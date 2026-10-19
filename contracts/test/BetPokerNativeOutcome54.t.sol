// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerLiveCardReveals54.t.sol";
import "../src/bet/PokerNativeOutcome420.sol";
import "../src/bet/PokerHandRank420.sol";
import "../src/bet/PokerCanonicalRake420.sol";

contract PokerNativeOutcome54Test is PokerLiveCardReveals54Test {
    PokerCanonicalRake420 actualRake;
    PokerHandRank420 actualRanker;
    PokerNativeOutcome420 result;
    address constant RAKES=address(0xFEE420);
    constructor(){
        actualRake=new PokerCanonicalRake420(address(registry));
        actualRanker=new PokerHandRank420();
        result=new PokerNativeOutcome420(address(engine),address(live),
            address(actualRake),address(actualRanker));
        cap.grant(ADMIN,engine.ACTION_BIND_OUTCOME(),auth.scopeForTable(TABLE),true);
        cap.grant(ADMIN,dispute.ACTION_BIND_RESOLVER(),auth.scopeForTable(TABLE),true);
        cap.grant(ADMIN,dispute.ACTION_START_CLOCK(),auth.scopeForTable(TABLE),true);
    }
    function _fundedAndProved() internal returns(bytes32 id){
        PokerTableRegistry420.Configuration memory cfg=_config();
        cfg.asset=address(coin);
        PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(500,20,true,true);
        cfg.rakePolicyHash=actualRake.policyHash(policy);
        cheat54.prank(ADMIN);registry.register(cfg,ADMIN);
        cheat54.prank(ADMIN);registry.approve(TABLE);
        cheat54.prank(ADMIN);registry.open(TABLE);
        _buy();
        cheat54.prank(PLAYER_B);ledger.buyIn(TABLE,1,400);
        id=_begin(1);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("provider A"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("provider B"));
        bytes32 initial=keccak256("proved initial encrypted deck");
        initialVerifier.allow(initialDeck.statement(id,initial));
        initialDeck.submit(id,initial,hex"f00d");
        bytes32 first=keccak256("re-encryption first");
        bytes32 second=bytes32(uint256(1000));
        verifier.allow(gate.statement(id,1,initial,first));
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,initial,first,hex"010203");
        verifier.allow(gate.statement(id,2,first,second));
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,first,second,hex"010203");
        cheat54.prank(ADMIN);ledger.bindSettlement(TABLE,address(engine),RAKES);
        cheat54.prank(PLAYER);engine.reserve(id);
        cheat54.prank(PLAYER);signing.bindSigner(TABLE,signedVm.addr(PLAYER_KEY));
        cheat54.prank(PLAYER_B);signing.bindSigner(TABLE,signedVm.addr(OPPONENT_KEY));
        engine.start(id,0,60);
        cheat54.prank(ADMIN);engine.bindReveals(TABLE,address(live));
        cheat54.prank(ADMIN);engine.bindOutcome(TABLE,address(result));
        cheat54.prank(ADMIN);dispute.bindResolver(TABLE,address(engine));
    }
    function testOnChainUncontestedOutcomeSettlesExactEscrowOnce() public {
        bytes32 id=_fundedAndProved();
        PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(500,20,true,true);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);
        engine.settle(id,policy);
        _signedAction(id,0,PokerNLHEBetting420.Move.FOLD,0,PLAYER_KEY);
        require(engine.gameOf(id).phase==PokerNLHEBetting420.Phase.UNCONTESTED,"uncontested");
        (uint256[9] memory amounts,uint256 rake)=result.calculate(id,policy);
        require(amounts[0]==390&&amounts[1]==410&&rake==0,"uncalled blind/refund");
        cheat54.prank(OTHER);engine.settle(id,policy);
        require(ledger.seatOf(TABLE,0).chips==390 && ledger.seatOf(TABLE,1).chips==410,
            "on-chain recomputed payout only");
        require(coin.balanceOf(address(ledger))==800&&ledger.totalChips(TABLE)==800,
            "token-backing preserved");
        require(ledger.handConsumed(id)&&engine.handSettled(id),"replay protection");
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);
        engine.settle(id,policy);
    }
    function testTableCannotSubstituteRakePolicyAtSettlement() public {
        bytes32 id=_fundedAndProved();
        _signedAction(id,0,PokerNLHEBetting420.Move.FOLD,0,PLAYER_KEY);
        PokerCanonicalRake420.Policy memory forged=PokerCanonicalRake420.Policy(300,20,true,true);
        cheat54.expectRevert(PokerCanonicalRake420.InvalidPolicy.selector);
        engine.settle(id,forged);
        require(ledger.reservedInHand(TABLE)==800,"escrow remains reserved");
    }
    function testDisputedHandAppealDoesNotOverrideVerifiedNativeOutcome() public {
        bytes32 id=_fundedAndProved();
        PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(500,20,true,true);
        cheat54.prank(ADMIN);dispute.start(id,0,1,uint64(block.timestamp+90),keccak256("state"));
        cheat54.prank(PLAYER_B);dispute.dispute(id,keccak256("challenge evidence"));
        require(dispute.isFrozen(id),"settlement temporarily frozen");
        // Objective native gameplay continues despite a claim with no verified
        // contradictory proof. The escrow remains immutable.
        _signedAction(id,0,PokerNLHEBetting420.Move.FOLD,0,PLAYER_KEY);
        cheat54.expectRevert(PokerActionDisputeClock420.InvalidState.selector);
        engine.settle(id,policy);
        cheat54.prank(OTHER);engine.proposeDisputeResolution(id,policy);
        cheat54.expectRevert(PokerActionDisputeClock420.Premature.selector);
        engine.settle(id,policy);
        cheat54.prank(PLAYER);dispute.appeal(id,keccak256("one documented appeal"));
        cheat54.warp(block.timestamp+1 days+1);
        cheat54.expectRevert(PokerActionDisputeClock420.Premature.selector);
        engine.settle(id,policy);
        cheat54.warp(block.timestamp+1 days+1);
        cheat54.prank(OTHER);engine.settle(id,policy);
        require(!dispute.isFrozen(id) && dispute.resolutions(id).finalized,
            "one-appeal objective resolution");
        require(ledger.seatOf(TABLE,0).chips==390&&ledger.seatOf(TABLE,1).chips==410,
            "verified terminal payouts cannot be overridden");
        require(ledger.handConsumed(id),"exactly once");
    }

}
