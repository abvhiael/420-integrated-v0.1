// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerGnarkElGamalAdapters420.sol";

/// @notice Actual BabyJubjub partial ElGamal decryption-share proof adapter.
/// Input schema (13 public Fr values) is fixed by PartialDecryptCircuit.
interface IPokerPartialShareProof420 {
    function verifyPartial(bytes32 handId,bytes32 deckRoot,uint8 position,uint8 street,
        uint8 holder,uint256[8] calldata points,bytes calldata proof) external view returns(bool);
}
contract PokerGnarkPartialShareAdapter420 is PokerGnarkVerifierBound420,IPokerPartialShareProof420 {
    bytes4 private constant SELECTOR=bytes4(keccak256("verifyProof(uint256[8],uint256[13])"));
    constructor(address verifier_,address registry_,bytes32 version_,bytes32 circuit_,
        bytes32 keyHash_,bytes32 schema_,bytes32 providerKey_)
        PokerGnarkVerifierBound420(verifier_,registry_,version_,circuit_,keyHash_,schema_,providerKey_) {}
    function verifyPartial(bytes32 handId,bytes32 deckRoot,uint8 position,uint8 street,uint8 holder,
        uint256[8] calldata points,bytes calldata packedProof) external view returns(bool){
        if(handId==bytes32(0)||deckRoot==bytes32(0)||position>=52||
           street>3||holder>1||packedProof.length!=672)return false;
        (uint256[8] memory proof,uint256[13] memory pub)=
            abi.decode(packedProof,(uint256[8],uint256[13]));
        if(pub[0]!=_scope(handId)||pub[1]!=uint256(deckRoot)||
           pub[2]!=points[2]||pub[3]!=points[3]||
           pub[4]!=position||pub[5]!=street||pub[6]!=holder||
           pub[7]!=points[0]||pub[8]!=points[1]||
           pub[9]!=points[4]||pub[10]!=points[5]||
           pub[11]!=points[6]||pub[12]!=points[7]||
           !_publicKeyMatches(points[4],points[5]))return false;
        for(uint256 i=0;i<13;i++)if(pub[i]>=FR)return false;
        return _safeVerify(abi.encodeWithSelector(SELECTOR,proof,pub));
    }
}

/// @notice Proves the exact 2-of-2 share combination yields a canonical card
/// and provider public keys aggregate to the pinned shuffle encryption key.
interface IPokerCardUnmaskProof420 {
    function verifyCard(bytes32 handId,bytes32 deckRoot,uint8 position,uint8 street,uint8 card,
        uint256[12] calldata points,bytes calldata proof) external view returns(bool);
}
contract PokerGnarkCardUnmaskAdapter420 is PokerGnarkVerifierBound420,IPokerCardUnmaskProof420 {
    bytes4 private constant SELECTOR=bytes4(keccak256("verifyProof(uint256[8],uint256[17])"));
    constructor(address verifier_,address registry_,bytes32 version_,bytes32 circuit_,
        bytes32 keyHash_,bytes32 schema_,bytes32 aggregateKey_)
        PokerGnarkVerifierBound420(verifier_,registry_,version_,circuit_,keyHash_,schema_,aggregateKey_) {}
    function verifyCard(bytes32 handId,bytes32 deckRoot,uint8 position,uint8 street,uint8 card,
        uint256[12] calldata points,bytes calldata packedProof) external view returns(bool){
        if(handId==bytes32(0)||deckRoot==bytes32(0)||position>=52||
            street>3||card>=52||packedProof.length!=800)return false;
        (uint256[8] memory proof,uint256[17] memory pub)=
            abi.decode(packedProof,(uint256[8],uint256[17]));
        if(pub[0]!=_scope(handId)||pub[1]!=uint256(deckRoot)||
           pub[2]!=position||pub[3]!=street||pub[4]!=card||
           !_publicKeyMatches(points[10],points[11]))return false;
        for(uint256 i=0;i<12;i++)if(pub[i+5]!=points[i])return false;
        for(uint256 i=0;i<17;i++)if(pub[i]>=FR)return false;
        return _safeVerify(abi.encodeWithSelector(SELECTOR,proof,pub));
    }
}
