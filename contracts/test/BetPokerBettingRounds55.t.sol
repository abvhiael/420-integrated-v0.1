// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerIntegratedAdversarial54.t.sol";

interface VmPoker55 {
    function chainId(uint256) external;
}

/// @dev Arithmetic/rules unit harness ONLY. It seeds isolated internal state and
/// invokes the very same blind and move kernel as production. It never admits a
/// hand, verifies a proof, takes custody or claims cryptographic integration.
contract PokerBettingKernelHarness55 is PokerNLHEBetting420 {
    uint256 private serial;
    bytes32 private constant TABLE55=keccak256("5A5.KERNEL.TABLE");
    constructor(address d,address s,address k,address c) PokerNLHEBetting420(d,s,k,c) {}
    function seed(uint16 mask,uint256[9] calldata stacks) external returns(bytes32 id){
        id=keccak256(abi.encode("ISOLATED.BETTING.KERNEL.UNIT",++serial));
        Game storage g=games[id];g.tableId=TABLE55;g.seatsMask=mask;g.initialized=true;g.actionTimeout=60;
        g.stateRoot=keccak256("UNIT.STATE.NOT.A.CRYPTOGRAPHIC.HAND");
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0){
            require(stacks[i]>0);players[id][i].stack=stacks[i];g.initialChips+=stacks[i];
        }
        _postBlinds(id,g,_canonicalButton(TABLE55,mask),10,20);
    }
    function history(uint8 button,uint8 bigBlind) external {
        hasButton[TABLE55]=true;lastButton[TABLE55]=button;lastBigBlind[TABLE55]=bigBlind;
    }
    function move(bytes32 id,uint8 seat,Move action_,uint256 chips) external {
        Game storage g=games[id];
        if(g.phase!=Phase.PREFLOP&&g.phase!=Phase.FLOP&&g.phase!=Phase.TURN&&g.phase!=Phase.RIVER)revert InvalidState();
        if(seat!=g.toAct||(g.pendingMask&(uint16(1)<<seat))==0)revert WrongTurn();
        _apply(id,g,seat,action_,chips);
    }
    function nextStreet(bytes32 id,uint8 street) external {
        Game storage g=games[id];
        if(street<1||street>3||uint8(g.phase)!=2*street)revert InvalidState();
        _openBettingStreet(id,g,street,20);
    }
}

