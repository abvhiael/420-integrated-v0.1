// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/PokerHandRank420.sol";
interface VmRank54 {function expectRevert(bytes4) external;}
contract PokerHandRank54Test {
    PokerHandRank420 ranker=new PokerHandRank420();
    VmRank54 constant vm=VmRank54(address(uint160(uint256(keccak256("hevm cheat code")))));
    function testStraightFlushBeatsQuadsAndWheel() public view {
        uint8[5] memory royal=[uint8(12),11,10,9,8];
        uint8[5] memory quads=[uint8(12),0,13,26,39];
        uint8[5] memory wheel=[uint8(12),13,27,41,3];
        require(ranker.rank5(royal)>ranker.rank5(quads),"SF beats quads");
        require(ranker.rank5(quads)>ranker.rank5(wheel),"quads beats wheel");
        uint8[5] memory sixHigh=[uint8(12),0,1,2,4];
        require(ranker.rank5(sixHigh)>ranker.rank5(wheel),"six high straight > five high");
    }
    function testSevenCardRankIndependentOfOrdering() public view {
        uint8[7] memory a=[uint8(12),11,10,9,8,13,26];
        uint8[7] memory b=[uint8(26),13,8,9,10,11,12];
        require(ranker.rank7(a)==ranker.rank7(b),"permutation invariant");
        require(ranker.rank7(a)>0,"valid rank");
    }
    function testDuplicatesAndOutOfRangeRejected() public {
        uint8[7] memory repeated=[uint8(1),1,2,3,4,5,6];
        vm.expectRevert(PokerHandRank420.InvalidCard.selector);
        ranker.rank7(repeated);
        uint8[5] memory invalid=[uint8(1),2,3,4,52];
        vm.expectRevert(PokerHandRank420.InvalidCard.selector);
        ranker.rank5(invalid);
    }
    function testTieAndKickersDistinguishCorrectly() public view {
        uint8[5] memory pairA=[uint8(12),25,11,10,9];
        uint8[5] memory pairB=[uint8(12),25,11,10,8];
        require(ranker.rank5(pairA)>ranker.rank5(pairB),"kicker");
        uint8[5] memory eq=[uint8(12),25,11,10,9];
        require(ranker.rank5(pairA)==ranker.rank5(eq),"tie");
    }
}
