// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerGnarkElGamalAdapters420.sol";
interface IPokerThresholdKeyAggregate420 {
    function verifyAggregate(uint256 scope,uint256[6] calldata points,
        bytes calldata proof)external view returns(bool);
}
contract PokerGnarkThresholdKeyAggregateAdapter420 is
    PokerGnarkVerifierBound420, IPokerThresholdKeyAggregate420 {
    bytes4 private constant SELECTOR=bytes4(keccak256("verifyProof(uint256[8],uint256[7])"));
    constructor(address actual,address registry,bytes32 version,bytes32 circuit,
        bytes32 keyHash,bytes32 schema,bytes32 thresholdKey)
        PokerGnarkVerifierBound420(actual,registry,version,circuit,keyHash,schema,thresholdKey){}
    function verifyAggregate(uint256 scope,uint256[6] calldata points,
        bytes calldata packed) external view returns(bool){
        if(scope==0||scope>=FR||packed.length!=480||
           keccak256(abi.encode(points[4],points[5]))!=thresholdKeyCommitment)
           return false;
        (uint256[8] memory proof,uint256[7] memory pub)=
            abi.decode(packed,(uint256[8],uint256[7]));
        if(pub[0]!=scope)return false;
        for(uint256 i=0;i<6;i++)if(pub[i+1]!=points[i])return false;
        for(uint256 i=0;i<7;i++)if(pub[i]>=FR)return false;
        return _safeVerify(abi.encodeWithSelector(SELECTOR,proof,pub));
    }
}
