// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerPrivateShuffleGate54.t.sol";
import "../src/bet/PokerNLHEBetting420.sol";
import "../src/bet/PokerActionKeys420.sol";
import "../src/bet/PokerActionDisputeClock420.sol";
import "../src/bet/PokerRecipientKeys420.sol";
import "../src/bet/PokerDeckDisclosure420.sol";
import "../src/bet/PokerDeliveryProofBook420.sol";
/// @dev Integration-only proof seam. Cryptographic soundness is separately
/// verified against the real gnark-generated Solidity verifier, never here.
contract TestRecipientPoP54 is IPokerRecipientKeyPoP420 {
    function verifyKeyPossession(uint256 scope,uint256 x,uint256 y,bytes calldata proof)
        external pure returns(bool){return scope!=0 && x!=0 && y!=0 && proof.length!=0;}
}
contract TestEncryptedShareVerifier54 is IPokerEncryptedShareDelivery420 {
    function verifyDelivery(bytes32 handId,bytes32 root,uint8 pos,uint8 seat,uint8 provider,
        uint256 context,uint256[12] calldata points,bytes calldata proof)
        external pure returns(bool){
        return handId!=bytes32(0)&&root!=bytes32(0)&&pos<52&&seat<9&&provider<2&&
            context!=0&&points[6]!=0&&points[7]!=0&&proof.length!=0;
    }
}
interface VmPokerNativeSign54 {
    function addr(uint256 privateKey)external returns(address);
    function sign(uint256 privateKey,bytes32 digest)external returns(uint8,bytes32,bytes32);
}
contract PokerNLHEBetting54Test is PokerPrivateShuffleGate54Test {
    PokerActionKeys420 signing;
    PokerActionDisputeClock420 dispute;
    PokerNLHEBetting420 engine;
    PokerRecipientKeys420 recipient;
    PokerDeckDisclosure420 delivery;
    PokerDeliveryProofBook420 proofBook;
    TestRecipientPoP54 popVerifier;
    VmPokerNativeSign54 constant signedVm=VmPokerNativeSign54(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant PLAYER_KEY=0x420001;
    uint256 constant OPPONENT_KEY=0x420002;
    constructor(){
        signing=new PokerActionKeys420(address(deal));
        dispute=new PokerActionDisputeClock420(address(deal));
        engine=new PokerNLHEBetting420(address(deal),address(gate),address(signing),address(dispute));
        recipient=new PokerRecipientKeys420(address(ledger));
        delivery=new PokerDeckDisclosure420(address(deal),address(recipient));
        popVerifier=new TestRecipientPoP54();
        TestEncryptedShareVerifier54 proverA=new TestEncryptedShareVerifier54();
        TestEncryptedShareVerifier54 proverB=new TestEncryptedShareVerifier54();
        proofBook=new PokerDeliveryProofBook420(address(deal),address(delivery),
            address(gate),address(engine),address(proverA),address(proverB));
        cap.grant(ADMIN,recipient.ACTION_BIND_KEY_POP(),auth.scopeForTable(bytes32(0)),true);
        cap.grant(ADMIN,delivery.ACTION_BIND_PROOF_BOOK(),auth.scopeForTable(TABLE),true);
        cheat54.prank(ADMIN);recipient.bindProofVerifier(address(popVerifier));
        cheat54.prank(ADMIN);delivery.bindProofBook(TABLE,address(proofBook));
        cap.grant(ADMIN,engine.ACTION_BIND_DELIVERY(),auth.scopeForTable(TABLE),true);
        cap.grant(ADMIN,ledger.ACTION_BIND_SETTLEMENT(),auth.scopeForTable(TABLE),true);
    }
    function _acknowledgedPrivateDelivery(bytes32 handId) internal {
        // NOTE: these are integration-only verifier stubs. Real Groth16 is
        // qualified separately by generated Solidity proof acceptance.
        cheat54.prank(PLAYER);recipient.bindVerifiedKey(TABLE,111,222,hex"aa");
        cheat54.prank(PLAYER_B);recipient.bindVerifiedKey(TABLE,333,444,hex"bb");
        cheat54.prank(PROVIDER_A);
        delivery.publish(handId,keccak256("private deck commitment"),keccak256("encrypted manifest"));
        for(uint8 pos=0;pos<4;pos++){
            uint8 seat=engine.holeSeatForPosition(handId,pos);
            (uint256 x,uint256 y,)=recipient.encryptionKeyOf(TABLE,seat);
            for(uint8 provider=0;provider<2;provider++){
                uint256[12] memory points;
                points[0]=1111+pos;points[1]=2222+pos;
                points[2]=3333+pos;points[3]=4444+pos;
                points[4]=100+provider;points[5]=200+provider;
                points[6]=x;points[7]=y;
                points[8]=1000+pos;points[9]=2000+provider;
                points[10]=3000+pos;points[11]=4000+provider;
                proofBook.proveEncryptedShare(handId,pos,provider,points,hex"0123");
            }
        }
        bytes32 keyA=recipient.fingerprintOf(TABLE,0);
        bytes32 keyB=recipient.fingerprintOf(TABLE,1);
        cheat54.prank(PROVIDER_A);
        delivery.bindEnvelope(handId,0,proofBook.envelopeHashFor(handId,0),keyA);
        cheat54.prank(PROVIDER_B);
        delivery.bindEnvelope(handId,1,proofBook.envelopeHashFor(handId,1),keyB);
        cheat54.prank(PLAYER);delivery.acknowledge(handId,0,keccak256("receipt A"));
        cheat54.prank(PLAYER_B);delivery.acknowledge(handId,1,keccak256("receipt B"));
        cheat54.prank(ADMIN);engine.bindDelivery(TABLE,address(delivery));
        require(proofBook.allVerified(handId),"four accepted encrypted shares per recipient");
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
        engine.prepareDealAssignment(id);
        _acknowledgedPrivateDelivery(id);
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
        require(g.toAct==0&&g.pot==30&&g.currentBet==20,"heads-up blind/button");
        require(!engine.canRevealStreet(id,1),"flop cannot be exposed prematurely");
        _signedAction(id,0,PokerNLHEBetting420.Move.CALL,10,PLAYER_KEY);
        g=engine.gameOf(id);
        require(g.toAct==1 && g.pot==40,"next actor");
        _signedAction(id,1,PokerNLHEBetting420.Move.CHECK,0,OPPONENT_KEY);
        g=engine.gameOf(id);
        require(g.phase==PokerNLHEBetting420.Phase.AWAIT_FLOP,"waiting for verified board");
        require(engine.canRevealStreet(id,1),"authorized flop");
        require(g.pot==40 && g.nonce==2,"conserved signed actions");
        require(ledger.reservedInHand(TABLE)==800,"funds locked through betting");
    }
    function testTimeoutFoldsOnlyPlayerFacingLiveBet() public {
        bytes32 id=_readyBetting();
        cheat54.warp(block.timestamp+61);
        engine.timeout(id);
        PokerNLHEBetting420.Game memory g=engine.gameOf(id);
        require(g.phase==PokerNLHEBetting420.Phase.UNCONTESTED,"fold terminal");
        require(engine.playerOf(id,0).folded,"auto-fold on owed bet");
        require(g.pot==30 && g.nonce==1,"timeout cannot alter chips");
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
            uint8(g.phase),uint8(0),uint8(PokerNLHEBetting420.Move.CALL),uint256(10)));
        bytes32 digest=signing.actionDigest(id,0,1,g.stateRoot,moveHash,expiry);
        (uint8 v,bytes32 rr,bytes32 ss)=signedVm.sign(PLAYER_KEY,digest);
        bytes memory signature=abi.encodePacked(rr,ss,v);
        signing.checkSignature(id,0,1,g.stateRoot,moveHash,expiry,signature);
        require(signing.lastActionNonce(id,0)==0,"signature remains unconsumed");
        engine.action(id,0,PokerNLHEBetting420.Move.CALL,10,expiry,g.stateRoot,signature);
        require(engine.gameOf(id).nonce==1,"engine atomically consumes");
    }
    function testWithheldPreplayShuffleRefundsLockedBalancesWithoutOperatorConsent() public {
        _prepared();
        bytes32 id=_begin(1);
        cheat54.prank(ADMIN);ledger.bindSettlement(TABLE,address(engine),address(0x500BEEF));
        cheat54.prank(PLAYER);engine.reserve(id);
        require(ledger.reservedInHand(TABLE)==800,"funded escrow locked");
        cheat54.expectRevert(PokerNLHEBetting420.TooEarly.selector);
        cheat54.prank(OTHER);engine.cancelWithheldDeal(id);
        cheat54.warp(block.timestamp+1 hours+121);
        cheat54.prank(OTHER);engine.cancelWithheldDeal(id);
        require(engine.handAborted(id)&&ledger.handConsumed(id),"one time void");
        require(ledger.activeHand(TABLE)==bytes32(0)&&ledger.reservedInHand(TABLE)==0,
            "no locks after safe original-balance refund");
        require(ledger.seatOf(TABLE,0).chips==400&&ledger.seatOf(TABLE,1).chips==400,
            "dealer never transfers chips");
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);
        engine.cancelWithheldDeal(id);
    }

    function testUnacknowledgedHoleDeliveryCannotStartOrMoveEscrow() public {
        bytes32 id=_hand54();
        bytes32 input=initialDeck.rootOf(id);
        bytes32 first=keccak256("phase one");
        bytes32 second=bytes32(uint256(1000));
        verifier.allow(gate.statement(id,1,input,first));
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,input,first,hex"010203");
        verifier.allow(gate.statement(id,2,first,second));
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,first,second,hex"010203");
        cheat54.prank(ADMIN);ledger.bindSettlement(TABLE,address(engine),address(0x500BEEF));
        cheat54.prank(PLAYER);engine.reserve(id);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);
        engine.start(id,0,60);
        require(ledger.reservedInHand(TABLE)==800,"escrow never moved");
        engine.prepareDealAssignment(id);
        _acknowledgedPrivateDelivery(id);
        engine.start(id,0,60);
        require(engine.gameOf(id).initialized,"recipient consent required");
    }

}
