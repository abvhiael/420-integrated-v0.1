// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/PokerVerifierVersions420.sol";
import "../src/bet/PokerGnarkElGamalAdapters420.sol";
import "./BetPokerWS8ProductionFixture54.sol";

/// @notice Inherited registry invariants. The separate funded contract below
/// owns the genuine proof-admitted settlement and ten adversarial scenarios.
contract BetPokerIntegratedAdversarial54Test {
    PokerVerifierVersions420 internal versions;

    constructor() {
        versions = new PokerVerifierVersions420(address(this));
    }

    /// @dev A registry controls verifier identity and pins its runtime code hash.
    /// This control does NOT replace a genuine Groth16 proof.
    function testProductionRegistryPinsRuntimeCodeHash() public {
        bytes32 version = keccak256("WS8.REGISTRY.INVARIANT");
        bytes32 vk = keccak256("WS8.DISTINCT.VK");
        bytes32 circuit = keccak256("WS8.DISTINCT.CIRCUIT");
        bytes32 schema = keccak256("WS8.DISTINCT.PUBLIC.INPUTS");

        // A real production verifier must be obtained from the qualified proof
        // artifacts; using this registry's own runtime here only tests registry
        // mechanics, and MUST NOT be used for poker proof admission.
        versions.register(version, address(this), vk, circuit, schema);
        PokerVerifierVersions420.Version memory record = versions.get(version);
        require(record.exists, "version not registered");
        require(record.verifier == address(this), "verifier address changed");
        require(record.verifierCodeHash == address(this).codehash, "runtime not pinned");
        require(record.verifyingKeyHash == vk, "verifying key id changed");
        require(record.circuitHash == circuit, "circuit identity changed");
        require(record.publicInputSchemaHash == schema, "schema identity changed");
        require(versions.matches(version,address(this),vk,circuit,schema), "valid registration rejected");
        require(!versions.matches(version,address(this),keccak256("wrong"),circuit,schema),
            "wrong verifying key accepted");
        require(!versions.matches(version,address(this),vk,keccak256("wrong"),schema),
            "wrong circuit accepted");
        require(!versions.matches(version,address(this),vk,circuit,keccak256("wrong")),
            "wrong schema accepted");
    }

    /// @dev An unauthorized entity cannot install a verifier identity.
    function testUnauthorizedVerifierRegistrationReverts() public {
        PokerVerifierVersions420 other = new PokerVerifierVersions420(address(0xBEEF));
        (bool ok,) = address(other).call(abi.encodeCall(
            PokerVerifierVersions420.register,
            (keccak256("unauthorized"), address(this), keccak256("vk"),
             keccak256("circuit"), keccak256("schema"))
        ));
        require(!ok, "unauthorized registration accepted");
    }


    /// @dev A second registration cannot substitute a different verifier/VK
    /// for an already registered circuit version.
    function testRegisteredVerifierVersionCannotBeOverwritten() public {
        bytes32 id = keccak256("WS8.IMMUTABLE.VK.VERSION");
        bytes32 vk = keccak256("WS8.ORIGINAL.VK");
        bytes32 circuit = keccak256("WS8.ORIGINAL.CIRCUIT");
        bytes32 schema = keccak256("WS8.ORIGINAL.SCHEMA");
        versions.register(id, address(this), vk, circuit, schema);
        (bool ok,) = address(versions).call(abi.encodeCall(
            PokerVerifierVersions420.register,
            (id, address(this), keccak256("ATTACKER.VK"), circuit, schema)
        ));
        require(!ok, "verifier version overwritten");
        require(versions.matches(id,address(this),vk,circuit,schema),
            "previous verified identity changed");
    }

    /// @dev Invalid/undeployed verifiers cannot become trusted identities.
    function testUncontractedVerifierCannotBeRegistered() public {
        bytes32 id = keccak256("WS8.NONCONTRACT.VERIFIER");
        (bool ok,) = address(versions).call(abi.encodeCall(
            PokerVerifierVersions420.register,
            (id, address(0x123456), keccak256("VK"),keccak256("CIRCUIT"),keccak256("SCHEMA"))
        ));
        require(!ok, "uncontracted verifier registered");
        require(!versions.get(id).exists, "bad verifier persisted");
    }


}

