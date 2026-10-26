// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentFundedFixture420.sol";
abstract contract TournamentFundedTestsBase420 is TournamentFundedFixture420 {
    event C5ExecutedHand(bytes32 indexed hand,uint8 button,uint16 mask,uint8[9] holeA,uint8[9] holeB,uint8[5] board,uint256[9] initialChips,uint256[9] finalChips);
    event C5ExecutedHandData(bytes encoded);
    event C5CertifiedStandingsData(bytes encoded);
    event C5VerifierIdentity(uint8 index,address backend,bytes32 verifyingKey,bytes32 runtimeHash,bytes32 circuit,bytes32 schema);
    event C5RuntimeIdentity(address host,bytes32 hostHash,address escrow,bytes32 escrowHash,address engine,bytes32 engineHash);
    function _emitIdentities()internal {
        for(uint8 i;i<7;i++){(bytes32 circuit,bytes32 schema)=C5VerifierData.identity(i);emit C5VerifierIdentity(i,ws8Backends[i],ws8Keys[i],ws8Backends[i].codehash,circuit,schema);}
        emit C5RuntimeIdentity(address(host),address(host).codehash,address(runtimeEscrow),address(runtimeEscrow).codehash,address(ws8Engine),address(ws8Engine).codehash);
    }
    function _n(uint256 n)internal pure returns(string memory){if(n==0)return "0";uint256 x=n;uint256 len;while(x!=0){len++;x/=10;}bytes memory b=new bytes(len);while(n!=0){b[--len]=bytes1(uint8(48+n%10));n/=10;}return string(b);}
    function _data(string memory label,string memory name)internal returns(bytes memory){return cvm.readFileBinary(string.concat("../clients/420bet-poker/zkshuffle/fixtures/tournament-5c5/",folder(),"/",label,"/",name));}
    function _proof(string memory label,string memory name)internal returns(bytes memory){return _data(label,string.concat(name,".abi"));}
    function _proveDeal(bytes32 hand,string memory label)internal {
        require(keccak256(_context(hand))==keccak256(_data(label,"context.bin")),"exact tournament context mismatch");
        bytes32[3] memory roots=abi.decode(_data(label,"roots.bin"),(bytes32[3]));
        for(uint8 i;i<3;i++){uint256[208] memory points=abi.decode(_data(label,string.concat("deck-",_n(i),".bin")),(uint256[208]));require(ws8Availability.publish(uint256(hand)%WS8_FR,points)==roots[i]);}
        ws8Initial.submit(hand,roots[0],_proof(label,"WS8Initial"));
        provider0.invoke(address(ws8Shuffle),abi.encodeCall(ws8Shuffle.proveStage,(hand,uint8(1),roots[0],roots[1],_proof(label,"WS8Shuffle1"))));
        provider1.invoke(address(ws8Shuffle),abi.encodeCall(ws8Shuffle.proveStage,(hand,uint8(2),roots[1],roots[2],_proof(label,"WS8Shuffle2"))));ws8Engine.prepareDealAssignment(hand);
        bytes32 table=deal.getHand(hand).tableId;uint16 mask=deal.handSeatMask(hand);
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0){bytes memory proof=_proof(label,string.concat("WS8Recipient",_n(i)));(,uint256[3] memory pub)=abi.decode(proof,(uint256[8],uint256[3]));EntryActor420(payable(host.seatOf(table,i).player)).invoke(address(ws8Recipients),abi.encodeCall(ws8Recipients.bindVerifiedKey,(table,pub[1],pub[2],proof)));}
        if(!ws8Book.aggregateVerified())ws8Book.proveAggregateKey(C5VerifierData.keys(),_proof(label,"WS8Aggregate"));
        provider0.invoke(address(ws8Delivery),abi.encodeCall(ws8Delivery.publish,(hand,keccak256(abi.encode("C5 authenticated deck",hand)),keccak256(abi.encode("C5 encrypted manifest",hand)))));
        uint8 count;for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0)count++;
        for(uint8 pos;pos<2*count;pos++)for(uint8 provider;provider<2;provider++){
            string memory name=string.concat("WS8Delivery",_n(pos),_n(provider));uint256[12] memory points=abi.decode(_data(label,string.concat(name,".points")),(uint256[12]));
            (provider==0?provider0:provider1).invoke(address(ws8Book),abi.encodeCall(ws8Book.proveEncryptedShare,(hand,pos,provider,points,_proof(label,name))));
        }
        for(uint8 seat;seat<9;seat++)if((mask&(uint16(1)<<seat))!=0){bytes32 envelope=ws8Book.envelopeHashFor(hand,seat);bytes32 fingerprint=ws8Recipients.fingerprintOf(table,seat);
            provider0.invoke(address(ws8Delivery),abi.encodeCall(ws8Delivery.bindEnvelope,(hand,seat,envelope,fingerprint)));EntryActor420(payable(host.seatOf(table,seat).player)).invoke(address(ws8Delivery),abi.encodeCall(ws8Delivery.acknowledge,(hand,seat,ws8Delivery.receiptDigest(hand,seat))));}
        require(ws8Shuffle.isProofComplete(hand)&&ws8Book.allVerified(hand)&&ws8Delivery.allAcknowledged(hand));host.startHand(hand);
    }
    function _signed(bytes32 hand,PokerNLHEStorage420.Move move,uint256 amount)internal {
        PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(hand);uint8 seat=g.toAct;uint64 expiry=uint64(block.timestamp+50);address actor=host.seatOf(g.tableId,seat).player;
        bytes32 action=keccak256(abi.encode(ws8Engine.ACTION_DOMAIN(),hand,uint8(g.phase),seat,uint8(move),amount));bytes32 digest=ws8Signing.actionDigest(hand,seat,g.nonce+1,g.stateRoot,action,expiry);
        (uint8 v,bytes32 r,bytes32 s)=cvm.sign(signingKey[actor],digest);ws8Engine.action(hand,seat,move,amount,expiry,g.stateRoot,abi.encodePacked(r,s,v));
    }
    function _reveal(bytes32 hand,string memory label,uint8 street,uint8 pos)internal {
        for(uint8 provider;provider<2;provider++){string memory name=string.concat("WS8Partial",_n(street),_n(pos),_n(provider));uint256[8] memory points=abi.decode(_data(label,string.concat(name,".points")),(uint256[8]));(provider==0?provider0:provider1).invoke(address(ws8Live),abi.encodeCall(ws8Live.submitShare,(hand,street,pos,provider,points,_proof(label,name))));}
        uint8 card=pos==0?12:pos==12?0:pos;ws8Live.reveal(hand,street,pos,card,C5VerifierData.keys(),_proof(label,string.concat("WS8Unmask",_n(street),_n(pos))));
    }
    function _play(bytes32 hand,string memory label)internal {
        _proveDeal(hand,label);PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(hand);uint256 total=ws8Engine.playerOf(hand,g.toAct).stack;
        _signed(hand,PokerNLHEStorage420.Move.RAISE,total);while(ws8Engine.gameOf(hand).phase==PokerNLHEStorage420.Phase.PREFLOP)_signed(hand,PokerNLHEStorage420.Move.CALL,ws8Engine.turnOf(hand).callChips);
        uint8 count;uint16 participating=deal.handSeatMask(hand);for(uint8 i;i<9;i++)if((participating&(uint16(1)<<i))!=0)count++;
        for(uint8 pos=2*count+1;pos<=2*count+3;pos++)_reveal(hand,label,1,pos);ws8Live.advance(hand,1);
        _reveal(hand,label,2,2*count+5);ws8Live.advance(hand,2);_reveal(hand,label,3,2*count+7);ws8Live.advance(hand,3);
        for(uint8 pos;pos<2*count;pos++)_reveal(hand,label,4,pos);
        PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(0,0,true,true);(uint256[9] memory amounts,uint256 rake)=ws8Outcome.calculate(hand,policy);require(rake==0,"no tournament hand rake");
        uint8 zeroes;uint16 mask=deal.handSeatMask(hand);for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0&&amounts[i]==0)zeroes++;require(zeroes==count-1,"genuine distinct winner fixture");
        ws8Engine.settle(hand,policy);require(host.handConsumed(hand)&&ws8Engine.handSettled(hand)&&host.chipConservation(EVENT));_emitHand(hand,count,amounts);
    }
    function _emitHand(bytes32 hand,uint8 count,uint256[9] memory amounts)internal {
        uint8[9] memory a;uint8[9] memory b;uint8[5] memory board;
        for(uint8 pos;pos<2*count;pos++){uint8 seat=ws8Engine.holeSeatForPosition(hand,pos);if(pos<count)a[seat]=ws8Live.slotOf(hand,pos).card;else b[seat]=ws8Live.slotOf(hand,pos).card;}
        board=[ws8Live.slotOf(hand,2*count+1).card,ws8Live.slotOf(hand,2*count+2).card,ws8Live.slotOf(hand,2*count+3).card,ws8Live.slotOf(hand,2*count+5).card,ws8Live.slotOf(hand,2*count+7).card];
        emit C5ExecutedHand(hand,ws8Engine.gameOf(hand).button,deal.handSeatMask(hand),a,b,board,host.frozenHand(hand).initialChips,amounts);
        PokerTournamentHostState420.Frozen memory f=host.frozenHand(hand);uint256[9] memory contributed;uint256[9] memory remaining;uint16 folded;
        for(uint8 i;i<9;i++)if((f.mask&(uint16(1)<<i))!=0){PokerNLHEStorage420.Player memory p=ws8Engine.playerOf(hand,i);contributed[i]=p.contributed;remaining[i]=p.stack;if(p.folded)folded|=uint16(1)<<i;}
        emit C5ExecutedHandData(abi.encode(hand,f.table,f.round,ws8Engine.gameOf(hand).button,f.mask,f.people,a,b,board,f.initialChips,contributed,remaining,amounts,folded));
    }
    function _emitCertificate()internal {
        (,,,,bytes32 context,,)=host.eventState(EVENT);(,,uint32 wave,,,bytes32 champion,bytes32 root,,uint32 unique)=host.standingsState(EVENT);require(unique==4);
        bytes32[4] memory people;uint32[4] memory generations;uint64[4] memory receipts;uint32[4] memory first;uint32[4] memory last;uint256[4] memory chips;
        for(uint32 i;i<4;i++){people[i]=host.standingsPersonAt(EVENT,i);(PokerTournamentStandings420.Person memory p,uint32 a,uint32 b)=host.standing(EVENT,people[i]);generations[i]=p.generation;receipts[i]=p.receipt;first[i]=a;last[i]=b;chips[i]=host.tournamentPlayer(EVENT,people[i]).chips;}
        emit C5CertifiedStandingsData(abi.encode(context,wave,champion,root,unique,people,generations,receipts,first,last,chips,runtimeEscrow.heldPrizes(),runtimeEscrow.heldFees()));
    }
    function _checkedHand(bytes32 hand,string memory label)internal {
        _proveDeal(hand,label);while(ws8Engine.gameOf(hand).phase==PokerNLHEStorage420.Phase.PREFLOP){uint256 owed=ws8Engine.turnOf(hand).callChips;_signed(hand,owed==0?PokerNLHEStorage420.Move.CHECK:PokerNLHEStorage420.Move.CALL,owed);}
        uint8 count;uint16 mask=deal.handSeatMask(hand);for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0)count++;
        for(uint8 pos=2*count+1;pos<=2*count+3;pos++)_reveal(hand,label,1,pos);ws8Live.advance(hand,1);_checks(hand);
        _reveal(hand,label,2,2*count+5);ws8Live.advance(hand,2);_checks(hand);_reveal(hand,label,3,2*count+7);ws8Live.advance(hand,3);_checks(hand);
        for(uint8 pos;pos<2*count;pos++)_reveal(hand,label,4,pos);PokerCanonicalRake420.Policy memory p=PokerCanonicalRake420.Policy(0,0,true,true);(uint256[9] memory amounts,uint256 fee)=ws8Outcome.calculate(hand,p);require(fee==0);
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0)require(amounts[i]>0);ws8Engine.settle(hand,p);require(host.chipConservation(EVENT));_emitHand(hand,count,amounts);
    }
    function _checks(bytes32 hand)private {while(ws8Engine.gameOf(hand).phase==PokerNLHEStorage420.Phase.FLOP||ws8Engine.gameOf(hand).phase==PokerNLHEStorage420.Phase.TURN||ws8Engine.gameOf(hand).phase==PokerNLHEStorage420.Phase.RIVER)_signed(hand,PokerNLHEStorage420.Move.CHECK,0);}
    function _zero(bytes32 hand)internal view returns(bytes32 person){PokerTournamentHostState420.Frozen memory f=host.frozenHand(hand);for(uint8 i;i<9;i++)if((f.mask&(uint16(1)<<i))!=0&&host.tournamentPlayer(EVENT,f.people[i]).chips==0)return f.people[i];revert("no genuine zero stack");}
    function _extra(bytes32 person)internal returns(uint64 receipt){PokerTournamentTableBalance420.Player memory p=host.tournamentPlayer(EVENT,person);bytes32 subject;bytes32 credential;address actor=p.payer;
        if(actor==address(alice)){subject=A;credential=AC;}else if(actor==address(bob)){subject=B;credential=BC;}else if(actor==address(carol)){subject=C;credential=CC;}else if(actor==address(dan)){subject=D;credential=DC;}else revert("unknown fixture owner");
        receipt=abi.decode(EntryActor420(payable(actor)).invoke(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseExtra,(EVENT,subject,credential,p.nonce+1,uint256(103),escrow.eventOf(EVENT).manifest))),(uint64));
    }
    function _drawAndBalance()internal {
        host.processRound(EVENT,32);bytes32 purpose=host.eventPurpose(EVENT);provider0.invoke(address(roundEntropy),abi.encodeCall(roundEntropy.reveal,(purpose,SECRET0)));provider1.invoke(address(roundEntropy),abi.encodeCall(roundEntropy.reveal,(purpose,SECRET1)));roundEntropy.resolve(purpose);
        while(true){(PokerTournamentHostState420.Phase phase,,,,,,)=host.eventState(EVENT);if(phase==PokerTournamentHostState420.Phase.READY)break;host.balance(EVENT);}
    }
    function _finalContext()internal {
        _firstHands();_play(handA,"tableA");_play(handB,"tableB");_drawAndBalance();(bool formed,uint32 table)=host.finalTableOf(EVENT);require(formed&&host.tournamentTableCount(EVENT)==1);_openRound();finalHand=_begin(table);
    }
}
contract TournamentEliminationFunded420Test is TournamentFundedTestsBase420 {
    function testExportInitialTournamentContexts()public {_firstHands();emit C5StatementContext("tableA",_context(handA));emit C5StatementContext("tableB",_context(handB));}
    function testExportFinalTableContext()public {_finalContext();emit C5StatementContext("final",_context(finalHand));}
    function testLegitimateFundedTournamentEliminationsAndChampion()public {
        _finalContext();_play(finalHand,"final");host.processRound(EVENT,32);host.finalizeStandings(EVENT,16);
        (PokerTournamentHostState420.Phase phase,,,,,uint256 chips,)=host.eventState(EVENT);require(phase==PokerTournamentHostState420.Phase.COMPLETE&&chips==4000);
        (uint32 live,uint32 pending,,bool waveOpen,bool finished,bytes32 champion,,uint32 cursor,uint32 unique)=host.standingsState(EVENT);
        require(live==1&&pending==0&&!waveOpen&&finished&&champion!=0&&cursor==4&&unique==4);require(host.tournamentPlayer(EVENT,champion).chips==4000);
        require(asset.balanceOf(address(runtimeEscrow))==412&&runtimeEscrow.heldPrizes()==400&&runtimeEscrow.heldFees()==12&&asset.balanceOf(address(host))==0&&asset.balanceOf(address(0x420))==0&&runtimeEscrow.solvent());
        require(ws8Bonds.available(address(asset),address(provider0))==10000&&ws8Bonds.available(address(asset),address(provider1))==10000);
        _emitCertificate();_emitIdentities();
    }
    function testNoProoflessTournamentActivationOrElimination()public {_firstHands();_reject(address(host),abi.encodeCall(host.startHand,(handA)));_reject(address(host),abi.encodeCall(host.processRound,(EVENT,uint32(32))));_reject(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.confirmStarted,(EVENT,handA)));require(!runtimeEscrow.started(EVENT));}
    function testGenuineAdmissionReceiptIsRetainedAcrossStartTransition()public {_firstHands();_proveDeal(handA,"tableA");require(runtimeEscrow.started(EVENT)&&host.frozenHand(handA).admission!=0&&ws8Engine.isHandInitialized(handA));require(!ws8Delivery.allAcknowledged(handA),"admission-only predicate must retain its original post-start guard");}
    function testOnlyCanonicalEngineMaySupplySettlement()public {_firstHands();uint256[9] memory forged;forged[0]=2000;_reject(address(host),abi.encodeCall(host.settleReservedHand,(host.tableId(EVENT,1),handA,forged,uint256(0))));require(!host.handConsumed(handA));}
    function testOperatorCannotDeclareEliminationOrChampion()public {_firstHands();(bool ok,)=address(host).call(abi.encodeWithSignature("eliminate(bytes32,bytes32)",EVENT,escrow.entryOf(EVENT,1).person));require(!ok);(ok,)=address(host).call(abi.encodeWithSignature("setChampion(bytes32,bytes32)",EVENT,escrow.entryOf(EVENT,1).person));require(!ok);}
    function testLiveStacksCannotBeRedeemedOrToppedUp()public {_firstHands();(bool ok,)=address(host).call(abi.encodeWithSignature("leave(bytes32)",host.tableId(EVENT,1)));require(!ok);(ok,)=address(host).call(abi.encodeWithSignature("topUp(bytes32,uint256)",host.tableId(EVENT,1),uint256(100)));require(!ok);}
    function testOneFinishedTableCannotAdvanceRoundOrStandings()public {_firstHands();_play(handA,"tableA");_reject(address(host),abi.encodeCall(host.processRound,(EVENT,uint32(32))));_reject(address(host),abi.encodeCall(host.prepareRound,(EVENT)));(,uint32 round,uint32 expected,uint32 resolved,,,)=host.eventState(EVENT);require(round==1&&expected==2&&resolved==1);}
    function testDisconnectionTimeoutCannotInventZeroStack()public {_firstHands();_proveDeal(handA,"tableA");vm.warp(uint256(ws8Engine.gameOf(handA).deadline)+1);ws8Engine.timeout(handA);ws8Engine.settle(handA,PokerCanonicalRake420.Policy(0,0,true,true));(uint32 live,uint32 pending,,,,,,,)=host.standingsState(EVENT);require(live==4&&pending==0&&host.chipConservation(EVENT));}
    function testEarlyFinalizationAndDirectModuleMutationRejected()public {_firstHands();_reject(address(host),abi.encodeCall(host.finalizeStandings,(EVENT,uint32(16))));_reject(host.admissionModule(),abi.encodeCall(PokerTournamentHostAdmission420.bootstrap,(EVENT,uint32(32))));}
    function testPublishedHostAndProofBundleCannotBeReplaced()public {_firstHands();_reject(address(host),abi.encodeCall(host.bindEngine,(address(ws8Engine))));_reject(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.bindHost,(address(host))));_reject(address(host),abi.encodeCall(host.configureTable,(EVENT,uint32(1),address(ws8Delivery),address(ws8Book),address(ws8Live),address(ws8Outcome),address(ws8Bonds))));}
    function testCanonicalSettlementReplayCannotDoubleEliminate()public {_firstHands();_play(handA,"tableA");(uint32 before_,,,,,,,,)=host.standingsState(EVENT);_reject(address(ws8Engine),abi.encodeCall(ws8Engine.settle,(handA,PokerCanonicalRake420.Policy(0,0,true,true))));(uint32 after_,,,,,,,,)=host.standingsState(EVENT);require(before_==after_&&before_==3);}
    function testProofFromOtherTournamentTableIsRejected()public {_firstHands();bytes32[3] memory roots=abi.decode(_data("tableA","roots.bin"),(bytes32[3]));ws8Initial.submit(handA,roots[0],_proof("tableA","WS8Initial"));_reject(address(ws8Initial),abi.encodeCall(ws8Initial.submit,(handB,roots[0],_proof("tableA","WS8Initial"))));require(ws8Initial.rootOf(handA)==roots[0]&&ws8Initial.rootOf(handB)==0);}
    function testWithheldReseatingEntropyFailsClosedWithoutRedraw()public {_firstHands();_play(handA,"tableA");_play(handB,"tableB");host.processRound(EVENT,32);_reject(address(host),abi.encodeCall(host.balance,(EVENT)));vm.warp(block.timestamp+301);host.requireEntropyRecovery(EVENT);_reject(address(host),abi.encodeCall(host.prepareRound,(EVENT)));(PokerTournamentHostState420.Phase phase,,,,,,)=host.eventState(EVENT);require(phase==PokerTournamentHostState420.Phase.RECOVERY_REQUIRED&&asset.balanceOf(address(runtimeEscrow))==412);}
    function testSafeLateEntryUsesRealEscrowAndOneNewStack()public {_firstHands();_play(handA,"tableA");_play(handB,"tableB");_drawAndBalance();_identity(outsider,E,EC,keccak256("late verified person"));_fund(outsider,103);grant(address(outsider),escrow.ENTER(),escrow.scope(EVENT));uint64 receipt=abi.decode(outsider.invoke(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseLate,(EVENT,E,EC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest))),(uint64));require(receipt==5);host.balance(EVENT);require(runtimeEscrow.admittedUniquePlayers(EVENT)==5&&asset.balanceOf(address(runtimeEscrow))==515&&host.chipConservation(EVENT));}
    function testClosedTournamentCannotReopenOrPayArbitraryPrizes()public {_finalContext();_play(finalHand,"final");host.processRound(EVENT,32);host.finalizeStandings(EVENT,16);_reject(address(host),abi.encodeCall(host.prepareRound,(EVENT)));(bool ok,)=address(runtimeEscrow).call(abi.encodeWithSignature("payPrize(bytes32,address,uint256)",EVENT,address(this),uint256(400)));require(!ok&&asset.balanceOf(address(runtimeEscrow))==412);}
}
contract TournamentRebuyFunded420Test is TournamentFundedTestsBase420 {
    function kind()internal pure override returns(PokerTournamentPolicy420.PurchaseKind){return PokerTournamentPolicy420.PurchaseKind.REBUY;}
    function folder()internal pure override returns(string memory){return "rebuy";}
    function testExportInitialTournamentContexts()public {_firstHands();emit C5StatementContext("tableA",_context(handA));emit C5StatementContext("tableB",_context(handB));}
    function testGenuineZeroStackRebuyRetainsEntryAndCostsExactFee()public {_firstHands();_play(handA,"tableA");bytes32 person=_zero(handA);(PokerTournamentStandings420.Person memory before_,,)=host.standing(EVENT,person);require(before_.status==PokerTournamentStandings420.Status.REBUY_PENDING);uint64 receipt=_extra(person);(PokerTournamentStandings420.Person memory after_,,)=host.standing(EVENT,person);require(after_.status==PokerTournamentStandings420.Status.ACTIVE&&after_.generation==before_.generation&&after_.receipt==receipt&&host.tournamentPlayer(EVENT,person).chips==1000);require(runtimeEscrow.heldPrizes()==500&&runtimeEscrow.heldFees()==15&&asset.balanceOf(address(runtimeEscrow))==515&&host.chipConservation(EVENT));}
    function testExpiredGenuineRebuyCannotRestoreStack()public {_firstHands();_play(handA,"tableA");bytes32 person=_zero(handA);(PokerTournamentStandings420.Person memory p,,)=host.standing(EVENT,person);vm.warp(p.rebuyUntil);host.expireRebuy(EVENT,person);require(!host.extraAllowed(EVENT,person)&&host.tournamentPlayer(EVENT,person).chips==0&&asset.balanceOf(address(runtimeEscrow))==412);}
    function testActiveFundedStackCannotRebuy()public {_firstHands();_play(handA,"tableA");PokerTournamentHostState420.Frozen memory f=host.frozenHand(handA);bytes32 person=host.tournamentPlayer(EVENT,f.people[0]).chips>0?f.people[0]:f.people[1];require(!host.extraAllowed(EVENT,person));}
}
contract TournamentReentryFunded420Test is TournamentFundedTestsBase420 {
    function kind()internal pure override returns(PokerTournamentPolicy420.PurchaseKind){return PokerTournamentPolicy420.PurchaseKind.RE_ENTRY;}
    function folder()internal pure override returns(string memory){return "reentry";}
    function testExportInitialTournamentContexts()public {_firstHands();emit C5StatementContext("tableA",_context(handA));emit C5StatementContext("tableB",_context(handB));}
    function testGenuineEliminationReentryHasNewGenerationAndOneIdentity()public {_firstHands();_play(handA,"tableA");bytes32 person=_zero(handA);_play(handB,"tableB");_drawAndBalance();uint64 receipt=_extra(person);host.balance(EVENT);(PokerTournamentStandings420.Person memory p,,)=host.standing(EVENT,person);require(p.generation==2&&p.receipt==receipt&&p.status==PokerTournamentStandings420.Status.ACTIVE&&runtimeEscrow.admittedUniquePlayers(EVENT)==4&&host.tournamentPlayer(EVENT,person).chips==1000&&host.chipConservation(EVENT));require(asset.balanceOf(address(runtimeEscrow))==515);}
}
contract TournamentTieFunded420Test is TournamentFundedTestsBase420 {
    function folder()internal pure override returns(string memory){return "tie";}
    function tableLimit()internal pure override returns(uint16){return 1;}
    function seatCapacity()internal pure override returns(uint8){return 4;}
    function testExportInitialTournamentContexts()public {_fundedSeated();_openRound();handA=_begin(1);emit C5StatementContext("tableA",_context(handA));}
    function testGenuineSameHandEliminationTie()public {
        _fundedSeated();_openRound();handA=_begin(1);_play(handA,"tableA");host.processRound(EVENT,32);host.finalizeStandings(EVENT,16);
        bytes32[4] memory people=[escrow.entryOf(EVENT,1).person,escrow.entryOf(EVENT,2).person,escrow.entryOf(EVENT,3).person,escrow.entryOf(EVENT,4).person];uint8 tied;
        for(uint8 i;i<4;i++){(,uint32 first,uint32 last)=host.standing(EVENT,people[i]);if(first==2){require(last==4);tied++;}else require(first==1&&last==1);}require(tied==3&&host.chipConservation(EVENT));
        _emitCertificate();
    }
}
contract TournamentBalanceFunded420Test is TournamentFundedTestsBase420 {
    function folder()internal pure override returns(string memory){return "balance";}
    function fieldSize()internal pure override returns(uint8){return 6;}
    function testExportInitialTournamentContexts()public {_firstHands();emit C5StatementContext("tableA",_context(handA));emit C5StatementContext("tableB",_context(handB));}
    function testGenuineHandResultsAuthorizeNextBigBlindBalancing()public {
        _firstHands();_play(handA,"tableA");_checkedHand(handB,"tableB");host.processRound(EVENT,32);PokerTournamentTableBalance420.Table memory source=host.tournamentTable(EVENT,2);
        bytes32 person=host.frozenHand(handB).people[source.nextBB];PokerTournamentTableBalance420.Player memory before_=host.tournamentPlayer(EVENT,person);bytes32 purpose=host.eventPurpose(EVENT);
        provider0.invoke(address(roundEntropy),abi.encodeCall(roundEntropy.reveal,(purpose,SECRET0)));provider1.invoke(address(roundEntropy),abi.encodeCall(roundEntropy.reveal,(purpose,SECRET1)));roundEntropy.resolve(purpose);
        require(host.balance(EVENT)==PokerTournamentTableBalance420.Result.MOVED);host.balance(EVENT);PokerTournamentTableBalance420.Player memory after_=host.tournamentPlayer(EVENT,person);
        require(after_.table==1&&after_.chips==before_.chips&&after_.receipt==before_.receipt&&after_.generation==before_.generation&&after_.blindHistory==before_.blindHistory&&after_.blindObligations==before_.blindObligations&&after_.placementEpoch==before_.placementEpoch+1);
        require(PokerTournamentTableBalance420._count(host.tournamentTable(EVENT,1).mask)==2&&PokerTournamentTableBalance420._count(host.tournamentTable(EVENT,2).mask)==2&&host.chipConservation(EVENT));
    }
}
