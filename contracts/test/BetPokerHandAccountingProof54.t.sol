// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerHandAccountingProof420.sol";

contract PokerHandAccountingProof54Test is PokerConfidentialDeal54Test {
    PokerHandAccountingProof420 proof;
    constructor() { proof=new PokerHandAccountingProof420(address(deal)); }
    function _hand() internal returns(bytes32 id){
        _prepared();id=_begin(1);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("a"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("b"));
    }
    function testConservationAndTerminalTranscript() public {
        bytes32 id=_hand();
        cheat54.prank(ADMIN);proof.initialize(id,800,keccak256("snapshot"));
        cheat54.prank(ADMIN);proof.record(id,1,keccak256("call"),600,200,0);
        cheat54.prank(ADMIN);proof.record(id,2,keccak256("showdown"),790,0,10);
        cheat54.prank(ADMIN);proof.markTerminal(id,keccak256("finish"));
        PokerHandAccountingProof420.State memory s=proof.stateOf(id);
        require(s.terminal && s.nonce==2 && s.stackChips==790 && s.rakeChips==10,"terminal accounting");
    }
    function testInflationAndReplayRejected() public {
        bytes32 id=_hand();
        cheat54.prank(ADMIN);proof.initialize(id,800,keccak256("snapshot"));
        cheat54.expectRevert(PokerHandAccountingProof420.Conservation.selector);
        cheat54.prank(ADMIN);proof.record(id,1,keccak256("inflate"),800,1,0);
        cheat54.prank(ADMIN);proof.record(id,1,keccak256("correct"),600,200,0);
        cheat54.expectRevert(PokerHandAccountingProof420.InvalidAction.selector);
        cheat54.prank(ADMIN);proof.record(id,1,keccak256("replay"),600,200,0);
    }
    function testUnauthorizedWriterAndPrematureTerminalDenied() public {
        bytes32 id=_hand();
        cheat54.expectRevert(PokerHandAccountingProof420.Unauthorized.selector);
        cheat54.prank(OTHER);proof.initialize(id,800,keccak256("snapshot"));
        cheat54.prank(ADMIN);proof.initialize(id,800,keccak256("snapshot"));
        cheat54.prank(ADMIN);proof.record(id,1,keccak256("pot"),600,200,0);
        cheat54.expectRevert(PokerHandAccountingProof420.InvalidState.selector);
        cheat54.prank(ADMIN);proof.markTerminal(id,keccak256("early"));
        cheat54.expectRevert(PokerHandAccountingProof420.Unauthorized.selector);
        cheat54.prank(OTHER);proof.record(id,2,keccak256("fake"),800,0,0);
    }
    function testCannotInitializeWrongCollateralOrTwice() public {
        bytes32 id=_hand();
        cheat54.expectRevert(PokerHandAccountingProof420.Conservation.selector);
        cheat54.prank(ADMIN);proof.initialize(id,801,keccak256("snapshot"));
        cheat54.prank(ADMIN);proof.initialize(id,800,keccak256("snapshot"));
        cheat54.expectRevert(PokerHandAccountingProof420.InvalidState.selector);
        cheat54.prank(ADMIN);proof.initialize(id,800,keccak256("snapshot"));
    }
}
