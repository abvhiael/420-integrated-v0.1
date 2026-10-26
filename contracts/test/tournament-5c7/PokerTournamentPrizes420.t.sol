// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPrizeFundedFixture420.sol";
abstract contract TournamentPrizeTestsBase420 is TournamentPrizeFundedFixture420 {
    event C7ExecutedHand(bytes32 indexed hand,uint8 button,uint16 mask,uint8[9] holeA,uint8[9] holeB,uint8[5] board,uint256[9] initialChips,uint256[9] finalChips);
    event C7ExecutedHandData(bytes encoded);
    event C7CertifiedStandingsData(bytes encoded);
    event C7VerifierIdentity(uint8 index,address backend,bytes32 verifyingKey,bytes32 runtimeHash,bytes32 circuit,bytes32 schema);
    event C7PurchaseSeedData(bytes encoded);
    event C7FinalPurchaseRoot(bytes32 root);
    event C7RuntimeIdentity(address host,bytes32 hostHash,address escrow,bytes32 escrowHash,address engine,bytes32 engineHash);
    function _emitIdentities()internal {
        emit C7PurchaseSeedData(abi.encode(host.PURCHASE_DOMAIN(),runtimeEscrow.eventOf(EVENT).manifest,purchasePolicies.get(PURCHASE_PLAN).digest));
        (,,,,bytes32 purchaseRoot,)=host.purchaseState(EVENT);emit C7FinalPurchaseRoot(purchaseRoot);
        for(uint8 i;i<7;i++){(bytes32 circuit,bytes32 schema)=C5VerifierData.identity(i);emit C7VerifierIdentity(i,ws8Backends[i],ws8Keys[i],ws8Backends[i].codehash,circuit,schema);}
        emit C7RuntimeIdentity(address(host),address(host).codehash,address(runtimeEscrow),address(runtimeEscrow).codehash,address(ws8Engine),address(ws8Engine).codehash);
    }
    function _n(uint256 n)internal pure returns(string memory){if(n==0)return "0";uint256 x=n;uint256 len;while(x!=0){len++;x/=10;}bytes memory b=new bytes(len);while(n!=0){b[--len]=bytes1(uint8(48+n%10));n/=10;}return string(b);}
    function _data(string memory label,string memory name)internal returns(bytes memory){return cvm.readFileBinary(string.concat("../clients/420bet-poker/zkshuffle/fixtures/tournament-5c7/",folder(),"/",label,"/",name));}
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
        emit C7ExecutedHand(hand,ws8Engine.gameOf(hand).button,deal.handSeatMask(hand),a,b,board,host.frozenHand(hand).initialChips,amounts);
        PokerTournamentHostState420.Frozen memory f=host.frozenHand(hand);uint256[9] memory contributed;uint256[9] memory remaining;uint16 folded;
        for(uint8 i;i<9;i++)if((f.mask&(uint16(1)<<i))!=0){PokerNLHEStorage420.Player memory p=ws8Engine.playerOf(hand,i);contributed[i]=p.contributed;remaining[i]=p.stack;if(p.folded)folded|=uint16(1)<<i;}
        emit C7ExecutedHandData(abi.encode(hand,f.table,f.round,ws8Engine.gameOf(hand).button,f.mask,f.people,a,b,board,f.initialChips,contributed,remaining,amounts,folded));
    }
    function _emitCertificate()internal {
        (,,,,bytes32 context,,)=host.eventState(EVENT);(,,uint32 wave,,,bytes32 champion,bytes32 root,,uint32 unique)=host.standingsState(EVENT);require(unique<=9);
        bytes32[9] memory people;uint32[9] memory generations;uint64[9] memory receipts;uint32[9] memory first;uint32[9] memory last;uint256[9] memory chips;
        for(uint32 i;i<unique;i++){people[i]=host.standingsPersonAt(EVENT,i);(PokerTournamentStandings420.Person memory p,uint32 a,uint32 b)=host.standing(EVENT,people[i]);generations[i]=p.generation;receipts[i]=p.receipt;first[i]=a;last[i]=b;chips[i]=host.tournamentPlayer(EVENT,people[i]).chips;}
        emit C7CertifiedStandingsData(abi.encode(context,wave,champion,root,unique,people,generations,receipts,first,last,chips,runtimeEscrow.heldPrizes(),runtimeEscrow.heldFees()));
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








    function _readyPurchases()internal {if(kind()==PokerTournamentPolicy420.PurchaseKind.REBUY){_firstHands();_play(handA,"tableA");_extra(_zero(handA));_play(handB,"tableB");_extra(_zero(handB));_drawAndBalance();}else _reentryAndLate();}



    function _finish()internal{_lastRound();_play(finalHand,"final");host.processRound(EVENT,32);host.finalizeStandings(EVENT,16);require(host.chipConservation(EVENT));(PokerTournamentHostState420.Phase p,,,,,uint256 chips,)=host.eventState(EVENT);require(p==PokerTournamentHostState420.Phase.COMPLETE&&chips==8000);_emitCertificate();_emitIdentities();}
    event C7PayoutTermsData(bytes encoded);
    event C7FinancialSeedData(bytes encoded);
    event C7FinalFinanceData(bytes encoded);
    function _emitFinalMoney()internal{(PokerTournamentFinanceState420.Mode mode,,,,,,,,bytes32 root)=runtimeEscrow.financialState(EVENT);emit C7FinalFinanceData(abi.encode(EVENT,uint8(mode),root,runtimeEscrow.totalReceived(),runtimeEscrow.totalWithdrawn(),runtimeEscrow.totalLiability(),runtimeEscrow.heldPrizes(),runtimeEscrow.heldFees(),runtimeEscrow.totalCredits(),asset.balanceOf(address(runtimeEscrow)),asset.balanceOf(address(feeRecipient)),asset.balanceOf(address(ws8Bonds))));}
    function _distribute()internal{
        (,,,,bytes32 context,,)=host.eventState(EVENT);(,,,,,,bytes32 result,,uint32 unique)=host.standingsState(EVENT);PokerTournamentPurchaseEscrowState420.EventAccount memory e=runtimeEscrow.eventOf(EVENT);
        emit C7PayoutTermsData(abi.encode(EVENT,unique,e.prize,e.fees,prizePolicies.select(PRIZE_PLAN,unique)));
        emit C7FinancialSeedData(abi.encode(runtimeEscrow.FINANCIAL_DOMAIN(),block.chainid,address(runtimeEscrow),EVENT,e.manifest,context,result,prizePolicies.get(PRIZE_PLAN).digest,unique,e.prize,e.fees,runtimeEscrow.developmentFund()));
        runtimeEscrow.beginPrizes(EVENT);for(uint32 i;i<unique;i+=2)runtimeEscrow.loadPrizes(EVENT,2);for(uint32 i;i<unique;i+=2)runtimeEscrow.allocatePrizes(EVENT,2);
        require(runtimeEscrow.credit(address(feeRecipient))==e.fees&&runtimeEscrow.heldFees()==0);uint256 total;
        for(uint32 i;i<unique;i++){bytes32 person=host.standingsPersonAt(EVENT,i);PokerTournamentPrizeMath420.Row memory row=runtimeEscrow.prizeRow(EVENT,person);total+=row.amount;runtimeEscrow.claimPrize(EVENT,person);}
        require(total==e.prize&&runtimeEscrow.heldPrizes()==0&&runtimeEscrow.solvent());_withdrawAll();_emitFinalMoney();
    }
    function _withdrawAll()internal{
        EntryActor420[7] memory actors=[alice,bob,carol,dan,eve,frank,feeRecipient];for(uint8 i;i<actors.length;i++)if(runtimeEscrow.credit(address(actors[i]))!=0)actors[i].invoke(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.withdraw,()));
        if(runtimeEscrow.credit(address(this))!=0)runtimeEscrow.withdraw();require(runtimeEscrow.totalLiability()==0&&runtimeEscrow.totalCredits()==0&&runtimeEscrow.totalReceived()==runtimeEscrow.totalWithdrawn()&&runtimeEscrow.solvent());
    }
    function _closeSmall()internal{_play(handA,"tableA");if(tableLimit()>1){_play(handB,"tableB");_drawAndBalance();(,uint32 table)=host.finalTableOf(EVENT);_openRound();finalHand=_begin(table);}else finalHand=handA;}
    function _completeSmall()internal{if(tableLimit()>1)_play(finalHand,"final");host.processRound(EVENT,32);host.finalizeStandings(EVENT,16);_emitCertificate();_emitIdentities();}
    function _paidPurchases()internal{if(kind()==PokerTournamentPolicy420.PurchaseKind.REBUY)_afterRebuys();else _afterPurchases();}
    function _completeScenario()internal{if(kind()==PokerTournamentPolicy420.PurchaseKind.FREEZEOUT){_firstHands();_closeSmall();_completeSmall();}else{_paidPurchases();_finish();}}
    function _plan()internal{(,,,,,,,,uint32 unique)=host.standingsState(EVENT);runtimeEscrow.beginPrizes(EVENT);for(uint32 i;i<unique;i+=2)runtimeEscrow.loadPrizes(EVENT,2);for(uint32 i;i<unique;i+=2)runtimeEscrow.allocatePrizes(EVENT,2);}
    function testFinancialModulesRejectDirectCallsAndUnknownClaims()public{
        require(address(runtimeEscrow).code.length<=24576&&address(host).code.length<=24576&&runtimeEscrow.prizeModule().code.length<=24576&&runtimeEscrow.refundModule().code.length<=24576);
        _fails(runtimeEscrow.prizeModule(),abi.encodeCall(runtimeEscrow.beginPrizes,(EVENT)));_fails(runtimeEscrow.refundModule(),abi.encodeCall(runtimeEscrow.beginFullRefund,(EVENT)));_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.claimPrize,(EVENT,bytes32(uint256(1)))));
    }
    function testAutomaticUnstartedCancellationReturnsAllFunds()public{
        _fundedSeated();uint256 expected=runtimeEscrow.totalReceived();vm.warp(uint256(runtimeEscrow.eventOf(EVENT).readyAt)+600);runtimeEscrow.tick(EVENT);
        for(uint64 i=1;i<=fieldSize();i++)runtimeEscrow.refundCancelled(EVENT,i);
        require(runtimeEscrow.totalCredits()==expected&&runtimeEscrow.heldPrizes()==0&&runtimeEscrow.heldFees()==0);_withdrawAll();require(asset.balanceOf(address(runtimeEscrow))==0&&runtimeEscrow.totalWithdrawn()==expected);
    }
    function testRefundCannotRepeatOrResetPersistentNonce()public{
        _fundedSeated();vm.warp(uint256(runtimeEscrow.eventOf(EVENT).readyAt)+600);runtimeEscrow.tick(EVENT);runtimeEscrow.refundCancelled(EVENT,1);_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.refundCancelled,(EVENT,uint64(1))));bytes32 person=runtimeEscrow.personKey(A,AC,address(alice));require(runtimeEscrow.nonceOf(EVENT,person)==1);
    }
    function testUnaccountedDonationIsNotRefundedAsPrizeMoney()public{
        _fundedSeated();asset.transfer(address(runtimeEscrow),7);vm.warp(uint256(runtimeEscrow.eventOf(EVENT).readyAt)+600);runtimeEscrow.tick(EVENT);for(uint64 i=1;i<=fieldSize();i++)runtimeEscrow.refundCancelled(EVENT,i);_withdrawAll();require(asset.balanceOf(address(runtimeEscrow))==7&&runtimeEscrow.totalLiability()==0);
    }
    function testFrozenFinancialPoliciesCannotBeReplaced()public{
        PokerTournamentPrizePolicies420.Record memory r=prizePolicies.get(PRIZE_PLAN);_fails(address(prizePolicies),abi.encodeCall(prizePolicies.approve,(PRIZE_PLAN)));_fails(address(prizePolicies),abi.encodeCall(prizePolicies.publish,(PRIZE_PLAN)));require(prizePolicies.get(PRIZE_PLAN).digest==r.digest&&runtimeEscrow.configOf(EVENT).recoveryPolicy==prizePolicies.FULL_REFUND());
    }
    function testGenuineActiveHandCannotReleasePrizesOrFees()public{
        _firstHands();_proveDeal(handA,"tableA");_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.beginPrizes,(EVENT)));_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.beginFullRefund,(EVENT)));require(runtimeEscrow.credit(address(feeRecipient))==0&&runtimeEscrow.heldFees()==uint256(fieldSize())*PokerTournamentPolicy420.fee(buyIn()));
    }
    function testPrizesAndFeesCannotBeCreditedTwice()public{
        _completeScenario();_plan();(,,,,,bytes32 winner,,,)=host.standingsState(EVENT);runtimeEscrow.claimPrize(EVENT,winner);_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.claimPrize,(EVENT,winner)));_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.beginPrizes,(EVENT)));_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.allocatePrizes,(EVENT,uint32(1))));_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.beginFullRefund,(EVENT)));
    }
    function testBoundedPlanHoldsFeesUntilAllAllocationsAreValidated()public{
        _completeScenario();(,,,,,,,,uint32 unique)=host.standingsState(EVENT);uint256 fee=runtimeEscrow.heldFees();runtimeEscrow.beginPrizes(EVENT);_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.loadPrizes,(EVENT,uint32(17))));_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.loadPrizes,(EVENT,uint32(0))));runtimeEscrow.loadPrizes(EVENT,1);_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.allocatePrizes,(EVENT,uint32(1))));for(uint32 i=1;i<unique;i++)runtimeEscrow.loadPrizes(EVENT,1);runtimeEscrow.allocatePrizes(EVENT,1);require(runtimeEscrow.heldFees()==fee&&runtimeEscrow.credit(address(feeRecipient))==0);_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.claimPrize,(EVENT,host.standingsPersonAt(EVENT,0))));for(uint32 i=1;i<unique;i++)runtimeEscrow.allocatePrizes(EVENT,1);require(runtimeEscrow.credit(address(feeRecipient))==fee&&runtimeEscrow.heldFees()==0);
    }
    function testRevokedCredentialCannotRedirectAnEarnedPrize()public{
        _completeScenario();(,,,,,bytes32 winner,,,)=host.standingsState(EVENT);(EntryActor420 actor,,bytes32 credential)=_actor(winner);identity.revokeCredential(credential);_plan();PokerTournamentPrizeMath420.Row memory row=runtimeEscrow.prizeRow(EVENT,winner);require(row.amount>0&&row.payee==address(actor));outsider.invoke(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.claimPrize,(EVENT,winner)));require(runtimeEscrow.credit(address(actor))==row.amount&&runtimeEscrow.credit(address(outsider))==0);actor.invoke(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.withdraw,()));require(runtimeEscrow.credit(address(actor))==0&&runtimeEscrow.solvent());
    }
    function _entropyRecovery()internal{
        host.prepareRound(EVENT);vm.warp(block.timestamp+3601);host.requireEntropyRecovery(EVENT);runtimeEscrow.checkpointRecovery(EVENT);
    }
    function _fullRefundAndWithdraw()internal{
        address[8] memory owners=[address(alice),address(bob),address(carol),address(dan),address(eve),address(frank),address(feeRecipient),address(this)];uint256[8] memory expected;for(uint8 i;i<8;i++)expected[i]=runtimeEscrow.credit(owners[i]);PokerTournamentPurchaseEscrowState420.EventAccount memory before_=runtimeEscrow.eventOf(EVENT);for(uint8 i;i<8;i++)if(owners[i]==before_.funder)expected[i]+=before_.sponsored;
        for(uint64 index=1;index<=before_.receipts;index++){PokerTournamentPurchaseEscrowState420.Entry memory entry=runtimeEscrow.entryOf(EVENT,index);if(entry.refunded)continue;bool found;for(uint8 i;i<8;i++)if(owners[i]==entry.payer){expected[i]+=entry.buyIn+entry.fee;found=true;}require(found);}
        (,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);if(block.timestamp<deadline)vm.warp(deadline);runtimeEscrow.beginFullRefund(EVENT);
        while(true){(PokerTournamentFinanceState420.Mode mode,,,,,,,,)=runtimeEscrow.financialState(EVENT);if(mode==PokerTournamentFinanceState420.Mode.REFUNDED)break;runtimeEscrow.processRefunds(EVENT,2);}
        for(uint8 i;i<8;i++)require(runtimeEscrow.credit(owners[i])==expected[i],"original payer full refund");require(runtimeEscrow.heldPrizes()==0&&runtimeEscrow.heldFees()==0&&runtimeEscrow.eventOf(EVENT).reservedPlayers==0);_withdrawAll();require(asset.balanceOf(address(runtimeEscrow))==0&&asset.balanceOf(address(feeRecipient))==0);_emitFinalMoney();
    }

}
contract TournamentPrizeReentryFunded420Test is TournamentPrizeTestsBase420 {
    function testGenuineReentryAddOnRecoveryRefundsEveryOriginalPayer()public{
        _readyPurchases();_cutoffAndAddOns();_entropyRecovery();(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);require(deadline==uint256(roundEntropy.roundOf(host.eventPurpose(EVENT)).preparedAt)+3600+86400);_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.beginFullRefund,(EVENT)));vm.warp(block.timestamp+100);runtimeEscrow.checkpointRecovery(EVENT);(,,,,,,,uint64 same,)=runtimeEscrow.financialState(EVENT);require(same==deadline);_fullRefundAndWithdraw();require(runtimeEscrow.totalWithdrawn()==824);_fails(address(host),abi.encodeCall(host.prepareRound,(EVENT)));_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.beginPrizes,(EVENT)));
    }
    function testQueuedReceiptsMustBeReconciledBeforeFullRecoveryRefund()public{
        _firstHands();_play(handA,"tableA");_extra(_zero(handA));_late(eve,E,EC);vm.warp(ws8Engine.fundedEvidenceDeadline(handB));ws8Engine.cancelWithheldDeal(handB);runtimeEscrow.checkpointRecovery(EVENT);(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);vm.warp(deadline);_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.beginFullRefund,(EVENT)));PokerTournamentFinancialKeeper420 keeper=new PokerTournamentFinancialKeeper420(address(runtimeEscrow));keeper.drainRecoveryQueue(EVENT,1);require(host.queuedHead(EVENT)!=0);keeper.drainRecoveryQueue(EVENT,16);require(host.queuedHead(EVENT)==0);_fullRefundAndWithdraw();require(runtimeEscrow.totalWithdrawn()==618&&runtimeEscrow.nonceOf(EVENT,runtimeEscrow.personKey(E,EC,address(eve)))==1);
    }
    function testOneAbortedHandDoesNotPermitRefundWhileAnotherIsActive()public{
        _firstHands();_proveDeal(handA,"tableA");vm.warp(ws8Engine.fundedEvidenceDeadline(handB));ws8Engine.cancelWithheldDeal(handB);runtimeEscrow.checkpointRecovery(EVENT);(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);vm.warp(deadline);_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.beginFullRefund,(EVENT)));ws8Engine.timeout(handA);PokerCanonicalRake420.Policy memory policy=PokerCanonicalRake420.Policy(0,0,true,true);ws8Engine.settle(handA,policy);require(ws8Engine.handSettled(handA)&&ws8Engine.handAborted(handB));_fullRefundAndWithdraw();require(runtimeEscrow.totalWithdrawn()==412&&host.chipConservation(EVENT));
    }

    function testExportInitialC7Contexts()public{_firstHands();emit C7StatementContext("tableA",_context(handA));emit C7StatementContext("tableB",_context(handB));}
    function testExportPostPurchaseC7Contexts()public{_paidPurchases();emit C7StatementContext("nextA",_context(handA));emit C7StatementContext("nextB",_context(handB));}
    function testExportFinalC7Context()public{_paidPurchases();_lastRound();emit C7StatementContext("final",_context(finalHand));}
    function testLegitimateReentryPrizesAndWithdrawals()public{_paidPurchases();_finish();_distribute();require(asset.balanceOf(address(feeRecipient))==24&&asset.balanceOf(address(runtimeEscrow))==0);}
}
contract TournamentPrizeRebuyFunded420Test is TournamentPrizeTestsBase420 {
    function testRecoveryRequiresExpiredRebuyChoicesToBeReconciled()public{
        _firstHands();_play(handA,"tableA");vm.warp(ws8Engine.fundedEvidenceDeadline(handB));ws8Engine.cancelWithheldDeal(handB);runtimeEscrow.checkpointRecovery(EVENT);(,,,,,,,uint64 deadline,)=runtimeEscrow.financialState(EVENT);vm.warp(deadline);_fails(address(runtimeEscrow),abi.encodeCall(runtimeEscrow.beginFullRefund,(EVENT)));PokerTournamentFinancialKeeper420 keeper=new PokerTournamentFinancialKeeper420(address(runtimeEscrow));keeper.expireRecoveryChoices(EVENT,0,16);(,uint32 pending,,,,,,,)=host.standingsState(EVENT);require(pending==0);_fullRefundAndWithdraw();require(runtimeEscrow.totalWithdrawn()==412);
    }

    function kind()internal pure override returns(PokerTournamentPolicy420.PurchaseKind){return PokerTournamentPolicy420.PurchaseKind.REBUY;}
    function folder()internal pure override returns(string memory){return "rebuy";}
    function testExportInitialC7Contexts()public{_firstHands();emit C7StatementContext("tableA",_context(handA));emit C7StatementContext("tableB",_context(handB));}
    function testExportPostPurchaseC7Contexts()public{_paidPurchases();emit C7StatementContext("nextA",_context(handA));emit C7StatementContext("nextB",_context(handB));}
    function testExportFinalC7Context()public{_paidPurchases();_lastRound();emit C7StatementContext("final",_context(finalHand));}
    function testLegitimateRebuyPrizesAndWithdrawals()public{_paidPurchases();_finish();_distribute();require(asset.balanceOf(address(feeRecipient))==24&&asset.balanceOf(address(runtimeEscrow))==0);}
}
contract TournamentPrizeFreeFunded420Test is TournamentPrizeTestsBase420 {
    function testGenuineFreeEventRecoveryReturnsSponsorAndChargesNoFees()public{_firstHands();_play(handA,"tableA");_play(handB,"tableB");host.processRound(EVENT,32);vm.warp(block.timestamp+301);host.requireEntropyRecovery(EVENT);runtimeEscrow.checkpointRecovery(EVENT);_fullRefundAndWithdraw();require(runtimeEscrow.totalWithdrawn()==807&&asset.balanceOf(address(this))==10000);}

    function kind()internal pure override returns(PokerTournamentPolicy420.PurchaseKind){return PokerTournamentPolicy420.PurchaseKind.FREEZEOUT;}
    function folder()internal pure override returns(string memory){return "free";}
    function addOnsEnabled()internal pure override returns(bool){return false;}
    function buyIn()internal pure override returns(uint128){return 0;}
    function sponsor()internal pure override returns(uint128){return 807;}
    function testExportInitialC7Contexts()public{_firstHands();emit C7StatementContext("tableA",_context(handA));emit C7StatementContext("tableB",_context(handB));}
    function testExportFinalC7Context()public{_firstHands();_closeSmall();emit C7StatementContext("final",_context(finalHand));}
    function testLegitimateFreeSponsoredTiedPrizesAndOddUnits()public{_firstHands();_closeSmall();_completeSmall();_distribute();require(asset.balanceOf(address(feeRecipient))==0&&runtimeEscrow.totalWithdrawn()==807);}
}
contract TournamentPrizeHeadsUpFunded420Test is TournamentPrizeTestsBase420 {
    function kind()internal pure override returns(PokerTournamentPolicy420.PurchaseKind){return PokerTournamentPolicy420.PurchaseKind.FREEZEOUT;}
    function folder()internal pure override returns(string memory){return "heads";}
    function addOnsEnabled()internal pure override returns(bool){return false;}
    function tableLimit()internal pure override returns(uint16){return 1;}
    function seatCapacity()internal pure override returns(uint8){return 2;}
    function fieldSize()internal pure override returns(uint8){return 2;}
    function testExportInitialC7Contexts()public{_firstHands();emit C7StatementContext("tableA",_context(handA));}
    function testLegitimateTwoEntrantWinnerTakeAll()public{_firstHands();_closeSmall();_completeSmall();_distribute();require(asset.balanceOf(address(feeRecipient))==6&&runtimeEscrow.totalWithdrawn()==206);}
}
