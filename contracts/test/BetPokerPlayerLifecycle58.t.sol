// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerIntegratedAdversarial54.t.sol";
import "./BetPokerLedgerReentrancy54.t.sol";
import "../src/bet/PokerPlayerRecovery420.sol";

interface VmLifecycle58 {function etch(address,bytes calldata)external;}
contract RejectExitToken58 {
    mapping(address=>uint256) public balanceOf;
    function transfer(address,uint256)external pure returns(bool){return false;}
}

/// @notice Every integration case uses the same genuinely proved funded hand.
/// No presence coordinator, transport assertion or replacement proof verifier.
contract PokerPlayerLifecycle58Test is BetPokerIntegratedFundedAdversarial54Test {
    PokerPlayerRecovery420 internal recoveryView;
    VmLifecycle58 constant faults58=VmLifecycle58(address(uint160(uint256(keccak256("hevm cheat code")))));
    event LifecycleReconnectRecord(string stage,bytes32 handId,bytes32 stateRoot,uint64 actionNonce,
        uint64 deadline,uint64 lifecycleNonce,bool sittingOut,bool disconnected,bool leaveRequested,uint256 chips,uint256 total);
    event LifecycleComponentIdentity(address projection,bytes32 projectionCodeHash,uint256 projectionBytes,
        address seatLedger,bytes32 ledgerCodeHash,uint256 ledgerBytes);
    constructor(){recoveryView=new PokerPlayerRecovery420(address(ws8Engine));}
    function _epoch()private view returns(uint64){return ledger.seatOf(TABLE,0).epoch;}
    function _nonce()private view returns(uint64){return ledger.lifecycleOf(TABLE,0).nonce;}
    function _disconnect(bool value)private {uint64 e=_epoch();uint64 n=_nonce();cheat54.prank(PLAYER);ledger.setDisconnected(TABLE,value,e,n);}
    function _requestOut(bool value)private {uint64 e=_epoch();uint64 n=_nonce();cheat54.prank(PLAYER);ledger.requestSitOut(TABLE,value,e,n);}
    function _requestExit()private {uint64 e=_epoch();uint64 n=_nonce();cheat54.prank(PLAYER);ledger.requestLeave(TABLE,e,n);}
    function _rejectPreviousSigner(bytes32 id)private {
        PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);uint64 expiry=uint64(block.timestamp+50);
        bytes32 moveHash=keccak256(abi.encode(ws8Engine.ACTION_DOMAIN(),id,uint8(g.phase),uint8(0),uint8(PokerNLHEStorage420.Move.CALL),uint256(10)));
        bytes32 digest=ws8Signing.actionDigest(id,0,g.nonce+1,g.stateRoot,moveHash,expiry);
        (uint8 v,bytes32 r,bytes32 s)=ws8vm.sign(WS8_PLAYER_KEY,digest);
        (bool ok,bytes memory reason)=address(ws8Engine).call(abi.encodeCall(PokerNLHEBetting420.action,
            (id,0,PokerNLHEStorage420.Move.CALL,10,expiry,g.stateRoot,abi.encodePacked(r,s,v))));
        require(!ok&&reason.length>=4&&bytes4(reason)==PokerActionKeys420.InvalidSignature.selector,"old session signer accepted");
    }
    function _fold(bytes32 id)private {_signed(id,0,PokerNLHEStorage420.Move.FOLD,0,WS8_PLAYER_KEY);}
    function _record(string memory stage,bytes32 id)private {
        PokerPlayerRecovery420.Snapshot memory s=recoveryView.snapshot(TABLE,PLAYER,id);
        emit LifecycleReconnectRecord(stage,id,s.game.stateRoot,s.game.nonce,s.game.deadline,
            s.lifecycle.nonce,s.seat.sittingOut,s.lifecycle.disconnected,s.lifecycle.leaveRequested,s.seat.chips,ledger.totalChips(TABLE));
    }
    function test58DisconnectedTurnReconnectionAndTimeoutEvidence()public {
        bytes32 id=_ready();bytes32 root=ws8Engine.gameOf(id).stateRoot;
        emit LifecycleComponentIdentity(address(recoveryView),address(recoveryView).codehash,address(recoveryView).code.length,
            address(ledger),address(ledger).codehash,address(ledger).code.length);
        uint64 deadline=ws8Engine.gameOf(id).deadline;bytes32 escrow=ledger.lockedSnapshot(TABLE);
        _record("before",id);_disconnect(true);_record("disconnected",id);
        _disconnect(false);_requestOut(false);_record("reconnected",id);
        require(ws8Engine.gameOf(id).stateRoot==root&&ws8Engine.gameOf(id).deadline==deadline,"reconnect reset clock/root");
        require(ledger.lockedSnapshot(TABLE)==escrow&&ledger.seatingEpoch(TABLE)==2,"reconnect changed locked context");
        cheat54.warp(deadline+1);cheat54.prank(OTHER);ws8Engine.timeout(id);_record("timedout",id);
        require(ws8Engine.playerOf(id,0).folded&&ledger.lifecycleOf(TABLE,0).sitOutNextHand,"timeout did not fold and sit out");
        ws8Engine.settle(id,_policy());_record("settled",id);
        require(ledger.seatOf(TABLE,0).chips==390&&ledger.seatOf(TABLE,1).chips==410,"blind-only deterministic loss");
        require(ledger.seatOf(TABLE,0).sittingOut&&!ledger.eligibleForNextHand(TABLE,0),"timeout player re-admitted");
    }
    function test58QueuedExitAfterGenuineShowdown()public {
        bytes32 id=_ready();_disconnect(true);_requestExit();
        _showdown(id);_settle(id);
        uint64 e=_epoch();uint64 n=_nonce();uint256 before=coin.balanceOf(PLAYER);
        cheat54.prank(OTHER);ledger.completeLeave(TABLE,PLAYER,e,n);
        require(coin.balanceOf(PLAYER)==before+399&&ledger.playerSeatPlusOne(TABLE,PLAYER)==0,"exit not paid to owner");
        require(ledger.totalChips(TABLE)==399&&coin.balanceOf(address(ledger))==399,"exit escrow mismatch");
        require(coin.balanceOf(address(ws8Bonds))==1600,"exit spent provider collateral");
        PokerPlayerRecovery420.Snapshot memory s=recoveryView.snapshot(TABLE,PLAYER,id);
        require(s.settled&&s.seatPlusOne==0&&s.receipt.finalChips[0]==399&&s.signer==address(0),"terminal recovery lost receipt");
    }
    function test58QueuedSitOutCannotChangeCurrentCardsActionsOrSnapshot()public {
        bytes32 id=_ready();bytes32 snapshot=deal.snapshotFor(TABLE,3);_requestOut(true);
        require(!ledger.seatOf(TABLE,0).sittingOut&&!ledger.eligibleForNextHand(TABLE,0),"deferred eligibility");
        require(deal.snapshotFor(TABLE,3)==snapshot,"changed funded snapshot");
        _showdown(id);_settle(id);
        require(ledger.seatOf(TABLE,0).sittingOut&&ledger.seatingEpoch(TABLE)==3,"next-hand sitout not applied");
        uint256[9] memory ranks=ws8Outcome.showdownRanks(id);require(ranks[0]==ranks[1]&&ranks[0]!=0,"historical ranks changed");
    }
    function test58QueuedExitCannotCashOutActiveOrFoldedHand()public {
        bytes32 id=_ready();_requestExit();uint64 e=_epoch();uint64 n=_nonce();
        cheat54.expectRevert(PokerSeatLedger420.Locked.selector);ledger.completeLeave(TABLE,PLAYER,e,n);
        _fold(id);
        cheat54.expectRevert(PokerSeatLedger420.Locked.selector);ledger.completeLeave(TABLE,PLAYER,e,n);
        _escrowUnchanged(id);
    }
    function test58CancelExitDoesNotSilentlyReturnOrCancelSitOut()public {
        bytes32 id=_ready();_requestExit();uint64 e=_epoch();uint64 n=_nonce();
        cheat54.prank(PLAYER);ledger.cancelLeave(TABLE,e,n);
        require(!ledger.lifecycleOf(TABLE,0).leaveRequested&&ledger.lifecycleOf(TABLE,0).sitOutNextHand,"cancel silently resumed");
        _fold(id);ws8Engine.settle(id,_policy());
        require(ledger.seatOf(TABLE,0).sittingOut,"cancel silently re-admitted");_requestOut(false);
        require(ledger.eligibleForNextHand(TABLE,0),"explicit return denied");
    }
    function test58ReconnectRequiresExplicitReturnAndDoesNotGrantNewTurn()public {
        bytes32 id=_ready();_disconnect(true);_fold(id);ws8Engine.settle(id,_policy());
        _disconnect(false);require(!ledger.eligibleForNextHand(TABLE,0),"reconnect sits in");
        _requestOut(false);require(ledger.eligibleForNextHand(TABLE,0),"explicit return");
        require(ws8Engine.turnOf(id).allowedMoves==0,"terminal reconnect granted turn");
    }
    function test58TimeoutCheckContinuesVerifiedStreetAndSitsOutNextHand()public {
        bytes32 id=_ready();_signed(id,0,PokerNLHEStorage420.Move.CALL,10,WS8_PLAYER_KEY);
        cheat54.warp(ws8Engine.gameOf(id).deadline+1);cheat54.prank(OTHER);ws8Engine.timeout(id);
        require(!ws8Engine.playerOf(id,1).folded&&ledger.lifecycleOf(TABLE,1).sitOutNextHand,"free check became fold");
        for(uint8 p=5;p<=7;p++)_reveal(id,1,p);ws8Live.advance(id,1);_checks(id);
        _reveal(id,2,9);ws8Live.advance(id,2);_checks(id);
        _reveal(id,3,11);ws8Live.advance(id,3);_checks(id);
        for(uint8 p;p<4;p++)_reveal(id,4,p);_settle(id);
        require(ledger.seatOf(TABLE,1).sittingOut,"timed out player admitted next hand");
    }
    function test58DisconnectedAllInPlayerRetainsProvenShowdownEligibility()public {
        bytes32 id=_ready();_signed(id,0,PokerNLHEStorage420.Move.RAISE,390,WS8_PLAYER_KEY);
        _signed(id,1,PokerNLHEStorage420.Move.CALL,380,WS8_OPPONENT_KEY);_disconnect(true);_requestExit();
        for(uint8 p=5;p<=7;p++)_reveal(id,1,p);ws8Live.advance(id,1);
        _reveal(id,2,9);ws8Live.advance(id,2);_reveal(id,3,11);ws8Live.advance(id,3);
        for(uint8 p;p<4;p++)_reveal(id,4,p);ws8Engine.settle(id,_policy());
        require(ledger.seatOf(TABLE,0).chips==390&&ledger.seatOf(TABLE,1).chips==390&&coin.balanceOf(WS8_RAKES)==20,"all-in disconnect changed award");
        ledger.completeLeave(TABLE,PLAYER,_epoch(),_nonce());
    }
    function test58DisconnectDuringFundedAdmissionDoesNotInvalidateExistingHand()public {
        bytes32 id=_shuffled();_disconnect(true);_requestExit();_deliver(id);ws8Engine.start(id,0,60);
        _fold(id);ws8Engine.settle(id,_policy());ledger.completeLeave(TABLE,PLAYER,_epoch(),_nonce());
    }
    function test58IdleDisconnectedSeatCannotBeginNewDeal()public {
        _prepared();_disconnect(true);bytes32 snapshot=deal.snapshotFor(TABLE,3);
        cheat54.expectRevert(PokerConfidentialDeal420.InvalidInput.selector);
        cheat54.prank(ADMIN);deal.begin(TABLE,1,uint64(block.timestamp+60),keccak256("prior"),snapshot,3);
        _disconnect(false);_requestOut(false);_begin(1);
    }
    function test58IdleEligibilityChangeInvalidatesPreparedUnfundedDeal()public {
        _prepared();bytes32 id=_begin(1);_disconnect(true);_disconnect(false);_requestOut(false);
        cheat54.expectRevert(PokerConfidentialDeal420.ParticipantsChanged.selector);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("cannot revive old context"));
    }
    function test58OnlySeatOwnerCanRequestPresenceOrExit()public {
        _ready();uint64 e=_epoch();
        cheat54.expectRevert(PokerSeatLedger420.NotSeated.selector);cheat54.prank(ADMIN);ledger.setDisconnected(TABLE,true,e,0);
        cheat54.expectRevert(PokerSeatLedger420.NotSeated.selector);cheat54.prank(OTHER);ledger.requestLeave(TABLE,e,0);
        cheat54.expectRevert(PokerSeatLedger420.StaleLifecycle.selector);cheat54.prank(PLAYER_B);ledger.requestLeave(TABLE,e,0);
        require(_nonce()==0,"operator changed player presence");
    }
    function test58StaleNonceAndSeatEpochCannotOverwriteNewerIntent()public {
        _ready();uint64 e=_epoch();_disconnect(true);
        cheat54.expectRevert(PokerSeatLedger420.StaleLifecycle.selector);cheat54.prank(PLAYER);ledger.setDisconnected(TABLE,false,e,0);
        uint64 n=_nonce();cheat54.expectRevert(PokerSeatLedger420.StaleLifecycle.selector);cheat54.prank(PLAYER);ledger.requestLeave(TABLE,e+1,n);
        require(ledger.lifecycleOf(TABLE,0).disconnected,"stale intent applied");
    }
    function test58TimeoutInvalidatesStaleLifecycleIntent()public {
        bytes32 id=_ready();uint64 e=_epoch();cheat54.warp(ws8Engine.gameOf(id).deadline+1);ws8Engine.timeout(id);
        cheat54.expectRevert(PokerSeatLedger420.StaleLifecycle.selector);cheat54.prank(PLAYER);ledger.requestLeave(TABLE,e,0);
    }
    function test58TransportAndOtherEnginesCannotFabricateTimeout()public {
        bytes32 id=_ready();
        cheat54.expectRevert(PokerSeatLedger420.SettlementUnauthorized.selector);ledger.markTimedOut(TABLE,id,0);
        require(_nonce()==0&&!ledger.lifecycleOf(TABLE,0).sitOutNextHand,"forged timeout");
        cheat54.expectRevert(PokerNLHEStorage420.TooEarly.selector);ws8Engine.timeout(id);
    }
    function test58RevokedPresenceCapabilityCannotChangeIntentButTimeoutWorks()public {
        bytes32 id=_ready();cap.grant(PLAYER,BetIds420.ACTION_POKER_SIT_OUT,auth.scopeForTable(TABLE),false);
        uint64 e=_epoch();cheat54.expectRevert(PokerSeatLedger420.Unauthorized.selector);
        cheat54.prank(PLAYER);ledger.setDisconnected(TABLE,true,e,0);
        cheat54.warp(ws8Engine.gameOf(id).deadline+1);ws8Engine.timeout(id);
        require(ledger.lifecycleOf(TABLE,0).sitOutNextHand,"capability blocked timeout liveness");
    }
    function test58QueuedCashoutRechecksCurrentWithdrawalCapability()public {
        bytes32 id=_ready();_requestExit();_fold(id);ws8Engine.settle(id,_policy());uint64 e=_epoch();uint64 n=_nonce();
        cap.grant(PLAYER,BetIds420.ACTION_POKER_WITHDRAW,auth.scopeForTable(TABLE),false);
        cheat54.expectRevert(PokerSeatLedger420.Unauthorized.selector);ledger.completeLeave(TABLE,PLAYER,e,n);
        require(ledger.lifecycleOf(TABLE,0).leaveRequested&&ledger.seatOf(TABLE,0).chips==390,"revocation lost claim");
        cap.grant(PLAYER,BetIds420.ACTION_POKER_WITHDRAW,auth.scopeForTable(TABLE),true);ledger.completeLeave(TABLE,PLAYER,e,n);
    }
    function test58ExitRemainsAvailableWhenPausedAndOperatorSuspended()public {
        bytes32 id=_ready();_requestExit();cheat54.prank(ADMIN);registry.pause(TABLE);
        ops.setActive(OP,false);emergency.setHalted(true);_fold(id);ws8Engine.settle(id,_policy());
        ledger.completeLeave(TABLE,PLAYER,_epoch(),_nonce());require(ledger.playerSeatPlusOne(TABLE,PLAYER)==0,"paused exit stranded");
    }
    function test58UnavailableProvidersRefundThenQueuedExit()public {
        bytes32 id=_funded();_disconnect(true);_requestExit();cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));
        ws8Engine.cancelWithheldDeal(id);require(ws8Engine.handAborted(id),"missing proof was accepted");
        require(ledger.seatOf(TABLE,0).chips==400&&ledger.seatOf(TABLE,0).sittingOut,"refund or pending state lost");
        ledger.completeLeave(TABLE,PLAYER,_epoch(),_nonce());
    }
    function test58DisconnectedRecipientWithoutAcknowledgmentUsesBoundedRefund()public {
        bytes32 id=_shuffled();_keys();_disconnect(true);_requestExit();
        cheat54.prank(PROVIDER_A);ws8Delivery.publish(id,keccak256("WS8.AUTHENTICATED.DECK"),keccak256("WS8.ENCRYPTED.MANIFEST"));
        for(uint8 pos;pos<4;pos++)for(uint8 provider;provider<2;provider++)_deliveryShare(id,pos,provider);
        for(uint8 seat;seat<2;seat++){
            bytes32 envelope=ws8Book.envelopeHashFor(id,seat);bytes32 fingerprint=ws8Recipients.fingerprintOf(TABLE,seat);
            cheat54.prank(seat==0?PROVIDER_A:PROVIDER_B);ws8Delivery.bindEnvelope(id,seat,envelope,fingerprint);
        }
        bytes32 receipt=ws8Delivery.receiptDigest(id,1);cheat54.prank(PLAYER_B);ws8Delivery.acknowledge(id,1,receipt);
        require(ws8Book.allVerified(id)&&!ws8Delivery.allAcknowledged(id),"missing recipient was fabricated");
        cheat54.expectRevert(PokerNLHEStorage420.InvalidState.selector);ws8Engine.start(id,0,60);
        cheat54.expectRevert(PokerNLHEStorage420.TooEarly.selector);ws8Engine.cancelWithheldDelivery(id);
        cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDelivery(id);
        require(ws8Engine.handAborted(id)&&ledger.seatOf(TABLE,0).chips==400,"no-ack hand was played or charged");
        require(coin.balanceOf(WS8_RISK)==0&&ws8Bonds.available(address(coin),PROVIDER_A)==800&&ws8Bonds.available(address(coin),PROVIDER_B)==800,"player disconnect blamed providers");
        ledger.completeLeave(TABLE,PLAYER,_epoch(),_nonce());
    }
    function test58QueuedLeaveSurvivesBoundedMissingStreetRecovery()public {
        bytes32 id=_ready();_preflop(id);_disconnect(true);_requestExit();
        cheat54.warp(ws8Engine.evidenceDueAt(id)+1);ws8Engine.beginMissingEvidenceRecovery(id);
        PokerPlayerRecovery420.Snapshot memory s=recoveryView.snapshot(TABLE,PLAYER,id);
        require(s.recoveryActive&&s.recoveryStateRoot==s.game.stateRoot&&s.recoveryFinalizableAt>block.timestamp,"reconnect lost recovery state");
        uint64 e=_epoch();uint64 n=_nonce();
        cheat54.expectRevert(PokerSeatLedger420.Locked.selector);ledger.completeLeave(TABLE,PLAYER,e,n);
        cheat54.warp(s.recoveryFinalizableAt);ws8Engine.finalizeMissingEvidenceRecovery(id);
        require(ws8Engine.handAborted(id)&&ledger.seatOf(TABLE,0).chips==400&&ledger.seatOf(TABLE,0).sittingOut,"recovery lost original stack or next-hand intent");
        require(coin.balanceOf(WS8_RISK)==1600,"genuinely withheld street shares not charged to providers");
        ledger.completeLeave(TABLE,PLAYER,e,n);
        s=recoveryView.snapshot(TABLE,PLAYER,id);require(s.aborted&&s.seatPlusOne==0&&!s.recoveryActive,"terminal refund recovery view stale");
    }
    function test58FailedCashoutAtomicallyPreservesSeatIntentAndEscrow()public {
        bytes32 id=_ready();_requestExit();_fold(id);ws8Engine.settle(id,_policy());
        uint64 e=_epoch();uint64 n=_nonce();uint64 epoch=ledger.seatingEpoch(TABLE);bytes memory original=address(coin).code;
        RejectExitToken58 rejector=new RejectExitToken58();faults58.etch(address(coin),address(rejector).code);
        cheat54.expectRevert(PokerSeatLedger420.TransferFailed.selector);ledger.completeLeave(TABLE,PLAYER,e,n);
        require(ledger.seatOf(TABLE,0).chips==390&&ledger.lifecycleOf(TABLE,0).leaveRequested&&ledger.seatingEpoch(TABLE)==epoch,"failed exit consumed claim");
        faults58.etch(address(coin),original);ledger.completeLeave(TABLE,PLAYER,e,n);
    }
    function test58CashoutCallbackCannotReenterCompleteLeave()public {
        bytes32 id=_ready();_requestExit();_fold(id);ws8Engine.settle(id,_policy());
        uint64 e=_epoch();uint64 n=_nonce();uint256 before=coin.balanceOf(PLAYER);
        PokerReentrantToken54 token=new PokerReentrantToken54();faults58.etch(address(coin),address(token).code);
        PokerReentrantToken54(address(coin)).prepareCallback(address(ledger),abi.encodeCall(ledger.completeLeave,(TABLE,PLAYER,e,n)));
        ledger.completeLeave(TABLE,PLAYER,e,n);
        require(PokerReentrantToken54(address(coin)).callbackAttempted()&&!PokerReentrantToken54(address(coin)).callbackSucceeded(),"cashout callback accepted");
        require(PokerReentrantToken54(address(coin)).callbackRevertSelector()==PokerSeatLedger420.Reentrancy.selector,"wrong callback rejection");
        require(coin.balanceOf(PLAYER)==before+390&&ledger.totalChips(TABLE)==410,"duplicate cashout");
    }
    function test58ExitReplayAndRebuyCannotReusePreviousSeatIntent()public {
        bytes32 id=_ready();_requestExit();_fold(id);ws8Engine.settle(id,_policy());uint64 e=_epoch();uint64 n=_nonce();
        ledger.completeLeave(TABLE,PLAYER,e,n);
        cheat54.expectRevert(PokerSeatLedger420.NotSeated.selector);ledger.completeLeave(TABLE,PLAYER,e,n);
        cheat54.prank(PLAYER);ledger.buyIn(TABLE,0,400);
        require(_epoch()>e&&_nonce()==0&&ledger.eligibleForNextHand(TABLE,0),"new seat inherited old lifecycle");
        cheat54.expectRevert(PokerSeatLedger420.StaleLifecycle.selector);cheat54.prank(PLAYER);ledger.requestLeave(TABLE,e,0);
        PokerPlayerRecovery420.Snapshot memory s=recoveryView.snapshot(TABLE,PLAYER,bytes32(0));require(s.signer==address(0),"old session survived reseat");
    }
    function test58ReconnectSnapshotRotatedSignerAndCanonicalTurn()public {
        bytes32 id=_ready();_disconnect(true);_disconnect(false);
        uint256 key=0x580058;cheat54.prank(PLAYER);ws8Signing.bindSigner(TABLE,ws8vm.addr(key));
        PokerPlayerRecovery420.Snapshot memory s=recoveryView.snapshot(TABLE,PLAYER,bytes32(0));
        require(s.handId==id&&s.signer==ws8vm.addr(key)&&s.signerSerial==2&&s.turn.nonce==1&&s.turn.seat==0,"snapshot stale authority");
        require(s.chainId==block.chainid&&s.blockNumber==block.number&&s.timestamp==block.timestamp&&s.escrowSnapshot==ledger.lockedSnapshot(TABLE),"snapshot anchor");
        _rejectPreviousSigner(id);
        _signed(id,0,PokerNLHEStorage420.Move.CALL,10,key);
    }
    function test58SnapshotRejectsWrongHandAndUnknownTable()public {
        _ready();cheat54.expectRevert(PokerPlayerRecovery420.InvalidContext.selector);recoveryView.snapshot(TABLE,PLAYER,keccak256("unknown hand"));
        cheat54.expectRevert(PokerTableRegistry420.NotFound.selector);recoveryView.snapshot(keccak256("other table"),PLAYER,bytes32(0));
        cheat54.expectRevert(PokerPlayerRecovery420.InvalidContext.selector);recoveryView.snapshot(TABLE,address(0),bytes32(0));
    }
    function test58CannotReturnWhileDisconnectedOrLeaving()public {
        _ready();_disconnect(true);uint64 e=_epoch();uint64 n=_nonce();
        cheat54.expectRevert(PokerSeatLedger420.InvalidLifecycle.selector);cheat54.prank(PLAYER);ledger.requestSitOut(TABLE,false,e,n);
        _disconnect(false);_requestExit();n=_nonce();
        cheat54.expectRevert(PokerSeatLedger420.InvalidLifecycle.selector);cheat54.prank(PLAYER);ledger.requestSitOut(TABLE,false,e,n);
    }
}
