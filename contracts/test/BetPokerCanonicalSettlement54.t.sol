// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerCanonicalEvidence54.t.sol";
import "../src/bet/PokerCanonicalSettlement420.sol";
import "../src/bet/PokerActionDisputeClock420.sol";
import "../src/bet/PokerCanonicalRake420.sol";

/// @dev All verifier fixtures inherited here are TEST-ONLY and cannot qualify
///      sound production poker proofs. This suite qualifies escrow mechanics.
contract PokerCanonicalSettlement54Test is PokerCanonicalEvidence54Test {
    PokerCanonicalRake420 rakeEngine;
    PokerActionDisputeClock420 clock;
    PokerCanonicalSettlement420 settlement;
    address constant TREASURY=address(0x420FEE);
    constructor() {
        rakeEngine=new PokerCanonicalRake420(address(registry));
        clock=new PokerActionDisputeClock420(address(deal));
        settlement=new PokerCanonicalSettlement420(address(canonical),address(rakeEngine),address(clock));
        cap.grant(ADMIN,ledger.ACTION_BIND_SETTLEMENT(),auth.scopeForTable(TABLE),true);
    }
    function _fundedTable() internal {
        PokerTableRegistry420.Configuration memory config=_config();
        config.asset=address(coin);
        PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(500,20,true,true);
        config.rakePolicyHash=rakeEngine.policyHash(policy);
        cheat54.prank(ADMIN);registry.register(config,ADMIN);
        cheat54.prank(ADMIN);registry.approve(TABLE);
        cheat54.prank(ADMIN);registry.open(TABLE);
        cheat54.prank(ADMIN);ledger.bindSettlement(TABLE,address(settlement),TREASURY);
        _buy();
        cheat54.prank(PLAYER_B);ledger.buyIn(TABLE,1,400);
    }
    function _lockedHand() internal returns(bytes32 id) {
        _fundedTable();
        id=_begin(1);
        cheat54.prank(PLAYER);settlement.reserve(id);
        require(ledger.reservedInHand(TABLE)==800,"exact escrow locked");
        require(ledger.activeHand(TABLE)==id,"hand pinned");
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("a"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("b"));
    }
    function _completeShuffle(bytes32 id) internal {
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 first=keccak256("encrypted A");
        bytes32 second=keccak256("encrypted B");
        verifier.allow(gate.statement(id,1,h.transcriptCommitment,first));
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,h.transcriptCommitment,first,hex"010203");
        verifier.allow(gate.statement(id,2,first,second));
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,first,second,hex"010203");
    }
    function _proveTerminal(bytes32 id,uint256[9] memory balances,uint256 rake,
        uint256 grossPot,bool flopSeen,bool uncontested) internal {
        PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(500,20,true,true);
        bytes32 actionRoot=keccak256("legal authenticated transcript");
        bytes32 boardRoot=keccak256("authenticated final reveals");
        bytes32 policyHash=rakeEngine.policyHash(policy);
        bytes32 payout=settlement.payoutHash(id,balances,rake,grossPot,flopSeen,uncontested);
        bytes32 finalRoot=settlement.finalStateHash(id,actionRoot,boardRoot,payout);
        rules.setValid(canonical.statement(id,actionRoot,boardRoot,payout,policyHash,finalRoot));
        canonical.submit(id,actionRoot,boardRoot,payout,policyHash,finalRoot,hex"abcd");
    }
    function testExactAtomicEscrowAndRakeConservation() public {
        bytes32 id=_lockedHand();
        _completeShuffle(id);
        uint256[9] memory balances;
        balances[0]=460; balances[1]=330; // 800 chips less exactly 10 fee
        _proveTerminal(id,balances,10,200,true,false);
        PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(500,20,true,true);
        cheat54.prank(OTHER);settlement.settle(id,balances,policy,200,true,false);
        require(ledger.seatOf(TABLE,0).chips==460 && ledger.seatOf(TABLE,1).chips==330,"exact settlement");
        require(coin.balanceOf(TREASURY)==10,"rake transferred");
        require(coin.balanceOf(address(ledger))==790,"escrow matches liabilities");
        require(ledger.totalChips(TABLE)==790 && ledger.reservedInHand(TABLE)==0,"conserved/unlocked");
        require(ledger.handConsumed(id),"consumed");
        cheat54.expectRevert(PokerCanonicalSettlement420.InvalidSettlement.selector);
        settlement.settle(id,balances,policy,200,true,false);
    }
    function testFundsRemainFrozenUntilProvenAndUnsubstituted() public {
        bytes32 id=_lockedHand();
        cheat54.expectRevert(PokerSeatLedger420.Locked.selector);
        cheat54.prank(PLAYER);ledger.leave(TABLE);
        uint256[9] memory balances;
        balances[0]=400;balances[1]=400;
        PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(500,20,true,true);
        cheat54.expectRevert(PokerCanonicalSettlement420.InvalidProof.selector);
        settlement.settle(id,balances,policy,0,false,false);
        _completeShuffle(id);
        _proveTerminal(id,balances,0,0,false,false);
        balances[0]=600;balances[1]=200;
        cheat54.expectRevert(PokerCanonicalSettlement420.InvalidProof.selector);
        settlement.settle(id,balances,policy,0,false,false);
        require(coin.balanceOf(address(ledger))==800,"no withdrawal or substitution");
    }
    function testWithheldShuffleRestoresOnlyOriginalChipBalances() public {
        _fundedTable();
        bytes32 id=_begin(1);
        cheat54.prank(PLAYER);settlement.reserve(id);
        cheat54.expectRevert(PokerCanonicalSettlement420.TooEarly.selector);
        settlement.cancelWithheldShuffle(id);
        cheat54.warp(block.timestamp+1 hours+121);
        cheat54.prank(PLAYER_B);settlement.cancelWithheldShuffle(id);
        require(ledger.reservedInHand(TABLE)==0 && ledger.activeHand(TABLE)==bytes32(0),"unlocked");
        require(ledger.seatOf(TABLE,0).chips==400 && ledger.seatOf(TABLE,1).chips==400,"refund unchanged");
        cheat54.prank(PLAYER);ledger.leave(TABLE);
        require(coin.balanceOf(PLAYER)==5000,"player can withdraw");
        cheat54.expectRevert(PokerCanonicalSettlement420.InvalidHand.selector);
        settlement.reserve(id);
    }
    function testCompletedShuffleCannotBeVoidedAsWithheld() public {
        bytes32 id=_lockedHand();_completeShuffle(id);
        cheat54.warp(block.timestamp+1 hours+121);
        cheat54.expectRevert(PokerCanonicalSettlement420.InvalidProof.selector);
        settlement.cancelWithheldShuffle(id);
        require(ledger.reservedInHand(TABLE)==800,"escrow remains locked");
    }
}
