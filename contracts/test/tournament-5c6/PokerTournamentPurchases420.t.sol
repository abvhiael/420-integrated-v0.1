// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPurchaseFundedFixture420.sol";
abstract contract TournamentPurchaseTestsBase420 is TournamentPurchaseFundedFixture420 {
    event C6ExecutedHand(bytes32 indexed hand,uint8 button,uint16 mask,uint8[9] holeA,uint8[9] holeB,uint8[5] board,uint256[9] initialChips,uint256[9] finalChips);
    event C6ExecutedHandData(bytes encoded);
    event C6CertifiedStandingsData(bytes encoded);
    event C6VerifierIdentity(uint8 index,address backend,bytes32 verifyingKey,bytes32 runtimeHash,bytes32 circuit,bytes32 schema);
    event C6PurchaseSeedData(bytes encoded);
    event C6FinalPurchaseRoot(bytes32 root);
    event C6RuntimeIdentity(address host,bytes32 hostHash,address escrow,bytes32 escrowHash,address engine,bytes32 engineHash);
    function _emitIdentities()internal {
        emit C6PurchaseSeedData(abi.encode(host.PURCHASE_DOMAIN(),runtimeEscrow.eventOf(EVENT).manifest,purchasePolicies.get(PURCHASE_PLAN).digest));
        (,,,,bytes32 purchaseRoot,)=host.purchaseState(EVENT);emit C6FinalPurchaseRoot(purchaseRoot);
        for(uint8 i;i<7;i++){(bytes32 circuit,bytes32 schema)=C5VerifierData.identity(i);emit C6VerifierIdentity(i,ws8Backends[i],ws8Keys[i],ws8Backends[i].codehash,circuit,schema);}
        emit C6RuntimeIdentity(address(host),address(host).codehash,address(runtimeEscrow),address(runtimeEscrow).codehash,address(ws8Engine),address(ws8Engine).codehash);
    }
    function _n(uint256 n)internal pure returns(string memory){if(n==0)return "0";uint256 x=n;uint256 len;while(x!=0){len++;x/=10;}bytes memory b=new bytes(len);while(n!=0){b[--len]=bytes1(uint8(48+n%10));n/=10;}return string(b);}
    function _data(string memory label,string memory name)internal returns(bytes memory){return cvm.readFileBinary(string.concat("../clients/420bet-poker/zkshuffle/fixtures/tournament-5c6/",folder(),"/",label,"/",name));}
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
        uint8 target=_winnerPosition(hand);uint8 card=pos==target?12:pos==12?target:pos;ws8Live.reveal(hand,street,pos,card,C5VerifierData.keys(),_proof(label,string.concat("WS8Unmask",_n(street),_n(pos))));
    }
    function _play(bytes32 hand,string memory label)internal {
        _proveDeal(hand,label);PokerNLHEStorage420.Game memory g=ws8Engine.gameOf(hand);uint256 total=ws8Engine.playerOf(hand,g.toAct).stack;
        _signed(hand,PokerNLHEStorage420.Move.RAISE,total);while(ws8Engine.gameOf(hand).phase==PokerNLHEStorage420.Phase.PREFLOP)_signed(hand,PokerNLHEStorage420.Move.CALL,ws8Engine.turnOf(hand).callChips);
        uint8 count;uint16 participating=deal.handSeatMask(hand);for(uint8 i;i<9;i++)if((participating&(uint16(1)<<i))!=0)count++;
        for(uint8 pos=2*count+1;pos<=2*count+3;pos++)_reveal(hand,label,1,pos);ws8Live.advance(hand,1);_checks(hand);
        _reveal(hand,label,2,2*count+5);ws8Live.advance(hand,2);_checks(hand);_reveal(hand,label,3,2*count+7);ws8Live.advance(hand,3);_checks(hand);
        for(uint8 pos;pos<2*count;pos++)_reveal(hand,label,4,pos);
        PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(0,0,true,true);(uint256[9] memory amounts,uint256 rake)=ws8Outcome.calculate(hand,policy);require(rake==0,"no tournament hand rake");
        uint8 zeroes;uint16 mask=deal.handSeatMask(hand);for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0&&amounts[i]==0)zeroes++;require(zeroes==count-1,"genuine distinct winner fixture");
        ws8Engine.settle(hand,policy);require(host.handConsumed(hand)&&ws8Engine.handSettled(hand)&&host.chipConservation(EVENT));_emitHand(hand,count,amounts);
    }
    function _emitHand(bytes32 hand,uint8 count,uint256[9] memory amounts)internal {
        uint8[9] memory a;uint8[9] memory b;uint8[5] memory board;
        for(uint8 pos;pos<2*count;pos++){uint8 seat=ws8Engine.holeSeatForPosition(hand,pos);if(pos<count)a[seat]=ws8Live.slotOf(hand,pos).card;else b[seat]=ws8Live.slotOf(hand,pos).card;}
        board=[ws8Live.slotOf(hand,2*count+1).card,ws8Live.slotOf(hand,2*count+2).card,ws8Live.slotOf(hand,2*count+3).card,ws8Live.slotOf(hand,2*count+5).card,ws8Live.slotOf(hand,2*count+7).card];
        emit C6ExecutedHand(hand,ws8Engine.gameOf(hand).button,deal.handSeatMask(hand),a,b,board,host.frozenHand(hand).initialChips,amounts);
        PokerTournamentHostState420.Frozen memory f=host.frozenHand(hand);uint256[9] memory contributed;uint256[9] memory remaining;uint16 folded;
        for(uint8 i;i<9;i++)if((f.mask&(uint16(1)<<i))!=0){PokerNLHEStorage420.Player memory p=ws8Engine.playerOf(hand,i);contributed[i]=p.contributed;remaining[i]=p.stack;if(p.folded)folded|=uint16(1)<<i;}
        emit C6ExecutedHandData(abi.encode(hand,f.table,f.round,ws8Engine.gameOf(hand).button,f.mask,f.people,a,b,board,f.initialChips,contributed,remaining,amounts,folded));
    }
    function _emitCertificate()internal {
        (,,,,bytes32 context,,)=host.eventState(EVENT);(,,uint32 wave,,,bytes32 champion,bytes32 root,,uint32 unique)=host.standingsState(EVENT);require(unique<=9);
        bytes32[9] memory people;uint32[9] memory generations;uint64[9] memory receipts;uint32[9] memory first;uint32[9] memory last;uint256[9] memory chips;
        for(uint32 i;i<unique;i++){people[i]=host.standingsPersonAt(EVENT,i);(PokerTournamentStandings420.Person memory p,uint32 a,uint32 b)=host.standing(EVENT,people[i]);generations[i]=p.generation;receipts[i]=p.receipt;first[i]=a;last[i]=b;chips[i]=host.tournamentPlayer(EVENT,people[i]).chips;}
        emit C6CertifiedStandingsData(abi.encode(context,wave,champion,root,unique,people,generations,receipts,first,last,chips,runtimeEscrow.heldPrizes(),runtimeEscrow.heldFees()));
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
    function _actor(bytes32 person)internal view returns(EntryActor420 actor,bytes32 subject,bytes32 credential){
        address payer=host.tournamentPlayer(EVENT,person).payer;
        if(payer==address(alice))return(alice,A,AC);if(payer==address(bob))return(bob,B,BC);if(payer==address(carol))return(carol,C,CC);if(payer==address(dan))return(dan,D,DC);if(payer==address(eve))return(eve,E,EC);if(payer==address(frank))return(frank,F,FC);revert("unknown actual actor");
    }
    function _late(EntryActor420 actor,bytes32 subject,bytes32 credential)internal returns(uint64){return abi.decode(actor.invoke(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseLate,(EVENT,subject,credential,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest))),(uint64));}
    function _addOn(bytes32 person)internal returns(uint64){(EntryActor420 actor,bytes32 subject,bytes32 credential)=_actor(person);return abi.decode(actor.invoke(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseAddOn,(EVENT,subject,credential,runtimeEscrow.nonceOf(EVENT,person)+1,uint256(103),escrow.eventOf(EVENT).manifest))),(uint64));}
    function _cutoffAndAddOns()internal {
        vm.warp(1401);host.openAddOnBreak(EVENT);uint8 bought;
        for(uint32 i;i<runtimeEscrow.admittedUniquePlayers(EVENT);i++){bytes32 person=host.standingsPersonAt(EVENT,i);if(host.tournamentPlayer(EVENT,person).chips>=2000){_addOn(person);bought++;}}
        require(bought==2,"two original surviving stacks");vm.warp(1701);host.closeAddOnBreak(EVENT);
    }
    function _reentryAndLate()internal {
        _firstHands();_play(handA,"tableA");bytes32 person=_zero(handA);_extra(person);_late(eve,E,EC);require(host.chipConservation(EVENT));
        (,,,uint32 queued,,)=host.purchaseState(EVENT);require(queued==2&&runtimeEscrow.heldPrizes()==600&&runtimeEscrow.heldFees()==18);
        require(host.tournamentPlayer(EVENT,person).chips==0,"payment must not mint into a live round");_play(handB,"tableB");_drawAndBalance();
        require(host.tournamentPlayer(EVENT,person).chips==1000&&runtimeEscrow.admittedUniquePlayers(EVENT)==5&&host.chipConservation(EVENT));
    }
    function _afterPurchases()internal{_reentryAndLate();_cutoffAndAddOns();require(runtimeEscrow.heldPrizes()==800&&runtimeEscrow.heldFees()==24);_openRound();handA=_begin(1);handB=_begin(2);}
    function _afterRebuys()internal{_firstHands();_play(handA,"tableA");_extra(_zero(handA));_play(handB,"tableB");_extra(_zero(handB));_drawAndBalance();_cutoffAndAddOns();_openRound();handA=_begin(1);handB=_begin(2);}
    function _lastRound()internal{_play(handA,"nextA");_play(handB,"nextB");_drawAndBalance();(bool formed,uint32 table)=host.finalTableOf(EVENT);require(formed&&host.tournamentTableCount(EVENT)==1);_openRound();finalHand=_begin(table);}
    function _fails(address target,bytes memory data)internal { (bool ok,)=target.call(data);require(!ok,"unauthorized or invalid action succeeded"); }
    function testFrozenPurchasePlanCannotBeReplacedOrRepublished()public {
        PokerTournamentPurchasePolicies420.Record memory r=purchasePolicies.get(PURCHASE_PLAN);require(r.status==PokerTournamentPurchasePolicies420.Status.PUBLISHED&&r.addOn&&r.window==300&&purchasePolicies.defaultWindow()==300&&!purchasePolicies.acceptsFunds());
        _fails(address(purchasePolicies),abi.encodeCall(purchasePolicies.register,(PURCHASE_PLAN,POLICY,true,uint32(301))));_fails(address(purchasePolicies),abi.encodeCall(purchasePolicies.approve,(PURCHASE_PLAN)));_fails(address(purchasePolicies),abi.encodeCall(purchasePolicies.publish,(PURCHASE_PLAN)));
        require(purchasePolicies.get(PURCHASE_PLAN).digest==r.digest&&runtimeEscrow.purchasePlan(EVENT)==PURCHASE_PLAN);
    }
    function testFixedRuntimeModulesFitDeploymentLimitsAndRejectDirectCalls()public {
        require(address(host).code.length<=24576&&address(runtimeEscrow).code.length<=24576&&runtimeEscrow.paymentModule().code.length<=24576);
        require(runtimeEscrow.paymentModule().codehash==runtimeEscrow.paymentCodeHash());
        _fails(runtimeEscrow.paymentModule(),abi.encodeCall(runtimeEscrow.activateQueued,(EVENT,uint64(1))));
    }
    function testNoPostStartPurchaseBeforeGenuineFirstHand()public {
        _fundedSeated();_fails(address(eve),abi.encodeCall(eve.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseLate,(EVENT,E,EC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)))));
        _fails(address(host),abi.encodeCall(host.openAddOnBreak,(EVENT)));require(runtimeEscrow.heldPrizes()==400&&runtimeEscrow.heldFees()==12);
    }
    function testBankAndHostCallbacksRequireActualAuthority()public {
        _fails(address(host),abi.encodeCall(host.acceptPaidRequest,(EVENT,uint64(1))));_fails(address(host),abi.encodeCall(host.acceptRebuy,(EVENT,uint64(1))));_fails(address(host),abi.encodeCall(host.acceptAddOn,(EVENT,uint64(1))));
        _fails(address(host),abi.encodeCall(host.activateQueuedRequest,(EVENT,uint64(1))));_fails(address(host),abi.encodeCall(host.resolveAtBarrier,(EVENT,uint32(1))));_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.activateQueued,(EVENT,uint64(1))));
    }
    function testLiveLatePaymentReservesCapacityWithoutMinting()public {
        _firstHands();_proveDeal(handA,"tableA");bytes32 snapshot=host.frozenHand(handB).snapshot;uint64 r=_late(eve,E,EC);_late(frank,F,FC);
        bytes32 person=escrow.personKey(E,EC,address(eve));require(runtimeEscrow.pendingReceipt(EVENT,person)==r&&runtimeEscrow.activeReceipt(EVENT,person)==0&&host.tournamentPlayer(EVENT,person).chips==0);
        require(escrow.eventOf(EVENT).reservedPlayers==6&&host.frozenHand(handB).snapshot==snapshot&&host.chipConservation(EVENT));
        _fails(address(eve),abi.encodeCall(eve.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseLate,(EVENT,E,EC,uint64(2),uint256(103),escrow.eventOf(EVENT).manifest)))));
        _fails(address(host),abi.encodeCall(host.resolveRequests,(EVENT,uint32(1))));
    }
    function testQueuedDeadlineRefundCreditsOriginalPayerAndKeepsNonce()public {
        _firstHands();_proveDeal(handA,"tableA");uint64 r=_late(eve,E,EC);bytes32 person=escrow.personKey(E,EC,address(eve));
        _fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.refundUnseated,(EVENT,r)));vm.warp(runtimeEscrow.receiptOf(EVENT,r).readyUntil);runtimeEscrow.refundUnseated(EVENT,r);
        require(runtimeEscrow.credit(address(eve))==103&&runtimeEscrow.nonceOf(EVENT,person)==1&&runtimeEscrow.pendingReceipt(EVENT,person)==0&&host.queuedHead(EVENT)==0&&escrow.eventOf(EVENT).reservedPlayers==4);
        require(runtimeEscrow.heldPrizes()==400&&runtimeEscrow.heldFees()==12&&runtimeEscrow.solvent());_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.refundUnseated,(EVENT,r)));
        uint256 before_=asset.balanceOf(address(eve));eve.invoke(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.withdraw,()));require(asset.balanceOf(address(eve))==before_+103&&runtimeEscrow.totalCredits()==0&&runtimeEscrow.solvent());
    }
    function testWrongManifestPriceAndNonceLeaveCustodyUnchanged()public {
        _firstHands();_proveDeal(handA,"tableA");bytes32 manifest=escrow.eventOf(EVENT).manifest;
        _fails(address(eve),abi.encodeCall(eve.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseLate,(EVENT,E,EC,uint64(1),uint256(103),bytes32(0))))));
        _fails(address(eve),abi.encodeCall(eve.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseLate,(EVENT,E,EC,uint64(1),uint256(102),manifest)))));
        _fails(address(eve),abi.encodeCall(eve.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseLate,(EVENT,E,EC,uint64(2),uint256(103),manifest)))));
        require(runtimeEscrow.heldPrizes()==400&&runtimeEscrow.heldFees()==12&&host.queuedHead(EVENT)==0);
    }
    function testExtraRequiresAuthenticZeroStackAndAddOnRequiresBreak()public {
        _firstHands();_proveDeal(handA,"tableA");bytes32 person=host.frozenHand(handA).people[0];(EntryActor420 actor,bytes32 subject,bytes32 credential)=_actor(person);
        _fails(address(actor),abi.encodeCall(actor.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseExtra,(EVENT,subject,credential,uint64(2),uint256(103),escrow.eventOf(EVENT).manifest)))));
        _fails(address(actor),abi.encodeCall(actor.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseAddOn,(EVENT,subject,credential,uint64(2),uint256(103),escrow.eventOf(EVENT).manifest)))));
        _fails(address(host),abi.encodeCall(host.openAddOnBreak,(EVENT)));require(host.chipConservation(EVENT));
    }
    function _readyPurchases()internal {if(kind()==PokerTournamentPolicy420.PurchaseKind.REBUY){_firstHands();_play(handA,"tableA");_extra(_zero(handA));_play(handB,"tableB");_extra(_zero(handB));_drawAndBalance();}else _reentryAndLate();}
    function testAddOnIsOncePerPositiveStackAndExactlyPriced()public {
        _readyPurchases();_fails(address(host),abi.encodeCall(host.openAddOnBreak,(EVENT)));vm.warp(1401);host.openAddOnBreak(EVENT);
        bytes32 buyer;for(uint32 i;i<host.admittedUniquePlayers(EVENT);i++){bytes32 person=host.standingsPersonAt(EVENT,i);if(host.tournamentPlayer(EVENT,person).chips>0){buyer=person;break;}}
        uint256 before_=host.tournamentPlayer(EVENT,buyer).chips;_addOn(buyer);require(host.tournamentPlayer(EVENT,buyer).chips==before_+1000&&host.addOnClaimed(EVENT,buyer));
        (EntryActor420 actor,bytes32 subject,bytes32 credential)=_actor(buyer);uint64 nonce=runtimeEscrow.nonceOf(EVENT,buyer)+1;
        _fails(address(actor),abi.encodeCall(actor.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseAddOn,(EVENT,subject,credential,nonce,uint256(103),escrow.eventOf(EVENT).manifest)))));
        _fails(address(host),abi.encodeCall(host.closeAddOnBreak,(EVENT)));(,uint32 roundBefore,,,,,)=host.eventState(EVENT);host.prepareRound(EVENT);(PokerTournamentHostState420.Phase phase,uint32 roundAfter,,,,,)=host.eventState(EVENT);require(phase==PokerTournamentHostState420.Phase.PAUSED&&roundBefore==roundAfter&&host.chipConservation(EVENT));
    }
    function testAddOnExactDeadlineAndKeeperDelayCannotExtendBreak()public {
        _readyPurchases();vm.warp(1401);host.openAddOnBreak(EVENT);vm.warp(1701);
        bytes32 buyer=host.standingsPersonAt(EVENT,0);(EntryActor420 actor,bytes32 subject,bytes32 credential)=_actor(buyer);
        _fails(address(actor),abi.encodeCall(actor.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseAddOn,(EVENT,subject,credential,runtimeEscrow.nonceOf(EVENT,buyer)+1,uint256(103),escrow.eventOf(EVENT).manifest)))));
        vm.warp(1801);PokerTournamentStructure420.Position memory before_=host.blindPosition(EVENT);host.closeAddOnBreak(EVENT);PokerTournamentStructure420.Position memory after_=host.blindPosition(EVENT);require(keccak256(abi.encode(before_))==keccak256(abi.encode(after_)));_fails(address(host),abi.encodeCall(host.openAddOnBreak,(EVENT)));
    }
    function testExpiredPublishedBreakRequiresRecovery()public {_readyPurchases();vm.warp(1401);host.openAddOnBreak(EVENT);vm.warp(1701+86400);host.closeAddOnBreak(EVENT);(PokerTournamentHostState420.Phase phase,,,,,,)=host.eventState(EVENT);require(phase==PokerTournamentHostState420.Phase.RECOVERY_REQUIRED);_fails(address(host),abi.encodeCall(host.prepareRound,(EVENT)));}
    function _finish()internal{_lastRound();_play(finalHand,"final");host.processRound(EVENT,32);host.finalizeStandings(EVENT,16);require(host.chipConservation(EVENT));(PokerTournamentHostState420.Phase p,,,,,uint256 chips,)=host.eventState(EVENT);require(p==PokerTournamentHostState420.Phase.COMPLETE&&chips==8000);_emitCertificate();_emitIdentities();}
}
contract TournamentPurchasesFunded420Test is TournamentPurchaseTestsBase420 {
    function testPaidBeforeCutoffCanActivateAfterCutoffWithinReadiness()public {
        _firstHands();_play(handA,"tableA");vm.warp(1300);bytes32 zero=_zero(handA);uint64 r=_extra(zero);_late(eve,E,EC);vm.warp(1401);_play(handB,"tableB");_drawAndBalance();
        require(runtimeEscrow.activeReceipt(EVENT,zero)==r&&runtimeEscrow.receiptOf(EVENT,r).status==PokerTournamentPurchaseEscrowState420.ReceiptStatus.ACTIVATED&&host.tournamentPlayer(EVENT,zero).chips==1000&&host.chipConservation(EVENT));
    }
    function testCannotQueueReentryTwiceOrCashOutActivatedPurchase()public {
        _firstHands();_play(handA,"tableA");bytes32 zero=_zero(handA);uint64 r=_extra(zero);(EntryActor420 actor,bytes32 subject,bytes32 credential)=_actor(zero);
        _fails(address(actor),abi.encodeCall(actor.invoke,(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.purchaseExtra,(EVENT,subject,credential,runtimeEscrow.nonceOf(EVENT,zero)+1,uint256(103),escrow.eventOf(EVENT).manifest)))));
        _play(handB,"tableB");_drawAndBalance();_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.refundUnseated,(EVENT,r)));require(host.tournamentPlayer(EVENT,zero).chips==1000&&runtimeEscrow.credit(address(actor))==0);
    }

    function testExportInitialC6Contexts()public{_firstHands();emit C6StatementContext("tableA",_context(handA));emit C6StatementContext("tableB",_context(handB));}
    function testExportPostPurchaseContexts()public{_afterPurchases();emit C6StatementContext("nextA",_context(handA));emit C6StatementContext("nextB",_context(handB));}
    function testExportFinalC6Context()public{_afterPurchases();_lastRound();emit C6StatementContext("final",_context(finalHand));}
    function testLegitimateFundedReentryLateRegistrationAddOnsAndCompletion()public{_afterPurchases();_finish();require(asset.balanceOf(address(runtimeEscrow))==824&&runtimeEscrow.heldPrizes()==800&&runtimeEscrow.heldFees()==24&&runtimeEscrow.solvent());}
}
contract TournamentRebuyPurchasesFunded420Test is TournamentPurchaseTestsBase420 {
    function kind()internal pure override returns(PokerTournamentPolicy420.PurchaseKind){return PokerTournamentPolicy420.PurchaseKind.REBUY;}
    function folder()internal pure override returns(string memory){return "rebuy";}
    function testExportInitialC6Contexts()public{_firstHands();emit C6StatementContext("tableA",_context(handA));emit C6StatementContext("tableB",_context(handB));}
    function testExportPostPurchaseContexts()public{_afterRebuys();emit C6StatementContext("nextA",_context(handA));emit C6StatementContext("nextB",_context(handB));}
    function testExportFinalC6Context()public{_afterRebuys();_lastRound();emit C6StatementContext("final",_context(finalHand));}
    function testLegitimateFundedRebuysAddOnsAndCompletion()public{_afterRebuys();_finish();require(asset.balanceOf(address(runtimeEscrow))==824&&runtimeEscrow.heldPrizes()==800&&runtimeEscrow.heldFees()==24&&runtimeEscrow.solvent());}
}
