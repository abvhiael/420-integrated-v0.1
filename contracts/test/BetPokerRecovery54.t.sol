// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerLiveCardReveals54.t.sol";

/// @notice Recovery liveness across every authentically verified street.
/// This inherits funded NLHE and the real gate's security behavior; only the
/// test fixture's Groth16 backend is mocked, with authentic VKs inherited
/// from the already-qualified Workstreams 3 and 4.
contract PokerWS5Recovery54Test is PokerLiveCardReveals54Test {
    function testGenuineLateStreetCorrectionAllowsNextStageRecoveryAndRefund() public {
        bytes32 id=_readyLive();
        _completePreflop(id);
        uint64 due=engine.evidenceDueAt(id);
        cheat54.warp(uint256(due)+1);
        engine.beginMissingEvidenceRecovery(id);
        require((engine.recoveryStageMask(id)&(uint16(1)<<2))!=0,"flop used only review");
        for(uint8 pos=5;pos<=7;pos++){
            _submit(id,pos,0);_submit(id,pos,1);_open(id,pos,pos+10);
        }
        require(live.isStageComplete(id,1),"three valid late flop proofs");
        live.advance(id,1);
        (,,,,bool active)=engine.evidenceRecovery(id);
        require(!active,"proof correction closes stale review");
        require(engine.gameOf(id).phase==PokerNLHEBetting420.Phase.FLOP,
            "corrected evidence resumes authenticated gameplay");
        _signedAction(id,1,PokerNLHEBetting420.Move.CHECK,0,OPPONENT_KEY);
        _signedAction(id,0,PokerNLHEBetting420.Move.CHECK,0,PLAYER_KEY);
        require(engine.gameOf(id).phase==PokerNLHEBetting420.Phase.AWAIT_TURN,
            "fresh turn is an independently bounded proof window");
        cheat54.warp(uint256(engine.evidenceDueAt(id))+1);
        engine.beginMissingEvidenceRecovery(id);
        require((engine.recoveryStageMask(id)&(uint16(1)<<4))!=0,
            "turn gets its own single review");
        (,uint64 finalAt,,,) = engine.evidenceRecovery(id);
        cheat54.warp(finalAt);
        cheat54.prank(OTHER);engine.finalizeMissingEvidenceRecovery(id);
        require(engine.handAborted(id)&&!engine.handSettled(id),"one terminal refund");
        require(ledger.seatOf(TABLE,0).chips==400&&ledger.seatOf(TABLE,1).chips==400,
            "exact original funded chip snapshot");
        require(coin.balanceOf(address(0xB00D))==1600,
            "both genuinely missing turn provider shares charged to segregated bonds");
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);
        engine.finalizeMissingEvidenceRecovery(id);
    }
    function testInvalidPublicShareIsNotEvidenceAndCannotAvoidObjectiveFault() public {
        bytes32 id=_readyLive();
        _completePreflop(id);
        partialFixture.setAccept(false);
        uint256[8] memory p=_points(5,0);
        cheat54.expectRevert(PokerLiveCardReveals420.InvalidProof.selector);
        cheat54.prank(PROVIDER_A);
        live.submitShare(id,1,5,0,p,_shareProof(id,5,0,p));
        require(live.missingProviders(id,1)==3,
            "invalid proof may not clear missing share attribution");
        cheat54.warp(uint256(engine.evidenceDueAt(id))+1);
        engine.beginMissingEvidenceRecovery(id);
        (,uint64 reviewEnd,,,) = engine.evidenceRecovery(id);
        cheat54.warp(reviewEnd);
        engine.finalizeMissingEvidenceRecovery(id);
        require(coin.balanceOf(address(0xB00D))==1600,
            "both genuinely withheld provider shares slashed");
        require(ledger.totalChips(TABLE)==800&&ledger.reservedInHand(TABLE)==0,
            "hostile evidence did not modify original custody balances");
    }
}
