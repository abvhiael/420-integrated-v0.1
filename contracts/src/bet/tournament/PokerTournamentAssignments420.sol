// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentStructureBook420.sol";
import "./PokerTournamentSeatingEntropy420.sol";
import "./PokerTournamentTableBalance420.sol";
import {RandomnessRouter420 as SeatingRouter420} from "../../randomness/RandomnessRouter420.sol";
import "../../randomness/RandomnessProfileRegistry420.sol";
import "../../randomness/RandomnessRouteRegistry420.sol";

/// @notice Receipt-backed initial assignments using canonical, genuinely verified commit/reveal.
/// @dev Assignments are not live hand admission. No outcome, movement, stack debit or prize authority.
contract PokerTournamentAssignments420 {
    using PokerTournamentTableBalance420 for PokerTournamentTableBalance420.Layout;
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.ASSIGNMENTS.V1");
    bytes32 public constant BIND=keccak256("BET_POKER_TOURNAMENT_SEATING_BIND.V1");
    uint32 public constant MAX_CHUNK=128;
    PokerTournamentStructureBook420 public immutable book;
    PokerTournamentEntryEscrow420 public immutable escrow;
    SeatingRouter420 public immutable router;
    PokerTournamentSeatingEntropy420 public immutable entropy;
    bytes32 public immutable routerCodeHash;
    bytes32 public immutable verifierCodeHash;
    enum Stage { NONE, BOUND, LOADING, REQUESTED, SHUFFLING, ASSIGNING, READY, VOID }
    struct Event {
        Stage stage;bytes32 profile;bytes32 configuration;bytes32 purpose;bytes32 manifest;
        bytes32 rosterRoot;bytes32 requestId;bytes32 seed;bytes32 proofHash;bytes32 assignmentRoot;
        uint32 timeout;uint64 receiptLimit;uint64 cursor;uint32 shuffleLeft;uint32 assigned;
    }
    mapping(bytes32=>Event) private events_;
    mapping(bytes32=>PokerTournamentEntryEscrow420.Entry[]) private rosters;
    mapping(bytes32=>uint64[]) private receiptIds;
    mapping(bytes32=>uint32[]) private order;
    mapping(bytes32=>mapping(bytes32=>bool)) private included;
    mapping(bytes32=>PokerTournamentTableBalance420.Layout) private layouts;
    error Invalid();error Unauthorized();
    bool private entered;
    modifier guarded(){if(entered)revert Invalid();entered=true;_;entered=false;}
    event Bound(bytes32 indexed id,bytes32 policy,bytes32 purpose);
    event Requested(bytes32 indexed id,bytes32 requestId,bytes32 rosterRoot,uint32 players);
    event Completed(bytes32 indexed id,bytes32 assignmentRoot,bytes32 seed,bytes32 proofHash);
    constructor(address book_,address router_,address entropy_) {
        if(book_.code.length==0||router_.code.length==0||entropy_.code.length==0)revert Invalid();
        book=PokerTournamentStructureBook420(book_);escrow=book.escrow();router=SeatingRouter420(router_);entropy=PokerTournamentSeatingEntropy420(entropy_);
        if(address(entropy.escrow())!=address(escrow)||address(entropy.router())!=router_)revert Invalid();
        routerCodeHash=router_.codehash;verifierCodeHash=entropy_.codehash;
    }
    function scope(bytes32 id) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id));}
    function _codes() private view {if(address(router).codehash!=routerCodeHash||address(entropy).codehash!=verifierCodeHash)revert Invalid();}
    function configuration(bytes32 profile) public view returns(bytes32) {
        RandomnessProfileRegistry420.Profile memory p=router.profileRegistry().profile(profile);
        RandomnessRouteRegistry420.Route memory r=router.routeRegistry().route(p.primaryRoute);
        return keccak256(abi.encode(p,r));
    }
    function policyDigest(bytes32 profile,uint32 timeout) public view returns(bytes32){
        return keccak256(abi.encode(DOMAIN,block.chainid,address(this),address(book),address(escrow),address(router),address(entropy),routerCodeHash,verifierCodeHash,profile,configuration(profile),timeout,uint32(64),MAX_CHUNK));
    }
    function bind(bytes32 id,bytes32 profile,uint32 timeout) external guarded {
        _codes();PokerTournamentEntryEscrow420.EventAccount memory a=escrow.eventOf(id);PokerTournamentPolicy420.Config memory c=escrow.configOf(id);
        if(!book.authorization().isAuthorized(msg.sender,BIND,scope(id),0)||msg.sender!=a.funder)revert Unauthorized();
        PokerTournamentTableBalance420.validate(c.seatsPerTable,c.maxTables,c.maxPlayers,c.multiTable);
        RandomnessProfileRegistry420.Profile memory p=router.profileRegistry().profile(profile);
        RandomnessRouteRegistry420.Route memory r=router.routeRegistry().route(p.primaryRoute);
        if(events_[id].stage!=Stage.NONE||a.state!=PokerTournamentEntryEscrow420.State.REGISTRATION||a.receipts!=0||block.timestamp>=c.registrationOpens||
            book.boundManifest(id)==0||timeout==0||timeout>=c.technicalGrace||timeout>p.maxTimeoutSeconds||!p.active||p.revision==0||p.fallbackPolicy!=RandomnessIds420.FALLBACK_VOID||p.fallbackRoute!=0||
            !r.active||r.revision==0||r.operator!=address(this)||r.verifier!=address(entropy)||r.methodId!=entropy.METHOD()||c.seatingPolicy!=policyDigest(profile,timeout))revert Invalid();
        Event storage e=events_[id];e.stage=Stage.BOUND;e.profile=profile;e.configuration=configuration(profile);e.timeout=timeout;e.manifest=book.boundManifest(id);
        e.purpose=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,a.manifest,e.manifest,c.seatingPolicy));
        entropy.prepare(e.purpose,id);emit Bound(id,c.seatingPolicy,e.purpose);
    }
    function eventOf(bytes32 id) external view returns(Event memory){return events_[id];}
    function rosterCount(bytes32 id) external view returns(uint256){return rosters[id].length;}
    function rosterAt(bytes32 id,uint32 index) external view returns(PokerTournamentEntryEscrow420.Entry memory,uint64,uint32){return(rosters[id][index],receiptIds[id][index],order[id][index]);}
    function player(bytes32 id,bytes32 person) external view returns(PokerTournamentTableBalance420.Player memory){return layouts[id].people[person];}
    function tableOf(bytes32 id,uint32 table) external view returns(PokerTournamentTableBalance420.Table memory){return layouts[id].tables[table];}
    function occupant(bytes32 id,uint32 table,uint8 seat) external view returns(bytes32){return layouts[id].seats[table][seat];}
    function tableCount(bytes32 id) external view returns(uint256){return layouts[id].open.length;}
    function liveHandIntegrationEnabled() external pure returns(bool){return false;}
    function assignmentLive(bytes32 id) external view returns(bool){
        PokerTournamentEntryEscrow420.EventAccount memory a=escrow.eventOf(id);
        return events_[id].stage==Stage.READY&&a.state==PokerTournamentEntryEscrow420.State.STARTING&&block.timestamp<uint256(a.readyAt)+escrow.configOf(id).technicalGrace;
    }
    function _live(bytes32 id) private view {
        _codes();PokerTournamentEntryEscrow420.EventAccount memory a=escrow.eventOf(id);
        if(a.state!=PokerTournamentEntryEscrow420.State.STARTING||block.timestamp>=uint256(a.readyAt)+escrow.configOf(id).technicalGrace||book.boundManifest(id)!=events_[id].manifest)revert Invalid();
    }
    function _chunk(uint32 n) private pure {if(n==0||n>MAX_CHUNK)revert Invalid();}
    function loadRoster(bytes32 id,uint32 limit) external guarded {
        _chunk(limit);escrow.tick(id);_live(id);Event storage e=events_[id];
        PokerTournamentEntryEscrow420.EventAccount memory a=escrow.eventOf(id);PokerTournamentPolicy420.Config memory c=escrow.configOf(id);
        if(e.stage==Stage.BOUND){e.stage=Stage.LOADING;e.receiptLimit=a.receipts;e.rosterRoot=keccak256(abi.encode(DOMAIN,id,a.manifest,e.manifest,a.receipts,a.reservedPlayers));}
        if(e.stage!=Stage.LOADING||a.receipts!=e.receiptLimit)revert Invalid();
        for(uint32 n;n<limit&&e.cursor<e.receiptLimit;n++){
            uint64 receipt=++e.cursor;PokerTournamentEntryEscrow420.Entry memory x=escrow.entryOf(id,receipt);
            if(x.refunded)continue;
            if(x.person==0||x.chips!=c.startingStack||escrow.activeReceipt(id,x.person)!=receipt||included[id][x.person]||x.person==entropy.providerKeys(0)||x.person==entropy.providerKeys(1))revert Invalid();
            included[id][x.person]=true;order[id].push(uint32(rosters[id].length));rosters[id].push(x);receiptIds[id].push(receipt);
            e.rosterRoot=keccak256(abi.encode(e.rosterRoot,receipt,x.person,x.payer,x.nonce,x.chips));
        }
        if(e.cursor==e.receiptLimit){
            if(rosters[id].length!=a.reservedPlayers||rosters[id].length<2||configuration(e.profile)!=e.configuration)revert Invalid();
            uint256 deadline=uint256(a.readyAt)+e.timeout;if(block.timestamp>=deadline||deadline>type(uint64).max)revert Invalid();
            e.requestId=router.requestRandomness(e.profile,RandomnessIds420.DOMAIN_BET,entropy.requestPurpose(e.purpose,e.rosterRoot),uint64(deadline));
            entropy.attachRequest(e.purpose,e.requestId,e.rosterRoot);e.stage=Stage.REQUESTED;
            emit Requested(id,e.requestId,e.rosterRoot,uint32(rosters[id].length));
        }
    }
    /// @notice Any keeper can relay proof; the canonical router executes the genuine verifier.
    function fulfill(bytes32 id,bytes32 word,bytes calldata proof) external guarded {
        _live(id);Event storage e=events_[id];if(e.stage!=Stage.REQUESTED)revert Invalid();router.fulfillRandomness(e.requestId,word,proof);
    }
    function resolve(bytes32 id) external guarded {
        _live(id);Event storage e=events_[id];if(e.stage!=Stage.REQUESTED)revert Invalid();
        (bytes32 word,bytes memory proof)=entropy.proofFor(address(this),e.purpose);router.fulfillRandomness(e.requestId,word,proof);
    }
    function shuffle(bytes32 id,uint32 limit) external guarded {
        _chunk(limit);_live(id);Event storage e=events_[id];
        if(e.stage==Stage.REQUESTED){
            if(router.status(e.requestId)!=IRandomnessRouter420.Status.FULFILLED)revert Invalid();
            (e.seed,e.proofHash)=router.result(e.requestId);if(e.seed==0||e.proofHash==0)revert Invalid();e.shuffleLeft=uint32(order[id].length);e.stage=Stage.SHUFFLING;
        }
        if(e.stage!=Stage.SHUFFLING)revert Invalid();
        bytes32 domain=keccak256(abi.encode(DOMAIN,e.purpose,e.rosterRoot,e.requestId));
        for(uint32 n;n<limit&&e.shuffleLeft>1;n++){
            uint32 i=--e.shuffleLeft;uint32 j=uint32(RandomnessDraw420.boundedUint(e.seed,domain,i,uint256(i)+1));
            (order[id][i],order[id][j])=(order[id][j],order[id][i]);
        }
        if(e.shuffleLeft<=1){
            PokerTournamentPolicy420.Config memory c=escrow.configOf(id);
            layouts[id].initialize(e.purpose,c.seatsPerTable,c.maxTables,c.maxPlayers,c.startingStack,uint32(rosters[id].length));
            e.assignmentRoot=keccak256(abi.encode(DOMAIN,e.rosterRoot,e.seed,e.proofHash));e.stage=Stage.ASSIGNING;
        }
    }
    function assign(bytes32 id,uint32 limit) external guarded {
        _chunk(limit);_live(id);Event storage e=events_[id];if(e.stage!=Stage.ASSIGNING)revert Invalid();
        for(uint32 n;n<limit&&e.assigned<order[id].length;n++){
            uint32 index=e.assigned++;uint32 k=order[id][index];PokerTournamentEntryEscrow420.Entry memory x=rosters[id][k];
            PokerTournamentTableBalance420.Player memory p=PokerTournamentTableBalance420.Player(x.person,x.payer,receiptIds[id][k],x.nonce,uint128(x.chips),0,0,0,0,0,0,false);
            layouts[id].initial(p,index);p=layouts[id].people[p.person];e.assignmentRoot=keccak256(abi.encode(e.assignmentRoot,p));
        }
        if(e.assigned==order[id].length){layouts[id].seal(e.seed);e.stage=Stage.READY;emit Completed(id,e.assignmentRoot,e.seed,e.proofHash);}
    }
    function expire(bytes32 id) external guarded {
        Event storage e=events_[id];if(e.stage==Stage.NONE||e.stage==Stage.VOID)revert Invalid();
        PokerTournamentEntryEscrow420.EventAccount memory a=escrow.eventOf(id);
        bool technical=a.readyAt!=0&&block.timestamp>=uint256(a.readyAt)+escrow.configOf(id).technicalGrace;
        bool unresolved=e.requestId==0||router.status(e.requestId)!=IRandomnessRouter420.Status.FULFILLED;
        bool expired=a.readyAt!=0&&block.timestamp>uint256(a.readyAt)+e.timeout&&unresolved;
        if(!expired&&!technical&&a.state!=PokerTournamentEntryEscrow420.State.CANCELLED)revert Invalid();
        // A completed draw remains historical; no replacement request or redraw is possible.
        if(e.stage==Stage.READY&&a.state!=PokerTournamentEntryEscrow420.State.CANCELLED&&block.timestamp<uint256(a.readyAt)+escrow.configOf(id).technicalGrace)revert Invalid();
        if(e.requestId!=0&&router.status(e.requestId)==IRandomnessRouter420.Status.REQUESTED)router.voidExpired(e.requestId);
        e.stage=Stage.VOID;
    }
}
