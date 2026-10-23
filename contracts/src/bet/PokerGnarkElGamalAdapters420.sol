// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerPrivateShuffleGate420.sol";
import "./PokerVerifierVersions420.sol";

/// @notice Adapters for *actual gnark BN254 Groth16 Solidity verifiers*.
/// @dev Proof bytes are ABI-encoded (uint256[8] proof,uint256[N] publicInputs).
///      The generated VK must be deployed, codehash-pinned and governance-vetted.
///      A mock returning true is not a cryptographic proof verifier.
abstract contract PokerGnarkVerifierBound420 {
    uint256 internal constant FR=
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    address public immutable groth16Verifier;
    PokerVerifierVersions420 public immutable versions;
    bytes32 public immutable versionId;
    bytes32 public immutable circuitHash;
    bytes32 public immutable verifyingKeyHash;
    bytes32 public immutable schemaHash;
    bytes32 public immutable thresholdKeyCommitment;
    bytes32 public immutable verifierRuntimeHash;
    error InvalidConfiguration();
    constructor(address actual_,address registry_,bytes32 version_,bytes32 circuit_,
        bytes32 keyHash_,bytes32 schema_,bytes32 thresholdKey_) {
        if(actual_==address(0)||registry_==address(0)||actual_.code.length==0||
            version_==bytes32(0)||circuit_==bytes32(0)||keyHash_==bytes32(0)||
            schema_==bytes32(0)||thresholdKey_==bytes32(0))
            revert InvalidConfiguration();
        PokerVerifierVersions420 source=PokerVerifierVersions420(registry_);
        if(!source.matches(version_,actual_,keyHash_,circuit_,schema_))
            revert InvalidConfiguration();
        groth16Verifier=actual_;versions=source;
        versionId=version_;circuitHash=circuit_;verifyingKeyHash=keyHash_;
        schemaHash=schema_;thresholdKeyCommitment=thresholdKey_;
        verifierRuntimeHash=actual_.codehash;
    }
    function _safeVerify(bytes memory encoded) internal view returns(bool){
        if(groth16Verifier.codehash!=verifierRuntimeHash ||
           !versions.matches(versionId,groth16Verifier,verifyingKeyHash,circuitHash,schemaHash))
            return false;
        (bool success,bytes memory result)=groth16Verifier.staticcall(encoded);
        if(!success)return false;
        if(result.length==0)return true; // gnark generated verifier reverts on invalid proof
        if(result.length==32)return abi.decode(result,(bool));
        return false;
    }
    function _publicKeyMatches(uint256 x,uint256 y) internal view returns(bool){
        return x<FR && y<FR &&
            keccak256(abi.encode(x,y))==thresholdKeyCommitment;
    }
    function _scope(bytes32 handId) internal pure returns(uint256){
        return uint256(handId)%FR;
    }
}

/// @notice Actual 52-card two-stage MiMC-root ElGamal permutation proof bridge.
/// The Groth16 verifier MUST be generated from the exact Reencrypt52 circuit
/// whose five public values are [inputRoot,outputRoot,handScope,pkX,pkY].
contract PokerGnarkShuffle52Adapter420 is PokerGnarkVerifierBound420,IPokerShuffleProofVerifier420 {
    bytes4 private constant SELECTOR=bytes4(keccak256("verifyProof(uint256[8],uint256[6])"));
    constructor(address actual_,address registry_,bytes32 version_,bytes32 circuit_,
        bytes32 keyHash_,bytes32 schema_,bytes32 thresholdKey_)
        PokerGnarkVerifierBound420(actual_,registry_,version_,circuit_,keyHash_,schema_,thresholdKey_) {}
    function verifyShuffleProof(bytes32 statementHash,bytes32 handId,bytes32 inputRoot,
        bytes32 outputRoot,bytes32 thresholdKey,bytes calldata packedProof)
        external view returns(bool){
        if(statementHash==bytes32(0)||handId==bytes32(0)||
           thresholdKey!=thresholdKeyCommitment||packedProof.length!=448)return false;
        (uint256[8] memory proof,uint256[6] memory input)=
            abi.decode(packedProof,(uint256[8],uint256[6]));
        if(input[0]!=uint256(inputRoot)||input[1]!=uint256(statementHash)%FR||
           input[2]!=uint256(outputRoot)||input[3]!=_scope(handId)||
           !_publicKeyMatches(input[4],input[5]))return false;
        for(uint256 i=0;i<6;i++)if(input[i]>=FR)return false;
        return _safeVerify(abi.encodeWithSelector(SELECTOR,proof,input));
    }
}

/// @notice Initial encrypted 52-card correctness proof bridge.
/// Public inputs: [initialDeckRoot,handScope,pkX,pkY].
contract PokerGnarkInitial52Adapter420 is PokerGnarkVerifierBound420,IPokerInitialDeckProof420 {
    bytes4 private constant SELECTOR=bytes4(keccak256("verifyProof(uint256[8],uint256[5])"));
    constructor(address actual_,address registry_,bytes32 version_,bytes32 circuit_,
        bytes32 keyHash_,bytes32 schema_,bytes32 thresholdKey_)
        PokerGnarkVerifierBound420(actual_,registry_,version_,circuit_,keyHash_,schema_,thresholdKey_) {}
    function verifyInitialDeck(bytes32 statementHash,bytes32 handId,bytes32 deckRoot,
        bytes32 thresholdKey,bytes calldata packedProof) external view returns(bool) {
        if(statementHash==bytes32(0)||handId==bytes32(0)||
           thresholdKey!=thresholdKeyCommitment||packedProof.length!=416)return false;
        (uint256[8] memory proof,uint256[5] memory input)=
            abi.decode(packedProof,(uint256[8],uint256[5]));
        if(input[0]!=uint256(deckRoot)||input[1]!=uint256(statementHash)%FR||
           input[2]!=_scope(handId)||!_publicKeyMatches(input[3],input[4]))return false;
        for(uint256 i=0;i<5;i++)if(input[i]>=FR)return false;
        return _safeVerify(abi.encodeWithSelector(SELECTOR,proof,input));
    }
}
