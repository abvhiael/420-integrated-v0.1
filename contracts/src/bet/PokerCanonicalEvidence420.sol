// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerConfidentialDeal420.sol";
import "./PokerPrivateShuffleGate420.sol";

/// @notice Independent on-chain acceptance of terminal rules proof.
/// @dev The proof verifier MUST verify the entire NLHE rules transition relation,
///      signed seat actions, authorized ciphertext openings, versioned rake policy,
///      computed pot/winner/payout vector and fund conservation.
///      This contract does NOT transfer chips. No legacy attestation substitutes for proof.
interface IPokerTerminalRulesProof420 {
    function verifyTerminal(bytes32 statement, bytes calldata proof) external view returns (bool);
}

/// @notice Permissionless proof submission. Only actual proof verification can finalize evidence.
/// @dev Test-only verifiers do not establish production soundness. A pinned independently
///      qualified full-deck shuffle verifier and NLHE verifier are prerequisites to deployment.
contract PokerCanonicalEvidence420 {
    bytes32 public constant EVIDENCE_DOMAIN = keccak256("420.BET.POKER.CANONICAL.EVIDENCE.V1");
    PokerConfidentialDeal420 public immutable deals;
    PokerPrivateShuffleGate420 public immutable shuffle;
    IPokerTerminalRulesProof420 public immutable rulesVerifier;
    bytes32 public immutable rulesCircuitId;
    bytes32 public immutable rulesVerifyingKeyHash;

    struct Accepted {
        bytes32 actionTranscriptRoot;
        bytes32 boardRevealRoot;
        bytes32 payoutVectorHash;
        bytes32 rakePolicyHash;
        bytes32 finalStateRoot;
        bytes32 proofHash;
        bool accepted;
    }
    mapping(bytes32 => Accepted) private evidence;
    error InvalidDependency(); error InvalidHand(); error MissingShuffle(); error InvalidProof(); error Duplicate();

    event CanonicalEvidenceAccepted(
        bytes32 indexed handId,bytes32 indexed finalStateRoot,bytes32 indexed payoutVectorHash,bytes32 proofHash
    );

    constructor(
        address deals_,address shuffle_,address rulesVerifier_,
        bytes32 circuitId_,bytes32 verifyingKeyHash_
    ) {
        if (deals_==address(0)||shuffle_==address(0)||rulesVerifier_==address(0)||
            rulesVerifier_.code.length==0||circuitId_==bytes32(0)||verifyingKeyHash_==bytes32(0))
            revert InvalidDependency();
        deals=PokerConfidentialDeal420(deals_);
        shuffle=PokerPrivateShuffleGate420(shuffle_);
        rulesVerifier=IPokerTerminalRulesProof420(rulesVerifier_);
        rulesCircuitId=circuitId_;
        rulesVerifyingKeyHash=verifyingKeyHash_;
        if(address(shuffle.deals())!=deals_)revert InvalidDependency();
    }

    function acceptedOf(bytes32 handId) external view returns(Accepted memory) {
        return evidence[handId];
    }

    function statement(
        bytes32 handId,bytes32 actionRoot,bytes32 boardRoot,bytes32 payoutHash,
        bytes32 rakePolicyHash,bytes32 finalStateRoot
    ) public view returns(bytes32) {
        PokerConfidentialDeal420.Hand memory hand=deals.getHand(handId);
        PokerPrivateShuffleGate420.Record memory record=shuffle.recordOf(handId);
        if(hand.state!=PokerConfidentialDeal420.State.COMMITTED ||
            record.stage!=2||record.finalDeckRoot==bytes32(0))revert MissingShuffle();
        PokerTableRegistry420.Table memory table=deals.tables().getTable(hand.tableId);
        if(table.configHash!=hand.configHash||table.config.rakePolicyHash!=rakePolicyHash)
            revert InvalidHand();
        return keccak256(abi.encode(
            EVIDENCE_DOMAIN,block.chainid,address(this),address(rulesVerifier),
            rulesCircuitId,rulesVerifyingKeyHash,handId,
            hand.tableId,hand.configHash,hand.rulesetId,hand.versionId,
            hand.seatSnapshotHash,hand.epoch,hand.nonce,hand.transcriptCommitment,
            record.finalDeckRoot,actionRoot,boardRoot,payoutHash,rakePolicyHash,finalStateRoot
        ));
    }

    /// @notice Any party can submit proof; no operator/adjudicator approval.
    /// @dev The proof must certify complete legal replay and payout computation.
    function submit(
        bytes32 handId,bytes32 actionRoot,bytes32 boardRoot,
        bytes32 payoutHash,bytes32 rakePolicyHash,bytes32 finalStateRoot,
        bytes calldata proof
    ) external {
        if(evidence[handId].accepted)revert Duplicate();
        if(actionRoot==bytes32(0)||boardRoot==bytes32(0)||payoutHash==bytes32(0)||
            rakePolicyHash==bytes32(0)||finalStateRoot==bytes32(0)||proof.length==0)
            revert InvalidProof();
        bytes32 digest=statement(handId,actionRoot,boardRoot,payoutHash,rakePolicyHash,finalStateRoot);
        if(!rulesVerifier.verifyTerminal(digest,proof))revert InvalidProof();
        evidence[handId]=Accepted(actionRoot,boardRoot,payoutHash,rakePolicyHash,
            finalStateRoot,keccak256(proof),true);
        emit CanonicalEvidenceAccepted(handId,finalStateRoot,payoutHash,keccak256(proof));
    }
}
