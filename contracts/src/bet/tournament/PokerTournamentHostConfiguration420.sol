// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentHostAdmission420.sol";
contract PokerTournamentHostConfiguration420 is PokerTournamentHostModule420 {
using PokerTournamentStandings420 for PokerTournamentStandings420.Book;
constructor(address e,address b,address x,address h)PokerTournamentHostModule420(e,b,x,h){}
    function bindEngine(address engine_)external onlyHost guarded {
        _cap(0,CONFIGURE);State storage s=_state();if(s.engine!=address(0)||escrow.createdEvents()!=0||engine_.code.length==0)revert Invalid();
        PokerTournamentNLHE420 engine=PokerTournamentNLHE420(engine_);
        if(address(engine.ledger())!=address(this)||address(engine.deals().tables())!=address(this))revert Invalid();
        s.engine=engine_;s.engineCodeHash=engine_.codehash;s.deals=address(engine.deals());
    }
    function bindEntropy(address entropy_)external onlyHost guarded {
        _cap(0,CONFIGURE);State storage s=_state();if(s.entropy!=address(0)||escrow.createdEvents()!=0||entropy_.code.length==0||ITournamentRoundEntropy420(entropy_).host()!=address(this))revert Invalid();
        s.entropy=entropy_;s.entropyCodeHash=entropy_.codehash;
    }
    function bindEvent(bytes32 id,address assignments,bytes32 profile,uint32 entropyTimeout,uint32 turnSeconds)external onlyHost guarded {
        _cap(id,CONFIGURE);_engine();ITournamentRoundEntropy420 source=_entropy();State storage s=_state();Event storage e=s.events[id];
        PokerTournamentRuntimeEscrow420.EventAccount memory a=escrow.eventOf(id);PokerTournamentPolicy420.Config memory c=_config(id);
        PokerTournamentAssignments420 draw=PokerTournamentAssignments420(assignments);
        if(e.phase!=Phase.NONE||a.funder!=msg.sender||a.receipts!=0||a.state!=PokerTournamentRuntimeEscrow420.State.REGISTRATION||block.timestamp>=c.registrationOpens||escrow.gameplayHost()!=address(this)||
            address(draw.book())!=address(book)||address(draw.escrow())!=address(escrow)||draw.eventOf(id).stage!=PokerTournamentAssignments420.Stage.BOUND||entropyTimeout<30||entropyTimeout>3600||turnSeconds<30||turnSeconds>3600)revert Invalid();
        PokerTournamentTableBalance420.validate(c.seatsPerTable,c.maxTables,c.maxPlayers,c.multiTable);
        if(uint256(c.startingStack)*c.maxPlayers*(uint256(c.extraCap)+1)>type(uint128).max)revert Invalid();
        e.phase=Phase.BOUND;e.assignments=assignments;e.assignmentCodeHash=assignments.codehash;e.profile=profile;e.profileHash=source.configuration(profile);e.entropyTimeout=entropyTimeout;e.turnSeconds=turnSeconds;e.manifest=a.manifest;
        e.context=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,a.manifest,book.boundManifest(id),assignments,draw.eventOf(id).purpose,s.engine,s.engineCodeHash,s.entropy,s.entropyCodeHash,profile,e.profileHash,entropyTimeout,turnSeconds,keccak256("ALL_ROUNDS_SYNCHRONIZED.LOCAL_TIERS_TIE.NO_REDRAW.V1")));
        PokerTournamentStructure420.Level[] memory levels=book.levelsOf(book.eventStructure(id));for(uint256 i;i<levels.length;i++)e.levels.push(levels[i]);
        s.standings[id].initialize(e.context);
        for(uint32 i=1;i<=c.maxTables;i++)s.tableRefs[tableId(id,i)]=TableRef(id,i,false);
        emit Bound(id,e.context,assignments);
    }
    function configureTable(bytes32 id,uint32 table,address delivery,address proofBook,address reveals,address outcome,address bond)external onlyHost guarded {
        _cap(id,CONFIGURE);State storage s=_state();Event storage e=s.events[id];bytes32 key=tableId(id,table);TableRef storage t=s.tableRefs[key];
        bytes32 bundle=keccak256(abi.encode(delivery,proofBook,reveals,outcome,bond));
        bool initial=e.phase==Phase.BOUND&&block.timestamp<_config(id).registrationOpens;
        bool additional=e.phase==Phase.READY&&table==s.seating[id].lastTable+1&&s.seating[id].open.length<s.seating[id].maxTables&&e.hands.activeCount==0;
        if((!initial&&!additional)||t.configured||(e.bundleHash!=0&&e.bundleHash!=bundle))revert Invalid();
        if(t.eventId==0){if(!additional)revert Invalid();s.tableRefs[key]=TableRef(id,table,false);}else if(t.eventId!=id)revert Invalid();
        e.bundleHash=bundle;
        PokerTournamentNLHE420 engine=_engine();engine.disputes().bindResolver(key,address(engine));engine.bindTurnPolicy(key,e.turnSeconds);engine.bindProviderBond(key,bond);
        PokerDeckDisclosure420(delivery).bindProofBook(key,proofBook);
        engine.bindDelivery(key,delivery);engine.bindReveals(key,reveals);engine.bindOutcome(key,outcome);t.configured=true;
    }
}
