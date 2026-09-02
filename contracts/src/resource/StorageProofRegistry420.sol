// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceIds420.sol";
import "./ResourceNodeRegistry420.sol";
import "./StorageCommitmentRegistry420.sol";
import "./StorageProofSchemeRegistry420.sol";
import "./IStorageProofVerifier420.sol";

contract StorageProofRegistry420 is I420System {
    uint256 public constant MAX_PROOF_BYTES = 65_536;

    struct ProofReceipt {
        bytes32 commitmentId;
        bytes32 challengeId;
        bytes32 proofDigest;
        uint64 challengeEpoch;
        uint64 submittedAt;
        bool exists;
    }

    StorageCommitmentRegistry420 public immutable commitments;
    StorageProofSchemeRegistry420 public immutable schemes;
    ResourceNodeRegistry420 public immutable nodes;

    mapping(bytes32 => ProofReceipt) private _proofs;
    mapping(bytes32 => mapping(bytes32 => bool)) public challengeConsumed;
    uint256 private _entered;

    error ZeroAddress();
    error InvalidProof();
    error ProofExists();
    error ChallengeReplayed();
    error ChallengeOutsideCommitment();
    error ProofTooEarly();
    error ProofTooLate();
    error InactiveStoreNode();
    error InactiveProofScheme();
    error VerificationFailed();
    error Reentrancy();

    event StorageProofAccepted(bytes32 indexed proofId, bytes32 indexed commitmentId, bytes32 indexed challengeId, bytes32 proofDigest, uint64 challengeEpoch, uint64 submittedAt);

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    constructor(address commitments_, address schemes_, address nodes_) {
        if (commitments_ == address(0) || schemes_ == address(0) || nodes_ == address(0)) revert ZeroAddress();
        commitments = StorageCommitmentRegistry420(commitments_);
        schemes = StorageProofSchemeRegistry420(schemes_);
        nodes = ResourceNodeRegistry420(nodes_);
    }

    function systemName() external pure returns (string memory) { return "StorageProofRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalProofId(bytes32 commitmentId, bytes32 challengeId, bytes32 proofDigest) public pure returns (bytes32) {
        return keccak256(abi.encode("420/STORAGE/PROOF_RECEIPT/V1", commitmentId, challengeId, proofDigest));
    }

    function submitProof(bytes32 commitmentId, bytes32 challengeId, uint64 challengeEpoch, bytes calldata proof) external nonReentrant returns (bytes32 proofId) {
        if (commitmentId == bytes32(0) || challengeId == bytes32(0) || challengeEpoch == 0 || proof.length == 0 || proof.length > MAX_PROOF_BYTES) revert InvalidProof();
        if (challengeConsumed[commitmentId][challengeId]) revert ChallengeReplayed();

        StorageCommitmentRegistry420.Commitment memory commitment = commitments.getCommitment(commitmentId);
        if (challengeEpoch < commitment.startTime || challengeEpoch > commitment.endTime) revert ChallengeOutsideCommitment();
        if (block.timestamp < challengeEpoch) revert ProofTooEarly();
        if (!nodes.isActiveFor(commitment.nodeId, ResourceIds420.SERVICE_STORE)) revert InactiveStoreNode();

        StorageProofSchemeRegistry420.Scheme memory scheme = schemes.getScheme(commitment.proofSchemeId);
        if (!scheme.active) revert InactiveProofScheme();
        if (block.timestamp > uint256(challengeEpoch) + uint256(scheme.maxProofDelay)) revert ProofTooLate();

        bytes32 proofDigest = keccak256(proof);
        proofId = canonicalProofId(commitmentId, challengeId, proofDigest);
        if (_proofs[proofId].exists) revert ProofExists();

        challengeConsumed[commitmentId][challengeId] = true;
        bool verified;
        try IStorageProofVerifier420(scheme.verifier).verifyStorageProof(
            commitment.proofSchemeId,
            commitmentId,
            commitment.providerId,
            commitment.nodeId,
            commitment.contentRoot,
            commitment.replicaRoot,
            challengeId,
            challengeEpoch,
            proof
        ) returns (bool ok) {
            verified = ok;
        } catch {
            revert VerificationFailed();
        }
        if (!verified) revert VerificationFailed();

        _proofs[proofId] = ProofReceipt(commitmentId, challengeId, proofDigest, challengeEpoch, uint64(block.timestamp), true);
        emit StorageProofAccepted(proofId, commitmentId, challengeId, proofDigest, challengeEpoch, uint64(block.timestamp));
    }

    function getProof(bytes32 proofId) external view returns (ProofReceipt memory receipt) {
        receipt = _proofs[proofId];
        if (!receipt.exists) revert InvalidProof();
    }

    function hasVerifiedChallenge(bytes32 commitmentId, bytes32 challengeId) external view returns (bool) {
        return challengeConsumed[commitmentId][challengeId];
    }
}
