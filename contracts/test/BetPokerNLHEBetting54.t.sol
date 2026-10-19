// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerPrivateShuffleGate54.t.sol";
import "../src/bet/PokerNLHEBetting420.sol";
import "../src/bet/PokerActionKeys420.sol";
import "../src/bet/PokerActionDisputeClock420.sol";
interface VmPokerNativeSign54 {
    function addr(uint256 privateKey)external returns(address);
    function sign(uint256 privateKey,bytes32 digest)external returns(uint8,bytes32,bytes32);
}
contract PokerNLHEBetting54Test is PokerPrivateShuffleGate54Test {
    PokerActionKeys420 signing;
    PokerActionDisputeClock420 dispute;
    PokerNLHEBetting420 engine;
    VmPokerNativeSign54 constant signedVm=VmPokerNativeSign54(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant PLAYER_KEY=0x420001;
    uint256 constant OPPONENT_KEY=0x420002;
    constructor(){
        signing=new PokerActionKeys420(address(deal));
        dispute=new PokerActionDisputeClock420(address(deal));
        engine=new PokerNLHEBetting420(address(deal),address(gate),address(signing),address(dispute));
        cap.grant(ADMIN,ledger.ACTION_BIND_SETTLEMENT(),auth.scopeForTable(TABLE),true);
    }
    function _readyBetting() internal returns(bytes32 id){
        id=_hand54();
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        bytes32 input=initialDeck.rootOf(id);
        bytes32 first=keccak256("encrypted shuffle A");
        bytes32 second=bytes32(uint256(1000));
        verifier.allow(gate.statement(id,1,input,first));
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,input,first,hex"010203");
        verifier.allow(gate.statement(id,2,first,second));
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,first,second,hex"010203");
        cheat54.prank(ADMIN);ledger.bindSettlement(TABLE,address(engine),address(0x500BEEF));
        cheat54.prank(PLAYER);engine.reserve(id);
        cheat54.prank(PLAYER);signing.bindSigner(TABLE,signedVm.addr(PLAYER_KEY));
        cheat54.prank(PLAYER_B);signing.bindSigner(TABLE,signedVm.addr(OPPONENT_KEY));
        engine.start(id,0,60);
    }
    function _signedAction(bytes32 id,uint8 seat,PokerNLHEBetting420.Move move,
        uint256 chips,uint256 privateKey) internal {
        PokerNLHEBetting420.Game memory g=engine.gameOf(id);
        uint64 expiry=uint64(block.timestamp+50);
        bytes32 moveHash=keccak256(abi.encode(engine.ACTION_DOMAIN(),id,
            uint8(g.phase),seat,uint8(move),chips));
        bytes32 digest=signing.actionDigest(id,seat,g.nonce+1,g.stateRoot,moveHash,expiry);
        (uint8 v,bytes32 rr,bytes32 ss)=signedVm.sign(privateKey,digest);
        engine.action(id,seat,move,chips,expiry,g.stateRoot,abi.encodePacked(rr,ss,v));
    }
    function testSignedHeadsUpPreflopClosesOnlyAfterBothAct() public {
        bytes32 id=_readyBetting();
        PokerNLHEBetting420.Game memory g=engine.gameOf(id);
        require(g.toAct==0&&g.pot==15&&g.currentBet==10,"heads-up blind/button");
        require(!engine.canRevealStreet(id,1),"flop cannot be exposed prematurely");
        _signedAction(id,0,PokerNLHEBetting420.Move.CALL,5,PLAYER_KEY);
        g=engine.gameOf(id);
        require(g.toAct==1 && g.pot==20,"next actor");
        _signedAction(id,1,PokerNLHEBetting420.Move.CHECK,0,OPPONENT_KEY);
        g=engine.gameOf(id);
        require(g.phase==PokerNLHEBetting420.Phase.AWAIT_FLOP,"waiting for verified board");
        require(engine.canRevealStreet(id,1),"authorized flop");
        require(g.pot==20 && g.nonce==2,"conserved signed actions");
        require(ledger.reservedInHand(TABLE)==800,"funds locked through betting");
    }
    function testTimeoutFoldsOnlyPlayerFacingLiveBet() public {
        bytes32 id=_readyBetting();
        cheat54.warp(block.timestamp+61);
        engine.timeout(id);
        PokerNLHEBetting420.Game memory g=engine.gameOf(id);
        require(g.phase==PokerNLHEBetting420.Phase.UNCONTESTED,"fold terminal");
        require(engine.playerOf(id,0).folded,"auto-fold on owed bet");
        require(g.pot==15 && g.nonce==1,"timeout cannot alter chips");
    }
    function testInvalidSignedCallAndWrongTurnCannotMutateTranscript() public {
        bytes32 id=_readyBetting();
        PokerNLHEBetting420.Game memory g=engine.gameOf(id);
        cheat54.expectRevert(PokerNLHEBetting420.WrongTurn.selector);
        engine.action(id,1,PokerNLHEBetting420.Move.CHECK,0,uint64(block.timestamp+30),
            g.stateRoot,hex"dead");
        bytes32 expected=g.stateRoot;
        uint64 expiry=uint64(block.timestamp+50);
        bytes32 moveHash=keccak256(abi.encode(engine.ACTION_DOMAIN(),id,
            uint8(g.phase),uint8(0),uint8(PokerNLHEBetting420.Move.CALL),uint256(4)));
        bytes32 digest=signing.actionDigest(id,0,1,g.stateRoot,moveHash,expiry);
        (uint8 v,bytes32 rr,bytes32 ss)=signedVm.sign(PLAYER_KEY,digest);
        bytes memory signature=abi.encodePacked(rr,ss,v);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidAction.selector);
        engine.action(id,0,PokerNLHEBetting420.Move.CALL,4,expiry,g.stateRoot,signature);
        require(engine.gameOf(id).stateRoot==expected,"invalid action cannot advance");
    }
    function testReadOnlySignatureCheckCannotFrontRunCanonicalAction() public {
        bytes32 id=_readyBetting();
        PokerNLHEBetting420.Game memory g=engine.gameOf(id);
        uint64 expiry=uint64(block.timestamp+50);
        bytes32 moveHash=keccak256(abi.encode(engine.ACTION_DOMAIN(),id,
            uint8(g.phase),uint8(0),uint8(PokerNLHEBetting420.Move.CALL),uint256(5)));
        bytes32 digest=signing.actionDigest(id,0,1,g.stateRoot,moveHash,expiry);
        (uint8 v,bytes32 rr,bytes32 ss)=signedVm.sign(PLAYER_KEY,digest);
        bytes memory signature=abi.encodePacked(rr,ss,v);
        signing.checkSignature(id,0,1,g.stateRoot,moveHash,expiry,signature);
        require(signing.lastActionNonce(id,0)==0,"signature remains unconsumed");
        engine.action(id,0,PokerNLHEBetting420.Move.CALL,5,expiry,g.stateRoot,signature);
        require(engine.gameOf(id).nonce==1,"engine atomically consumes");
    }
}
