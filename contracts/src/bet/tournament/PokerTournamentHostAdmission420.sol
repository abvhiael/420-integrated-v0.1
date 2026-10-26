// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentHostState420.sol";
abstract contract PokerTournamentHostModule420 is PokerTournamentHostState420 {
    address public immutable host;
    constructor(address e,address b,address x,address h)PokerTournamentHostState420(e,b,x){if(h==address(0))revert Invalid();host=h;}
    modifier onlyHost(){if(address(this)!=host)revert Unauthorized();_;}
}
contract PokerTournamentHostAdmission420 is PokerTournamentHostModule420 {
    using PokerTournamentTableBalance420 for PokerTournamentTableBalance420.Layout;
    using PokerTournamentStandings420 for PokerTournamentStandings420.Book;
    constructor(address e,address b,address x,address h)PokerTournamentHostModule420(e,b,x,h){}
    function bootstrap(bytes32 id,uint32 limit)external onlyHost guarded {
        if(limit==0||limit>32)revert Invalid();State storage s=_state();Event storage e=s.events[id];PokerTournamentAssignments420 draw=PokerTournamentAssignments420(e.assignments);
        escrow.tick(id);if(e.assignments.codehash!=e.assignmentCodeHash||!draw.assignmentLive(id)||(e.phase!=Phase.BOUND&&e.phase!=Phase.LOADING))revert Invalid();
        uint32 count=uint32(draw.rosterCount(id));PokerTournamentPolicy420.Config memory c=_config(id);
        if(e.phase==Phase.BOUND){PokerTournamentAssignments420.Event memory a=draw.eventOf(id);e.assignmentRoot=a.assignmentRoot;e.initialSeed=a.seed;e.drawSeed=a.seed;
            s.seating[id].initialize(a.purpose,c.seatsPerTable,c.maxTables,c.maxPlayers,c.startingStack,count);e.phase=Phase.LOADING;}
        for(uint32 n;n<limit&&e.loaded<count;n++){
            uint32 i=e.loaded++;(,,uint32 k)=draw.rosterAt(id,i);(PokerTournamentEntryEscrow420.Entry memory x,uint64 receipt,)=draw.rosterAt(id,k);
            PokerTournamentTableBalance420.Player memory p=draw.player(id,x.person);
            if(p.receipt!=receipt||p.payer!=x.payer||p.nonce!=x.nonce||p.chips!=c.startingStack||!s.tableRefs[tableId(id,p.table)].configured)revert Invalid();
            if(s.actorPerson[id][x.payer]!=0)revert Invalid();s.actorPerson[id][x.payer]=x.person;
            s.seating[id].initial(p,i);s.standings[id].enter(x.person,receipt);s.subject[id][x.person]=x.subject;s.credential[id][x.person]=escrow.receiptCredential(id,receipt);
        }
        if(e.loaded==count){s.seating[id].seal(e.initialSeed);e.issuedChips=uint256(count)*c.startingStack;
            for(uint32 i=1;i<=s.seating[id].open.length;i++){if(s.seating[id].tables[i].button!=draw.tableOf(id,i).button)revert Invalid();s.seatVersion[tableId(id,i)]=1;}
            e.phase=Phase.READY;if(s.seating[id].open.length==1){e.finalTable=true;e.finalTableId=1;emit FinalTable(id,1,count);}}
    }
    function acceptPurchase(bytes32 id,uint64 receipt)external onlyHost guarded {
        if(msg.sender!=address(escrow))revert Unauthorized();State storage s=_state();Event storage e=s.events[id];PokerTournamentPolicy420.Config memory c=_config(id);
        PokerTournamentRuntimeEscrow420.Entry memory x=escrow.entryOf(id,receipt);PokerTournamentTableBalance420.Player storage p=s.seating[id].people[x.person];
        if(x.payer==address(0)||x.refunded||x.chips!=c.startingStack||s.seating[id].consumedReceipt[receipt]||s.seating[id].tables[p.table].busy)revert Invalid();
        if(s.actorPerson[id][x.payer]!=0&&s.actorPerson[id][x.payer]!=x.person)revert Invalid();
        if(s.actorPerson[id][p.payer]==x.person)delete s.actorPerson[id][p.payer];s.actorPerson[id][x.payer]=x.person;
        s.standings[id].restore(x.person,receipt,c,e.clock.startedAt,_level(id),uint64(block.timestamp));
        if(c.purchaseKind==PokerTournamentPolicy420.PurchaseKind.REBUY){
            if(p.chips!=0||!p.seated)revert Invalid();p.chips=c.startingStack;p.payer=x.payer;p.receipt=receipt;p.nonce=x.nonce;++p.placementEpoch;++s.seating[id].tables[p.table].epoch;++s.seating[id].revision;++s.seatVersion[tableId(id,p.table)];s.seating[id].consumedReceipt[receipt]=true;
        }else {
            if(e.phase!=Phase.READY)revert WrongPhase();PokerTournamentTableBalance420.Player memory q=PokerTournamentTableBalance420.Player(x.person,x.payer,receipt,x.nonce,uint128(x.chips),0,0,0,0,0,0,false);
            (uint32 destination,)=s.seating[id].admit(q,PokerTournamentTableBalance420.Purchase.RE_ENTRY,e.drawSeed,s.seating[id].revision);if(!s.tableRefs[tableId(id,destination)].configured)revert Invalid();++s.seatVersion[tableId(id,destination)];e.phase=Phase.BALANCING;
        }
        s.subject[id][x.person]=x.subject;s.credential[id][x.person]=escrow.receiptCredential(id,receipt);e.issuedChips+=c.startingStack;
    }
    function acceptLatePurchase(bytes32 id,uint64 receipt)external onlyHost guarded {
        if(msg.sender!=address(escrow))revert Unauthorized();State storage s=_state();Event storage e=s.events[id];PokerTournamentPolicy420.Config memory c=_config(id);
        PokerTournamentRuntimeEscrow420.Entry memory x=escrow.entryOf(id,receipt);
        if(e.phase!=Phase.READY||s.standings[id].finished||s.standings[id].byPerson[x.person].status!=PokerTournamentStandings420.Status.NONE||s.standings[id].people.length>=c.maxPlayers||s.actorPerson[id][x.payer]!=0||x.refunded||x.chips!=c.startingStack||!PokerTournamentPolicy420.windowOpen(e.clock.startedAt,c.lateDuration,c.lateLevel,_level(id),block.timestamp))revert Invalid();
        s.standings[id].enter(x.person,receipt);PokerTournamentTableBalance420.Player memory p=PokerTournamentTableBalance420.Player(x.person,x.payer,receipt,x.nonce,uint128(x.chips),0,0,0,0,0,0,false);
        (uint32 destination,)=s.seating[id].admit(p,PokerTournamentTableBalance420.Purchase.NEW_PLAYER,e.drawSeed,s.seating[id].revision);if(!s.tableRefs[tableId(id,destination)].configured)revert Invalid();++s.seatVersion[tableId(id,destination)];
        s.actorPerson[id][x.payer]=x.person;s.subject[id][x.person]=x.subject;s.credential[id][x.person]=escrow.receiptCredential(id,receipt);e.issuedChips+=c.startingStack;e.phase=Phase.BALANCING;
    }
}
