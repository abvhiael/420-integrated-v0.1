// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/VideoPokerJacksOrBetter420.sol";
interface VmBetPaytable54 { function expectRevert(bytes4) external; }
contract BetVideoPokerPaytable54Test {
    VmBetPaytable54 constant vm=VmBetPaytable54(address(uint160(uint256(keccak256("hevm cheat code")))));
    VideoPokerEconomics420 internal immutable economics=new VideoPokerEconomics420();
    function _c(uint8 a,uint8 b,uint8 c,uint8 d,uint8 e) private pure returns(uint8[5] memory) {
        return [a,b,c,d,e];
    }
    function _check(uint8[5] memory cards, VideoPokerJacksOrBetter420.Category cat) private view {
        require(economics.evaluate(cards)==cat,"category mismatch");
    }
    function testAllTenCategoriesAndBoundaries() public view {
        _check(_c(1,16,31,46,9),VideoPokerJacksOrBetter420.Category.NOTHING);
        _check(_c(10,23,1,3,5),VideoPokerJacksOrBetter420.Category.JACKS_OR_BETTER);
        _check(_c(0,13,1,14,5),VideoPokerJacksOrBetter420.Category.TWO_PAIR);
        _check(_c(1,14,27,5,9),VideoPokerJacksOrBetter420.Category.THREE_OF_A_KIND);
        _check(_c(0,14,28,42,1),VideoPokerJacksOrBetter420.Category.STRAIGHT);
        _check(_c(0,2,5,8,12),VideoPokerJacksOrBetter420.Category.FLUSH);
        _check(_c(1,14,27,3,16),VideoPokerJacksOrBetter420.Category.FULL_HOUSE);
        _check(_c(1,14,27,40,5),VideoPokerJacksOrBetter420.Category.FOUR_OF_A_KIND);
        _check(_c(0,1,2,3,4),VideoPokerJacksOrBetter420.Category.STRAIGHT_FLUSH);
        _check(_c(0,9,10,11,12),VideoPokerJacksOrBetter420.Category.ROYAL_FLUSH);
        _check(_c(0,14,28,42,1),VideoPokerJacksOrBetter420.Category.STRAIGHT);
        _check(_c(9,10,11,12,13),VideoPokerJacksOrBetter420.Category.STRAIGHT);
        _check(_c(9,22,1,3,5),VideoPokerJacksOrBetter420.Category.NOTHING);
        _check(_c(11,24,1,3,5),VideoPokerJacksOrBetter420.Category.JACKS_OR_BETTER);
        _check(_c(12,25,1,3,5),VideoPokerJacksOrBetter420.Category.JACKS_OR_BETTER);
        _check(_c(0,13,1,3,5),VideoPokerJacksOrBetter420.Category.JACKS_OR_BETTER);
    }
    function testRoyalAcrossSuitsAndPermutation() public view {
        for(uint8 suit=0;suit<4;++suit){
            uint8 offset=suit*13;
            _check(_c(offset,offset+9,offset+10,offset+11,offset+12),VideoPokerJacksOrBetter420.Category.ROYAL_FLUSH);
            _check(_c(offset+12,offset+11,offset+10,offset+9,offset),VideoPokerJacksOrBetter420.Category.ROYAL_FLUSH);
            _check(_c(offset,offset+1,offset+2,offset+3,offset+4),VideoPokerJacksOrBetter420.Category.STRAIGHT_FLUSH);
        }
    }
    function testCommittedPaytableAllCategoriesAndCredits() public view {
        uint16[10] memory factors=[uint16(0),1,2,3,4,6,9,25,50,250];
        require(economics.paytableId()==keccak256("420BET.PAYTABLE.VIDEO_POKER.JACKS_OR_BETTER.V1"),"paytable ID");
        require(economics.paytableCommitment()==keccak256(abi.encode(economics.paytableId(),uint8(1),uint8(5),factors,uint16(4000))),"paytable commitment");
        for(uint8 credits=1;credits<=5;++credits){
            for(uint8 category=0;category<=9;++category){
                uint256 expected=category==9&&credits==5?4000:uint256(factors[category])*credits;
                require(economics.payoutCredits(VideoPokerJacksOrBetter420.Category(category),credits)==expected,"payout table");
            }
        }
    }
    function testRoyalBonusAndGrossRounding() public view {
        (VideoPokerJacksOrBetter420.Category cat,uint256 gross)=economics.quote(_c(0,9,10,11,12),1005,5);
        require(cat==VideoPokerJacksOrBetter420.Category.ROYAL_FLUSH&&gross==804000,"royal stake unit");
        require(economics.maximumGross(1005,5)==804000,"cap policy");
        (,gross)=economics.quote(_c(0,9,10,11,12),1004,4);
        require(gross==251000,"four credit scaling");
    }
    function testRejectedDuplicateAndOutOfRangeCards() public {
        vm.expectRevert(VideoPokerJacksOrBetter420.DuplicateCard.selector);
        economics.evaluate(_c(0,0,1,2,3));
        vm.expectRevert(VideoPokerJacksOrBetter420.InvalidCard.selector);
        economics.evaluate(_c(0,1,2,3,52));
        vm.expectRevert(VideoPokerJacksOrBetter420.InvalidCard.selector);
        economics.evaluate(_c(255,1,2,3,4));
    }
    function testRejectInvalidCreditsCategoryAndStake() public {
        vm.expectRevert(VideoPokerJacksOrBetter420.InvalidCredits.selector);
        economics.payoutCredits(VideoPokerJacksOrBetter420.Category.ROYAL_FLUSH,0);
        vm.expectRevert(VideoPokerJacksOrBetter420.InvalidCredits.selector);
        economics.payoutCredits(VideoPokerJacksOrBetter420.Category.ROYAL_FLUSH,6);
        (bool accepted, bytes memory response) = address(economics).call(
            abi.encodeWithSelector(VideoPokerEconomics420.payoutCredits.selector, uint8(10), uint8(5))
        );
        require(!accepted && response.length >= 4, "invalid ABI enum accepted");
        bytes4 selector;
        assembly { selector := mload(add(response, 32)) }
        require(selector == bytes4(0x4e487b71), "invalid enum must fail closed");
        vm.expectRevert(VideoPokerJacksOrBetter420.InvalidStake.selector);
        economics.maximumGross(0,5);
        vm.expectRevert(VideoPokerJacksOrBetter420.InvalidStake.selector);
        economics.maximumGross(1001,5);
        vm.expectRevert(VideoPokerJacksOrBetter420.InvalidStake.selector);
        economics.quote(_c(0,9,10,11,12),1001,5);
    }
    function testOverflowFailsClosed() public {
        vm.expectRevert(VideoPokerJacksOrBetter420.InvalidStake.selector);
        economics.maximumGross(type(uint256).max,1);
    }
}
