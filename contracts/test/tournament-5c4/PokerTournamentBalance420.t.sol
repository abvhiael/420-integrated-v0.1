// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/tournament/PokerTournamentTableBalance420.sol";

/// @dev Native math state fixture only. Synthetic stack/boundary snapshots are never poker proof acceptance.
contract SeatingMechanicsHarness420 {
    using PokerTournamentTableBalance420 for PokerTournamentTableBalance420.Layout;
    PokerTournamentTableBalance420.Layout private s;
    function init(uint8 cap,uint32 tables,uint32 maximum,uint32 count)external {s.initialize(keccak256("math context"),cap,tables,maximum,1000,count);}
    function initial(uint32 start,uint32 count)external {
        for(uint32 i=start;i<start+count;i++){PokerTournamentTableBalance420.Player memory p;p.person=bytes32(uint256(i)+1);p.payer=address(uint160(i+1));p.receipt=uint64(i+1);p.nonce=1;p.chips=1000;s.initial(p,i);}
    }
    function seal(bytes32 seed)external{s.seal(seed);}
    function person(uint256 id)external view returns(PokerTournamentTableBalance420.Player memory){return s.people[bytes32(id)];}
    function readTable(uint32 id)external view returns(PokerTournamentTableBalance420.Table memory){return s.tables[id];}
    function at(uint32 id,uint8 seat)external view returns(bytes32){return s.seats[id][seat];}
    function size()external view returns(uint256){return s.open.length;}
    function revision()external view returns(uint64){return s.revision;}
    function players()external view returns(uint32){return s.players;}
    function bounds()external view returns(uint8,uint8,uint32,uint32){return s.bounds();}
    function balance(uint64 rev)external returns(PokerTournamentTableBalance420.Result,PokerTournamentTableBalance420.Move memory){return s.balanceOne(rev);}
    function breakTable(bytes32 seed,uint64 rev)external returns(PokerTournamentTableBalance420.Result,PokerTournamentTableBalance420.Move[] memory){return s.breakHighest(rev,seed);}
    function worst(uint16 mask,uint8 button,uint8 cap)external pure returns(bool,uint8){return PokerTournamentTableBalance420.worstSeat(mask,button,cap);}
    function lock(uint32 id,bytes32 hand,uint64 rev)external{s.lock(s.context,id,hand,rev);}
    function unlock(uint32 id,bytes32 hand,uint64 rev)external{s.unlock(s.context,id,hand,rev);}
    function remove(uint256 person,uint64 rev)external{s.removeZero(bytes32(person),rev);}
    function simulatedZero(uint256 id)external{s.people[bytes32(id)].chips=0;}
    function simulatedHistory(uint256 id,uint64 history,uint8 owed)external{s.people[bytes32(id)].blindHistory=history;s.people[bytes32(id)].blindObligations=owed;}
    function admit(uint256 id,uint64 receipt,uint64 nonce,PokerTournamentTableBalance420.Purchase kind,bytes32 seed,uint64 rev)external {
        PokerTournamentTableBalance420.Player memory p;p.person=bytes32(id);p.payer=address(uint160(id));p.receipt=receipt;p.nonce=nonce;p.chips=1000;s.admit(p,kind,seed,rev);
    }
}
contract TournamentTableBalance420Test {
    SeatingMechanicsHarness420 private h;bytes32 private constant SEED=keccak256("unit arithmetic seed, not proof");
    function setUp()public{h=new SeatingMechanicsHarness420();}
    function setup(uint8 cap,uint32 tables,uint32 count)private{h.init(cap,tables,uint32(cap)*tables,count);h.initial(0,count);h.seal(SEED);}
    function reject(bytes memory data)private{(bool ok,)=address(h).call(data);require(!ok,"unexpected native acceptance");}
    function zero(uint256 id)private {h.simulatedZero(id);h.remove(id,h.revision());}
    function zeroSeat(uint32 id,uint8 seat)private{bytes32 p=h.at(id,seat);require(p!=0);zero(uint256(p));}
    function testInitialAssignmentsWithinOneAndUnique()public{setup(9,3,20);(uint8 lo,uint8 hi,,)=h.bounds();require(lo==6&&hi==7);for(uint256 i=1;i<=20;i++){PokerTournamentTableBalance420.Player memory p=h.person(i);require(p.chips==1000&&p.generation==1&&h.at(p.table,p.seat)==bytes32(i));}}
    function testSixtyFourTablesAnd576Players()public{setup(9,64,576);require(h.size()==64&&h.players()==576);(uint8 lo,uint8 hi,,)=h.bounds();require(lo==9&&hi==9);for(uint32 i=1;i<=64;i++)require(h.readTable(i).mask==511);}
    function testCapacityBeyond64Rejected()public{reject(abi.encodeCall(h.init,(uint8(9),uint32(65),uint32(585),uint32(2))));}
    function testTwoSeatMultiTableRejected()public{reject(abi.encodeCall(h.init,(uint8(2),uint32(2),uint32(4),uint32(4))));}
    function testTwoSeatSingleTableWorks()public{setup(2,1,2);require(h.readTable(1).mask==3);}
    function testInitialReplayAndSkippedIndexRejected()public{h.init(9,2,18,10);reject(abi.encodeCall(h.initial,(uint32(1),uint32(1))));h.initial(0,10);reject(abi.encodeCall(h.initial,(uint32(0),uint32(1))));h.seal(SEED);reject(abi.encodeCall(h.seal,(SEED)));}
    function testSealRequiresCompleteRosterAndNonzeroSeed()public{h.init(9,2,18,10);h.initial(0,1);reject(abi.encodeCall(h.seal,(SEED)));h.initial(1,9);reject(abi.encodeCall(h.seal,(bytes32(0))));}
    function testBalancedDoesNotMutateRevision()public{setup(9,2,17);uint64 r=h.revision();(PokerTournamentTableBalance420.Result result,)=h.balance(r);require(result==PokerTournamentTableBalance420.Result.BALANCED&&h.revision()==r);}
    function testStaleRevisionRejected()public{setup(9,2,17);reject(abi.encodeCall(h.balance,(uint64(1))));}
    function imbalanced()private{setup(9,2,18);zeroSeat(2,0);zeroSeat(2,1);}
    function testBalanceMovesNextDueBBAndPreservesAccounting()public{
        imbalanced();PokerTournamentTableBalance420.Table memory source=h.readTable(1);bytes32 due=h.at(1,source.nextBB);h.simulatedHistory(uint256(due),55,3);
        PokerTournamentTableBalance420.Player memory before_=h.person(uint256(due));
        (bool legal,uint8 worst)=h.worst(h.readTable(2).mask,h.readTable(2).button,9);require(legal);
        (PokerTournamentTableBalance420.Result result,PokerTournamentTableBalance420.Move memory m)=h.balance(h.revision());require(result==PokerTournamentTableBalance420.Result.MOVED&&m.person==due&&m.toSeat==worst);
        PokerTournamentTableBalance420.Player memory p=h.person(uint256(due));require(p.chips==before_.chips&&p.receipt==before_.receipt&&p.nonce==before_.nonce&&p.generation==before_.generation&&p.blindHistory==55&&p.blindObligations==3&&p.placementEpoch==before_.placementEpoch+1);
        (uint8 lo,uint8 hi,,)=h.bounds();require(lo==8&&hi==8);
    }
    function testBusySourceWaitsWithoutMutation()public{imbalanced();h.lock(1,keccak256("hand"),h.revision());uint64 r=h.revision();(PokerTournamentTableBalance420.Result result,)=h.balance(r);require(result==PokerTournamentTableBalance420.Result.WAIT_HAND&&h.revision()==r);}
    function testBusyDestinationWaitsWithoutMutation()public{imbalanced();h.lock(2,keccak256("hand"),h.revision());uint64 r=h.revision();(PokerTournamentTableBalance420.Result result,)=h.balance(r);require(result==PokerTournamentTableBalance420.Result.WAIT_HAND&&h.revision()==r);}
    function testHandReplayAndWrongCloseRejected()public{setup(9,2,18);bytes32 hand=keccak256("hand");h.lock(1,hand,h.revision());reject(abi.encodeCall(h.unlock,(uint32(1),SEED,h.revision())));h.unlock(1,hand,h.revision());reject(abi.encodeCall(h.lock,(uint32(2),hand,h.revision())));}
    function testNonzeroStackCannotBeRemoved()public{setup(9,2,18);reject(abi.encodeCall(h.remove,(uint256(1),h.revision())));}
    function testBusyZeroStackCannotBeRemoved()public{setup(9,2,18);h.simulatedZero(1);h.lock(1,keccak256("hand"),h.revision());reject(abi.encodeCall(h.remove,(uint256(1),h.revision())));}
    function breakable()private{setup(9,3,20);zeroSeat(1,0);zeroSeat(2,0);}
    function testSurplusTablesMustBreakBeforeBalancing()public{breakable();(PokerTournamentTableBalance420.Result result,)=h.balance(h.revision());require(result==PokerTournamentTableBalance420.Result.NEEDS_BREAK);}
    function testHighestTableClosesAndConsolidates()public{breakable();(PokerTournamentTableBalance420.Result result,PokerTournamentTableBalance420.Move[] memory moves)=h.breakTable(SEED,h.revision());require(result==PokerTournamentTableBalance420.Result.MOVED&&h.size()==2&&h.readTable(3).mask==0&&moves.length==6);for(uint256 i;i<moves.length;i++)require(moves[i].from==3&&moves[i].to<3&&h.person(uint256(moves[i].person)).chips==1000);(uint8 lo,uint8 hi,,)=h.bounds();require(lo==9&&hi==9);}
    function testBreakBusyHighestWaitsAtomically()public{breakable();h.lock(3,keccak256("hand"),h.revision());uint64 r=h.revision();(PokerTournamentTableBalance420.Result result,)=h.breakTable(SEED,r);require(result==PokerTournamentTableBalance420.Result.WAIT_HAND&&h.revision()==r&&h.size()==3);}
    function testBreakInsufficientIdleVacanciesWaitsAtomically()public{breakable();h.lock(1,keccak256("hand"),h.revision());uint64 r=h.revision();uint16 mask=h.readTable(3).mask;(PokerTournamentTableBalance420.Result result,)=h.breakTable(SEED,r);require(result==PokerTournamentTableBalance420.Result.WAIT_HAND&&h.revision()==r&&h.readTable(3).mask==mask);}
    function testNoOptionalRedrawAfterClosure()public{breakable();h.breakTable(SEED,h.revision());reject(abi.encodeCall(h.breakTable,(SEED,h.revision())));}
    function testConsolidatesToOneFinalTable()public{setup(9,2,10);zeroSeat(2,0);h.breakTable(SEED,h.revision());require(h.size()==1&&h.players()==9);}
    function testNewAdmissionUsesFreeCapacityAndFreshReceipt()public{setup(9,2,10);h.admit(99,99,1,PokerTournamentTableBalance420.Purchase.NEW_PLAYER,SEED,h.revision());require(h.person(99).seated&&h.players()==11);reject(abi.encodeCall(h.admit,(uint256(100),uint64(99),uint64(1),PokerTournamentTableBalance420.Purchase.NEW_PLAYER,SEED,h.revision())));}
    function testReentryIncrementsGenerationCarriesObligations()public{setup(9,2,10);h.simulatedHistory(1,7,2);zero(1);h.admit(1,99,2,PokerTournamentTableBalance420.Purchase.RE_ENTRY,SEED,h.revision());require(h.person(1).generation==2&&h.person(1).blindHistory==7&&h.person(1).blindObligations==2&&h.person(1).chips==1000);}
    function testRebuyRetainsGenerationAndStartingStack()public{setup(9,2,10);zero(1);h.admit(1,99,2,PokerTournamentTableBalance420.Purchase.REBUY,SEED,h.revision());require(h.person(1).generation==1&&h.person(1).chips==1000);}
    function testActiveStackCannotReenter()public{setup(9,2,10);reject(abi.encodeCall(h.admit,(uint256(1),uint64(99),uint64(2),PokerTournamentTableBalance420.Purchase.RE_ENTRY,SEED,h.revision())));}
    function testRemovedIdentityCannotMasqueradeAsNewPlayer()public{setup(9,2,10);zero(1);reject(abi.encodeCall(h.admit,(uint256(1),uint64(99),uint64(2),PokerTournamentTableBalance420.Purchase.NEW_PLAYER,SEED,h.revision())));}
    function testFuzzWorstSeatNeverSmallBlind(uint16 input,uint8 b)public view{
        uint16 mask=(input%511)+1;uint8 button=b%9;mask|=uint16(1)<<button;(bool found,uint8 seat)=h.worst(mask,button,9);
        if(found){require((mask&(uint16(1)<<seat))==0);uint16 nextMask=mask|(uint16(1)<<seat);uint8 count;for(uint8 i;i<9;i++)if((nextMask&(uint16(1)<<i))!=0)count++;
            uint8 sb=button;if(count>2)for(uint8 j=1;j<=9;j++){uint8 k=uint8((uint256(button)+j)%9);if((nextMask&(uint16(1)<<k))!=0){sb=k;break;}}require(seat!=sb);
        }
    }
    function testFuzzInitialDistributionWithinOne(uint8 input,uint8 c)public{uint8 cap=3+c%7;uint32 count=2+uint32(input)%70;uint32 tables=(count+cap-1)/cap;setup(cap,tables,count);(uint8 lo,uint8 hi,,)=h.bounds();require(hi<=lo+1&&hi<=cap&&lo>=2);}
}
