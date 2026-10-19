// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerActionDisputeClock420.sol";
contract PokerActionDisputeClock54Test is PokerConfidentialDeal54Test {
    PokerActionDisputeClock420 clock;
    constructor(){
        clock=new PokerActionDisputeClock420(address(deal));
        cap.grant(ADMIN,clock.ACTION_START_CLOCK(),auth.scopeForTable(TABLE),true);
    }
    function _readyClock() internal returns(bytes32 id){
        _prepared();id=_begin(1);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("a"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("b"));
    }
    function testTimeoutCannotFireEarlyOrIssueSettlement() public {
        bytes32 id=_readyClock();
        cheat54.prank(ADMIN);
        clock.start(id,0,1,uint64(block.timestamp+60),keccak256("state"));
        cheat54.expectRevert(PokerActionDisputeClock420.Premature.selector);
        clock.expire(id);
        cheat54.warp(block.timestamp+61);
        clock.expire(id);
        (,,,,bool active,)=clock.clocks(id);
        require(!active && !clock.isFrozen(id),"expired without payout");
    }
    function testHandDisputePermanentlyFreezesClock() public {
        bytes32 id=_readyClock();
        cheat54.prank(ADMIN);
        clock.start(id,0,1,uint64(block.timestamp+60),keccak256("state"));
        cheat54.prank(PLAYER);clock.dispute(id,keccak256("withheld proof"));
        require(clock.isFrozen(id),"frozen");
        cheat54.warp(block.timestamp+100);
        cheat54.expectRevert(PokerActionDisputeClock420.InvalidState.selector);
        clock.expire(id);
        cheat54.expectRevert(PokerActionDisputeClock420.InvalidState.selector);
        cheat54.prank(ADMIN);clock.start(id,0,2,uint64(block.timestamp+60),keccak256("next"));
    }
    function testUnauthorizedClockStartOrDisputeRejected() public {
        bytes32 id=_readyClock();
        cheat54.expectRevert(PokerActionDisputeClock420.Unauthorized.selector);
        cheat54.prank(OTHER);clock.start(id,0,1,uint64(block.timestamp+60),keccak256("state"));
        cheat54.prank(ADMIN);clock.start(id,0,1,uint64(block.timestamp+60),keccak256("state"));
        cheat54.expectRevert(PokerActionDisputeClock420.Unauthorized.selector);
        cheat54.prank(OTHER);clock.dispute(id,keccak256("forged"));
    }
}
