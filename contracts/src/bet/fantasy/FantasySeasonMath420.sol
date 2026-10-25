// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../randomness/RandomnessDraw420.sol";
/// @notice Hall matching conditions and canonical unbiased shuffle; no custody or authority.
contract FantasySeasonMath420{
    function slot(uint8 i) public pure returns(uint8){return i==0?1:i==1?2:i==2?4:i<5?8:i==5?16:15;}
    function deficiency(uint16[32] calldata counts,uint8 remainingSlots) public pure returns(uint256 maximum){
        // Hall's conditions can be grouped by the 31 position unions rather than
        // enumerating 127 slot subsets. Duplicate D slots still contribute twice.
        for(uint8 union=1;union<32;union++){
            uint256 demand;
            if(remainingSlots&1!=0&&union&1!=0)demand++;
            if(remainingSlots&2!=0&&union&2!=0)demand++;
            if(remainingSlots&4!=0&&union&4!=0)demand++;
            if(remainingSlots&8!=0&&union&8!=0)demand++;
            if(remainingSlots&16!=0&&union&8!=0)demand++;
            if(remainingSlots&32!=0&&union&16!=0)demand++;
            if(remainingSlots&64!=0&&union&15==15)demand++;
            uint256 neighbors;for(uint8 p=1;p<32;p++)if(p&union!=0)neighbors+=counts[p];
            if(demand>neighbors&&demand-neighbors>maximum)maximum=demand-neighbors;
        }
    }
    /// Hall conditions for all managers together. A shared free athlete cannot
    /// satisfy multiple managers, even when every roster is individually fillable.
    function leagueFeasible(uint16[32][] calldata owned,uint16[32] calldata free) external pure returns(bool){
        if(owned.length==0||owned.length>12)return false;
        uint256[32] memory need;
        for(uint256 m;m<owned.length;m++){
            uint256[32] memory missing;
            for(uint8 u=1;u<32;u++){
                uint256 demand=(u&1!=0?1:0)+(u&2!=0?1:0)+(u&4!=0?1:0)+(u&8!=0?2:0)+(u&16!=0?1:0)+(u&15==15?1:0);
                uint256 neighbors;for(uint8 p=1;p<32;p++)if(p&u!=0)neighbors+=owned[m][p];
                if(demand>neighbors)missing[u]=demand-neighbors;
            }
            // Maximum over sub-unions: each manager may have a different deficit.
            for(uint8 bit=1;bit<32;bit<<=1)for(uint8 u=1;u<32;u++)if(u&bit!=0&&missing[u^bit]>missing[u])missing[u]=missing[u^bit];
            for(uint8 u=1;u<32;u++)need[u]+=missing[u];
        }
        for(uint8 u=1;u<32;u++){
            uint256 neighbors;for(uint8 p=1;p<32;p++)if(p&u!=0)neighbors+=free[p];
            if(need[u]>neighbors)return false;
        }
        return true;
    }
    function shuffle(bytes32 entropy,bytes32 domain,uint8 count) external pure returns(uint256[] memory permutation){
        permutation=new uint256[](count);for(uint256 i;i<count;i++)permutation[i]=i+1;return RandomnessDraw420.shuffle(entropy,domain,0,permutation);
    }
    function verify(bytes32 root,bytes32 leaf,bytes32[] calldata proof) external pure returns(bool){
        if(proof.length>16)return false;for(uint256 i;i<proof.length;i++)leaf=leaf<proof[i]?keccak256(abi.encodePacked(leaf,proof[i])):keccak256(abi.encodePacked(proof[i],leaf));return leaf==root&&root!=0;
    }
}
