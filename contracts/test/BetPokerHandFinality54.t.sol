// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerHandFinality420.sol";

contract PokerHandFinality54Test is PokerConfidentialDeal54Test {
    address constant JUDGE_A=address(0xA774);
    address constant JUDGE_B=address(0xB774);
    PokerHandFinality420 finality;
    bytes32 constant FINAL_STATE=keccak256("settled terminal action state");
    bytes32 constant TRANSCRIPT=keccak256("immutable transcript");
    constructor() {
        finality=new PokerHandFinality420(address(deal),JUDGE_A,JUDGE_B);
        cap.grant(JUDGE_A,finality.ACTION_ATTEST(),auth.scopeForTable(TABLE),true);
        cap.grant(JUDGE_B,finality.ACTION_ATTEST(),auth.scopeForTable(TABLE),true);
    }
    function _committed() internal returns(bytes32 id){
        _prepared();id=_begin(1);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("a"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("b"));
    }
    function _one(bytes32 id) internal {
        cheat54.prank(JUDGE_A);finality.attest(id,FINAL_STATE,TRANSCRIPT);
    }
    function _both(bytes32 id) internal {
        _one(id);
        cheat54.prank(JUDGE_B);finality.attest(id,FINAL_STATE,TRANSCRIPT);
    }
    function testTwoIndependentAttestorsAndChallengeWindowRequired() public {
        bytes32 id=_committed();
        _both(id);
        cheat54.expectRevert(PokerHandFinality420.Expired.selector);
        finality.finalize(id);
        cheat54.warp(block.timestamp+1 days);
        finality.finalize(id);
        require(finality.isFinal(id),"terminal");
        cheat54.expectRevert(PokerHandFinality420.InvalidState.selector);
        finality.finalize(id);
    }
    function testPlayerChallengeFailsClosedAndCannotBeOverridden() public {
        bytes32 id=_committed();
        _both(id);
        cheat54.prank(PLAYER);finality.challenge(id,keccak256("disputed evidence"));
        cheat54.warp(block.timestamp+1 days);
        cheat54.expectRevert(PokerHandFinality420.InvalidState.selector);
        finality.finalize(id);
        require(!finality.isFinal(id),"challenged finality");
    }
    function testUnauthorizedAttestorAndObserverChallengeDenied() public {
        bytes32 id=_committed();
        cheat54.expectRevert(PokerHandFinality420.Unauthorized.selector);
        cheat54.prank(PROVIDER_A);finality.attest(id,FINAL_STATE,TRANSCRIPT);
        _one(id);
        cheat54.expectRevert(PokerHandFinality420.Unauthorized.selector);
        cheat54.prank(OTHER);finality.challenge(id,keccak256("foreign"));
    }
    function testConflictingTranscriptAndRepeatAttestationRejected() public {
        bytes32 id=_committed();
        _one(id);
        cheat54.expectRevert(PokerHandFinality420.InvalidInput.selector);
        cheat54.prank(JUDGE_B);finality.attest(id,FINAL_STATE,keccak256("fork"));
        cheat54.expectRevert(PokerHandFinality420.InvalidState.selector);
        cheat54.prank(JUDGE_A);finality.attest(id,FINAL_STATE,TRANSCRIPT);
    }
    function testRevokedJudgeCannotAttest() public {
        bytes32 id=_committed();
        cap.grant(JUDGE_B,finality.ACTION_ATTEST(),auth.scopeForTable(TABLE),false);
        _one(id);
        cheat54.expectRevert(PokerHandFinality420.Unauthorized.selector);
        cheat54.prank(JUDGE_B);finality.attest(id,FINAL_STATE,TRANSCRIPT);
        cheat54.warp(block.timestamp+1 days);
        cheat54.expectRevert(PokerHandFinality420.InvalidState.selector);
        finality.finalize(id);
    }
}
