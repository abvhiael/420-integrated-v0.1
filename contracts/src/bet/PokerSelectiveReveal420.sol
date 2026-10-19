// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerPrivateShuffleGate420.sol";
import "./PokerVerifierVersions420.sol";

/// @notice Each submitted proof must certify one provider's partial decryption
/// D=s*C1 for an exact ciphertext in the proven final deck, with public key s*G.
/// The binding to the final ciphertext commitment MUST be enforced by this adapter.
/// Arbitrary boolean-returning contracts are invalid for production.
interface IPokerSelectiveShareProof420 {
    function verifyShare(
        bytes32 statement,bytes32 finalDeckRoot,bytes32 ciphertextCommitment,
        uint8 position,uint8 street,address provider,bytes32 shareCommitment,
        bytes calldata proof
    ) external view returns(bool);
}

/// @notice Permissionless, stage-scoped collection of two independently proved
/// partial shares. Does not reveal private card identities or authorize settlement.
contract PokerSelectiveReveal420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.SELECTIVE.SHARE.V1");
    PokerPrivateShuffleGate420 public immutable shuffle;
    PokerVerifierVersions420 public immutable versions;
    IPokerSelectiveShareProof420 public immutable verifier;
    bytes32 public immutable verifierVersion;
    bytes32 public immutable circuitHash;
    bytes32 public immutable verifyingKeyHash;
    bytes32 public immutable schemaHash;

    struct Opening {
        bytes32 ciphertextCommitment;
        bytes32 shareA;
        bytes32 shareB;
        bool completed;
    }
    mapping(bytes32=>mapping(uint8=>Opening)) private openings;
    mapping(bytes32=>uint8) public currentStreet;

    error InvalidConfiguration();error InvalidState();error Unauthorized();error Duplicate();error InvalidProof();
    event ShareAccepted(bytes32 indexed handId,uint8 indexed position,address indexed provider,bytes32 share);
    event PositionSharesComplete(bytes32 indexed handId,uint8 indexed position,bytes32 commitment);
    event StreetAdvanced(bytes32 indexed handId,uint8 street);

    constructor(address shuffle_,address versions_,address verifier_,bytes32 version_,
        bytes32 circuit_,bytes32 keyHash_,bytes32 schema_) {
        if(shuffle_==address(0)||versions_==address(0)||verifier_==address(0)||
            verifier_.code.length==0||version_==bytes32(0)||circuit_==bytes32(0)||
            keyHash_==bytes32(0)||schema_==bytes32(0))revert InvalidConfiguration();
        shuffle=PokerPrivateShuffleGate420(shuffle_);
        versions=PokerVerifierVersions420(versions_);
        verifier=IPokerSelectiveShareProof420(verifier_);
        verifierVersion=version_;circuitHash=circuit_;verifyingKeyHash=keyHash_;schemaHash=schema_;
        if(!versions.matches(version_,verifier_,keyHash_,circuit_,schema_))
            revert InvalidConfiguration();
    }

    function openingOf(bytes32 handId,uint8 position) external view returns(Opening memory){
        return openings[handId][position];
    }
    function statement(bytes32 handId,uint8 position,uint8 street,
        address provider,bytes32 ciphertextCommitment,bytes32 shareCommitment)
        public view returns(bytes32) {
        PokerPrivateShuffleGate420.Record memory rec=shuffle.recordOf(handId);
        if(rec.stage!=2 || rec.finalDeckRoot==bytes32(0))revert InvalidState();
        return keccak256(abi.encode(DOMAIN,block.chainid,address(this),address(verifier),
            verifierVersion,circuitHash,verifyingKeyHash,schemaHash,
            handId,shuffle.thresholdKeyCommitment(),rec.finalDeckRoot,
            position,street,provider,ciphertextCommitment,shareCommitment));
    }
    /// @dev Only board positions 2*N+1..2*N+8 should be revealed by a
    /// canonical, independently proved betting-street state machine.
    /// This contract deliberately does not infer the street from an operator hash.
    function submitShare(bytes32 handId,uint8 position,uint8 street,
        bytes32 ciphertextCommitment,bytes32 shareCommitment,bytes calldata proof) external {
        if(position>=52||street>3||street!=currentStreet[handId]||
            ciphertextCommitment==bytes32(0)||shareCommitment==bytes32(0)||proof.length==0)
            revert InvalidState();
        address a=shuffle.deals().providerA();
        address b=shuffle.deals().providerB();
        if(msg.sender!=a && msg.sender!=b)revert Unauthorized();
        Opening storage o=openings[handId][position];
        if(o.completed)revert Duplicate();
        if(o.ciphertextCommitment!=bytes32(0)&&o.ciphertextCommitment!=ciphertextCommitment)
            revert InvalidProof();
        if((msg.sender==a&&o.shareA!=bytes32(0))||
           (msg.sender==b&&o.shareB!=bytes32(0)))revert Duplicate();
        bytes32 digest=statement(handId,position,street,msg.sender,ciphertextCommitment,shareCommitment);
        if(!verifier.verifyShare(digest,shuffle.recordOf(handId).finalDeckRoot,
            ciphertextCommitment,position,street,msg.sender,shareCommitment,proof))
            revert InvalidProof();
        o.ciphertextCommitment=ciphertextCommitment;
        if(msg.sender==a)o.shareA=shareCommitment;
        else o.shareB=shareCommitment;
        emit ShareAccepted(handId,position,msg.sender,shareCommitment);
        if(o.shareA!=bytes32(0)&&o.shareB!=bytes32(0)){
            o.completed=true;
            emit PositionSharesComplete(handId,position,ciphertextCommitment);
        }
    }
}
