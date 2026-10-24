// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/PokerPotMath420.sol";
import "../src/bet/PokerHandRank420.sol";
import "./PokerEvaluationVectors56.sol";

contract PokerPotHarness56 {
    function award(uint256[9] memory c,bool[9] memory f,uint256[9] memory r,
        uint8 b,uint256 fee,uint256 gross) external pure returns(uint256[9] memory paid){
        PokerPotMath420.award(c,f,r,b,fee,gross,paid);
    }
    function portion(uint256 a,uint256 n,uint256 d)external pure returns(uint256){
        return PokerPotMath420.portion(a,n,d);
    }
}
interface VmEvaluation56 {function expectRevert(bytes4)external;}
contract PokerEvaluation56Test {
    PokerPotHarness56 pot=new PokerPotHarness56();
    PokerHandRank420 ranker=new PokerHandRank420();
    VmEvaluation56 constant vm=VmEvaluation56(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testNineTierRakeRemainderCannotDeadlockSettlement()public view {
        uint256[9] memory c=[uint256(10),11,12,13,14,15,16,17,17];
        uint256[9] memory r=[uint256(9),8,7,6,5,4,3,2,1];bool[9] memory f;
        for(uint256 fee=0;fee<=125;fee++){
            uint256[9] memory paid=pot.award(c,f,r,8,fee,125);
            uint256 sum=fee;for(uint8 i=0;i<9;i++)sum+=paid[i];
            require(sum==125,"every permitted rake amount conserves");
        }
    }
    function testSparseSeatsSplitEachPotAndAssignOddChipsClockwise()public view {
        uint256[9] memory c;c[0]=5;c[4]=5;c[8]=5;
        uint256[9] memory r;r[0]=100;r[8]=100;r[4]=999;
        bool[9] memory f;f[4]=true;
        uint256[9] memory paid=pot.award(c,f,r,4,0,15);
        require(paid[8]==8&&paid[0]==7&&paid[4]==0,"physical sparse seat order");
    }
    function testNineDifferentAllInLevelsSelectOnlyCoveredWinners()public view {
        uint256[9] memory c=[uint256(1),2,3,4,5,6,7,8,8];
        uint256[9] memory r=[uint256(9),8,7,6,5,4,3,2,1];bool[9] memory f;
        uint256[9] memory paid=pot.award(c,f,r,0,0,44);
        for(uint8 i=0;i<8;i++)require(paid[i]==9-i,"each short stack wins its covered tier");
        require(paid[8]==0,"deep loser cannot take short stack pot");
    }
    function testInvalidGrossButtonFeeAndWinnerRejected()public {
        uint256[9] memory c;c[0]=5;c[1]=5;uint256[9] memory r;bool[9] memory f;
        vm.expectRevert(PokerPotMath420.InvalidPot.selector);pot.award(c,f,r,0,0,11);
        vm.expectRevert(PokerPotMath420.InvalidPot.selector);pot.award(c,f,r,9,0,10);
        vm.expectRevert(PokerPotMath420.InvalidPot.selector);pot.award(c,f,r,0,11,10);
        f[0]=true;f[1]=true;
        vm.expectRevert(PokerPotMath420.InvalidPot.selector);pot.award(c,f,r,0,0,10);
    }
    function testFullWidthPotAndExactRakeDoNotOverflow()public view {
        uint256 max=type(uint256).max;
        require(pot.portion(max-1,max-1,max)==max-2,"512 bit intermediate");
        require(pot.portion(max,max,max)==max,"full charge");
        require(pot.portion(max,700,10000)==(max/10000)*700+((max%10000)*700)/10000,
            "full width canonical rake");
        uint256[9] memory c;c[0]=max/2;c[1]=max/2;
        uint256[9] memory r;r[0]=1;bool[9] memory f;
        uint256[9] memory paid=pot.award(c,f,r,0,max-1,max-1);
        require(paid[0]==0&&paid[1]==0,"full rake exact");
    }
    function testTwoTripsThreePairsAndBoardOnlyBestFive()public view {
        uint8[7] memory trips=[uint8(12),25,38,11,24,37,0];
        uint8[5] memory full=[uint8(12),25,38,11,24];
        require(ranker.rank7(trips)==ranker.rank5(full),"higher trips make full house");
        uint8[7] memory pairs=[uint8(12),25,11,24,10,23,9];
        uint8[5] memory two=[uint8(12),25,11,24,10];
        require(ranker.rank7(pairs)==ranker.rank5(two),"third pair supplies kicker");
        uint8[7] memory boardA=[uint8(0),14,8,9,10,11,12];
        uint8[7] memory boardB=[uint8(2),16,8,9,10,11,12];
        require(ranker.rank7(boardA)==ranker.rank7(boardB),"board royal ties");
    }
    function testEveryHandCategoryHasCanonicalOrdering()public view {
        uint8[5][9] memory cards=[
            [uint8(12),24,36,48,7], [uint8(12),25,11,10,8],
            [uint8(12),25,11,24,10], [uint8(12),25,38,11,10],
            [uint8(12),13,27,41,3], [uint8(12),10,8,6,4],
            [uint8(12),25,38,11,24], [uint8(12),25,38,51,11],
            [uint8(12),11,10,9,8]
        ];
        uint256 prior=0;
        for(uint8 category=0;category<9;category++){
            uint256 score=ranker.rank5(cards[category]);
            require(score/759375==category&&score>prior,"canonical ordered category");
            prior=score;
        }
    }
    function testFuzzProportionalChargeBounds(uint128 a,uint128 n,uint128 d)public view {
        uint256 denominator=uint256(d)+1;
        uint256 amount=uint256(a)%denominator;
        uint256 numerator=uint256(n)%denominator;
        require(pot.portion(amount,numerator,denominator)==amount*numerator/denominator,"exact fraction");
    }
    function testIndependentSevenCardVectorsAgainstNativeEvaluator()public view {
        bytes memory vectors=PokerEvaluationVectors56.ranks();
        require(vectors.length==256*11,"complete independent rank corpus");
        for(uint256 offset=0;offset<vectors.length;offset+=11){
            uint8[7] memory cards;
            for(uint8 i=0;i<7;i++)cards[i]=uint8(vectors[offset+i]);
            uint256 expected=0;
            for(uint8 i=7;i<11;i++)expected=expected*256+uint8(vectors[offset+i]);
            require(ranker.rank7(cards)==expected,"independent native rank differential");
        }
    }
    function testIndependentTwoThroughNineSeatPotVectors()public view {
        bytes memory vectors=PokerEvaluationVectors56.pots();
        require(vectors.length==256*48,"complete independent pot corpus");
        for(uint256 offset=0;offset<vectors.length;offset+=48){
            uint256[9] memory c;bool[9] memory f;uint256[9] memory r;uint256 gross=0;
            for(uint8 i=0;i<9;i++){
                c[i]=uint8(vectors[offset+i]);gross+=c[i];
                f[i]=uint8(vectors[offset+9+i])!=0;
                r[i]=uint8(vectors[offset+18+i]);
            }
            uint256[9] memory paid=pot.award(c,f,r,uint8(vectors[offset+27]),
                uint256(uint8(vectors[offset+28]))*256+uint8(vectors[offset+29]),gross);
            for(uint8 i=0;i<9;i++)require(paid[i]==
                uint256(uint8(vectors[offset+30+2*i]))*256+uint8(vectors[offset+31+2*i]),
                "independent native pot differential");
        }
    }
    function _word(bytes memory data,uint256 offset)private pure returns(uint256 value){
        assembly ("memory-safe") {value:=mload(add(add(data,32),offset))}
    }
    function testIndependentFullWidthIntegerDivisionVectors()public view {
        bytes memory vectors=PokerEvaluationVectors56.ratios();
        require(vectors.length==32*128,"complete bigint oracle corpus");
        for(uint256 i=0;i<vectors.length;i+=128)require(
            pot.portion(_word(vectors,i),_word(vectors,i+32),_word(vectors,i+64))==_word(vectors,i+96),
            "independent full width integer division");
    }

}
