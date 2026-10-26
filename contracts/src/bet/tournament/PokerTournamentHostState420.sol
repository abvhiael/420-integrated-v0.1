// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentRuntimeEscrow420.sol";
import "./PokerTournamentAssignments420.sol";
import "./PokerTournamentStandings420.sol";
import "./PokerTournamentNLHE420.sol";

interface ITournamentRoundEntropy420 {
    function prepare(bytes32)external;
    function freeze(bytes32)external;
    function request(bytes32,bytes32,bytes32,uint32)external returns(bytes32);
    function result(bytes32)external view returns(bytes32);
    function configuration(bytes32)external view returns(bytes32);
    function host()external view returns(address);
    function expired(bytes32)external view returns(bool);
    function preparationExpired(bytes32)external view returns(bool);
}
abstract contract PokerTournamentHostState420 {
    using PokerTournamentTableBalance420 for PokerTournamentTableBalance420.Layout;
    using PokerTournamentStandings420 for PokerTournamentStandings420.Book;
    using PokerTournamentStructure420 for PokerTournamentStructure420.Clock;
    using PokerTournamentStructure420 for PokerTournamentStructure420.Hands;
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.HOST.V1");
    bytes32 public constant RULESET=keccak256("420.BET.POKER.NLHE.TOURNAMENT.V1");
    bytes32 public constant CONFIGURE=keccak256("BET_POKER_TOURNAMENT_HOST_CONFIGURE.V1");
    bytes32 public constant PAUSE=keccak256("BET_POKER_TOURNAMENT_HOST_PAUSE.V1");
    PokerTournamentRuntimeEscrow420 public immutable escrow;
    PokerTournamentStructureBook420 public immutable book;
    BetAuthorization420 public immutable authorization;
    BetOperatorRegistry420 public immutable operators;
    BetEmergencyState420 public immutable emergency;
    enum Phase {NONE,BOUND,LOADING,READY,PREPARING,PLAYING,PROCESSING,DRAWING,BALANCING,FINISHING,COMPLETE,PAUSED,RECOVERY_REQUIRED}
    struct Event {
        Phase phase;bytes32 context;bytes32 manifest;address assignments;bytes32 assignmentCodeHash;
        bytes32 assignmentRoot;bytes32 initialSeed;bytes32 profile;bytes32 profileHash;uint32 entropyTimeout;
        uint32 loaded;uint32 round;uint32 expected;uint32 resolved;uint32 processCursor;uint32 rootCursor;bytes32 roundRoot;bytes32 purpose;bytes32 drawRequest;bytes32 drawSeed;
        uint32 turnSeconds;uint256 issuedChips;bool started;bool finalTable;uint32 finalTableId;
        bytes32 bundleHash;
        PokerTournamentStructure420.Clock clock;PokerTournamentStructure420.Hands hands;
        PokerTournamentStructure420.Level[] levels;
    }
    struct TableRef {bytes32 eventId;uint32 id;bool configured;}
    struct Plan {bytes32 hand;uint32 round;uint16 level;uint128 smallBlind;uint128 bigBlind;bool resolved;}
    struct Frozen {
        bytes32 eventId;bytes32 table;uint32 round;uint16 mask;uint64 epoch;bytes32 snapshot;
        bytes32[9] people;uint256[9] initialChips;uint256 total;bool reserved;bool settled;bool aborted;bytes32 admission;
    }
    struct State {
        address engine;bytes32 engineCodeHash;address deals;address entropy;bytes32 entropyCodeHash;bool entered;bool ledgerEntered;
        mapping(bytes32=>Event) events;mapping(bytes32=>PokerTournamentTableBalance420.Layout) seating;
        mapping(bytes32=>PokerTournamentStandings420.Book) standings;mapping(bytes32=>TableRef) tableRefs;
        mapping(bytes32=>Plan) plans;mapping(bytes32=>Frozen) frozen;
        mapping(bytes32=>uint64) seatVersion;
        mapping(bytes32=>bytes32) activeHand;mapping(bytes32=>bool) consumed;
        mapping(bytes32=>mapping(bytes32=>bytes32)) subject;mapping(bytes32=>mapping(bytes32=>bytes32)) credential;
        mapping(bytes32=>mapping(bytes32=>bool)) timedOut;
        mapping(bytes32=>mapping(address=>bytes32)) actorPerson;
    }
    bytes32 private constant SLOT=keccak256("420.bet.tournament.host.state.v1");
    function _state()internal pure returns(State storage s){bytes32 slot=SLOT;assembly("memory-safe"){s.slot:=slot}}
    error Invalid();error Unauthorized();error WrongPhase();error Locked();error Reentrancy();
    event Bound(bytes32 indexed eventId,bytes32 context,address assignments);
    event HandPlanned(bytes32 indexed eventId,bytes32 indexed hand,bytes32 table,uint32 round,uint16 level,uint128 smallBlind,uint128 bigBlind);
    event HandObserved(bytes32 indexed eventId,bytes32 indexed hand,uint32 round,bytes32 terminalTranscript);
    event RoundClosed(bytes32 indexed eventId,uint32 round,bytes32 canonicalRoot,uint32 remaining);
    event FinalTable(bytes32 indexed eventId,uint32 table,uint32 players);
    event TournamentComplete(bytes32 indexed eventId,bytes32 champion,bytes32 standingsRoot);
    event RecoveryRequired(bytes32 indexed eventId,bytes32 hand);
    constructor(address escrow_,address book_,address emergency_){
        if(escrow_.code.length==0||book_.code.length==0||emergency_.code.length==0)revert Invalid();
        escrow=PokerTournamentRuntimeEscrow420(escrow_);book=PokerTournamentStructureBook420(book_);authorization=escrow.authorization();operators=escrow.policies().operators();emergency=BetEmergencyState420(emergency_);
        if(address(book.escrow())!=escrow_||address(book.policies())!=address(escrow.policies()))revert Invalid();
    }
    modifier guarded(){State storage s=_state();if(s.entered||s.ledgerEntered)revert Reentrancy();s.entered=true;_;s.entered=false;}
    function scope(bytes32 eventId)public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),eventId));}
    function tableId(bytes32 eventId,uint32 id)public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),eventId,id));}
    function _cap(bytes32 eventId,bytes32 action)internal view {if(!authorization.isAuthorized(msg.sender,action,scope(eventId),0))revert Unauthorized();}
    function _engine()internal view returns(PokerTournamentNLHE420 e){State storage s=_state();if(s.engine==address(0)||s.engine.codehash!=s.engineCodeHash)revert Invalid();return PokerTournamentNLHE420(s.engine);}
    function _onlyEngine()internal view {if(msg.sender!=address(_engine()))revert Unauthorized();}
    function _entropy()internal view returns(ITournamentRoundEntropy420 e){State storage s=_state();if(s.entropy==address(0)||s.entropy.codehash!=s.entropyCodeHash)revert Invalid();return ITournamentRoundEntropy420(s.entropy);}
    function _config(bytes32 id)internal view returns(PokerTournamentPolicy420.Config memory){return escrow.configOf(id);}
    function _person(bytes32 table,uint8 seat)internal view returns(bytes32){TableRef storage t=_state().tableRefs[table];return _state().seating[t.eventId].seats[t.id][seat];}
    function _seat(bytes32 table,uint8 seat)internal view returns(PokerSeatLedger420.Seat memory v){
        if(seat>=9)return v;State storage s=_state();TableRef storage t=s.tableRefs[table];bytes32 person=s.seating[t.eventId].seats[t.id][seat];
        if(person==0)return v;PokerTournamentTableBalance420.Player storage p=s.seating[t.eventId].people[person];
        return PokerSeatLedger420.Seat(p.payer,p.chips,false,p.placementEpoch);
    }
    function _table(bytes32 key)internal view returns(PokerTableRegistry420.Table memory t){
        State storage s=_state();TableRef storage ref=s.tableRefs[key];Event storage e=s.events[ref.eventId];
        if(ref.eventId==0||e.context==0)revert Invalid();PokerTournamentPolicy420.Config memory c=_config(ref.eventId);Plan storage p=s.plans[key];
        uint128 sb=p.smallBlind;uint128 bb=p.bigBlind;if(sb==0){sb=e.levels[0].smallBlind;bb=e.levels[0].bigBlind;}
        bytes32 rakeHash=keccak256(abi.encode(keccak256("420.BET.POKER.RAKE.POLICY.V1"),uint16(0),uint256(0),true,true));
        t.config=PokerTableRegistry420.Configuration(key,c.gameVersion,RULESET,c.operatorId,ref.eventId,rakeHash,e.manifest,escrow.asset(),c.seatsPerTable,sb,bb,bb,uint256(c.startingStack)*c.maxPlayers,0);
        t.configHash=keccak256(abi.encode(DOMAIN,block.chainid,address(this),e.context,t.config,p.round,p.level));t.controller=address(this);t.exists=true;t.createdAt=c.registrationOpens;
        t.status=e.phase==Phase.PAUSED||e.phase==Phase.RECOVERY_REQUIRED?PokerTableRegistry420.Status.PAUSED:PokerTableRegistry420.Status.OPEN;
        if(e.phase==Phase.COMPLETE||e.phase==Phase.FINISHING||(s.seating[ref.eventId].context!=0&&!s.seating[ref.eventId].active[ref.id]))t.status=PokerTableRegistry420.Status.CLOSED;
    }
    function _level(bytes32 id)internal view returns(uint16){Event storage e=_state().events[id];return e.clock.state==PokerTournamentStructure420.State.NONE?1:PokerTournamentStructure420.at(e.levels,e.clock.elapsed(block.timestamp)).level;}
    function _eligible(bytes32 table,uint8 seat)internal view returns(bool){
        State storage s=_state();TableRef storage t=s.tableRefs[table];Event storage e=s.events[t.eventId];
        if(seat>=9||e.phase!=Phase.PLAYING||s.plans[table].round!=e.round||!s.seating[t.eventId].active[t.id])return false;
        bytes32 person=_person(table,seat);PokerTournamentTableBalance420.Player storage p=s.seating[t.eventId].people[person];
        if(person==0||!p.seated||p.chips==0||s.standings[t.eventId].byPerson[person].status!=PokerTournamentStandings420.Status.ACTIVE)return false;
        try escrow.personKey(s.subject[t.eventId][person],s.credential[t.eventId][person],p.payer)returns(bytes32 key){return key==person;}catch{return false;}
    }
}