contract PokerBettingKernel55Test is PokerWS8ProductionFixture54 {
    PokerBettingKernelHarness55 internal kernel;
    constructor(){kernel=new PokerBettingKernelHarness55(address(deal),address(ws8Shuffle),address(ws8Signing),address(ws8Disputes));}
    function _stacks(uint256 n) internal pure returns(uint256[9] memory x){for(uint8 i;i<9;i++)x[i]=n;}
    function _next(uint16 mask,uint8 seat) internal pure returns(uint8){
        for(uint8 i=1;i<=9;i++){uint8 j=uint8((uint256(seat)+i)%9);if((mask&(uint16(1)<<j))!=0)return j;}revert();
    }
    function _conserved(bytes32 id) internal view {
        PokerNLHEBetting420.Game memory g=kernel.gameOf(id);uint256 chips=g.pot;
        for(uint8 i;i<9;i++)if((g.seatsMask&(uint16(1)<<i))!=0)chips+=kernel.playerOf(id,i).stack;
        require(chips==g.initialChips,"actual kernel chip conservation");
    }
    function testEverySparseSeatMaskHasCanonicalBlindsAndTurn() public {
        for(uint16 mask=1;mask<512;mask++){
            uint8 count;uint8 first=255;
            for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0){count++;if(first==255)first=i;}
            if(count<2)continue;
            bytes32 id=kernel.seed(mask,_stacks(400));PokerNLHEBetting420.Game memory g=kernel.gameOf(id);
            uint8 sb=count==2?first:_next(mask,first);uint8 bb=_next(mask,sb);
            require(g.button==first&&g.smallBlindSeat==sb&&g.bigBlindSeat==bb,"canonical sparse blind order");
            require(g.toAct==(count==2?sb:_next(mask,bb))&&g.pendingMask==mask,"canonical sparse actor");
            require(g.pot==30&&g.currentBet==20&&g.minRaise==20,"fixed blind amounts");_conserved(id);
        }
    }
    function testThreeToHeadsUpNeverRepeatsSurvivingBigBlind() public {
        kernel.history(0,2);bytes32 id=kernel.seed(6,_stacks(400));
        PokerNLHEBetting420.Game memory g=kernel.gameOf(id);
        require(g.button==2&&g.smallBlindSeat==2&&g.bigBlindSeat==1,"heads-up transition blind correction");
    }
    function testHeadsUpButtonAndBlindsRotateBetweenHands() public {
        kernel.history(0,1);bytes32 id=kernel.seed(3,_stacks(400));
        PokerNLHEBetting420.Game memory g=kernel.gameOf(id);
        require(g.button==1&&g.smallBlindSeat==1&&g.bigBlindSeat==0&&g.toAct==1,"heads-up moving button");
    }
    function testShortBigBlindChargesOnlyActualLoneOpponentCall() public {
        uint256[9] memory stacks=_stacks(400);stacks[1]=15;bytes32 id=kernel.seed(3,stacks);
        require(kernel.gameOf(id).currentBet==15,"no unmatched nominal big blind");
        cheat54.expectRevert(PokerNLHEBetting420.InvalidAction.selector);kernel.move(id,0,PokerNLHEBetting420.Move.CALL,10);
        kernel.move(id,0,PokerNLHEBetting420.Move.CALL,5);
        require(kernel.gameOf(id).pot==30&&kernel.gameOf(id).phase==PokerNLHEBetting420.Phase.AWAIT_FLOP,"exact short call and runout");_conserved(id);
    }
    function testMatchedLoneBlindAndBothAllInSkipArtificialActions() public {
        uint256[9] memory stacks=_stacks(400);stacks[1]=5;
        bytes32 a=kernel.seed(3,stacks);require(kernel.gameOf(a).phase==PokerNLHEBetting420.Phase.AWAIT_FLOP&&kernel.gameOf(a).nonce==0,"matched lone blind must not check");
        stacks[0]=5;stacks[1]=400;bytes32 b=kernel.seed(3,stacks);
        require(kernel.gameOf(b).phase==PokerNLHEBetting420.Phase.AWAIT_FLOP&&kernel.gameOf(b).pot==25,"big blind has no opponent action");
        stacks[1]=15;bytes32 c=kernel.seed(3,stacks);
        require(kernel.gameOf(c).phase==PokerNLHEBetting420.Phase.AWAIT_FLOP&&kernel.gameOf(c).pot==20,"both short blinds all-in");
        _conserved(a);_conserved(b);_conserved(c);
    }
    function testMultiwayShortBlindRetainsNominalBringInWithLiveOpponents() public {
        uint256[9] memory stacks=_stacks(400);stacks[2]=15;bytes32 id=kernel.seed(7,stacks);
        require(kernel.gameOf(id).currentBet==20&&kernel.gameOf(id).toAct==0,"nominal multiway bring-in");
        kernel.move(id,0,PokerNLHEBetting420.Move.CALL,20);kernel.move(id,1,PokerNLHEBetting420.Move.CALL,10);
        require(kernel.gameOf(id).pot==55&&kernel.gameOf(id).phase==PokerNLHEBetting420.Phase.AWAIT_FLOP,"all responses required");_conserved(id);
    }
    function testNoRaiseIntoEmptySidePotAgainstOnlyAllInPlayers() public {
        uint256[9] memory stacks=_stacks(400);stacks[1]=5;stacks[2]=15;bytes32 id=kernel.seed(7,stacks);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidAction.selector);kernel.move(id,0,PokerNLHEBetting420.Move.RAISE,40);
        kernel.move(id,0,PokerNLHEBetting420.Move.CALL,15);require(kernel.gameOf(id).pot==35,"only actual call may be committed");_conserved(id);
    }
    function testCumulativeShortAllInsReopenOnlyWithAnotherLiveOpponent() public {
        uint256[9] memory stacks=_stacks(1000);stacks[1]=60;stacks[2]=80;stacks[3]=50;
        bytes32 id=kernel.seed(31,stacks);
        kernel.move(id,3,PokerNLHEBetting420.Move.RAISE,50);kernel.move(id,4,PokerNLHEBetting420.Move.CALL,50);
        kernel.move(id,0,PokerNLHEBetting420.Move.CALL,50);kernel.move(id,1,PokerNLHEBetting420.Move.RAISE,50);
        kernel.move(id,2,PokerNLHEBetting420.Move.RAISE,60);kernel.move(id,4,PokerNLHEBetting420.Move.RAISE,100);
        require(kernel.gameOf(id).minRaise==70&&kernel.gameOf(id).toAct==0,"cumulative reopening and new full raise");
        kernel.move(id,0,PokerNLHEBetting420.Move.CALL,100);
        require(kernel.gameOf(id).pot==490&&kernel.gameOf(id).phase==PokerNLHEBetting420.Phase.AWAIT_FLOP,"complete multiway response");_conserved(id);
    }
    function testSingleShortAllInDoesNotReopenPreviouslyActingSeat() public {
        uint256[9] memory stacks=_stacks(1000);stacks[1]=60;stacks[3]=50;bytes32 id=kernel.seed(31,stacks);
        kernel.move(id,3,PokerNLHEBetting420.Move.RAISE,50);kernel.move(id,4,PokerNLHEBetting420.Move.CALL,50);
        kernel.move(id,0,PokerNLHEBetting420.Move.CALL,50);kernel.move(id,1,PokerNLHEBetting420.Move.RAISE,50);
        kernel.move(id,2,PokerNLHEBetting420.Move.CALL,40);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidAction.selector);kernel.move(id,4,PokerNLHEBetting420.Move.RAISE,40);
        kernel.move(id,4,PokerNLHEBetting420.Move.CALL,10);kernel.move(id,0,PokerNLHEBetting420.Move.CALL,10);_conserved(id);
    }
    function testAllFourRoundsWaitForEveryPendingNonAllInSeat() public {
        bytes32 id=kernel.seed(511,_stacks(400));
        for(uint8 i;i<9;i++){
            PokerNLHEBetting420.Game memory g=kernel.gameOf(id);PokerNLHEBetting420.Player memory p=kernel.playerOf(id,g.toAct);
            uint256 owed=g.currentBet-p.bet;kernel.move(id,g.toAct,owed==0?PokerNLHEBetting420.Move.CHECK:PokerNLHEBetting420.Move.CALL,owed);
            if(i<8)require(kernel.gameOf(id).phase==PokerNLHEBetting420.Phase.PREFLOP,"pending blind option");
        }
        for(uint8 street=1;street<=3;street++){
            kernel.nextStreet(id,street);require(kernel.gameOf(id).toAct==1,"left of button after flop");
            for(uint8 i;i<9;i++)kernel.move(id,kernel.gameOf(id).toAct,PokerNLHEBetting420.Move.CHECK,0);
        }
        require(kernel.gameOf(id).phase==PokerNLHEBetting420.Phase.SHOWDOWN&&kernel.gameOf(id).nonce==36,"four complete rounds");_conserved(id);
    }
    function testFuzzBlindConservationAndPendingActor(uint16 raw,uint64 entropy) public {
        uint16 mask=raw&511;uint8 n;for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0)n++;
        if(n<2)mask|=3;
        uint256[9] memory stacks;
        for(uint8 i;i<9;i++)stacks[i]=uint256(keccak256(abi.encode(entropy,i)))%2000+1;
        bytes32 id=kernel.seed(mask,stacks);_conserved(id);
        PokerNLHEBetting420.Game memory g=kernel.gameOf(id);
        if(g.phase==PokerNLHEBetting420.Phase.PREFLOP){
            require((g.pendingMask&(uint16(1)<<g.toAct))!=0&&kernel.playerOf(id,g.toAct).stack>0,"live pending actor");
        }else require(g.pendingMask==0&&g.toAct==255&&g.deadline==0,"no artificial action on runout");
    }
}