/// @notice Genuine generated Groth16 admission through the canonical funded
/// native engine, including independent providers, current seat authority,
/// recipient delivery, live reveals and atomic ledger settlement.
contract BetPokerIntegratedFundedAdversarial54Test is PokerWS8ProductionFixture54 {
    event WS8ActionRecord(uint64 nonce,uint8 seat,uint8 move,uint256 amount);
    event WS8StreetRecord(uint8 street);
    event WS8HoleOwner(uint8 position,uint8 seat);
    event WS8VerifiedPublicStatement(string label,bytes proofAndPublicInputs);
    event WS8QualifiedSettlement(bytes32 indexed handId,bytes32 terminalTranscript,uint256 player0,uint256 player1,uint256 rake);

    function _n(uint256 v) internal pure returns(string memory){
        if(v==0)return "0";uint256 x=v;uint256 len;while(x!=0){len++;x/=10;}
        bytes memory b=new bytes(len);while(v!=0){b[--len]=bytes1(uint8(48+v%10));v/=10;}return string(b);
    }
    function _data(string memory name) internal virtual returns(bytes memory){
        return ws8vm.readFileBinary(string.concat("../clients/420bet-poker/zkshuffle/fixtures/ws8/proofs/",name));
    }
    function _proof(string memory name) internal returns(bytes memory){return _data(string.concat(name,".abi"));}
    function _roots() internal returns(bytes32[3] memory){return abi.decode(_data("roots.bin"),(bytes32[3]));}
    function _funded() internal returns(bytes32 id){
        id=_ws8FundedHand();
        require(keccak256(abi.encode(_ws8Context(id)))==keccak256(ws8vm.readFileBinary("../clients/420bet-poker/zkshuffle/fixtures/ws8/context.bin")),
            "proof material does not match production contract context");
    }
    function _attest(address provider,address auditor,bytes32 group) internal {
        bytes32 dossier=keccak256(abi.encode("WS8.INDEPENDENT.DOSSIER",provider,group));
        uint64 expiry=uint64(block.timestamp+30 days);
        cheat54.prank(provider);ws8Independence.claim(group,dossier,expiry);
        cheat54.prank(auditor);
        bytes32 audit=ws8Independence.recordAudit(provider,group,keccak256(abi.encode("WS8.REPORT",provider)),dossier,keccak256(abi.encode("WS8.LOCATION",provider)));
        ws8Independence.attest(provider,group,dossier,expiry,audit);
    }
    function _independent() internal {
        _attest(PROVIDER_A,address(0xC0FFEE),keccak256("WS8.CONTROLLER.A"));
        _attest(PROVIDER_B,address(0xD00D),keccak256("WS8.CONTROLLER.B"));
        require(ws8Independence.independentlyEligible(PROVIDER_A,PROVIDER_B),"independent providers");
    }
    function _publishAndInitial(bytes32 id) internal {
        bytes32[3] memory roots=_roots();
        for(uint8 i;i<3;i++){
            uint256[208] memory coords=abi.decode(_data(string.concat("deck-",_n(i),".bin")),(uint256[208]));
            require(ws8Availability.publish(uint256(id)%WS8_FR,coords)==roots[i],"actual ciphertext root");
        }
        ws8Initial.submit(id,roots[0],_proof("WS8Initial"));
        require(ws8Initial.rootOf(id)==roots[0],"initial Groth16 admission");
        emit WS8VerifiedPublicStatement("initial",_proof("WS8Initial"));
    }
    function _stages(bytes32 id) internal {
        bytes32[3] memory roots=_roots();bytes memory a=_proof("WS8Shuffle1");bytes memory b=_proof("WS8Shuffle2");
        cheat54.prank(PROVIDER_A);ws8Shuffle.proveStage(id,1,roots[0],roots[1],a);
        cheat54.prank(PROVIDER_B);ws8Shuffle.proveStage(id,2,roots[1],roots[2],b);
        require(ws8Shuffle.isProofComplete(id),"both genuine authenticated shuffle stages");
        ws8Engine.prepareDealAssignment(id);
        for(uint8 pos;pos<4;pos++)emit WS8HoleOwner(pos,ws8Engine.holeSeatForPosition(id,pos));
        emit WS8VerifiedPublicStatement("shuffle1",a);emit WS8VerifiedPublicStatement("shuffle2",b);
    }
    function _shuffled() internal returns(bytes32 id){id=_funded();_independent();_publishAndInitial(id);_stages(id);}
    function _keys() internal {
        for(uint8 seat;seat<2;seat++){
            bytes memory proof=_proof(string.concat("WS8Recipient",_n(seat)));
            (,uint256[3] memory pub)=abi.decode(proof,(uint256[8],uint256[3]));
            cheat54.prank(seat==0?PLAYER:PLAYER_B);ws8Recipients.bindVerifiedKey(TABLE,pub[1],pub[2],proof);
            emit WS8VerifiedPublicStatement(string.concat("recipient",_n(seat)),proof);
        }
        ws8Book.proveAggregateKey(WS8VerifierData.keys(),_proof("WS8Aggregate"));
        require(ws8Book.aggregateVerified(),"genuine aggregate-key relation");
        emit WS8VerifiedPublicStatement("aggregate",_proof("WS8Aggregate"));
    }
    function _deliveryShare(bytes32 id,uint8 pos,uint8 provider) internal {
        string memory name=string.concat("WS8Delivery",_n(pos),_n(provider));
        bytes memory proof=_proof(name);uint256[12] memory points=abi.decode(_data(string.concat(name,".points")),(uint256[12]));
        cheat54.prank(provider==0?PROVIDER_A:PROVIDER_B);ws8Book.proveEncryptedShare(id,pos,provider,points,proof);
        emit WS8VerifiedPublicStatement(name,proof);
    }
    function _deliver(bytes32 id) internal {
        _keys();
        cheat54.prank(PROVIDER_A);ws8Delivery.publish(id,keccak256("WS8.AUTHENTICATED.DECK"),keccak256("WS8.ENCRYPTED.MANIFEST"));
        for(uint8 pos;pos<4;pos++)for(uint8 provider;provider<2;provider++)_deliveryShare(id,pos,provider);
        for(uint8 seat;seat<2;seat++){
            bytes32 envelope=ws8Book.envelopeHashFor(id,seat);bytes32 fingerprint=ws8Recipients.fingerprintOf(TABLE,seat);
            cheat54.prank(seat==0?PROVIDER_A:PROVIDER_B);ws8Delivery.bindEnvelope(id,seat,envelope,fingerprint);
            bytes32 receipt=ws8Delivery.receiptDigest(id,seat);
            cheat54.prank(seat==0?PLAYER:PLAYER_B);ws8Delivery.acknowledge(id,seat,receipt);
        }
        require(ws8Book.allVerified(id)&&ws8Delivery.allAcknowledged(id),"same hand verified private delivery and owner receipts");
    }
    function _ready() internal returns(bytes32 id){id=_shuffled();_deliver(id);ws8Engine.start(id,0,60);}
    function _signed(bytes32 id,uint8 seat,PokerNLHEBetting420.Move move,uint256 amount,uint256 privateKey) internal {
        PokerNLHEBetting420.Game memory g=ws8Engine.gameOf(id);uint64 expiry=uint64(block.timestamp+50);
        bytes32 moveHash=keccak256(abi.encode(ws8Engine.ACTION_DOMAIN(),id,uint8(g.phase),seat,uint8(move),amount));
        bytes32 digest=ws8Signing.actionDigest(id,seat,g.nonce+1,g.stateRoot,moveHash,expiry);
        (uint8 v,bytes32 r,bytes32 s)=ws8vm.sign(privateKey,digest);
        ws8Engine.action(id,seat,move,amount,expiry,g.stateRoot,abi.encodePacked(r,s,v));
        emit WS8ActionRecord(g.nonce+1,seat,uint8(move),amount);
    }
    function _partial(bytes32 id,uint8 street,uint8 pos,uint8 provider) internal {
        string memory name=string.concat("WS8Partial",_n(street),_n(pos),_n(provider));
        uint256[8] memory points=abi.decode(_data(string.concat(name,".points")),(uint256[8]));bytes memory proof=_proof(name);
        cheat54.prank(provider==0?PROVIDER_A:PROVIDER_B);ws8Live.submitShare(id,street,pos,provider,points,proof);
        emit WS8VerifiedPublicStatement(name,proof);
    }
    function _reveal(bytes32 id,uint8 street,uint8 pos) internal virtual {
        _partial(id,street,pos,0);_partial(id,street,pos,1);
        ws8Live.reveal(id,street,pos,pos,WS8VerifierData.keys(),_proof(string.concat("WS8Unmask",_n(street),_n(pos))));
        emit WS8VerifiedPublicStatement(string.concat("WS8Unmask",_n(street),_n(pos)),_proof(string.concat("WS8Unmask",_n(street),_n(pos))));
        require(ws8Live.slotOf(id,pos).opened&&ws8Live.slotOf(id,pos).card==pos,"verified canonical card");
    }
    function _preflop(bytes32 id) internal {
        _signed(id,0,PokerNLHEStorage420.Move.CALL,10,WS8_PLAYER_KEY);
        _signed(id,1,PokerNLHEStorage420.Move.CHECK,0,WS8_OPPONENT_KEY);
    }
    function _checks(bytes32 id) internal {
        _signed(id,1,PokerNLHEStorage420.Move.CHECK,0,WS8_OPPONENT_KEY);
        _signed(id,0,PokerNLHEStorage420.Move.CHECK,0,WS8_PLAYER_KEY);
    }
    function _showdown(bytes32 id) internal {
        _preflop(id);
        for(uint8 pos=5;pos<=7;pos++)_reveal(id,1,pos);
        ws8Live.advance(id,1);emit WS8StreetRecord(1);_checks(id);
        _reveal(id,2,9);ws8Live.advance(id,2);emit WS8StreetRecord(2);_checks(id);
        _reveal(id,3,11);ws8Live.advance(id,3);emit WS8StreetRecord(3);_checks(id);
        for(uint8 pos;pos<4;pos++)_reveal(id,4,pos);
        require(ws8Engine.gameOf(id).phase==PokerNLHEStorage420.Phase.SHOWDOWN&&ws8Live.isStageComplete(id,4),"genuine showdown");
    }
    function _policy() internal pure returns(PokerCanonicalRake420.Policy memory){return PokerCanonicalRake420.Policy(500,20,true,true);}
    function _settle(bytes32 id) internal {
        (uint256[9] memory amounts,uint256 fee)=ws8Outcome.calculate(id,_policy());
        // The five board cards outrank all four hole cards in the same suit.
        // Independently replayed in the Node qualification owner as well.
        require(amounts[0]==399&&amounts[1]==399&&fee==2,"independent contested split and canonical rake");
        ws8Engine.settle(id,_policy());
        require(ledger.handConsumed(id)&&ws8Engine.handSettled(id)&&!ws8Engine.handAborted(id),"canonical atomic finality");
        require(ledger.seatOf(TABLE,0).chips==399&&ledger.seatOf(TABLE,1).chips==399,"canonical balances");
        require(ledger.totalChips(TABLE)==798&&coin.balanceOf(address(ledger))==798&&coin.balanceOf(WS8_RAKES)==2,"exact escrow plus rake conservation");
        require(ws8Bonds.available(address(coin),PROVIDER_A)==800&&ws8Bonds.available(address(coin),PROVIDER_B)==800,"independently released provider bonds");
        require(coin.balanceOf(address(ws8Bonds))==1600,"provider funds segregated");
        require(ws8Engine.terminalTranscript(id)!=bytes32(0)&&ws8Engine.actionTranscriptRoot(id)!=bytes32(0),"sealed native transcript");
        emit WS8QualifiedSettlement(id,ws8Engine.terminalTranscript(id),399,399,2);
    }
    function _escrowUnchanged(bytes32 id) internal view {
        require(ledger.activeHand(TABLE)==id&&ledger.reservedInHand(TABLE)==800&&coin.balanceOf(address(ledger))==800,"attack changed reserved custody");
        require(!ledger.handConsumed(id)&&!ws8Engine.handSettled(id),"attack caused terminal settlement");
    }

    function testLegitimateFundedHandSettlement() public {bytes32 id=_ready();_showdown(id);_settle(id);}

    function testColludingDealers() public {
        bytes32 id=_funded();bytes32 common=keccak256("WS8.COMMON.CONTROL");
        _attest(PROVIDER_A,address(0xC0FFEE),common);_attest(PROVIDER_B,address(0xD00D),common);
        require(!ws8Independence.independentlyEligible(PROVIDER_A,PROVIDER_B),"common control admitted");
        _publishAndInitial(id);bytes32[3] memory roots=_roots();bytes memory proof=_proof("WS8Shuffle1");
        cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);
        cheat54.prank(PROVIDER_A);ws8Shuffle.proveStage(id,1,roots[0],roots[1],proof);
        _escrowUnchanged(id);require(ws8Shuffle.recordOf(id).stage==0,"colluding stage persisted");
    }
    function testForgedRecipient() public {
        bytes32 id=_shuffled();bytes memory proof=_proof("WS8Recipient0");
        (,uint256[3] memory pub)=abi.decode(proof,(uint256[8],uint256[3]));
        cheat54.expectRevert(PokerRecipientKeys420.NotSeated.selector);
        cheat54.prank(PROVIDER_A);ws8Recipients.bindVerifiedKey(TABLE,pub[1],pub[2],proof);
        cheat54.expectRevert(PokerRecipientKeys420.InvalidKey.selector);
        cheat54.prank(PLAYER_B);ws8Recipients.bindVerifiedKey(TABLE,pub[1],pub[2],proof);
        _escrowUnchanged(id);
        _deliver(id);ws8Engine.start(id,0,60);_showdown(id);_settle(id);
    }
    function testCiphertextSubstitution() public {
        bytes32 id=_shuffled();_keys();
        uint256[12] memory points=abi.decode(_data("WS8Delivery00.points"),(uint256[12]));
        (uint256[8] memory proof,uint256[18] memory pub)=abi.decode(_proof("WS8Delivery00"),(uint256[8],uint256[18]));
        points[0]+=1;pub[6]=points[0];
        bytes32[3] memory roots=_roots();
        pub[5]=ws8Book.context(id,0,0,0,roots[2],ws8Recipients.fingerprintOf(TABLE,0),ledger.seatingEpoch(TABLE),points);
        bytes memory forged=abi.encode(proof,pub);
        cheat54.expectRevert(PokerDeliveryProofBook420.InvalidProof.selector);
        cheat54.prank(PROVIDER_A);ws8Book.proveEncryptedShare(id,0,0,points,forged);
        require(ws8Book.proofMaskOf(id,0)==0,"substituted ciphertext counted");_escrowUnchanged(id);
        _deliveryShare(id,0,0);require(ws8Book.proofMaskOf(id,0)==1,"genuine proof rejected after failed forgery");
    }
    function testRevokedKeys() public {
        bytes32 id=_shuffled();_deliver(id);
        cheat54.prank(PLAYER);ws8Recipients.bindKey(TABLE,keccak256("WS8.REVOKED.RECIPIENT"));
        require(!ws8Delivery.allAcknowledged(id),"stale encrypted receipt remained live");
        cheat54.expectRevert(PokerNLHEStorage420.InvalidState.selector);ws8Engine.start(id,0,60);
        _escrowUnchanged(id);
        // Restore the actual key with its genuine current-seat possession proof.
        bytes memory pop=_proof("WS8Recipient0");(,uint256[3] memory key)=abi.decode(pop,(uint256[8],uint256[3]));
        cheat54.prank(PLAYER);ws8Recipients.bindVerifiedKey(TABLE,key[1],key[2],pop);
        ws8Engine.start(id,0,60);
        address replacement=ws8vm.addr(0x420003);
        cheat54.prank(PLAYER);ws8Signing.bindSigner(TABLE,replacement);
        cheat54.expectRevert(PokerActionKeys420.InvalidSignature.selector);
        this.attackWithOldSigner(id);
        require(ws8Engine.gameOf(id).nonce==0,"revoked signer consumed nonce");_escrowUnchanged(id);
    }
    function attackWithOldSigner(bytes32 id) external {
        require(msg.sender==address(this));_signed(id,0,PokerNLHEStorage420.Move.CALL,10,WS8_PLAYER_KEY);
    }
    function testCrossHandReplay() public {
        bytes32 id=_funded();_independent();bytes32[3] memory roots=_roots();
        (uint256[8] memory proof,uint256[5] memory pub)=abi.decode(_proof("WS8Initial"),(uint256[8],uint256[5]));
        bytes32 snapshot=deal.snapshotFor(TABLE,3);
        cheat54.prank(ADMIN);bytes32 target=deal.begin(TABLE,2,uint64(block.timestamp+3600),keccak256("WS8.SECOND.HAND"),snapshot,3);
        cheat54.prank(PROVIDER_A);deal.commit(target,keccak256("WS8.SECOND.A"));
        cheat54.prank(PROVIDER_B);deal.commit(target,keccak256("WS8.SECOND.B"));
        bytes memory original=abi.encode(proof,pub);
        cheat54.expectRevert(PokerInitialEncryptedDeck420.InvalidProof.selector);ws8Initial.submit(target,roots[0],original);
        // Make the public fields match the new hand to force genuine Groth16
        // verification, rather than relying solely on wrapper input equality.
        pub[1]=uint256(ws8Initial.statement(target,roots[0]))%WS8_FR;
        pub[2]=uint256(target)%WS8_FR;bytes memory forged=abi.encode(proof,pub);
        cheat54.expectRevert(PokerInitialEncryptedDeck420.InvalidProof.selector);ws8Initial.submit(target,roots[0],forged);
        require(ws8Initial.rootOf(target)==0,"replayed initial deck persisted");_escrowUnchanged(id);
        _publishAndInitial(id);_stages(id);_deliver(id);ws8Engine.start(id,0,60);_showdown(id);_settle(id);
    }
    function testPrematureReveal() public {
        bytes32 id=_ready();uint256[8] memory points=abi.decode(_data("WS8Partial150.points"),(uint256[8]));bytes memory proof=_proof("WS8Partial150");
        cheat54.expectRevert(PokerLiveCardReveals420.WrongStreet.selector);
        cheat54.prank(PROVIDER_A);ws8Live.submitShare(id,1,5,0,points,proof);
        require(!ws8Live.slotOf(id,5).shareA&&!ws8Live.slotOf(id,5).opened,"early card evidence persisted");
        _escrowUnchanged(id);_showdown(id);_settle(id);
    }
    function testSelectiveWithholding() public {
        bytes32 id=_shuffled();_keys();
        cheat54.prank(PROVIDER_A);ws8Delivery.publish(id,keccak256("WS8.AUTHENTICATED.DECK"),keccak256("WS8.ENCRYPTED.MANIFEST"));
        for(uint8 pos;pos<4;pos++)_deliveryShare(id,pos,0);
        cheat54.expectRevert(PokerNLHEStorage420.InvalidState.selector);ws8Engine.start(id,0,60);
        _escrowUnchanged(id);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));
        ws8Engine.cancelWithheldDelivery(id);
        require(ledger.handConsumed(id)&&ws8Engine.handAborted(id)&&!ws8Engine.handSettled(id),"withholding terminal refund");
        require(ledger.seatOf(TABLE,0).chips==400&&ledger.seatOf(TABLE,1).chips==400&&coin.balanceOf(address(ledger))==800,"original escrow restored");
        require(ws8Bonds.available(address(coin),PROVIDER_A)==800&&ws8Bonds.available(address(coin),PROVIDER_B)==0,"objective missing-provider blame");
        require(coin.balanceOf(WS8_RISK)==800,"only withholding provider slashed");
        cheat54.expectRevert(PokerNLHEStorage420.InvalidState.selector);ws8Engine.cancelWithheldDelivery(id);
    }
    function testDisputeAbuse() public {
        bytes32 id=_ready();_showdown(id);
        (,,,bytes32 finalState,bool clockActive,)=ws8Disputes.clocks(id);
        require(!clockActive&&finalState==ws8Engine.gameOf(id).stateRoot,"canonical terminal clock anchor");
        cheat54.expectRevert(PokerActionDisputeClock420.Unauthorized.selector);
        cheat54.prank(OTHER);ws8Disputes.dispute(id,keccak256("outsider claim"));
        cheat54.prank(PLAYER);ws8Disputes.dispute(id,keccak256("seated claim"));
        cheat54.expectRevert(PokerActionDisputeClock420.Unauthorized.selector);
        ws8Disputes.proposeVerifiedOutcome(id,keccak256("attacker chosen payout"));
        ws8Engine.proposeDisputeResolution(id,_policy());
        cheat54.prank(PLAYER_B);ws8Disputes.appeal(id,keccak256("single appeal"));
        cheat54.expectRevert(PokerActionDisputeClock420.InvalidState.selector);
        cheat54.prank(PLAYER);ws8Disputes.appeal(id,keccak256("infinite review"));
        cheat54.expectRevert(PokerActionDisputeClock420.Premature.selector);ws8Engine.settle(id,_policy());
        _escrowUnchanged(id);cheat54.warp(ws8Disputes.resolutionOf(id).executableAfter);
        _settle(id);require(ws8Disputes.resolutionOf(id).finalized,"native disputed result finality");
    }
    function testDoubleSettlement() public {
        bytes32 id=_ready();_showdown(id);_settle(id);bytes32 transcript=ws8Engine.terminalTranscript(id);
        cheat54.expectRevert(PokerNLHEStorage420.InvalidState.selector);ws8Engine.settle(id,_policy());
        require(ws8Engine.terminalTranscript(id)==transcript&&coin.balanceOf(WS8_RAKES)==2&&ledger.totalChips(TABLE)==798,"double payout or rake");
    }
    function testReentrancy() public {
        bytes32 id=_ready();_showdown(id);
        WS8CallbackToken54 hostile=WS8CallbackToken54(address(coin));
        hostile.prepareCallback(address(ws8Engine),abi.encodeCall(PokerNLHEBetting420.settle,(id,_policy())));
        _settle(id);
        require(hostile.callbackAttempted()&&!hostile.callbackSucceeded(),"settlement callback attack was not rejected");
        require(hostile.callbackError()==PokerNLHEStorage420.InvalidState.selector,"terminal-state callback protection");
        require(ledger.totalChips(TABLE)==798&&coin.balanceOf(WS8_RAKES)==2,"callback changed atomic payout");
    }
}
