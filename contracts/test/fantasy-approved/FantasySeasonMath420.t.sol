// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/fantasy/FantasySeasonMath420.sol";

contract FantasySeasonMath420Test{
    FantasySeasonMath420 private math;
    function setUp() public{math=new FantasySeasonMath420();}
    function _slot(uint8 i) private pure returns(uint8){return i==0?16:i==1?1:i==2?2:i==3?4:i<6?8:15;}
    function _brute(uint8[8] memory masks,uint8 slot,uint16 used) private pure returns(bool){
        if(slot==7)return true;
        for(uint8 i;i<8;i++)if(used&(uint16(1)<<i)==0&&masks[i]&_slot(slot)!=0&&_brute(masks,slot+1,used|(uint16(1)<<i)))return true;
        return false;
    }
    function testFuzz_HallMatchesIndependentAssignmentSearch(uint256 seed) public view{
        uint8[9] memory options=[uint8(1),2,4,8,16,3,9,6,15];uint8[8] memory masks;uint16[32] memory counts;
        for(uint8 i;i<8;i++){seed=uint256(keccak256(abi.encode(seed,i)));masks[i]=options[seed%9];counts[masks[i]]++;}
        require((math.deficiency(counts,127)==0)==_brute(masks,0,0),"Hall/matching disagreement");
    }
    function test_TwoDefenseSlotsNeedTwoDistinctAthletes() public view{
        uint16[32] memory counts;counts[1]=2;counts[2]=1;counts[4]=1;counts[8]=1;counts[16]=1;
        require(math.deficiency(counts,127)==1,"missing defender accepted");counts[8]++;require(math.deficiency(counts,127)==0,"legal roster rejected");
    }
    function test_DualPositionsDoNotDoubleCountAnAthlete() public view{
        uint16[32] memory counts;counts[15]=1;counts[16]=1;require(math.deficiency(counts,127)==5,"dual eligibility duplicated athlete");
    }
    function test_SharedGoalieCannotFillSeveralManagers() public view{
        uint16[32][] memory owned=new uint16[32][](4);uint16[32] memory free;
        for(uint8 m;m<4;m++){owned[m][1]=2;owned[m][2]=1;owned[m][4]=1;owned[m][8]=2;}
        free[16]=3;require(!math.leagueFeasible(owned,free),"shared goalie counted repeatedly");
        free[16]=4;require(math.leagueFeasible(owned,free),"four distinct goalies rejected");
    }
    function _augment(uint8 slot_,uint8[16] memory masks,uint8[16] memory belongs,uint8[16] memory assigned,uint16 seen) private pure returns(bool){
        uint8 m=slot_/7+1;uint8 need=_slot(slot_%7);
        for(uint8 a;a<16;a++)if(seen&(uint16(1)<<a)==0&&(belongs[a]==0||belongs[a]==m)&&masks[a]&need!=0){
            uint16 next=seen|(uint16(1)<<a);
            if(assigned[a]==0||_augment(assigned[a]-1,masks,belongs,assigned,next)){assigned[a]=slot_+1;return true;}
        }
        return false;
    }
    function testFuzz_LeagueHallMatchesIndependentAugmentingPaths(uint256 seed) public view{
        uint8[9] memory options=[uint8(1),2,4,8,16,3,9,6,15];uint8[16] memory masks;uint8[16] memory belongs;uint8[16] memory assigned;
        uint16[32][] memory owned=new uint16[32][](2);uint16[32] memory free;
        for(uint8 a;a<16;a++){
            seed=uint256(keccak256(abi.encode(seed,a)));masks[a]=options[seed%9];belongs[a]=uint8((seed/9)%3);
            if(belongs[a]==0)free[masks[a]]++;else owned[belongs[a]-1][masks[a]]++;
        }
        bool possible=true;for(uint8 slot_;slot_<14;slot_++)if(!_augment(slot_,masks,belongs,assigned,0)){possible=false;break;}
        require(math.leagueFeasible(owned,free)==possible,"league Hall/independent matching disagreement");
    }
    function test_TwelveManagerSupplyAndGasBoundary() public view{
        uint16[32][] memory owned=new uint16[32][](12);uint16[32] memory free;
        free[1]=24;free[2]=12;free[4]=12;free[8]=24;free[16]=12;
        uint256 beforeGas=gasleft();require(math.leagueFeasible(owned,free),"twelve legal teams rejected");
        require(beforeGas-gasleft()<8000000,"matching exceeds normal transaction budget");
        free[8]--;require(!math.leagueFeasible(owned,free),"twelve-team defender shortage accepted");
    }
    function test_CanonicalShuffleIsAFullPermutation() public view{
        uint256[] memory order=math.shuffle(keccak256("entropy"),keccak256("domain"),12);uint256 seen;
        for(uint256 i;i<order.length;i++){require(order[i]>0&&order[i]<=12,"out of range");uint256 bit=uint256(1)<<order[i];require(seen&bit==0,"duplicate member");seen|=bit;}
        uint256[] memory again=math.shuffle(keccak256("entropy"),keccak256("domain"),12);require(keccak256(abi.encode(order))==keccak256(abi.encode(again)),"nondeterministic");
    }
    function test_RealMerkleSiblingAndTamperRejection() public view{
        bytes32 a=keccak256("a");bytes32 b=keccak256("b");bytes32 root=a<b?keccak256(abi.encodePacked(a,b)):keccak256(abi.encodePacked(b,a));bytes32[] memory proof=new bytes32[](1);proof[0]=b;
        require(math.verify(root,a,proof),"actual proof rejected");require(!math.verify(root,keccak256("wrong"),proof),"fabricated proof accepted");
    }
    function test_EmptyCommitmentRejected() public view{
        bytes32[] memory proof=new bytes32[](0);require(!math.verify(bytes32(0),bytes32(0),proof),"zero commitment accepted");
    }
}