/// @notice All admission in this owner uses the actual generated Groth16
/// verifiers and the real funded/segregated 800-chip hand. No crypto test double.
contract PokerBettingRounds55Test is BetPokerIntegratedFundedAdversarial54Test {
    VmPoker55 private constant vm55=VmPoker55(address(uint160(uint256(keccak256("hevm cheat code")))));
    function _payload(bytes32 id,uint8 seat,PokerNLHEBetting420.Move move,uint256 chips,uint256 privateKey,uint64 expiry,uint64 nonce) internal returns(bytes memory){
        PokerNLHEBetting420.Game memory g=ws8Engine.gameOf(id);
        bytes32 moveHash=keccak256(abi.encode(ws8Engine.ACTION_DOMAIN(),id,uint8(g.phase),seat,uint8(move),chips));
        bytes32 digest=ws8Signing.actionDigest(id,seat,nonce,g.stateRoot,moveHash,expiry);
        (uint8 v,bytes32 r,bytes32 s)=ws8vm.sign(privateKey,digest);
        return abi.encodeCall(PokerNLHEBetting420.action,(id,seat,move,chips,expiry,g.stateRoot,abi.encodePacked(r,s,v)));
    }
    function _rejected(bytes memory payload,bytes4 expected) internal {
        (bool ok,bytes memory reason)=address(ws8Engine).call(payload);
        require(!ok&&reason.length>=4&&bytes4(reason)==expected,"wrong action rejection");
    }
    function _clockMatches(bytes32 id) internal view {
        PokerNLHEBetting420.Game memory g=ws8Engine.gameOf(id);
        (uint64 due,uint64 nonce,uint8 seat,bytes32 state,bool active,)=ws8Disputes.clocks(id);
        require(due==g.deadline&&nonce==g.nonce+1&&seat==g.toAct&&state==g.stateRoot,"single canonical actor/clock/root");
        require(active==(g.pendingMask!=0),"clock active exactly during betting");
    }
    function test55ImmutableTurnPolicyRejectsStarterChosenClock() public {
        bytes32 id=_shuffled();_deliver(id);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);ws8Engine.start(id,0,30);
        ws8Engine.start(id,0,60);require(ws8Engine.turnPolicyForHand(id)==ws8Engine.turnPolicyHash(TABLE),"reserved immutable clock policy");
        cheat54.expectRevert(PokerNLHEBetting420.InvalidConfiguration.selector);
        cheat54.prank(ADMIN);ws8Engine.bindTurnPolicy(TABLE,120);_clockMatches(id);
    }
    function test55PolicyRequiresGovernanceBoundResolverAndValidDuration() public {
        _open();cap.grant(ADMIN,ws8Engine.ACTION_BIND_TURN_POLICY(),auth.scopeForTable(TABLE),true);
        cheat54.expectRevert(PokerNLHEBetting420.Unauthorized.selector);cheat54.prank(OTHER);ws8Engine.bindTurnPolicy(TABLE,60);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidConfiguration.selector);cheat54.prank(ADMIN);ws8Engine.bindTurnPolicy(TABLE,60);
        cap.grant(ADMIN,ws8Disputes.ACTION_BIND_RESOLVER(),auth.scopeForTable(TABLE),true);
        cheat54.prank(ADMIN);ws8Disputes.bindResolver(TABLE,address(ws8Engine));
        cheat54.expectRevert(PokerNLHEBetting420.InvalidConfiguration.selector);cheat54.prank(ADMIN);ws8Engine.bindTurnPolicy(TABLE,29);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidConfiguration.selector);cheat54.prank(ADMIN);ws8Engine.bindTurnPolicy(TABLE,3601);
        cheat54.prank(ADMIN);ws8Engine.bindTurnPolicy(TABLE,60);
        require(ws8Disputes.turnEngineForTable(TABLE)==address(ws8Engine),"native clock authority");
    }
    function test55EveryActionAtomicallyCommitsActorClockAndDeadline() public {
        bytes32 id=_ready();_clockMatches(id);
        PokerNLHEBetting420.Turn memory t=ws8Engine.turnOf(id);
        require(t.seat==0&&t.player==PLAYER&&t.signer==ws8vm.addr(WS8_PLAYER_KEY)&&t.callChips==10,"canonical action view");
        require(t.minimumRaiseChips==30&&t.maximumRaiseChips==390&&t.allowedMoves==13&&!t.canTimeout,"canonical move amounts");
        _signed(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY);_clockMatches(id);
        _signed(id,1,PokerNLHEBetting420.Move.CHECK,0,WS8_OPPONENT_KEY);_clockMatches(id);
        require(ws8Engine.turnOf(id).allowedMoves==0&&ws8Engine.gameOf(id).deadline==0,"no clock while waiting for proof");
    }
    function test55ControllerCannotOverwriteOrExpireNativeTurnClock() public {
        bytes32 id=_ready();PokerNLHEBetting420.Game memory g=ws8Engine.gameOf(id);
        cap.grant(ADMIN,ws8Disputes.ACTION_START_CLOCK(),auth.scopeForTable(TABLE),true);
        cheat54.expectRevert(PokerActionDisputeClock420.Unauthorized.selector);cheat54.prank(ADMIN);ws8Disputes.start(id,1,2,uint64(block.timestamp+120),keccak256("forged turn"));
        cheat54.expectRevert(PokerActionDisputeClock420.Unauthorized.selector);ws8Disputes.syncTurn(id,1,1,g.deadline,g.stateRoot,true);
        cheat54.warp(g.deadline+1);
        cheat54.expectRevert(PokerActionDisputeClock420.Unauthorized.selector);ws8Disputes.expire(id);
        ws8Engine.timeout(id);_clockMatches(id);
    }
    function test55SignedActionsRemainRelayerSafeAndReplayProtected() public {
        bytes32 id=_ready();bytes memory payload=_payload(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY,uint64(block.timestamp+50),1);
        cheat54.prank(OTHER);(bool ok,)=address(ws8Engine).call(payload);require(ok,"valid seat-owned relay rejected");
        bytes32 state=ws8Engine.gameOf(id).stateRoot;
        _rejected(payload,PokerNLHEBetting420.WrongTurn.selector);
        require(ws8Engine.gameOf(id).nonce==1&&ws8Engine.gameOf(id).stateRoot==state,"replay changed canonical state");_clockMatches(id);
    }
    function test55WrongOwnerNonceAndChainSignaturesCannotAdvanceTurn() public {
        bytes32 id=_ready();uint64 expiry=uint64(block.timestamp+50);bytes32 state=ws8Engine.gameOf(id).stateRoot;
        _rejected(_payload(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_OPPONENT_KEY,expiry,1),PokerActionKeys420.InvalidSignature.selector);
        _rejected(_payload(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY,expiry,2),PokerActionKeys420.InvalidSignature.selector);
        vm55.chainId(31338);bytes memory foreign=_payload(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY,expiry,1);vm55.chainId(31337);
        _rejected(foreign,PokerActionKeys420.InvalidSignature.selector);
        require(ws8Engine.gameOf(id).stateRoot==state&&ws8Engine.gameOf(id).nonce==0,"forgery advanced turn");_escrowUnchanged(id);
    }
    function test55RevokedActionCapabilityCannotActButTimeoutStaysPermissionless() public {
        bytes32 id=_ready();bytes memory payload=_payload(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY,uint64(block.timestamp+50),1);
        cap.grant(PLAYER,BetIds420.ACTION_POKER_ACTION,auth.scopeForTable(TABLE),false);
        _rejected(payload,PokerNLHEBetting420.Unauthorized.selector);require(ws8Engine.turnOf(id).allowedMoves==0,"revoked capability remains usable");
        cheat54.warp(ws8Engine.gameOf(id).deadline+1);cheat54.prank(OTHER);ws8Engine.timeout(id);
        require(ws8Engine.playerOf(id,0).folded&&ws8Engine.gameOf(id).nonce==1,"revoked identity blocked objective timeout");
    }
    function test55SignerSerialInvalidatesOldSignatureAfterRotateBack() public {
        bytes32 id=_ready();bytes memory payload=_payload(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY,uint64(block.timestamp+50),1);
        address replacement=ws8vm.addr(0x420003);address original=ws8vm.addr(WS8_PLAYER_KEY);
        cheat54.prank(PLAYER);ws8Signing.bindSigner(TABLE,replacement);cheat54.prank(PLAYER);ws8Signing.bindSigner(TABLE,original);
        _rejected(payload,PokerActionKeys420.InvalidSignature.selector);require(ws8Engine.gameOf(id).nonce==0,"old signer serial replay");
        _signed(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY);_clockMatches(id);
    }
    function test55ActionWinsExactDeadlineTieAndTimeoutCannotFireEarly() public {
        bytes32 id=_ready();uint64 due=ws8Engine.gameOf(id).deadline;
        cheat54.warp(due-1);cheat54.expectRevert(PokerNLHEBetting420.TooEarly.selector);ws8Engine.timeout(id);
        cheat54.warp(due);cheat54.expectRevert(PokerNLHEBetting420.TooEarly.selector);ws8Engine.timeout(id);
        _signed(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY);
        require(ws8Engine.gameOf(id).nonce==1&&ws8Engine.gameOf(id).deadline==due+60,"exact-deadline signed action and fresh timer");_clockMatches(id);
    }
    function test55ExpiredSignedActionLosesToDeterministicTimeoutFoldAndSettlement() public {
        bytes32 id=_ready();uint64 due=ws8Engine.gameOf(id).deadline;
        bytes memory payload=_payload(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY,due+600,1);
        cheat54.warp(due+1);_rejected(payload,PokerNLHEBetting420.Expired.selector);cheat54.prank(OTHER);ws8Engine.timeout(id);
        require(ws8Engine.gameOf(id).phase==PokerNLHEBetting420.Phase.UNCONTESTED&&ws8Engine.playerOf(id,0).folded,"only owed player auto-folds");
        ws8Engine.settle(id,_policy());require(ledger.seatOf(TABLE,0).chips==390&&ledger.seatOf(TABLE,1).chips==410&&coin.balanceOf(address(ledger))==800,"native timeout payout conservation");
        require(coin.balanceOf(WS8_RAKES)==0&&ledger.handConsumed(id),"no rake without contested flop");
    }
    function test55TimeoutChecksWithoutBetAndCannotReplayAcrossRevealWindow() public {
        bytes32 id=_ready();_signed(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY);
        cheat54.warp(ws8Engine.gameOf(id).deadline+1);ws8Engine.timeout(id);
        require(!ws8Engine.playerOf(id,1).folded&&ws8Engine.gameOf(id).phase==PokerNLHEBetting420.Phase.AWAIT_FLOP&&ws8Engine.gameOf(id).nonce==2,"objective check closes round");
        _clockMatches(id);cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);ws8Engine.timeout(id);_escrowUnchanged(id);
    }
    function test55OldDeadlineCannotExpireNextActorsFreshTurn() public {
        bytes32 id=_ready();uint64 oldDue=ws8Engine.gameOf(id).deadline;
        cheat54.warp(oldDue-10);_signed(id,0,PokerNLHEBetting420.Move.CALL,10,WS8_PLAYER_KEY);
        cheat54.warp(oldDue+1);cheat54.expectRevert(PokerNLHEBetting420.TooEarly.selector);ws8Engine.timeout(id);
        require(ws8Engine.gameOf(id).nonce==1&&ws8Engine.gameOf(id).toAct==1,"old clock stole next turn");_clockMatches(id);
    }
    function test55DisputeCannotFreezeTurnOrRewriteObjectiveOutcome() public {
        bytes32 id=_ready();uint64 due=ws8Engine.gameOf(id).deadline;
        cheat54.prank(PLAYER_B);ws8Disputes.dispute(id,keccak256("mid-hand claim"));
        require(ws8Engine.gameOf(id).deadline==due,"claim rewrote timer");_clockMatches(id);
        _showdown(id);ws8Engine.proposeDisputeResolution(id,_policy());
        cheat54.expectRevert(PokerActionDisputeClock420.Premature.selector);ws8Engine.settle(id,_policy());
        cheat54.warp(ws8Disputes.resolutionOf(id).executableAfter);_settle(id);
    }
    function _cancelAdmission(uint8 reason) internal {
        bytes32 id=_shuffled();_deliver(id);
        if(reason==0){cheat54.prank(ADMIN);registry.pause(TABLE);}else if(reason==1)ops.setActive(OP,false);else emergency.setHalted(true);
        cheat54.expectRevert(PokerNLHEBetting420.Unauthorized.selector);ws8Engine.start(id,0,60);
        cheat54.expectRevert(PokerNLHEBetting420.TooEarly.selector);ws8Engine.cancelUnavailableStart(id);
        cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelUnavailableStart(id);
        require(ledger.handConsumed(id)&&ws8Engine.handAborted(id)&&ledger.seatOf(TABLE,0).chips==400&&ledger.seatOf(TABLE,1).chips==400,"unavailable admission exact refund");
        require(ws8Bonds.available(address(coin),PROVIDER_A)==800&&ws8Bonds.available(address(coin),PROVIDER_B)==800&&coin.balanceOf(WS8_RISK)==0,"eligibility failure falsely slashed providers");
    }
    function test55PausedTableCannotStartButDeliveredEscrowRecovers() public {_cancelAdmission(0);}
    function test55SuspendedOperatorCannotStartButDeliveredEscrowRecovers() public {_cancelAdmission(1);}
    function test55EmergencyCannotStartButDeliveredEscrowRecovers() public {_cancelAdmission(2);}
    function test55ExistingFundedPlaySurvivesNewHandPauseAndOperatorSuspension() public {
        bytes32 id=_ready();cheat54.prank(ADMIN);registry.pause(TABLE);ops.setActive(OP,false);emergency.setHalted(true);
        _showdown(id);_settle(id);
    }
    function test55GenuineAllInRunoutRequiresProofsButNoArtificialTurns() public {
        bytes32 id=_ready();_signed(id,0,PokerNLHEBetting420.Move.RAISE,390,WS8_PLAYER_KEY);_signed(id,1,PokerNLHEBetting420.Move.CALL,380,WS8_OPPONENT_KEY);
        require(ws8Engine.gameOf(id).pot==800&&ws8Engine.gameOf(id).nonce==2,"real all-in pot");
        for(uint8 pos=5;pos<=7;pos++)_reveal(id,1,pos);ws8Live.advance(id,1);_clockMatches(id);
        require(ws8Engine.canRevealStreet(id,2)&&ws8Engine.gameOf(id).nonce==2,"no flop action without live opponents");
        _reveal(id,2,9);ws8Live.advance(id,2);_reveal(id,3,11);ws8Live.advance(id,3);
        for(uint8 pos;pos<4;pos++)_reveal(id,4,pos);
        (uint256[9] memory paid,uint256 fee)=ws8Outcome.calculate(id,_policy());require(paid[0]==390&&paid[1]==390&&fee==20,"all-in canonical native calculation");
        ws8Engine.settle(id,_policy());require(ledger.totalChips(TABLE)==780&&coin.balanceOf(WS8_RAKES)==20&&ledger.handConsumed(id),"all-in atomic settlement");
        require(!ws8Engine.canRevealStreet(id,4),"settled hand still authorizes reveals");
    }
    function test55RefundedRevealWindowCannotResumeBettingOrDiscloseCards() public {
        bytes32 id=_ready();_preflop(id);cheat54.warp(ws8Engine.evidenceDueAt(id)+1);
        ws8Engine.beginMissingEvidenceRecovery(id);(,uint64 finalizable,,,)=ws8Engine.evidenceRecovery(id);
        cheat54.warp(finalizable);ws8Engine.finalizeMissingEvidenceRecovery(id);
        require(!ws8Engine.canRevealStreet(id,1)&&ledger.handConsumed(id),"refunded evidence window remained live");
        require(coin.balanceOf(WS8_RISK)==1600,"actual missing-provider attribution lost on finality");
        uint256[8] memory points=abi.decode(_data("WS8Partial150.points"),(uint256[8]));bytes memory proof=_proof("WS8Partial150");
        cheat54.expectRevert(PokerLiveCardReveals420.WrongStreet.selector);cheat54.prank(PROVIDER_A);ws8Live.submitShare(id,1,5,0,points,proof);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);ws8Engine.timeout(id);
    }
}
