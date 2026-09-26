// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeJobAcceptedMatch420.sol";
import "./IComputeAcceptedMatchRuntime420.sol";
import "./ComputeAuthorization420.sol";

/// @notice Signed verifier verdict primitive. For production, deploy the policy-enforced subclass.
/// @dev Signatures and distinct wallet addresses alone do not prove beneficial-owner independence.
contract ComputeJobIndependentVerification420 is IComputeJobVerificationEvidence420 {
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant VERDICT_TYPEHASH = keccak256("ComputeVerdict(bytes32 jobId,bytes32 requestId,bytes32 manifestHash,bytes32 matchId,bytes32 assignmentRef,bytes32 resultCommitment,address verifier,bytes32 profileId,bool approved,uint64 expectedRevision,uint64 expiry,uint256 nonce)");
    bytes32 private constant NAME_HASH = keccak256("420 Compute Verification");
    bytes32 private constant VERSION_HASH = keccak256("1");
    bytes4 private constant ERC1271_MAGIC = 0x1626ba7e;
    uint256 private constant SECP256K1_HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    struct Verdict {
        bytes32 jobId;
        bytes32 requestId;
        bytes32 manifestHash;
        bytes32 matchId;
        bytes32 assignmentRef;
        bytes32 resultCommitment;
        address verifier;
        bytes32 profileId;
        bool approved;
        uint64 expectedRevision;
        uint64 expiry;
        uint256 nonce;
    }
    struct Decision {
        bytes32 jobId;
        bytes32 resultCommitment;
        address verifier;
        bytes32 profileId;
        bool approved;
        bool exists;
    }

    ComputeJobRegistry420 public jobs;
    IComputeAcceptedMatchRuntime420 public immutable matches;
    ComputeAuthorization420 public immutable authorization;
    address public immutable bindingAdmin;
    mapping(bytes32 => bool) public approvedProfile;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => bytes32) public decisionForJob;
    mapping(bytes32 => Decision) private _decisions;

    error InvalidEvidence();
    error Unauthorized();
    error InvalidSignature();
    event ProfileApproved(bytes32 indexed profileId, bool approved);
    event VerificationRecorded(bytes32 indexed jobId, bytes32 indexed decisionRef, address indexed verifier,
        bytes32 profileId, bool approved);

    constructor(address matches_, address authorization_) {
        if (matches_.code.length == 0 || authorization_.code.length == 0) revert InvalidEvidence();
        matches = IComputeAcceptedMatchRuntime420(matches_);
        authorization = ComputeAuthorization420(authorization_);
        bindingAdmin = msg.sender;
    }

    function bindJobs(address jobs_) external {
        if (msg.sender != bindingAdmin || address(jobs) != address(0) || jobs_.code.length == 0)
            revert Unauthorized();
        ComputeJobRegistry420 candidate = ComputeJobRegistry420(jobs_);
        if (address(candidate.verificationEvidence()) != address(this)
            || address(candidate.matchEvidence()) != address(matches)
            || matches.jobs() != jobs_) revert InvalidEvidence();
        jobs = candidate;
    }

    function setApprovedProfile(bytes32 profileId, bool approved) external {
        if (msg.sender != bindingAdmin) revert Unauthorized();
        if (profileId == bytes32(0)) revert InvalidEvidence();
        approvedProfile[profileId] = approved;
        emit ProfileApproved(profileId, approved);
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function verdictDigest(Verdict calldata v) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(VERDICT_TYPEHASH, v.jobId, v.requestId,
            v.manifestHash, v.matchId, v.assignmentRef, v.resultCommitment,
            v.verifier, v.profileId, v.approved, v.expectedRevision, v.expiry, v.nonce));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    /// @notice Production subclass MUST enforce canonical-controller appointment before this transition.
    function submitVerdict(Verdict calldata v, bytes calldata signature)
        public virtual returns (bytes32 decisionRef) {
        if (address(jobs) == address(0) || v.verifier == address(0)
            || v.profileId == bytes32(0) || !approvedProfile[v.profileId]
            || v.expiry < block.timestamp || usedNonce[v.verifier][v.nonce]
            || decisionForJob[v.jobId] != bytes32(0)) revert InvalidEvidence();
        ComputeJobRegistry420.Job memory j = jobs.job(v.jobId);
        if (j.status != ComputeJobRegistry420.Status.RESULT_COMMITTED
            || j.revision != v.expectedRevision || j.requestId != v.requestId
            || j.manifestHash != v.manifestHash || j.matchId != v.matchId
            || j.assignmentRef != v.assignmentRef || j.resultCommitment != v.resultCommitment
            || v.resultCommitment == bytes32(0) || j.owner == v.verifier || j.worker == v.verifier)
            revert InvalidEvidence();
        (bytes32 matchJobId, address matchOwner, address matchOperator, bool matchExists) =
            matches.matchParties(v.matchId);
        if (!matchExists || matchJobId != v.jobId || matchOperator == v.verifier
            || matchOwner == v.verifier) revert Unauthorized();
        if (!authorization.isAuthorized(v.verifier, authorization.ACTION_VERIFY_RESULT(),
            authorization.scopeJob(v.jobId), 0)) revert Unauthorized();
        decisionRef = verdictDigest(v);
        if (!_validSignature(v.verifier, decisionRef, signature)) revert InvalidSignature();
        usedNonce[v.verifier][v.nonce] = true;
        decisionForJob[v.jobId] = decisionRef;
        _decisions[decisionRef] = Decision(v.jobId, v.resultCommitment, v.verifier,
            v.profileId, v.approved, true);
        jobs.recordVerification(v.jobId, v.expectedRevision, v.verifier, decisionRef, v.approved);
        emit VerificationRecorded(v.jobId, decisionRef, v.verifier, v.profileId, v.approved);
    }

    function verified(bytes32 jobId, bytes32 resultCommitment, address verifier, bytes32 decisionRef,
        bool approved) external view returns (bool) {
        Decision storage d = _decisions[decisionRef];
        return d.exists && decisionForJob[jobId] == decisionRef && d.jobId == jobId
            && d.resultCommitment == resultCommitment && d.verifier == verifier
            && d.approved == approved && approvedProfile[d.profileId];
    }

    function decision(bytes32 decisionRef) external view returns (Decision memory d) {
        d = _decisions[decisionRef];
        if (!d.exists) revert InvalidEvidence();
    }

    function _validSignature(address signer, bytes32 digest, bytes calldata signature)
        private view returns (bool) {
        if (signer.code.length != 0) {
            (bool success, bytes memory result) = signer.staticcall(
                abi.encodeWithSelector(ERC1271_MAGIC, digest, signature));
            return success && result.length >= 32 && abi.decode(result, (bytes4)) == ERC1271_MAGIC;
        }
        if (signature.length != 65) return false;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v != 27 && v != 28) return false;
        if (uint256(s) == 0 || uint256(s) > SECP256K1_HALF_N || r == bytes32(0)) return false;
        return ecrecover(digest, v, r, s) == signer;
    }
}
