// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerPrivateShuffleGate420.sol";
import "./PokerVerifierVersions420.sol";

/// @dev A production verifier must prove ALL signed legal betting actions since
/// priorStateRoot, correct actor order, timeouts, all-ins, conservation and legal
/// conclusion of the street. Merely checking a supplied hash is NOT sufficient.
interface IPokerStreetRulesVerifier420 {
    function verifyStreet(bytes32 statement,bytes calldata proof) external view returns(bool);
}

/// @notice Canonical permissionless, proof-gated betting-street advancement.
/// @dev A sound on-chain verifier determines transitions, never a table operator.
contract PokerStreetProof420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.CANONICAL.STREET.V1");
    PokerPrivateShuffleGate420 public immutable shuffle;
    PokerVerifierVersions420 public immutable versions;
    IPokerStreetRulesVerifier420 public immutable verifier;
    bytes32 public immutable versionId;
    bytes32 public immutable circuitHash;
    bytes32 public immutable verifyingKeyHash;
    bytes32 public immutable schemaHash;
    struct State {uint8 nextStreet; bytes32 stateRoot; bytes32 transcriptRoot; bool initialized;}
    mapping(bytes32=>State) private states;
    error InvalidConfiguration();error InvalidState();error InvalidProof();error Duplicate();
    event StreetVerified(bytes32 indexed handId,uint8 indexed completedStreet,bytes32 nextStateRoot,bytes32 transcriptRoot);
    constructor(address shuffle_,address versions_,address verifier_,bytes32 version_,
        bytes32 circuit_,bytes32 keyHash_,bytes32 schema_) {
        if(shuffle_==address(0)||versions_==address(0)||verifier_==address(0)||
           verifier_.code.length==0||version_==bytes32(0)||circuit_==bytes32(0)||
           keyHash_==bytes32(0)||schema_==bytes32(0)) revert InvalidConfiguration();
        shuffle=PokerPrivateShuffleGate420(shuffle_);
        versions=PokerVerifierVersions420(versions_);
        verifier=IPokerStreetRulesVerifier420(verifier_);
        versionId=version_;circuitHash=circuit_;verifyingKeyHash=keyHash_;schemaHash=schema_;
        if(!versions.matches(version_,verifier_,keyHash_,circuit_,schema_))
            revert InvalidConfiguration();
    }
    function stateOf(bytes32 handId) external view returns(State memory){return states[handId];}
    function initialize(bytes32 handId,bytes32 initialStateRoot,bytes32 initialTranscriptRoot) external {
        if(states[handId].initialized)revert Duplicate();
        if(initialStateRoot==bytes32(0)||initialTranscriptRoot==bytes32(0)||
           !shuffle.isProofComplete(handId))revert InvalidState();
        // This initialization MUST be bound to an independently proved, locked
        // canonical seat snapshot. Until that proof exists, this component is
        // NOT safe for production street authorization.
        revert InvalidProof();
    }
    function submitStreet(bytes32 handId,uint8 street,bytes32 nextStateRoot,
        bytes32 nextTranscriptRoot,bytes calldata proof) external {
        State storage s=states[handId];
        if(!s.initialized || street!=s.nextStreet||street>3||
           nextStateRoot==bytes32(0)||nextTranscriptRoot==bytes32(0)||
           proof.length==0||!shuffle.isProofComplete(handId))revert InvalidState();
        PokerPrivateShuffleGate420.Record memory rec=shuffle.recordOf(handId);
        bytes32 statement=keccak256(abi.encode(DOMAIN,block.chainid,address(this),
            address(verifier),versionId,circuitHash,verifyingKeyHash,schemaHash,
            handId,rec.finalDeckRoot,street,s.stateRoot,s.transcriptRoot,
            nextStateRoot,nextTranscriptRoot));
        if(!verifier.verifyStreet(statement,proof))revert InvalidProof();
        s.nextStreet=street+1;s.stateRoot=nextStateRoot;
        s.transcriptRoot=nextTranscriptRoot;
        emit StreetVerified(handId,street,nextStateRoot,nextTranscriptRoot);
    }
    function canReveal(bytes32 handId,uint8 street) external view returns(bool){
        return states[handId].initialized && street!=0 && street<=3 &&
            states[handId].nextStreet>=street+1;
    }
}
