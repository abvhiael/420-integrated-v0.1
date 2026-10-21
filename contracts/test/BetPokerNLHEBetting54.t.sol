// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerPrivateShuffleGate54.t.sol";
import "../src/bet/PokerNLHEBetting420.sol";
import "../src/bet/PokerActionKeys420.sol";
import "../src/bet/PokerActionDisputeClock420.sol";
import "../src/bet/PokerRecipientKeys420.sol";
import "../src/bet/PokerDeckDisclosure420.sol";
import "../src/bet/PokerDeliveryProofBook420.sol";
/// @dev TEST-ONLY generated-verifier API fixture. The actual Groth16
/// acceptance owner uses genuine gnark output in the scoped proof workflow.
contract TestNativeGnarkBackend54 {
    function verifyProof(uint256[8] calldata,uint256[18] calldata)external pure returns(bool){return true;}
    function verifyProof(uint256[8] calldata,uint256[3] calldata)external pure returns(bool){return true;}
    function verifyProof(uint256[8] calldata,uint256[7] calldata)external pure returns(bool){return true;}
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
    PokerProviderAccountability420 providerBond;
    PokerGnarkRecipientKeyPoPAdapter420 popVerifier;
    TestNativeGnarkBackend54 backend;
    PokerVerifierVersions420 versionRegistry;
    VmPokerNativeSign54 constant signedVm=VmPokerNativeSign54(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant PLAYER_KEY=0x420001;
    uint256 constant OPPONENT_KEY=0x420002;
    constructor(){
        signing=new PokerActionKeys420(address(deal));
        dispute=new PokerActionDisputeClock420(address(deal));
        engine=new PokerNLHEBetting420(address(deal),address(gate),address(signing),address(dispute));
        providerBond=new PokerProviderAccountability420(address(deal),address(engine),address(0xB00D));
        coin.mint(PROVIDER_A,3000);coin.mint(PROVIDER_B,3000);
        cheat54.prank(PROVIDER_A);coin.approve(address(providerBond),3000);
        cheat54.prank(PROVIDER_B);coin.approve(address(providerBond),3000);
        cheat54.prank(PROVIDER_A);providerBond.fundAsset(address(coin),3000);
        cheat54.prank(PROVIDER_B);providerBond.fundAsset(address(coin),3000);
        cap.grant(ADMIN,engine.ACTION_BIND_PROVIDER_BOND(),auth.scopeForTable(TABLE),true);
        cheat54.prank(ADMIN);engine.bindProviderBond(TABLE,address(providerBond));
        recipient=new PokerRecipientKeys420(address(ledger));
        delivery=new PokerDeckDisclosure420(address(deal),address(recipient));
        backend=new TestNativeGnarkBackend54();
        versionRegistry=new PokerVerifierVersions420(address(this));
        bytes32 version=keccak256("test-only delivery verifier");
        bytes32 keyHash=keccak256("test-only VK");
        bytes32 circuitHash=keccak256("test-only delivery circuit");
        bytes32 schemaHash=keccak256("test-only delivery schema");
        versionRegistry.register(version,address(backend),keyHash,circuitHash,schemaHash);
        PokerGnarkEncryptedShareDeliveryAdapter420 proverA=
            new PokerGnarkEncryptedShareDeliveryAdapter420(address(backend),address(versionRegistry),
                version,circuitHash,keyHash,schemaHash,keccak256(abi.encode(uint256(100),uint256(200))));
        PokerGnarkEncryptedShareDeliveryAdapter420 proverB=
            new PokerGnarkEncryptedShareDeliveryAdapter420(address(backend),address(versionRegistry),
                version,circuitHash,keyHash,schemaHash,keccak256(abi.encode(uint256(101),uint256(201))));
        bytes32 popVersion=keccak256("test-only recipient key possession");
        bytes32 popCircuit=keccak256("test-only recipient point circuit");
        bytes32 popSchema=keccak256("test-only key-possession schema");
        versionRegistry.register(popVersion,address(backend),keyHash,popCircuit,popSchema);
        popVerifier=new PokerGnarkRecipientKeyPoPAdapter420(address(backend),
            address(versionRegistry),popVersion,keyHash,popCircuit,popSchema);
        bytes32 aggregateVersion=keccak256("test-only aggregate key");
        bytes32 aggregateCircuit=keccak256("test-only aggregate curve relation");
        bytes32 aggregateSchema=keccak256("test-only aggregate schema");
        versionRegistry.register(aggregateVersion,address(backend),keyHash,
            aggregateCircuit,aggregateSchema);
        PokerGnarkThresholdKeyAggregateAdapter420 aggregate=
            new PokerGnarkThresholdKeyAggregateAdapter420(address(backend),
                address(versionRegistry),aggregateVersion,aggregateCircuit,keyHash,
                aggregateSchema,gate.thresholdKeyCommitment());
        proofBook=new PokerDeliveryProofBook420(address(deal),address(delivery),
            address(gate),address(engine),address(proverA),address(proverB),address(aggregate));
        cap.grant(ADMIN,recipient.ACTION_BIND_KEY_POP(),auth.scopeGlobal(),true);
        cap.grant(ADMIN,delivery.ACTION_BIND_PROOF_BOOK(),auth.scopeForTable(TABLE),true);
        cheat54.prank(ADMIN);recipient.bindProofVerifier(address(popVerifier));
        cheat54.prank(ADMIN);delivery.bindProofBook(TABLE,address(proofBook));
        cap.grant(ADMIN,engine.ACTION_BIND_DELIVERY(),auth.scopeForTable(TABLE),true);
        cap.grant(ADMIN,ledger.ACTION_BIND_SETTLEMENT(),auth.scopeForTable(TABLE),true);
    }
    function _acknowledgedPrivateDelivery(bytes32 handId) internal {
        // NOTE: these are integration-only verifier stubs. Real Groth16 is
        // qualified separately by generated Solidity proof acceptance.
        uint256[8] memory keyProof;
        uint256[3] memory pkeyA=[recipient.scopeForKey(TABLE,PLAYER,ledger.seatOf(TABLE,0).epoch),
            uint256(111),uint256(222)];
        uint256[3] memory pkeyB=[recipient.scopeForKey(TABLE,PLAYER_B,ledger.seatOf(TABLE,1).epoch),
            uint256(333),uint256(444)];
        cheat54.prank(PLAYER);recipient.bindVerifiedKey(TABLE,111,222,abi.encode(keyProof,pkeyA));
        cheat54.prank(PLAYER_B);recipient.bindVerifiedKey(TABLE,333,444,abi.encode(keyProof,pkeyB));
        uint256[6] memory aggregateKeys=[
            uint256(100),uint256(200),uint256(101),uint256(201),uint256(19),uint256(20)];
        uint256[7] memory aggregatePublic=[
            proofBook.aggregateScope(aggregateKeys),uint256(100),uint256(200),
            uint256(101),uint256(201),uint256(19),uint256(20)];
        uint256[8] memory aggregateProof;
        proofBook.proveAggregateKey(aggregateKeys,abi.encode(aggregateProof,aggregatePublic));
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
                uint256[18] memory inputs;
                PokerPrivateShuffleGate420.Record memory deck=gate.recordOf(handId);
                inputs[0]=uint256(handId)%21888242871839275222246405745257275088696311157297823662689037894645226208583;
                inputs[1]=uint256(deck.finalDeckRoot);
                inputs[2]=pos;inputs[3]=seat;inputs[4]=provider;
                inputs[5]=proofBook.context(handId,pos,seat,provider,deck.finalDeckRoot,
                    recipient.fingerprintOf(TABLE,seat),ledger.seatingEpoch(TABLE),points);
                for(uint256 k=0;k<12;k++)inputs[k+6]=points[k];
                uint256[8] memory proof;
                proofBook.proveEncryptedShare(handId,pos,provider,points,abi.encode(proof,inputs));
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
    function _readyProvedDelivery() internal returns(bytes32 id){
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
    }
    function _readyBetting() internal returns(bytes32 id){
        id=_readyProvedDelivery();
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

    function testVerifiedDeliveryCannotBeReboundAfterRecipientKeyRotation() public {
        bytes32 id=_readyProvedDelivery();
        require(delivery.allAcknowledged(id),"complete delivered shares required");
        bytes32 beforeHash=proofBook.envelopeHashFor(id,0);
        require(beforeHash!=bytes32(0),"authenticated ciphertext envelope");
        PokerSeatLedger420.Seat memory seat=ledger.seatOf(TABLE,0);
        uint256[8] memory raw;
        uint256[3] memory pub=[
            recipient.scopeForKey(TABLE,PLAYER,seat.epoch),uint256(555),uint256(666)];
        cheat54.prank(PLAYER);
        recipient.bindVerifiedKey(TABLE,555,666,abi.encode(raw,pub));
        require(!delivery.allAcknowledged(id),"rotated key cannot reuse proved ciphertext");
        cheat54.expectRevert(PokerDeliveryProofBook420.InvalidState.selector);
        proofBook.envelopeHashFor(id,0);
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);
        engine.start(id,0,60);
        require(ledger.reservedInHand(TABLE)==800,"no escrow consumed by rotated proof");
    }
    function testPostBettingMissingFlopProofRecoversOriginalEscrowExactlyOnce() public {
        bytes32 id=_readyBetting();
        _signedAction(id,0,PokerNLHEBetting420.Move.CALL,10,PLAYER_KEY);
        _signedAction(id,1,PokerNLHEBetting420.Move.CHECK,0,OPPONENT_KEY);
        require(engine.gameOf(id).phase==PokerNLHEBetting420.Phase.AWAIT_FLOP,
            "actual committed flop reveal awaited");
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);
        engine.beginMissingEvidenceRecovery(id);
        cheat54.warp(uint256(engine.evidenceDueAt(id))+1);
        engine.beginMissingEvidenceRecovery(id);
        cheat54.expectRevert(PokerNLHEBetting420.TooEarly.selector);
        engine.finalizeMissingEvidenceRecovery(id);
        (,uint64 afterAt,,,) = engine.evidenceRecovery(id);
        cheat54.warp(afterAt);
        engine.finalizeMissingEvidenceRecovery(id);
        require(engine.handAborted(id)&&ledger.handConsumed(id),"hand consumed exactly once");
        require(ledger.activeHand(TABLE)==bytes32(0)&&ledger.reservedInHand(TABLE)==0,
            "funds unlocked at terminal void");
        require(ledger.seatOf(TABLE,0).chips==400&&ledger.seatOf(TABLE,1).chips==400,
            "wagers cannot be fabricated into refunds");
        require(ledger.totalChips(TABLE)==800,"no fictitious winnings or rake");
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);
        engine.finalizeMissingEvidenceRecovery(id);
    }
    function testCompletedShuffleButMissingProvedDeliveryVoidsPreBetting() public {
        bytes32 id=_hand54();
        bytes32 input=initialDeck.rootOf(id);
        bytes32 first=keccak256("withheld delivery first stage");
        bytes32 last=bytes32(uint256(1000));
        verifier.allow(gate.statement(id,1,input,first));
        cheat54.prank(PROVIDER_A);gate.proveStage(id,1,input,first,hex"010203");
        verifier.allow(gate.statement(id,2,first,last));
        cheat54.prank(PROVIDER_B);gate.proveStage(id,2,first,last,hex"010203");
        cheat54.prank(ADMIN);ledger.bindSettlement(TABLE,address(engine),address(0x500BEEF));
        cheat54.prank(PLAYER);engine.reserve(id);
        engine.prepareDealAssignment(id);
        cheat54.expectRevert(PokerNLHEBetting420.TooEarly.selector);
        engine.cancelWithheldDelivery(id);
        PokerConfidentialDeal420.Hand memory h=deal.getHand(id);
        cheat54.warp(uint256(h.deadline)+1 hours+1);
        engine.cancelWithheldDelivery(id);
        require(engine.handAborted(id)&&ledger.handConsumed(id),"prebet void consumed");
        require(ledger.seatOf(TABLE,0).chips==400&&ledger.seatOf(TABLE,1).chips==400,
            "no private-card withholding can take escrow");
        (,,,,bool locked,bool closed,uint8 faults)=providerBond.bonds(id);
        require(!locked&&closed&&faults==3,"both withholding providers slashed objectively");
        require(coin.balanceOf(address(0xB00D))==1600,"bond penalties kept separate from player escrow");
        cheat54.expectRevert(PokerNLHEBetting420.InvalidState.selector);
        engine.cancelWithheldDelivery(id);
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
