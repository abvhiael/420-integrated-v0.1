// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerIntegratedAdversarial54.t.sol";
import "../src/bet/PokerAbuseControls420.sol";
interface VmMultiplayer610 { function snapshotState() external returns(uint256); function revertToState(uint256) external returns(bool); }
/// @notice Real nine-owner encrypted delivery, signatures, side pots and escrow.
contract PokerMultiplayerSecurity610Test is BetPokerIntegratedFundedAdversarial54Test {
    PokerAbuseControls420 internal abuse610;
    event MultiplayerContext610(bytes encoded);
    event MultiplayerSeat610(uint8 seat,address player,uint256 starting,uint256 contribution,uint256 finalChips);
    event MultiplayerSettlement610(bytes32 handId,bytes32 admissionRoot,bytes32 terminalTranscript,uint256 fee,uint256 escrow,uint256 providerCollateral);
    constructor(){abuse610=new PokerAbuseControls420(address(ledger),address(deal));}
    function _player610(uint8 i) internal pure returns(address){return i==0?PLAYER:i==1?PLAYER_B:address(uint160(0x6100+i));}
    function _stack610(uint8 i)internal pure returns(uint256){return 400+50*uint256(i);}
    function _total610(uint8 n)internal pure returns(uint256 total){for(uint8 i;i<n;i++)total+=_stack610(i);}
    function _protect610(uint8 n) internal {
        bytes32 scope=auth.scopeForTable(TABLE);address a=address(0xA610);address b=address(0xB610);
        cap.grant(ADMIN,abuse610.ACTION_CONFIGURE(),scope,true);cap.grant(ADMIN,ledger.ACTION_BIND_ABUSE_CONTROLS(),scope,true);
        cap.grant(a,abuse610.ACTION_ATTEST(),scope,true);cap.grant(b,abuse610.ACTION_ATTEST(),scope,true);
        cheat54.prank(ADMIN);abuse610.configure(TABLE,PokerAbuseControls420.Policy(30,300,60,60,10,3,keccak256("5A10.PROTECTED.MULTIPLAYER")));
        for(uint8 i;i<n;i++){
            address p=_player610(i);bytes32 group=keccak256(abi.encode("independently reviewed control group",i));
            cheat54.prank(a);bytes32 digest=abuse610.proposeIdentity(TABLE,p,group,keccak256(abi.encode("private evidence commitment",p)),uint64(block.timestamp+7 days),0);
            cheat54.prank(b);abuse610.confirmIdentity(TABLE,p,1,digest);
            bytes32[6] memory roles=[BetIds420.ACTION_POKER_BUY_IN,BetIds420.ACTION_POKER_TOP_UP,BetIds420.ACTION_POKER_ACTION,BetIds420.ACTION_POKER_SIT_OUT,BetIds420.ACTION_POKER_LEAVE,BetIds420.ACTION_POKER_WITHDRAW];
            for(uint8 j;j<6;j++)cap.grant(p,roles[j],scope,true);
        }
        cheat54.prank(ADMIN);ledger.bindAbuseControls(TABLE,address(abuse610));
    }
    function _data(string memory name) internal override returns(bytes memory){if(ledger.seatingEpoch(TABLE)>0&&registry.getTable(TABLE).config.seats!=9)return super._data(name);return ws8vm.readFileBinary(string.concat("../clients/420bet-poker/zkshuffle/fixtures/ws8/multiplayer/proofs/",name));}
    function _funded610(uint8 n)internal returns(bytes32 id){

        require(block.chainid==31337,"WS8 chain context");
        cheat54.warp(1_700_000_000);
        PokerTableRegistry420.Configuration memory config=_config();
        config.asset=address(coin);config.seats=n;
        config.rakePolicyHash=ws8Rake.policyHash(PokerCanonicalRake420.Policy(500,20,true,true));
        cheat54.prank(ADMIN);registry.register(config,ADMIN);
        cheat54.prank(ADMIN);registry.approve(TABLE);
        cheat54.prank(ADMIN);registry.open(TABLE);
        _protect610(n);
        for(uint8 i;i<n;i++){address p=_player610(i);coin.mint(p,_stack610(i));cheat54.prank(p);coin.approve(address(ledger),_stack610(i));cheat54.prank(p);ledger.buyIn(TABLE,i,_stack610(i));}
        bytes32 scope=auth.scopeForTable(TABLE);
        cap.grant(ADMIN,ledger.ACTION_BIND_SETTLEMENT(),scope,true);
        cap.grant(ADMIN,ws8Disputes.ACTION_BIND_RESOLVER(),scope,true);
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_PROVIDER_BOND(),scope,true);
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_DELIVERY(),scope,true);
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_REVEALS(),scope,true);
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_OUTCOME(),scope,true);
        cap.grant(ADMIN,ws8Delivery.ACTION_BIND_PROOF_BOOK(),scope,true);
        cheat54.prank(ADMIN);ledger.bindSettlement(TABLE,address(ws8Engine),WS8_RAKES);
        cheat54.prank(ADMIN);ws8Disputes.bindResolver(TABLE,address(ws8Engine));
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_TURN_POLICY(),scope,true);
        cheat54.prank(ADMIN);ws8Engine.bindTurnPolicy(TABLE,60);
        cheat54.prank(ADMIN);ws8Engine.bindProviderBond(TABLE,address(ws8Bonds));
        cheat54.prank(ADMIN);ws8Delivery.bindProofBook(TABLE,address(ws8Book));
        cheat54.prank(ADMIN);ws8Engine.bindDelivery(TABLE,address(ws8Delivery));
        cheat54.prank(ADMIN);ws8Engine.bindReveals(TABLE,address(ws8Live));
        cheat54.prank(ADMIN);ws8Engine.bindOutcome(TABLE,address(ws8Outcome));
        uint256 total=_total610(n);coin.mint(PROVIDER_A,total);coin.mint(PROVIDER_B,total);
        cheat54.prank(PROVIDER_A);coin.approve(address(ws8Bonds),total);
        cheat54.prank(PROVIDER_B);coin.approve(address(ws8Bonds),total);
        cheat54.prank(PROVIDER_A);ws8Bonds.fundAsset(address(coin),total);
        cheat54.prank(PROVIDER_B);ws8Bonds.fundAsset(address(coin),total);
        bytes32 snapshot=deal.snapshotFor(TABLE,uint16((uint256(1)<<n)-1));
        cheat54.prank(ADMIN);id=deal.begin(TABLE,1,uint64(block.timestamp+3600),keccak256("WS8.PREVIOUS.STATE.V1"),snapshot,uint16((uint256(1)<<n)-1));
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("WS8.INDEPENDENT.PROVIDER.A.V1"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("WS8.INDEPENDENT.PROVIDER.B.V1"));
        for(uint8 i;i<n;i++){cheat54.prank(_player610(i));ws8Signing.bindSigner(TABLE,ws8vm.addr(WS8_PLAYER_KEY+i));}
        cheat54.prank(PLAYER);ws8Engine.reserve(id);
        require(ledger.settlementCoordinator(TABLE)==address(ws8Engine),"canonical escrow authority");
        require(ws8Bonds.nativeEngine()==address(ws8Engine)&&ws8Bonds.isCollateralized(id),"canonical bond authority");
        require(ledger.reservedInHand(TABLE)==total&&ledger.lockedTotal(TABLE)==total,"funded player escrow");
        require(coin.balanceOf(address(ledger))==total&&coin.balanceOf(address(ws8Bonds))==2*total,"segregated actual custody");
        require(ws8Engine.fundedSnapshot(id)==ledger.lockedSnapshot(TABLE),"engine snapshot");
    }
    function _context610(bytes32 id)internal view returns(uint256[48] memory c){uint256[34] memory original=_ws8Context(id);for(uint8 i;i<34;i++)c[i]=original[i];for(uint8 i=2;i<9;i++){c[34+2*(i-2)]=uint160(_player610(i));c[35+2*(i-2)]=ledger.seatOf(TABLE,i).epoch;}}
    function test610ExportFundedNinePlayerContext()public{bytes32 id=_funded610(9);emit MultiplayerContext610(abi.encode(_context610(id)));}
    function _shuffled610()internal returns(bytes32 id){id=_funded610(9);require(keccak256(abi.encode(_context610(id)))==keccak256(ws8vm.readFileBinary("../clients/420bet-poker/zkshuffle/fixtures/ws8/multiplayer/context.bin")),"multiplayer context mismatch");_independent();_publishAndInitial(id);_stages(id);for(uint8 p;p<18;p++)require(ws8Engine.holeSeatForPosition(id,p)==(p%9+1)%9,"nine seat assignment");}
    function _keys610(bytes32 id)internal{
        for(uint8 i;i<9;i++){bytes memory proof=_proof(string.concat("WS8Recipient",_n(i)));(,uint256[3] memory pub)=abi.decode(proof,(uint256[8],uint256[3]));cheat54.prank(_player610(i));ws8Recipients.bindVerifiedKey(TABLE,pub[1],pub[2],proof);emit WS8VerifiedPublicStatement(string.concat("recipient",_n(i)),proof);}
        ws8Book.proveAggregateKey(WS8VerifierData.keys(),_proof("WS8Aggregate"));emit WS8VerifiedPublicStatement("aggregate",_proof("WS8Aggregate"));
    }
    function _deliveryWithAcks610(bytes32 id,uint16 ackMask)internal{
        _keys610(id);
        cheat54.prank(PROVIDER_A);ws8Delivery.publish(id,keccak256("5A10.AUTHENTICATED.DECK"),keccak256("5A10.PRIVATE.MANIFEST"));
        for(uint8 p;p<18;p++)for(uint8 provider;provider<2;provider++)_deliveryShare(id,p,provider);
        for(uint8 i;i<9;i++){bytes32 envelope=ws8Book.envelopeHashFor(id,i);bytes32 fingerprint=ws8Recipients.fingerprintOf(TABLE,i);cheat54.prank(PROVIDER_A);ws8Delivery.bindEnvelope(id,i,envelope,fingerprint);bytes32 receipt=ws8Delivery.receiptDigest(id,i);if((ackMask&(uint16(1)<<i))!=0){cheat54.prank(_player610(i));ws8Delivery.acknowledge(id,i,receipt);}}
        require(ws8Book.allVerified(id),"incomplete nine-owner encrypted delivery");
    }
    function _delivery610(bytes32 id)internal{_deliveryWithAcks610(id,511);require(ws8Delivery.allAcknowledged(id),"all nine owner receipts required");}
    function _ready610()internal returns(bytes32 id){id=_shuffled610();_delivery610(id);ws8Engine.start(id,0,60);require(ws8Engine.gameOf(id).toAct==3,"multiplayer turn order");}
    function _allIn610(bytes32 id)internal{
        for(uint8 k;k<9;k++){uint8 seat=(k+3)%9;PokerNLHEStorage420.Player memory p=ws8Engine.playerOf(id,seat);PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);uint256 owed=g.currentBet>p.bet?g.currentBet-p.bet:0;_signed(id,seat,p.stack>owed?PokerNLHEStorage420.Move.RAISE:PokerNLHEStorage420.Move.CALL,p.stack,WS8_PLAYER_KEY+seat);}
        require(ws8Engine.gameOf(id).phase==PokerNLHEStorage420.Phase.AWAIT_FLOP,"all-in round incomplete");
    }
    function _reveal(bytes32 id,uint8 street,uint8 pos)internal override{
        if(registry.getTable(TABLE).config.seats!=9){super._reveal(id,street,pos);return;}
        _partial(id,street,pos,0);_partial(id,street,pos,1);uint8 card=pos==0?24:pos==24?0:pos;
        bytes memory proof=_proof(string.concat("WS8Unmask",_n(street),_n(pos)));ws8Live.reveal(id,street,pos,card,WS8VerifierData.keys(),proof);emit WS8VerifiedPublicStatement(string.concat("WS8Unmask",_n(street),_n(pos)),proof);require(ws8Live.slotOf(id,pos).opened&&ws8Live.slotOf(id,pos).card==card,"genuine multiplayer card");
    }
    function _showdown610(bytes32 id)internal{_allIn610(id);for(uint8 p=19;p<=21;p++)_reveal(id,1,p);ws8Live.advance(id,1);emit WS8StreetRecord(1);_reveal(id,2,23);ws8Live.advance(id,2);emit WS8StreetRecord(2);_reveal(id,3,25);ws8Live.advance(id,3);emit WS8StreetRecord(3);for(uint8 p;p<18;p++)_reveal(id,4,p);require(ws8Live.isStageComplete(id,4),"nine-player showdown incomplete");}
    function _settle610(bytes32 id)internal{
        (uint256[9] memory amounts,uint256 fee)=ws8Outcome.calculate(id,_policy());uint256 total;for(uint8 i;i<9;i++)total+=amounts[i];require(total+fee==5400&&fee==20&&amounts[1]>3000&&amounts[8]>=50,"side-pot conservation");
        ws8Engine.settle(id,_policy());require(ledger.handConsumed(id)&&ws8Engine.handSettled(id)&&ledger.activeHand(TABLE)==bytes32(0),"atomic settlement missing");
        for(uint8 i;i<9;i++){require(ledger.seatOf(TABLE,i).chips==amounts[i],"escrow vector mismatch");emit MultiplayerSeat610(i,_player610(i),_stack610(i),ws8Engine.playerOf(id,i).contributed,amounts[i]);}
        require(coin.balanceOf(address(ledger))==total&&coin.balanceOf(WS8_RAKES)==fee&&coin.balanceOf(address(ws8Bonds))==10800,"segregated nine-player custody");require(ws8Bonds.available(address(coin),PROVIDER_A)==5400&&ws8Bonds.available(address(coin),PROVIDER_B)==5400,"bond release mismatch");
        emit MultiplayerSettlement610(id,ledger.abuseAdmission(id),ws8Engine.terminalTranscript(id),fee,total,10800);
    }
    function test610GenuineNinePlayerAllInSidePotsAndSettlement()public{bytes32 id=_ready610();_showdown610(id);_settle610(id);}

    function _unchanged610(bytes32 id,bytes32 state,uint64 nonce,uint64 deadline)internal view{
        PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);require(g.stateRoot==state&&g.nonce==nonce&&g.deadline==deadline,"attack changed native turn");
        require(ledger.activeHand(TABLE)==id&&ledger.lockedTotal(TABLE)==5400&&ledger.reservedInHand(TABLE)==5400&&coin.balanceOf(address(ledger))==5400,"attack changed player escrow");require(coin.balanceOf(address(ws8Bonds))==10800,"attack mixed provider collateral");
    }
    function _payload610(bytes32 id,uint8 seat,PokerNLHEStorage420.Move move,uint256 amount,uint256 key,uint64 nonce,bytes32 root)internal returns(bytes memory){
        uint64 expiry=uint64(block.timestamp+50);bytes32 hash=keccak256(abi.encode(ws8Engine.ACTION_DOMAIN(),id,uint8(ws8Engine.gameOf(id).phase),seat,uint8(move),amount));bytes32 digest=ws8Signing.actionDigest(id,seat,nonce,root,hash,expiry);(uint8 v,bytes32 r,bytes32 z)=ws8vm.sign(key,digest);return abi.encodeCall(PokerNLHEBetting420.action,(id,seat,move,amount,expiry,root,abi.encodePacked(r,z,v)));
    }
    function _rejected610(bytes32 id,bytes memory payload,bytes4 expected)internal{
        PokerNLHEStorage420.Game memory before_=ws8Engine.gameOf(id);(bool ok,bytes memory result)=address(ws8Engine).call(payload);require(!ok&&result.length>=4&&bytes4(result)==expected,"wrong rejection boundary");_unchanged610(id,before_.stateRoot,before_.nonce,before_.deadline);
    }
    function test610OtherSeatCannotForgeCurrentActor()public{bytes32 id=_ready610();PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);_rejected610(id,_payload610(id,3,PokerNLHEStorage420.Move.CALL,20,WS8_PLAYER_KEY+4,g.nonce+1,g.stateRoot),PokerActionKeys420.InvalidSignature.selector);}
    function test610ValidOtherSeatSignatureCannotPlayOutOfTurn()public{bytes32 id=_ready610();PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);_rejected610(id,_payload610(id,8,PokerNLHEStorage420.Move.CALL,20,WS8_PLAYER_KEY+8,g.nonce+1,g.stateRoot),PokerNLHEStorage420.WrongTurn.selector);}
    function test610SignedStaleRootCannotAdvanceTurn()public{bytes32 id=_ready610();PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);_rejected610(id,_payload610(id,3,PokerNLHEStorage420.Move.CALL,20,WS8_PLAYER_KEY+3,g.nonce+1,keccak256("stale fork")),PokerNLHEStorage420.InvalidAction.selector);}
    function test610StaleActionNonceCannotAdvanceTurn()public{bytes32 id=_ready610();PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);_rejected610(id,_payload610(id,3,PokerNLHEStorage420.Move.CALL,20,WS8_PLAYER_KEY+3,g.nonce+2,g.stateRoot),PokerActionKeys420.InvalidSignature.selector);}
    function test610OverStackBetCannotCreateChips()public{bytes32 id=_ready610();PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);_rejected610(id,_payload610(id,3,PokerNLHEStorage420.Move.RAISE,551,WS8_PLAYER_KEY+3,g.nonce+1,g.stateRoot),PokerNLHEStorage420.InvalidAction.selector);}
    function test610RevokedNinthPlayerCannotAct()public{bytes32 id=_ready610();for(uint8 i=3;i<8;i++)_signed(id,i,PokerNLHEStorage420.Move.CALL,20,WS8_PLAYER_KEY+i);cap.grant(_player610(8),BetIds420.ACTION_POKER_ACTION,auth.scopeForTable(TABLE),false);PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(id);_rejected610(id,_payload610(id,8,PokerNLHEStorage420.Move.CALL,20,WS8_PLAYER_KEY+8,g.nonce+1,g.stateRoot),PokerNLHEStorage420.Unauthorized.selector);}
    function test610EarlyTimeoutCannotStealCurrentTurn()public{bytes32 id=_ready610();_rejected610(id,abi.encodeCall(PokerNLHEBetting420.timeout,(id)),PokerNLHEStorage420.TooEarly.selector);}
    function test610DisconnectedActorTimesOutWithoutForgedSignature()public{bytes32 id=_ready610();uint64 epoch=ledger.seatOf(TABLE,3).epoch;cheat54.prank(_player610(3));ledger.setDisconnected(TABLE,true,epoch,0);uint64 deadline=ws8Engine.gameOf(id).deadline;cheat54.warp(deadline+1);ws8Engine.timeout(id);require(ws8Engine.playerOf(id,3).folded&&ws8Engine.gameOf(id).toAct==4&&ws8Engine.gameOf(id).nonce==1,"nine-player timeout incorrect");require(ledger.lockedTotal(TABLE)==5400,"timeout changed frozen escrow");}
    function test610PendingLeaveDoesNotChangeAcceptedNineSeatHand()public{bytes32 id=_ready610();bytes32 root=ledger.abuseAdmission(id);uint64 epoch=ledger.seatOf(TABLE,3).epoch;cheat54.prank(_player610(3));ledger.requestLeave(TABLE,epoch,0);_showdown610(id);ws8Engine.settle(id,_policy());ledger.completeLeave(TABLE,_player610(3),epoch,1);require(ledger.abuseAdmission(id)==root&&ledger.playerSeatPlusOne(TABLE,_player610(3))==0,"queued exit changed hand or failed");}
    function test610PlayerCannotWithdrawReservedNineSeatEscrow()public{bytes32 id=_ready610();cheat54.expectRevert(PokerSeatLedger420.Locked.selector);cheat54.prank(_player610(8));ledger.leave(TABLE);require(ledger.reservedInHand(TABLE)==5400,"reserved cashout escaped");}
    function test610ProviderCannotWithdrawLockedNineSeatBond()public{bytes32 id=_ready610();cheat54.prank(PROVIDER_A);(bool ok,)=address(ws8Bonds).call(abi.encodeCall(PokerProviderAccountability420.withdraw,(address(coin),uint256(1))));require(!ok&&ws8Bonds.isCollateralized(id)&&coin.balanceOf(address(ws8Bonds))==10800,"provider collateral escaped");}
    function test610HeadupProofCannotAdmitNineSeatContext()public{bytes32 id=_funded610(9);_independent();uint256[208] memory deck=abi.decode(_data("deck-0.bin"),(uint256[208]));bytes32 root=ws8Availability.publish(uint256(id)%WS8_FR,deck);bytes memory oldProof=ws8vm.readFileBinary("../clients/420bet-poker/zkshuffle/fixtures/ws8/proofs/WS8Initial.abi");(bool ok,)=address(ws8Initial).call(abi.encodeCall(PokerInitialEncryptedDeck420.submit,(id,root,oldProof)));require(!ok&&ws8Initial.rootOf(id)==bytes32(0)&&ledger.lockedTotal(TABLE)==5400,"cross-context proof accepted");}
    function test610CorruptProofCannotAdmitNineSeatDeck()public{bytes32 id=_funded610(9);_independent();uint256[208] memory deck=abi.decode(_data("deck-0.bin"),(uint256[208]));bytes32 root=ws8Availability.publish(uint256(id)%WS8_FR,deck);bytes memory proof=_proof("WS8Initial");proof[31]=bytes1(uint8(proof[31])^1);(bool ok,)=address(ws8Initial).call(abi.encodeCall(PokerInitialEncryptedDeck420.submit,(id,root,proof)));require(!ok&&ws8Initial.rootOf(id)==bytes32(0)&&ledger.lockedTotal(TABLE)==5400,"corrupt proof accepted");}
    function test610NinthRecipientCannotBindAnotherOwnersKey()public{bytes32 id=_shuffled610();bytes memory proof=_proof("WS8Recipient8");(,uint256[3] memory pub)=abi.decode(proof,(uint256[8],uint256[3]));cheat54.prank(_player610(7));(bool ok,)=address(ws8Recipients).call(abi.encodeCall(PokerRecipientKeys420.bindVerifiedKey,(TABLE,pub[1],pub[2],proof)));require(!ok&&ledger.activeHand(TABLE)==id&&!ws8Delivery.allAcknowledged(id),"recipient owner substituted");}
    function test610MissingNinthAcknowledgmentCannotStart()public{bytes32 id=_shuffled610();_deliveryWithAcks610(id,255);require(ws8Book.allVerified(id)&&!ws8Delivery.allAcknowledged(id),"missing final recipient receipt not exercised");_rejected610(id,abi.encodeCall(PokerNLHEBetting420.start,(id,uint256(0),uint32(60))),PokerNLHEStorage420.InvalidState.selector);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDelivery(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==5400&&ws8Bonds.available(address(coin),PROVIDER_A)==5400&&ws8Bonds.available(address(coin),PROVIDER_B)==5400,"recipient silence confiscated escrow or blamed honest providers");}

    function test610PrematureHoleRevealCannotExposePrivateCards()public{bytes32 id=_ready610();uint256[8] memory points=abi.decode(_data("WS8Partial4170.points"),(uint256[8]));bytes memory proof=_proof("WS8Partial4170");cheat54.prank(PROVIDER_A);(bool ok,bytes memory result)=address(ws8Live).call(abi.encodeCall(PokerLiveCardReveals420.submitShare,(id,uint8(4),uint8(17),uint8(0),points,proof)));require(!ok&&bytes4(result)==PokerLiveCardReveals420.WrongStreet.selector&&!ws8Live.slotOf(id,17).opened,"premature private reveal");}

    function test610MissingRevealsRefundAllNinePlayers()public{bytes32 id=_ready610();_allIn610(id);cheat54.warp(ws8Engine.evidenceDueAt(id)+1);ws8Engine.beginMissingEvidenceRecovery(id);(,uint64 finalAt,,,)=ws8Engine.evidenceRecovery(id);cheat54.warp(finalAt);ws8Engine.finalizeMissingEvidenceRecovery(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==5400&&coin.balanceOf(address(ledger))==5400,"missing-evidence refund lost escrow");for(uint8 i;i<9;i++)require(ledger.seatOf(TABLE,i).chips==_stack610(i),"refund chose a winner");}
    function test610DoubleSettlementCannotDuplicateNineSeatPayout()public{bytes32 id=_ready610();_showdown610(id);_settle610(id);bytes32 receipt=ws8Engine.terminalTranscript(id);cheat54.expectRevert(PokerNLHEStorage420.InvalidState.selector);ws8Engine.settle(id,_policy());require(ws8Engine.terminalTranscript(id)==receipt&&coin.balanceOf(WS8_RAKES)<=20,"duplicate rake or payout");}
    function test610SettlementCallbackCannotReenterNineSeatPayout()public{bytes32 id=_ready610();_showdown610(id);WS8CallbackToken54 hostile=WS8CallbackToken54(address(coin));hostile.prepareCallback(address(ws8Engine),abi.encodeCall(PokerNLHEBetting420.settle,(id,_policy())));_settle610(id);require(hostile.callbackAttempted()&&!hostile.callbackSucceeded()&&hostile.callbackError()==PokerNLHEStorage420.InvalidState.selector,"settlement callback escaped");}
    function testFuzz610TamperedGeneratedInitialProofIsRejected(uint8 index,uint8 bit)public{(uint256[8] memory proof,uint256[5] memory pub)=abi.decode(_proof("WS8Initial"),(uint256[8],uint256[5]));proof[index%8]^=uint256(1)<<(bit%254);(bool ok,)=ws8Backends[0].staticcall(abi.encodeWithSignature("verifyProof(uint256[8],uint256[5])",proof,pub));require(!ok,"tampered real Groth16 proof accepted");}
    function test610Funded2SeatsCancelWithoutEvidence()public{bytes32 id=_funded610(2);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDeal(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==_total610(2),"funded cancellation conservation");for(uint8 i;i<2;i++)require(ledger.seatOf(TABLE,i).chips==_stack610(i),"wrong participant refund");}
    function test610Funded3SeatsCancelWithoutEvidence()public{bytes32 id=_funded610(3);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDeal(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==_total610(3),"funded cancellation conservation");for(uint8 i;i<3;i++)require(ledger.seatOf(TABLE,i).chips==_stack610(i),"wrong participant refund");}
    function test610Funded4SeatsCancelWithoutEvidence()public{bytes32 id=_funded610(4);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDeal(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==_total610(4),"funded cancellation conservation");for(uint8 i;i<4;i++)require(ledger.seatOf(TABLE,i).chips==_stack610(i),"wrong participant refund");}
    function test610Funded5SeatsCancelWithoutEvidence()public{bytes32 id=_funded610(5);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDeal(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==_total610(5),"funded cancellation conservation");for(uint8 i;i<5;i++)require(ledger.seatOf(TABLE,i).chips==_stack610(i),"wrong participant refund");}
    function test610Funded6SeatsCancelWithoutEvidence()public{bytes32 id=_funded610(6);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDeal(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==_total610(6),"funded cancellation conservation");for(uint8 i;i<6;i++)require(ledger.seatOf(TABLE,i).chips==_stack610(i),"wrong participant refund");}
    function test610Funded7SeatsCancelWithoutEvidence()public{bytes32 id=_funded610(7);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDeal(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==_total610(7),"funded cancellation conservation");for(uint8 i;i<7;i++)require(ledger.seatOf(TABLE,i).chips==_stack610(i),"wrong participant refund");}
    function test610Funded8SeatsCancelWithoutEvidence()public{bytes32 id=_funded610(8);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDeal(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==_total610(8),"funded cancellation conservation");for(uint8 i;i<8;i++)require(ledger.seatOf(TABLE,i).chips==_stack610(i),"wrong participant refund");}
    function test610Funded9SeatsCancelWithoutEvidence()public{bytes32 id=_funded610(9);cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDeal(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==_total610(9),"funded cancellation conservation");for(uint8 i;i<9;i++)require(ledger.seatOf(TABLE,i).chips==_stack610(i),"wrong participant refund");}
    function test610LastPrivateShareWithholdingBlamesOnlyMissingProvider()public{bytes32 id=_shuffled610();_keys610(id);cheat54.prank(PROVIDER_A);ws8Delivery.publish(id,keccak256("deck"),keccak256("encrypted manifest"));for(uint8 p;p<18;p++)for(uint8 h;h<2;h++)if(p!=17||h!=1)_deliveryShare(id,p,h);require(!ws8Book.allVerified(id),"last share not withheld");cheat54.warp(ws8Engine.fundedEvidenceDeadline(id));ws8Engine.cancelWithheldDelivery(id);require(ws8Engine.handAborted(id)&&ledger.totalChips(TABLE)==5400&&coin.balanceOf(address(ledger))==5400,"withholding changed player refunds");require(ws8Bonds.available(address(coin),PROVIDER_A)==5400&&ws8Bonds.available(address(coin),PROVIDER_B)==0&&coin.balanceOf(WS8_RISK)==5400,"incorrect missing-provider attribution");}
    function test610RelatedProvidersCannotShuffleNineSeatHand()public{bytes32 id=_funded610(9);bytes32 group=keccak256("common beneficial provider control");_attest(PROVIDER_A,address(0xC0FFEE),group);_attest(PROVIDER_B,address(0xD00D),group);_publishAndInitial(id);bytes32[3] memory roots=_roots();bytes memory proof=_proof("WS8Shuffle1");cheat54.expectRevert(PokerPrivateShuffleGate420.Unauthorized.selector);cheat54.prank(PROVIDER_A);ws8Shuffle.proveStage(id,1,roots[0],roots[1],proof);require(ws8Shuffle.recordOf(id).stage==0&&ledger.lockedTotal(TABLE)==5400,"related-provider shuffle accepted");}
}
