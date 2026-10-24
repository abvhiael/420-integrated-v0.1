// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerIntegratedAdversarial54.t.sol";

interface VmShowdown57 {function etch(address,bytes calldata)external;}
contract RejectRakeToken57 {
    mapping(address=>uint256)public balanceOf;
    function transfer(address,uint256)external pure returns(bool){return false;}
}
contract ForgedOutcome57 {
    function calculate(bytes32,PokerCanonicalRake420.Policy calldata)external pure
        returns(uint256[9] memory chips,uint256 fee){chips[0]=800;fee=0;}
}
contract FailedDependency57 {
    error DependencyFailure();
    fallback()external {revert DependencyFailure();}
}

/// @notice Every 5A.7 case uses the production funded hand, independent provider
/// bonds and real registered Groth16 verifiers. Runtime fault injection only
/// tests rejection/rollback; it never manufactures proof acceptance.
contract PokerShowdown57Test is BetPokerIntegratedFundedAdversarial54Test {
    VmShowdown57 constant faults=VmShowdown57(address(uint160(uint256(keccak256("hevm cheat code")))));
    bool private singleWinner;

    function _data(string memory name)internal override returns(bytes memory){
        if(!singleWinner)return super._data(name);
        return ws8vm.readFileBinary(string.concat("../clients/420bet-poker/zkshuffle/fixtures/ws8/winner/proofs/",name));
    }
    function _reveal(bytes32 id,uint8 street,uint8 pos)internal override {
        uint8 card=singleWinner&&pos==0?12:pos;
        _partial(id,street,pos,0);_partial(id,street,pos,1);
        bytes memory proof=_proof(string.concat("WS8Unmask",_n(street),_n(pos)));
        ws8Live.reveal(id,street,pos,card,WS8VerifierData.keys(),proof);
        emit WS8VerifiedPublicStatement(string.concat("WS8Unmask",_n(street),_n(pos)),proof);
        require(ws8Live.slotOf(id,pos).opened&&ws8Live.slotOf(id,pos).card==card,"genuine opened card");
    }
    function _river(bytes32 id)private {
        _preflop(id);
        for(uint8 p=5;p<=7;p++)_reveal(id,1,p);
        ws8Live.advance(id,1);emit WS8StreetRecord(1);_checks(id);
        _reveal(id,2,9);ws8Live.advance(id,2);emit WS8StreetRecord(2);_checks(id);
        _reveal(id,3,11);ws8Live.advance(id,3);emit WS8StreetRecord(3);_checks(id);
    }
    function _empty(bytes32 id)private view {
        require(ws8Engine.settlementReceipt(id).terminalTranscript==bytes32(0),"failed/pending settlement has no receipt");
        require(ws8Engine.terminalTranscript(id)==bytes32(0)&&!ws8Engine.handSettled(id),"no premature finality");
    }
    function _receipt(bytes32 id,bytes32 snapshot,uint256 a,uint256 b,uint256 fee,bool contested)private view {
        PokerNLHEStorage420.SettlementReceipt memory r=ws8Engine.settlementReceipt(id);
        PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);
        require(r.tableId==TABLE&&r.stateRoot==g.stateRoot&&r.actionRoot==ws8Engine.actionTranscriptRoot(id),"state/action binding");
        require(r.escrowSnapshot==snapshot&&snapshot!=bytes32(0)&&r.calculatorCodeHash==address(ws8Outcome).codehash,"escrow/calculator binding");
        require(r.terminalTranscript==ws8Engine.terminalTranscript(id)&&r.terminalTranscript!=bytes32(0),"sealed receipt");
        require(r.finalChips[0]==a&&r.finalChips[1]==b&&r.rake==fee&&a+b+fee==800,"exact receipt awards");
        for(uint8 seat=2;seat<9;seat++)require(r.finalChips[seat]==0,"no phantom payout");
        require(r.actionNonce==g.nonce&&r.settledAt==block.timestamp&&r.seatsMask==3&&r.contested==contested,"terminal context");
        require(ledger.activeHand(TABLE)==bytes32(0)&&ledger.handConsumed(id)&&ws8Engine.handSettled(id),"atomic consumption");
        require(ledger.seatOf(TABLE,0).chips==a&&ledger.seatOf(TABLE,1).chips==b,"ledger agrees");
        require(coin.balanceOf(address(ledger))==800-fee&&coin.balanceOf(WS8_RAKES)==fee,"exact token custody");
        require(ws8Bonds.available(address(coin),PROVIDER_A)==800&&ws8Bonds.available(address(coin),PROVIDER_B)==800,"separate bonds released");
    }
    function test57SharedBoardTieSealsCanonicalReceipt()public {
        bytes32 id=_ready();bytes32 snapshot=ledger.lockedSnapshot(TABLE);_showdown(id);
        uint256[9] memory ranks=ws8Outcome.showdownRanks(id);
        require(ranks[0]==ranks[1]&&ranks[0]>0,"board tie");
        ws8Engine.settle(id,_policy());_receipt(id,snapshot,399,399,2,true);
    }
    function test57GenuineSingleWinnerShowdown()public {
        singleWinner=true;bytes32 id=_ready();bytes32 snapshot=ledger.lockedSnapshot(TABLE);_showdown(id);
        uint256[9] memory ranks=ws8Outcome.showdownRanks(id);
        require(ranks[0]>ranks[1]&&ranks[1]>0,"proved ace-high beats king-high flush");
        ws8Engine.settle(id,_policy());_receipt(id,snapshot,418,380,2,true);
        emit WS8QualifiedSettlement(id,ws8Engine.terminalTranscript(id),418,380,2);
    }
    function test57UncontestedWinnerNeedsNoHoleOrBoardDisclosure()public {
        bytes32 id=_ready();bytes32 snapshot=ledger.lockedSnapshot(TABLE);
        _signed(id,0,PokerNLHEStorage420.Move.FOLD,0,WS8_PLAYER_KEY);
        ws8Engine.settle(id,_policy());_receipt(id,snapshot,390,410,0,false);
        require(!ws8Live.slotOf(id,0).opened&&!ws8Live.slotOf(id,5).opened,"private folded hand stays private");
    }
    function test57EverySurvivorMustHaveBothAuthenticatedHoleCards()public {
        bytes32 id=_ready();_river(id);
        for(uint8 pos=0;pos<3;pos++)_reveal(id,4,pos);
        cheat54.expectRevert(PokerNativeOutcome420.InvalidState.selector);ws8Outcome.showdownRanks(id);
        cheat54.expectRevert(PokerNativeOutcome420.InvalidState.selector);ws8Engine.settle(id,_policy());
        _empty(id);_escrowUnchanged(id);
        _reveal(id,4,3);ws8Engine.settle(id,_policy());
        require(ledger.seatOf(TABLE,0).chips==399,"late valid proof completes real settlement");
    }
    function test57PrematureSettlementAndRankingCannotChooseWinner()public {
        bytes32 id=_ready();
        cheat54.expectRevert(PokerNLHEStorage420.InvalidState.selector);ws8Engine.settle(id,_policy());
        cheat54.expectRevert(PokerNativeOutcome420.InvalidState.selector);ws8Outcome.showdownRanks(id);
        _empty(id);_escrowUnchanged(id);
    }
    function test57FoldedHoleCardsCannotBePubliclyOpened()public {
        bytes32 id=_ready();
        _signed(id,0,PokerNLHEStorage420.Move.FOLD,0,WS8_PLAYER_KEY);
        uint256[8] memory points=abi.decode(_data("WS8Partial400.points"),(uint256[8]));
        bytes memory proof=_proof("WS8Partial400");
        cheat54.expectRevert(PokerLiveCardReveals420.WrongStreet.selector);
        cheat54.prank(PROVIDER_A);ws8Live.submitShare(id,4,0,0,points,proof);
        _empty(id);_escrowUnchanged(id);
        require(!ws8Live.slotOf(id,0).shareA,"folded hole remains confidential");
    }
    function test57CallerCannotSubmitPayoutVectorToLedger()public {
        bytes32 id=_ready();_showdown(id);uint256[9] memory forged;forged[0]=800;
        cheat54.expectRevert(PokerSeatLedger420.SettlementUnauthorized.selector);
        ledger.settleReservedHand(TABLE,id,forged,0);_empty(id);_escrowUnchanged(id);
    }
    function test57OutOfTablePayoutSlotsAreRejected()public {
        bytes32 id=_ready();uint256[9] memory forged;forged[0]=400;forged[1]=400;forged[8]=1;
        cheat54.expectRevert(PokerSeatLedger420.SettlementInvalid.selector);
        cheat54.prank(address(ws8Engine));ledger.settleReservedHand(TABLE,id,forged,0);
        _empty(id);_escrowUnchanged(id);
    }
    function test57ChangedCalculatorRuntimeCannotSettle()public {
        bytes32 id=_ready();_showdown(id);bytes memory original=address(ws8Outcome).code;
        ForgedOutcome57 forged=new ForgedOutcome57();faults.etch(address(ws8Outcome),address(forged).code);
        cheat54.expectRevert(PokerNLHEStorage420.InvalidState.selector);ws8Engine.settle(id,_policy());
        _empty(id);_escrowUnchanged(id);faults.etch(address(ws8Outcome),original);
        ws8Engine.settle(id,_policy());
    }
    function test57ChangedCalculatorRuntimeCannotProposeDisputedWinner()public {
        bytes32 id=_ready();_showdown(id);
        cheat54.prank(PLAYER);ws8Disputes.dispute(id,keccak256("real seat claim"));
        bytes memory original=address(ws8Outcome).code;ForgedOutcome57 forged=new ForgedOutcome57();faults.etch(address(ws8Outcome),address(forged).code);
        cheat54.expectRevert(PokerNLHEStorage420.InvalidState.selector);ws8Engine.proposeDisputeResolution(id,_policy());
        require(ws8Disputes.resolutionOf(id).proposedAt==0,"no unpinned proposal");
        _empty(id);_escrowUnchanged(id);faults.etch(address(ws8Outcome),original);
        ws8Engine.proposeDisputeResolution(id,_policy());
    }
    function test57RakeTransferFailureRollsBackReceiptAndCustody()public {
        bytes32 id=_ready();_showdown(id);bytes memory original=address(coin).code;
        RejectRakeToken57 rejector=new RejectRakeToken57();faults.etch(address(coin),address(rejector).code);
        cheat54.expectRevert(PokerSeatLedger420.TransferFailed.selector);ws8Engine.settle(id,_policy());
        faults.etch(address(coin),original);_empty(id);_escrowUnchanged(id);
        require(coin.balanceOf(WS8_RAKES)==0&&ledger.seatOf(TABLE,0).chips==400,"rake/awards rolled back");
        ws8Engine.settle(id,_policy());
    }
    function test57BondCloseFailureRollsBackPaidRakeAndReceipt()public {
        bytes32 id=_ready();_showdown(id);bytes memory original=address(ws8Bonds).code;
        FailedDependency57 failure=new FailedDependency57();faults.etch(address(ws8Bonds),address(failure).code);
        cheat54.expectRevert(FailedDependency57.DependencyFailure.selector);ws8Engine.settle(id,_policy());
        faults.etch(address(ws8Bonds),original);_empty(id);_escrowUnchanged(id);
        require(coin.balanceOf(WS8_RAKES)==0&&ledger.seatOf(TABLE,0).chips==400,"post-transfer rollback");
        ws8Engine.settle(id,_policy());
    }
    function test57RakeCallbackCannotPublishSecondReceiptOrSettleTwice()public {
        bytes32 id=_ready();_showdown(id);bytes32 snapshot=ledger.lockedSnapshot(TABLE);
        WS8CallbackToken54 hostile=WS8CallbackToken54(address(coin));
        hostile.prepareCallback(address(ws8Engine),abi.encodeCall(PokerNLHEBetting420.settle,(id,_policy())));
        ws8Engine.settle(id,_policy());_receipt(id,snapshot,399,399,2,true);
        require(hostile.callbackAttempted()&&!hostile.callbackSucceeded(),"actual callback rejected");
        require(hostile.callbackError()==PokerNLHEStorage420.InvalidState.selector,"one terminal write");
    }
    function test57DisputedShowdownAppealHoldsPaymentUntilExactDeadline()public {
        bytes32 id=_ready();_showdown(id);bytes32 snapshot=ledger.lockedSnapshot(TABLE);
        cheat54.prank(PLAYER);ws8Disputes.dispute(id,keccak256("seat evidence"));
        ws8Engine.proposeDisputeResolution(id,_policy());
        cheat54.prank(PLAYER_B);ws8Disputes.appeal(id,keccak256("one appeal"));
        uint64 deadline=ws8Disputes.resolutionOf(id).executableAfter;
        cheat54.warp(deadline-1);
        cheat54.expectRevert(PokerActionDisputeClock420.Premature.selector);ws8Engine.settle(id,_policy());
        _empty(id);_escrowUnchanged(id);cheat54.warp(deadline);
        ws8Engine.settle(id,_policy());_receipt(id,snapshot,399,399,2,true);
        require(ws8Disputes.resolutionOf(id).finalized,"objective proposal consumed");
    }
    function test57ReceiptAndRanksSurviveCashoutAndTablePause()public {
        bytes32 id=_ready();_showdown(id);ws8Engine.settle(id,_policy());
        bytes32 receiptHash=keccak256(abi.encode(ws8Engine.settlementReceipt(id)));
        uint256[9] memory ranks=ws8Outcome.showdownRanks(id);
        cheat54.prank(ADMIN);registry.pause(TABLE);
        cheat54.prank(PLAYER);ledger.leave(TABLE);
        require(keccak256(abi.encode(ws8Engine.settlementReceipt(id)))==receiptHash,"durable archived receipt");
        require(keccak256(abi.encode(ws8Outcome.showdownRanks(id)))==keccak256(abi.encode(ranks)),"frozen showdown audit");
    }
    function test57LateShowdownProofsClosePendingRecoveryOnSettlement()public {
        bytes32 id=_ready();bytes32 snapshot=ledger.lockedSnapshot(TABLE);_river(id);
        cheat54.warp(uint256(ws8Engine.evidenceDueAt(id))+1);
        ws8Engine.beginMissingEvidenceRecovery(id);
        (,,,,bool active)=ws8Engine.evidenceRecovery(id);
        require(active,"real missing-showdown recovery opened");
        for(uint8 pos=0;pos<4;pos++)_reveal(id,4,pos);
        ws8Engine.settle(id,_policy());_receipt(id,snapshot,399,399,2,true);
        (,,,,active)=ws8Engine.evidenceRecovery(id);
        require(!active,"settlement must close corrected recovery");
    }
    function test57WrongRakePolicyCannotPublishReceipt()public {
        bytes32 id=_ready();_showdown(id);PokerCanonicalRake420.Policy memory wrong=_policy();wrong.rakeBps=499;
        cheat54.expectRevert(PokerCanonicalRake420.InvalidPolicy.selector);ws8Engine.settle(id,wrong);
        _empty(id);_escrowUnchanged(id);
    }
    function test57TerminalReceiptRejectsReplayActionsAndRecovery()public {
        bytes32 id=_ready();_showdown(id);ws8Engine.settle(id,_policy());
        bytes32 receiptHash=keccak256(abi.encode(ws8Engine.settlementReceipt(id)));
        (bool ok,)=address(ws8Engine).call(abi.encodeCall(PokerNLHEBetting420.settle,(id,_policy())));require(!ok,"replay");
        (ok,)=address(ws8Engine).call(abi.encodeCall(PokerNLHEBetting420.timeout,(id)));require(!ok,"terminal timeout");
        (ok,)=address(ws8Engine).call(abi.encodeCall(PokerNLHEBetting420.beginMissingEvidenceRecovery,(id)));require(!ok,"post-payment void");
        (ok,)=address(ws8Engine).call(abi.encodeCall(PokerNLHEBetting420.proposeDisputeResolution,(id,_policy())));require(!ok,"post-payment proposal");
        require(keccak256(abi.encode(ws8Engine.settlementReceipt(id)))==receiptHash,"immutable terminal receipt");
    }
}
