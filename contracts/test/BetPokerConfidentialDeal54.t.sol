// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerSeatLedger53.t.sol";
import "../src/bet/PokerConfidentialDeal420.sol";

interface VmPoker54 { function prank(address) external; function expectRevert(bytes4) external; function warp(uint256) external; }

contract PokerConfidentialDeal54Test is PokerSeatLedger53Test {
    VmPoker54 constant cheat54=VmPoker54(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PROVIDER_A=address(0xAA54);
    address constant PROVIDER_B=address(0xBB54);
    address constant PLAYER_B=address(0xB54);
    PokerConfidentialDeal420 deal;

    constructor() {
        deal = new PokerConfidentialDeal420(address(registry),address(ledger),PROVIDER_A,PROVIDER_B);
        cap.grant(ADMIN,deal.ACTION_BEGIN(),auth.scopeForTable(TABLE),true);
        cap.grant(PROVIDER_A,deal.ACTION_PROVIDER_COMMIT(),auth.scopeForTable(TABLE),true);
        cap.grant(PROVIDER_B,deal.ACTION_PROVIDER_COMMIT(),auth.scopeForTable(TABLE),true);
        cap.grant(PLAYER_B,BetIds420.ACTION_POKER_BUY_IN,auth.scopeForTable(TABLE),true);
        coin.mint(PLAYER_B,2000);
        cheat54.prank(PLAYER_B); coin.approve(address(ledger),2000);
    }
    function _prepared() internal {
        _open();
        _buy();
        cheat54.prank(PLAYER_B); ledger.buyIn(TABLE,1,400);
    }
    function _begin(uint64 nonce) internal returns (bytes32 id) {
        cheat54.prank(ADMIN);
        id=deal.begin(TABLE,nonce,uint64(block.timestamp+120),keccak256("prior"),
            deal.snapshotFor(TABLE,3),3);
    }
    function testTwoProviderCommitNoPlaintextCards() public {
        _prepared();
        bytes32 id=_begin(1);
        cheat54.prank(PROVIDER_A); deal.commit(id,keccak256("independent encrypted transcript A"));
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        require(h.state==PokerConfidentialDeal420.State.AWAITING,"premature completion");
        require(h.rootB==0 && h.transcriptCommitment==0,"premature aggregate");
        cheat54.prank(PROVIDER_B); deal.commit(id,keccak256("independent encrypted transcript B"));
        h=deal.getHand(id);
        require(h.state==PokerConfidentialDeal420.State.COMMITTED && h.transcriptCommitment != 0,"commit");
        require(h.epoch==2 && h.nonce==1,"binding");
        require(ledger.totalChips(TABLE)==800 && coin.balanceOf(address(ledger))==800,"custody unchanged");
    }
    function testUnauthorizedAndDuplicateCommitRejected() public {
        _prepared(); bytes32 id=_begin(1);
        cheat54.expectRevert(PokerConfidentialDeal420.WrongProvider.selector);
        cheat54.prank(OTHER); deal.commit(id,keccak256("bad"));
        cheat54.prank(PROVIDER_A); deal.commit(id,keccak256("a"));
        cheat54.expectRevert(PokerConfidentialDeal420.Duplicate.selector);
        cheat54.prank(PROVIDER_A); deal.commit(id,keccak256("again"));
    }
    function testRevokedProviderDenied() public {
        _prepared(); bytes32 id=_begin(1);
        cap.grant(PROVIDER_A,deal.ACTION_PROVIDER_COMMIT(),auth.scopeForTable(TABLE),false);
        cheat54.expectRevert(PokerConfidentialDeal420.Unauthorized.selector);
        cheat54.prank(PROVIDER_A); deal.commit(id,keccak256("a"));
    }
    function testForgedSnapshotRejected() public {
        _prepared();
        cheat54.expectRevert(PokerConfidentialDeal420.ParticipantsChanged.selector);
        cheat54.prank(ADMIN);
        deal.begin(TABLE,1,uint64(block.timestamp+120),keccak256("prior"),
            keccak256("forged snapshot"),3);
    }
    function testNoReplayOrNonceSkip() public {
        _prepared(); _begin(1);
        cheat54.expectRevert(PokerConfidentialDeal420.InvalidInput.selector);
        cheat54.prank(ADMIN); deal.begin(TABLE,1,uint64(block.timestamp+100),keccak256("prior"),keccak256("snapshot"),3);
        cheat54.expectRevert(PokerConfidentialDeal420.InvalidInput.selector);
        cheat54.prank(ADMIN); deal.begin(TABLE,3,uint64(block.timestamp+100),keccak256("prior"),keccak256("snapshot"),3);
    }
    function testParticipantChangeInvalidatesPendingCommit() public {
        _prepared(); bytes32 id=_begin(1);
        cheat54.prank(PLAYER_B); ledger.leave(TABLE);
        cheat54.expectRevert(PokerConfidentialDeal420.ParticipantsChanged.selector);
        cheat54.prank(PROVIDER_A); deal.commit(id,keccak256("a"));
    }
    function testEmergencyBlocksBegin() public {
        _prepared(); emergency.setHalted(true);
        // Fixture emergency mock gates both new-table and new-hand for this test.
        cheat54.expectRevert(PokerConfidentialDeal420.EmergencyHalt.selector);
        _begin(1);
    }
    function testWithheldCommitExpiresWithoutSettlingFunds() public {
        _prepared(); bytes32 id=_begin(1);
        cheat54.prank(PROVIDER_A); deal.commit(id,keccak256("a"));
        cheat54.warp(block.timestamp+121);
        deal.expire(id);
        PokerConfidentialDeal420.Hand memory expired = deal.getHand(id);
        require(expired.state==PokerConfidentialDeal420.State.EXPIRED,"expiry");
        cheat54.expectRevert(PokerConfidentialDeal420.InvalidState.selector);
        cheat54.prank(PROVIDER_B); deal.commit(id,keccak256("late"));
        require(ledger.totalChips(TABLE)==800 && coin.balanceOf(address(ledger))==800,"no funds changed");
    }
    function testInvalidSeatsAndNoOnePlayerHands() public {
        _open(); _buy();
        cheat54.expectRevert(PokerConfidentialDeal420.InvalidInput.selector);
        _begin(1);
    }
}
