// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerGnarkElGamalAdapters420.sol";

/// @notice Real, pinned Groth16 verification of an encrypted 2-of-2 provider
/// share against a ciphertext member of the already-accepted final deck.
/// The adapter checks every public input; the consumer MUST recheck
/// membership of the recipient/provider identities, canonical position
/// assignment, current key epoch, and exact authenticated envelope.
interface IPokerEncryptedShareDelivery420 {
    function verifyDelivery(bytes32 handId,bytes32 deckRoot,uint8 position,uint8 seat,
        uint8 provider,uint256 deliveryContext,uint256[12] calldata points,
        bytes calldata proof) external view returns(bool);
}
contract PokerGnarkEncryptedShareDeliveryAdapter420 is
    PokerGnarkVerifierBound420, IPokerEncryptedShareDelivery420 {
    // gnark public values in exact EncryptedShareDeliveryV1 declaration order:
    // scope,root,position,seat,provider,context,C1(2),C2(2),providerPK(2),
    // recipientPK(2),envelopeU(2),envelopeV(2).
    bytes4 private constant SELECTOR =
        bytes4(keccak256("verifyProof(uint256[8],uint256[18])"));
    constructor(address actual_,address registry_,bytes32 version_,bytes32 circuit_,
        bytes32 keyHash_,bytes32 schema_,bytes32 providerKey_)
        PokerGnarkVerifierBound420(actual_,registry_,version_,circuit_,keyHash_,schema_,providerKey_){}
    function verifyDelivery(bytes32 handId,bytes32 deckRoot,uint8 position,uint8 seat,
        uint8 provider,uint256 deliveryContext,uint256[12] calldata points,
        bytes calldata packedProof) external view returns(bool) {
        if(handId==bytes32(0)||deckRoot==bytes32(0)||position>=52||
            seat>=9||provider>1||deliveryContext==0||
            deliveryContext>=FR||packedProof.length!=832)return false;
        (uint256[8] memory proof,uint256[18] memory pub)=
            abi.decode(packedProof,(uint256[8],uint256[18]));
        if(pub[0]!=_scope(handId)||pub[1]!=uint256(deckRoot)||
            pub[2]!=position||pub[3]!=seat||pub[4]!=provider||
            pub[5]!=deliveryContext)return false;
        for(uint256 i=0;i<12;i++)if(pub[i+6]!=points[i])return false;
        if(keccak256(abi.encode(points[4],points[5]))!=thresholdKeyCommitment)
            return false;
        for(uint256 i=0;i<18;i++)if(pub[i]>=FR)return false;
        return _safeVerify(abi.encodeWithSelector(SELECTOR,proof,pub));
    }
}
