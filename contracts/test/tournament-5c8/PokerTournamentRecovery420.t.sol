// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../tournament-5c7/PokerTournamentPrizes420.t.sol";
import "../../src/bet/tournament/recovery/PokerTournamentRecovery420.sol";
interface C8Vm420 {function chainId(uint256)external;function etch(address,bytes calldata)external;}
abstract contract TournamentRecoveryBase420 is TournamentPrizeTestsBase420 {
    PokerTournamentRecovery420 internal recovery;
    event C8RecoveryBinding(address bank,address host,address engine,address entropy);
    C8Vm420 internal constant rvm=C8Vm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function _coordinator()internal{recovery=new PokerTournamentRecovery420(address(runtimeEscrow));require(address(recovery).code.length<=24576);emit C8RecoveryBinding(address(runtimeEscrow),address(host),address(ws8Engine),address(roundEntropy));}
    function _step(PokerTournamentRecovery420.Action action,uint32 table,uint32 cursor,uint32 limit)internal returns(uint32){return recovery.advance(EVENT,recovery.snapshot(EVENT,table),action,table,cursor,limit);}
    function _bad(PokerTournamentRecovery420.Action action,uint32 table,uint32 cursor,uint32 limit)internal{bytes32 snapshot=recovery.snapshot(EVENT,table);_fails(address(recovery),abi.encodeCall(recovery.advance,(EVENT,snapshot,action,table,cursor,limit)));}
    function _checkpoint()internal{_step(PokerTournamentRecovery420.Action.CHECKPOINT,0,0,0);}
    function _refund()internal{
        _checkpoint();(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);vm.warp(deadline);_step(PokerTournamentRecovery420.Action.BEGIN_REFUND,0,0,0);
        while(true){(PokerTournamentFinanceState420.Mode mode,,,,,,,,)=runtimeEscrow.financialState(EVENT);if(mode==PokerTournamentFinanceState420.Mode.REFUNDED)break;_step(PokerTournamentRecovery420.Action.REFUND_CHUNK,0,0,1);}
        require(runtimeEscrow.heldPrizes()==0&&runtimeEscrow.heldFees()==0&&host.chipConservation(EVENT));_withdrawAll();_emitFinalMoney();
    }
}
contract TournamentRecoverySecurity420Test is TournamentRecoveryBase420 {
    function testCoordinatorRefundsRealPlayedHandAndWithheldDeal()public{
        _firstHands();_play(handA,"tableA");_coordinator();_bad(PokerTournamentRecovery420.Action.CANCEL_DEAL,2,0,0);vm.warp(ws8Engine.fundedEvidenceDeadline(handB));_step(PokerTournamentRecovery420.Action.CANCEL_DEAL,2,0,0);_refund();require(runtimeEscrow.totalWithdrawn()==412);
    }
    function testRestartBetweenEveryRefundChunkRetainsOriginalPayers()public{
        _readyPurchases();_cutoffAndAddOns();host.prepareRound(EVENT);_coordinator();_bad(PokerTournamentRecovery420.Action.OBSERVE_ENTROPY,0,0,0);vm.warp(block.timestamp+3600);_step(PokerTournamentRecovery420.Action.OBSERVE_ENTROPY,0,0,0);_checkpoint();(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);vm.warp(deadline);_step(PokerTournamentRecovery420.Action.BEGIN_REFUND,0,0,0);
        for(uint8 i;i<8;i++){_coordinator();_step(PokerTournamentRecovery420.Action.REFUND_CHUNK,0,0,1);}
        require(runtimeEscrow.heldPrizes()==0&&runtimeEscrow.heldFees()==0);_withdrawAll();require(runtimeEscrow.totalWithdrawn()==824);_emitFinalMoney();
    }
    function testQueuedPurchasesBlockRefundUntilBoundedDrain()public{
        _firstHands();_play(handA,"tableA");_extra(_zero(handA));_late(eve,E,EC);_coordinator();vm.warp(ws8Engine.fundedEvidenceDeadline(handB));_step(PokerTournamentRecovery420.Action.CANCEL_DEAL,2,0,0);_checkpoint();(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);vm.warp(deadline);_bad(PokerTournamentRecovery420.Action.BEGIN_REFUND,0,0,0);_step(PokerTournamentRecovery420.Action.DRAIN_QUEUE,0,0,1);require(host.queuedHead(EVENT)!=0);_step(PokerTournamentRecovery420.Action.DRAIN_QUEUE,0,0,1);require(host.queuedHead(EVENT)==0);_refund();require(runtimeEscrow.totalWithdrawn()==618);
    }
    function testActiveAuthenticatedHandBlocksRefundAndTimesOutCanonically()public{
        _firstHands();_proveDeal(handA,"tableA");_coordinator();vm.warp(ws8Engine.fundedEvidenceDeadline(handB));_step(PokerTournamentRecovery420.Action.CANCEL_DEAL,2,0,0);_checkpoint();(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);vm.warp(deadline);_bad(PokerTournamentRecovery420.Action.BEGIN_REFUND,0,0,0);_step(PokerTournamentRecovery420.Action.TIMEOUT,1,0,0);_step(PokerTournamentRecovery420.Action.SETTLE,1,0,0);require(ws8Engine.handSettled(handA));_refund();require(runtimeEscrow.totalWithdrawn()==412);
    }
    function testMissingPublicEvidenceUsesOriginalReviewDeadline()public{
        _firstHands();_proveDeal(handA,"tableA");while(ws8Engine.gameOf(handA).phase==PokerNLHEStorage420.Phase.PREFLOP){uint256 owed=ws8Engine.turnOf(handA).callChips;_signed(handA,owed==0?PokerNLHEStorage420.Move.CHECK:PokerNLHEStorage420.Move.CALL,owed);}
        _coordinator();_bad(PokerTournamentRecovery420.Action.OPEN_EVIDENCE,1,0,0);uint64 due=ws8Engine.evidenceDueAt(handA);vm.warp(uint256(due)+1);_step(PokerTournamentRecovery420.Action.OPEN_EVIDENCE,1,0,0);(,uint64 finalizable,,,bool active)=ws8Engine.evidenceRecovery(handA);require(active&&finalizable==uint256(due)+ws8Engine.RECOVERY_REVIEW_WINDOW());_bad(PokerTournamentRecovery420.Action.FINALIZE_EVIDENCE,1,0,0);vm.warp(finalizable);_coordinator();_step(PokerTournamentRecovery420.Action.FINALIZE_EVIDENCE,1,0,0);_step(PokerTournamentRecovery420.Action.CANCEL_DEAL,2,0,0);require(ws8Engine.handAborted(handA)&&ws8Engine.handAborted(handB));_refund();require(runtimeEscrow.totalWithdrawn()==412);
    }
    function testGenuineShuffleWithoutDeliveryCannotStartAndRefunds()public{
        _firstHands();_play(handA,"tableA");bytes32[3] memory roots=abi.decode(_data("tableB","roots.bin"),(bytes32[3]));
        for(uint8 n;n<3;n++){uint256[208] memory points=abi.decode(_data("tableB",string.concat("deck-",_n(n),".bin")),(uint256[208]));require(ws8Availability.publish(uint256(handB)%WS8_FR,points)==roots[n]);}
        ws8Initial.submit(handB,roots[0],_proof("tableB","WS8Initial"));provider0.invoke(address(ws8Shuffle),abi.encodeCall(ws8Shuffle.proveStage,(handB,uint8(1),roots[0],roots[1],_proof("tableB","WS8Shuffle1"))));provider1.invoke(address(ws8Shuffle),abi.encodeCall(ws8Shuffle.proveStage,(handB,uint8(2),roots[1],roots[2],_proof("tableB","WS8Shuffle2"))));require(ws8Shuffle.isProofComplete(handB));
        _coordinator();_fails(address(host),abi.encodeCall(host.startHand,(handB)));_bad(PokerTournamentRecovery420.Action.CANCEL_DELIVERY,2,0,0);vm.warp(ws8Engine.fundedEvidenceDeadline(handB));_bad(PokerTournamentRecovery420.Action.CANCEL_DEAL,2,0,0);_step(PokerTournamentRecovery420.Action.CANCEL_DELIVERY,2,0,0);_refund();require(runtimeEscrow.totalWithdrawn()==412);
    }
    function testWrongHandProofCannotBeUsedAsRecoveryReadiness()public{
        _firstHands();bytes32[3] memory roots=abi.decode(_data("tableA","roots.bin"),(bytes32[3]));_fails(address(ws8Initial),abi.encodeCall(ws8Initial.submit,(handB,roots[0],_proof("tableA","WS8Initial"))));require(!ws8Shuffle.isProofComplete(handB));_coordinator();_bad(PokerTournamentRecovery420.Action.SETTLE,2,0,0);_bad(PokerTournamentRecovery420.Action.BEGIN_PRIZES,0,0,0);
    }
    function testStalePlanCannotExecuteAfterAnotherKeeperProgresses()public{
        _firstHands();_coordinator();bytes32 old=recovery.snapshot(EVENT,0);host.pause(EVENT);_fails(address(recovery),abi.encodeCall(recovery.advance,(EVENT,old,PokerTournamentRecovery420.Action.CHECKPOINT,uint32(0),uint32(0),uint32(0))));
    }
    function testWrongChainAndEventPlansFailClosed()public{
        _firstHands();_coordinator();bytes32 old=recovery.snapshot(EVENT,0);uint256 chain=block.chainid;rvm.chainId(chain+1);require(recovery.snapshot(EVENT,0)!=old);_fails(address(recovery),abi.encodeCall(recovery.advance,(EVENT,old,PokerTournamentRecovery420.Action.TICK,uint32(0),uint32(0),uint32(0))));rvm.chainId(chain);_fails(address(recovery),abi.encodeCall(recovery.advance,(bytes32(uint256(7)),old,PokerTournamentRecovery420.Action.TICK,uint32(0),uint32(0),uint32(0))));
    }
    function testCoordinatorPlansCannotBeReusedAcrossDeployments()public{
        _firstHands();_coordinator();bytes32 old=recovery.snapshot(EVENT,0);_coordinator();require(old!=recovery.snapshot(EVENT,0));_fails(address(recovery),abi.encodeCall(recovery.advance,(EVENT,old,PokerTournamentRecovery420.Action.TICK,uint32(0),uint32(0),uint32(0))));
    }
    function testDependencyRuntimeMutationFailsClosed()public{
        _firstHands();_coordinator();bytes32 old=recovery.snapshot(EVENT,0);rvm.etch(address(roundEntropy),hex"00");_fails(address(recovery),abi.encodeCall(recovery.advance,(EVENT,old,PokerTournamentRecovery420.Action.TICK,uint32(0),uint32(0),uint32(0))));
    }
    function testUnknownAndZeroCodeBindingsRejected()public{
        try new PokerTournamentRecovery420(address(0)){revert("zero accepted");}catch{}
        try new PokerTournamentRecovery420(address(asset)){revert("foreign accepted");}catch{}
    }
    function testNoArbitraryCallWithdrawalOrPrivilegedPauseEndpoint()public{
        _firstHands();_coordinator();_fails(address(recovery),abi.encodeWithSignature("pause(bytes32)",EVENT));_fails(address(recovery),abi.encodeWithSignature("withdraw()"));_fails(address(recovery),abi.encodeWithSignature("execute(address,bytes)",address(runtimeEscrow),abi.encodeCall(runtimeEscrow.withdraw,())));require(runtimeEscrow.credit(address(recovery))==0);
    }
    function testUnauthorizedPauseStillRejectedByCanonicalHost()public{
        _firstHands();_coordinator();_fails(address(alice),abi.encodeCall(alice.invoke,(address(host),abi.encodeCall(host.pause,(EVENT)))));_bad(PokerTournamentRecovery420.Action.OBSERVE_PAUSE,0,0,0);
    }
    function testPauseDeadlineDoesNotMoveWhenObservedLateOrRestarted()public{
        _firstHands();_play(handA,"tableA");_play(handB,"tableB");host.pause(EVENT);uint64 original=uint64(block.timestamp);_coordinator();_bad(PokerTournamentRecovery420.Action.OBSERVE_PAUSE,0,0,0);vm.warp(uint256(original)+86400);_step(PokerTournamentRecovery420.Action.OBSERVE_PAUSE,0,0,0);_checkpoint();(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);require(deadline==uint256(original)+86400);vm.warp(block.timestamp+100);_coordinator();_checkpoint();(,,,,,,,uint64 same,)=runtimeEscrow.financialState(EVENT);require(same==deadline);_refund();
    }
    function testCompletedTournamentCannotEnterRecoveryOrRefund()public{
        _completeScenario();_coordinator();_bad(PokerTournamentRecovery420.Action.OBSERVE_ENTROPY,0,0,0);_bad(PokerTournamentRecovery420.Action.CHECKPOINT,0,0,0);_bad(PokerTournamentRecovery420.Action.BEGIN_REFUND,0,0,0);_bad(PokerTournamentRecovery420.Action.REFUND_CHUNK,0,0,1);
    }
    function testCanonicalPrizesResumeThroughIndependentCoordinators()public{
        _completeScenario();_coordinator();(,,,,bytes32 context,,)=host.eventState(EVENT);(,,,,,,bytes32 result,,uint32 unique)=host.standingsState(EVENT);PokerTournamentPurchaseEscrowState420.EventAccount memory e=runtimeEscrow.eventOf(EVENT);
        emit C7PayoutTermsData(abi.encode(EVENT,unique,e.prize,e.fees,prizePolicies.select(PRIZE_PLAN,unique)));emit C7FinancialSeedData(abi.encode(runtimeEscrow.FINANCIAL_DOMAIN(),block.chainid,address(runtimeEscrow),EVENT,e.manifest,context,result,prizePolicies.get(PRIZE_PLAN).digest,unique,e.prize,e.fees,runtimeEscrow.developmentFund()));
        _step(PokerTournamentRecovery420.Action.BEGIN_PRIZES,0,0,0);
        for(uint32 i;i<unique;i++){_coordinator();_step(PokerTournamentRecovery420.Action.LOAD_PRIZES,0,0,1);}
        for(uint32 i;i<unique;i++){_coordinator();_step(PokerTournamentRecovery420.Action.ALLOCATE_PRIZES,0,0,1);}
        for(uint32 i;i<unique;i++){_coordinator();require(_step(PokerTournamentRecovery420.Action.CLAIM_PRIZES,0,i,1)==i+1);}
        _withdrawAll();require(runtimeEscrow.totalWithdrawn()==824&&asset.balanceOf(address(feeRecipient))==24&&asset.balanceOf(address(recovery))==0);_emitFinalMoney();
    }
    function testUnstartedCancellationNeedsActualTechnicalDeadline()public{
        _fundedSeated();_coordinator();_step(PokerTournamentRecovery420.Action.TICK,0,0,0);_bad(PokerTournamentRecovery420.Action.REFUND_UNSTARTED,0,0,1);vm.warp(uint256(runtimeEscrow.eventOf(EVENT).readyAt)+600);_step(PokerTournamentRecovery420.Action.TICK,0,0,0);for(uint32 i;i<4;i++)require(_step(PokerTournamentRecovery420.Action.REFUND_UNSTARTED,0,i,1)==i+1);_withdrawAll();require(runtimeEscrow.totalWithdrawn()==412);
    }
    function testBoundedActionsRejectZeroAndOversizedChunks()public{
        _firstHands();_coordinator();_bad(PokerTournamentRecovery420.Action.REFUND_CHUNK,0,0,0);_bad(PokerTournamentRecovery420.Action.REFUND_CHUNK,0,0,33);_bad(PokerTournamentRecovery420.Action.DRAIN_QUEUE,0,0,17);_bad(PokerTournamentRecovery420.Action.EXPIRE_CHOICES,0,0,17);_bad(PokerTournamentRecovery420.Action.ALLOCATE_PRIZES,0,0,5);_bad(PokerTournamentRecovery420.Action.LOAD_PRIZES,0,0,17);_bad(PokerTournamentRecovery420.Action.CLAIM_PRIZES,0,0,17);
    }
    function testInvalidTableCursorAndUnusedArgumentsRejected()public{
        _firstHands();_coordinator();_bad(PokerTournamentRecovery420.Action.CANCEL_DEAL,0,0,0);_bad(PokerTournamentRecovery420.Action.CANCEL_DEAL,1,1,0);_bad(PokerTournamentRecovery420.Action.TICK,1,0,0);_bad(PokerTournamentRecovery420.Action.TICK,0,1,0);_fails(address(recovery),abi.encodeCall(recovery.snapshot,(EVENT,uint32(3))));
    }
    function testFuzzInterruptedRefundsConserveActualCustody(uint8 rawChunk,bool restart)public{
        _fundedSeated();_coordinator();bytes32 old=recovery.snapshot(EVENT,0);vm.warp(uint256(runtimeEscrow.eventOf(EVENT).readyAt)+600);_step(PokerTournamentRecovery420.Action.TICK,0,0,0);_fails(address(recovery),abi.encodeCall(recovery.advance,(EVENT,old,PokerTournamentRecovery420.Action.TICK,uint32(0),uint32(0),uint32(0))));
        uint32 cursor;uint32 chunk=uint32(rawChunk%16)+1;while(cursor<4){if(restart)_coordinator();cursor=_step(PokerTournamentRecovery420.Action.REFUND_UNSTARTED,0,cursor,chunk);require(runtimeEscrow.solvent()&&runtimeEscrow.totalLiability()==412&&runtimeEscrow.heldPrizes()+runtimeEscrow.heldFees()+runtimeEscrow.totalCredits()==412);}
        require(runtimeEscrow.credit(address(alice))==103&&runtimeEscrow.credit(address(bob))==103&&runtimeEscrow.credit(address(carol))==103&&runtimeEscrow.credit(address(dan))==103);_withdrawAll();require(runtimeEscrow.totalWithdrawn()==412&&asset.balanceOf(address(runtimeEscrow))==0);
    }
}
contract TournamentRecoveryRebuy420Test is TournamentRecoveryBase420 {
    function kind()internal pure override returns(PokerTournamentPolicy420.PurchaseKind){return PokerTournamentPolicy420.PurchaseKind.REBUY;}
    function folder()internal pure override returns(string memory){return "rebuy";}
    function testPendingRebuyExpiresBeforeRecoveryCanReleaseMoney()public{
        _firstHands();_play(handA,"tableA");_coordinator();vm.warp(ws8Engine.fundedEvidenceDeadline(handB));_step(PokerTournamentRecovery420.Action.CANCEL_DEAL,2,0,0);_checkpoint();(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);vm.warp(deadline);_bad(PokerTournamentRecovery420.Action.BEGIN_REFUND,0,0,0);require(_step(PokerTournamentRecovery420.Action.EXPIRE_CHOICES,0,0,1)==1);_step(PokerTournamentRecovery420.Action.EXPIRE_CHOICES,0,1,16);(,uint32 pending,,,,,,,)=host.standingsState(EVENT);require(pending==0);_refund();require(runtimeEscrow.totalWithdrawn()==412);
    }
}
