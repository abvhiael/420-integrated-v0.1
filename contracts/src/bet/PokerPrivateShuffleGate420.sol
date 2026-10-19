// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerConfidentialDeal420.sol";
import "./PokerInitialEncryptedDeck420.sol";

/// @notice Proof-gated, transcript-bound two-party re-encryption shuffle pipeline.
/// @dev Fail-closed integration seam. The external verifier MUST independently validate a
///      sound zero-knowledge proof of a correct permutation AND rerandomization of 52
///      encrypted cards under the committed threshold public key. Never use a mock verifier
///      for live use. No card plaintext or secret shuffle permutation enters calldata.
interface IPokerShuffleProofVerifier420 {
    function verifyShuffleProof(
        bytes32 statementHash, bytes calldata proof
    ) external view returns (bool);
}

contract PokerPrivateShuffleGate420 {
    bytes32 public constant SHUFFLE_DOMAIN=keccak256("420.BET.POKER.ZK.REENCRYPTION.SHUFFLE.V1");
    PokerConfidentialDeal420 public immutable deals;
    PokerInitialEncryptedDeck420 public immutable initialDeck;
    IPokerShuffleProofVerifier420 public immutable verifier;
    bytes32 public immutable circuitId;
    bytes32 public immutable thresholdKeyCommitment;
    struct Record {
        bytes32 initialDeckRoot;
        bytes32 firstDeckRoot;
        bytes32 finalDeckRoot;
        bytes32 stageOneProofHash;
        bytes32 stageTwoProofHash;
        uint8 stage;
    }
    mapping(bytes32=>Record) private records;
    error InvalidConfiguration(); error InvalidState(); error Unauthorized();
    error InvalidProof(); error WrongStage();
    event ShuffleStageVerified(bytes32 indexed handId,uint8 stage,bytes32 outputRoot,bytes32 proofHash);
    constructor(address deals_,address initialDeck_,address verifier_,bytes32 circuitId_,bytes32 keyCommitment_) {
        if(deals_==address(0)||initialDeck_==address(0)||verifier_==address(0)||verifier_.code.length==0||
            circuitId_==bytes32(0)||keyCommitment_==bytes32(0)) revert InvalidConfiguration();
        deals=PokerConfidentialDeal420(deals_);
        initialDeck=PokerInitialEncryptedDeck420(initialDeck_);
        if(address(initialDeck.deals())!=deals_ ||
           initialDeck.thresholdKeyCommitment()!=keyCommitment_)revert InvalidConfiguration();
        verifier=IPokerShuffleProofVerifier420(verifier_);
        circuitId=circuitId_;
        thresholdKeyCommitment=keyCommitment_;
    }
    function recordOf(bytes32 handId) external view returns(Record memory) {return records[handId];}
    function statement(bytes32 handId,uint8 stage,bytes32 inputRoot,bytes32 outputRoot)
        public view returns(bytes32) {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        return keccak256(abi.encode(SHUFFLE_DOMAIN,block.chainid,address(this),circuitId,
            thresholdKeyCommitment,handId,h.tableId,h.configHash,h.rulesetId,h.versionId,
            h.seatSnapshotHash,h.epoch,h.nonce,h.transcriptCommitment,stage,inputRoot,outputRoot));
    }
    /// @notice First shuffle input MUST be a publicly certified 52-unique-card encrypted
    ///         canonical initial deck, verified under the same circuit and threshold key.
    ///         This gate cannot certify that fact without the actual installed ZK verifier.
    function proveStage(bytes32 handId,uint8 stage,bytes32 inputRoot,bytes32 outputRoot,
        bytes calldata proof) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED) revert InvalidState();
        if(stage!=1&&stage!=2) revert WrongStage();
        if((stage==1&&msg.sender!=deals.providerA()) ||
            (stage==2&&msg.sender!=deals.providerB())) revert Unauthorized();
        if(!deals.authorization().isAuthorized(msg.sender,deals.ACTION_PROVIDER_COMMIT(),
            deals.authorization().scopeForTable(h.tableId),0)) revert Unauthorized();
        Record storage rec=records[handId];
        if(rec.stage!=stage-1) revert WrongStage();
        if(inputRoot==bytes32(0)||outputRoot==bytes32(0)||inputRoot==outputRoot||
           proof.length==0) revert InvalidProof();
        if(stage==1) {
            // Bind the initial ciphertext deck root to the hand's two-party transcript.
            if(inputRoot!=initialDeck.rootOf(handId)) revert InvalidProof();
        } else if(inputRoot!=rec.firstDeckRoot) revert InvalidProof();
        bytes32 digest=statement(handId,stage,inputRoot,outputRoot);
        if(!verifier.verifyShuffleProof(digest,proof)) revert InvalidProof();
        if(stage==1) {rec.initialDeckRoot=inputRoot;rec.firstDeckRoot=outputRoot;}
        else rec.finalDeckRoot=outputRoot;
        rec.stage=stage;
        if(stage==1) rec.stageOneProofHash=keccak256(proof);
        else rec.stageTwoProofHash=keccak256(proof);
        emit ShuffleStageVerified(handId,stage,outputRoot,keccak256(proof));
    }
    function isProofComplete(bytes32 handId) external view returns(bool){
        return records[handId].stage==2;
    }
}
