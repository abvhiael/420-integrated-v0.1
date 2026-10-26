// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentEntryEscrow420.sol";
import "./PokerTournamentStructure420.sol";

/// @notice Frozen tournament structures and real receipt-backed, nonredeemable stack reservations.
/// @dev A reservation is not live-hand admission. This book cannot activate the 5C.2 financial escrow.
contract PokerTournamentStructureBook420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.STRUCTURE.V1");
    bytes32 public constant CREATE=keccak256("BET_POKER_TOURNAMENT_STRUCTURE_CREATE.V1");
    bytes32 public constant APPROVE=keccak256("BET_POKER_TOURNAMENT_STRUCTURE_APPROVE.V1");
    bytes32 public constant PUBLISH=keccak256("BET_POKER_TOURNAMENT_STRUCTURE_PUBLISH.V1");
    bytes32 public constant RETIRE=keccak256("BET_POKER_TOURNAMENT_STRUCTURE_RETIRE.V1");
    bytes32 public constant BIND_POLICY=keccak256("BET_POKER_TOURNAMENT_STRUCTURE_BIND_POLICY.V1");
    bytes32 public constant BIND_EVENT=keccak256("BET_POKER_TOURNAMENT_STRUCTURE_BIND_EVENT.V1");
    bytes32 public constant RESERVE=keccak256("BET_POKER_TOURNAMENT_STACK_RESERVE.V1");
    enum Status { NONE, REGISTERED, APPROVED, PUBLISHED, RETIRED }
    struct Structure { bytes32 digest; bytes32 operatorId; address publisher; uint128 startingStack; uint64 duration; uint16 levelCount; Status status; }
    struct Reservation { bytes32 person; address payer; uint64 receipt; uint64 nonce; uint128 chips; bool released; }
    PokerTournamentPolicyRegistry420 public immutable policies;
    PokerTournamentEntryEscrow420 public immutable escrow;
    BetAuthorization420 public immutable authorization;
    mapping(bytes32=>Structure) private structures;
    mapping(bytes32=>PokerTournamentStructure420.Level[]) private schedules;
    mapping(bytes32=>bytes32) public policyStructure;
    mapping(bytes32=>bytes32) public eventStructure;
    mapping(bytes32=>bytes32) public boundManifest;
    mapping(bytes32=>mapping(uint64=>Reservation)) private reservations;
    mapping(bytes32=>mapping(bytes32=>uint64)) public reservedForPerson;
    mapping(bytes32=>uint256) public reservedChips;
    mapping(bytes32=>uint32) public reservedPlayers;
    error Invalid(); error Unauthorized();
    event Registered(bytes32 indexed id,bytes32 digest,uint128 startingStack,uint16 levelCount);
    event StatusChanged(bytes32 indexed id,Status status);
    event PolicyBound(bytes32 indexed policy,bytes32 indexed structure,bytes32 digest);
    event EventBound(bytes32 indexed id,bytes32 indexed structure,bytes32 manifest);
    event StackReserved(bytes32 indexed id,uint64 indexed receipt,bytes32 person,uint64 nonce,uint128 chips);
    event ReservationReleased(bytes32 indexed id,uint64 indexed receipt,bytes32 person,uint128 chips);

    constructor(address policies_,address escrow_) {
        if(policies_.code.length==0||escrow_.code.length==0)revert Invalid();
        policies=PokerTournamentPolicyRegistry420(policies_);escrow=PokerTournamentEntryEscrow420(escrow_);
        if(address(escrow.policies())!=policies_)revert Invalid();authorization=policies.authorization();
    }
    function scope(bytes32 id,uint8 kind) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),kind,id));}
    function _cap(bytes32 action,bytes32 id,uint8 kind) private view {if(!authorization.isAuthorized(msg.sender,action,scope(id,kind),0))revert Unauthorized();}
    function digest(bytes32 id,bytes32 operatorId,uint128 stack,PokerTournamentStructure420.Level[] calldata levels) public view returns(bytes32){
        return keccak256(abi.encode(DOMAIN,block.chainid,address(this),address(policies),address(escrow),policies.asset(),id,operatorId,stack,levels));
    }
    function register(bytes32 id,bytes32 operatorId,uint128 stack,PokerTournamentStructure420.Level[] calldata levels) external {
        _cap(CREATE,id,0);if(id==0||structures[id].status!=Status.NONE)revert Invalid();
        uint64 duration=PokerTournamentStructure420.validate(stack,levels);
        BetOperatorRegistry420.Operator memory op=policies.operators().getOperator(operatorId);
        if(op.status!=BetOperatorRegistry420.OperatorStatus.ACTIVE||op.operatorAccount!=msg.sender)revert Unauthorized();
        bytes32 h=digest(id,operatorId,stack,levels);
        structures[id]=Structure(h,operatorId,msg.sender,stack,duration,uint16(levels.length),Status.REGISTERED);
        for(uint256 i;i<levels.length;i++)schedules[id].push(levels[i]);
        emit Registered(id,h,stack,uint16(levels.length));
    }
    function approve(bytes32 id) external {_cap(APPROVE,id,0);Structure storage s=structures[id];if(s.status!=Status.REGISTERED)revert Invalid();s.status=Status.APPROVED;emit StatusChanged(id,s.status);}
    function publish(bytes32 id) external {
        _cap(PUBLISH,id,0);Structure storage s=structures[id];
        if(s.status!=Status.APPROVED||s.publisher!=msg.sender||!policies.operators().isActive(s.operatorId))revert Invalid();
        s.status=Status.PUBLISHED;emit StatusChanged(id,s.status);
    }
    function retire(bytes32 id) external {_cap(RETIRE,id,0);Structure storage s=structures[id];if(s.status==Status.NONE||s.status==Status.RETIRED)revert Invalid();s.status=Status.RETIRED;emit StatusChanged(id,s.status);}
    function structureOf(bytes32 id) external view returns(Structure memory){if(structures[id].status==Status.NONE)revert Invalid();return structures[id];}
    function levelsOf(bytes32 id) external view returns(PokerTournamentStructure420.Level[] memory){if(structures[id].status==Status.NONE)revert Invalid();return schedules[id];}
    /// @notice Deterministic preview over effective playing seconds, not an authenticated event clock.
    function levelAt(bytes32 id,uint256 effectiveSeconds) external view returns(PokerTournamentStructure420.Position memory){
        if(structures[id].status==Status.NONE)revert Invalid();return PokerTournamentStructure420.at(schedules[id],effectiveSeconds);
    }
    function bindPolicy(bytes32 policy,bytes32 id) external {
        _cap(BIND_POLICY,policy,1);Structure storage s=structures[id];PokerTournamentPolicyRegistry420.Record memory r=policies.get(policy);
        if(policyStructure[policy]!=0||s.status!=Status.PUBLISHED||!policies.usableForNewEvent(policy)||msg.sender!=r.publisher||
            s.publisher!=r.publisher||s.operatorId!=r.config.operatorId||r.config.startingStack!=s.startingStack||
            r.config.blindSchedule!=s.digest||block.timestamp>=r.config.registrationOpens||r.config.lateLevel>s.levelCount||r.config.extraLevel>s.levelCount)revert Invalid();
        policyStructure[policy]=id;emit PolicyBound(policy,id,s.digest);
    }
    function bindEvent(bytes32 eventId) external {
        _cap(BIND_EVENT,eventId,2);PokerTournamentEntryEscrow420.EventAccount memory e=escrow.eventOf(eventId);
        bytes32 id=policyStructure[e.policy];Structure storage s=structures[id];PokerTournamentPolicy420.Config memory c=escrow.configOf(eventId);
        if(eventStructure[eventId]!=0||id==0||s.status!=Status.PUBLISHED||e.state!=PokerTournamentEntryEscrow420.State.REGISTRATION||
            e.receipts!=0||e.readyAt!=0||e.funder!=msg.sender||block.timestamp>=c.registrationOpens||!policies.usableForNewEvent(e.policy)||
            c.startingStack!=s.startingStack||c.blindSchedule!=s.digest)revert Invalid();
        eventStructure[eventId]=id;boundManifest[eventId]=keccak256(abi.encode(DOMAIN,block.chainid,address(this),eventId,e.manifest,s.digest));
        emit EventBound(eventId,id,boundManifest[eventId]);
    }
    function _live(bytes32 eventId,uint64 receipt) private view returns(bool) {
        PokerTournamentEntryEscrow420.EventAccount memory e=escrow.eventOf(eventId);PokerTournamentEntryEscrow420.Entry memory x=escrow.entryOf(eventId,receipt);
        if(e.state==PokerTournamentEntryEscrow420.State.NONE||e.state==PokerTournamentEntryEscrow420.State.CANCELLED||x.payer==address(0)||x.refunded||escrow.activeReceipt(eventId,x.person)!=receipt)return false;
        PokerTournamentPolicy420.Config memory c=escrow.configOf(eventId);
        if(e.state==PokerTournamentEntryEscrow420.State.STARTING)return block.timestamp<uint256(e.readyAt)+c.technicalGrace;
        if(e.state==PokerTournamentEntryEscrow420.State.REGISTRATION&&c.startKind==PokerTournamentPolicy420.StartKind.SCHEDULED&&
            e.reservedPlayers>=c.minimum&&block.timestamp>=c.startOrRegistrationDeadline)return block.timestamp<uint256(c.startOrRegistrationDeadline)+c.technicalGrace;
        return block.timestamp<uint256(c.startOrRegistrationDeadline)+c.underfillGrace;
    }
    function reserve(bytes32 eventId,uint64 receipt,bytes32 expectedManifest) external {
        _reserve(eventId,receipt,expectedManifest);
    }
    /// @notice Clear a bounded set of genuinely stale projections and reserve atomically.
    function reserveAfterCleanup(bytes32 eventId,uint64 receipt,bytes32 expectedManifest,uint64[] calldata stale) external {
        _cap(RESERVE,eventId,2);if(stale.length>256)revert Invalid();escrow.tick(eventId);
        for(uint256 i;i<stale.length;i++){if(_live(eventId,stale[i]))revert Invalid();_release(eventId,stale[i]);}
        _reserve(eventId,receipt,expectedManifest);
    }
    function _reserve(bytes32 eventId,uint64 receipt,bytes32 expectedManifest) private {
        _cap(RESERVE,eventId,2);bytes32 id=eventStructure[eventId];Structure storage s=structures[id];
        if(id==0||expectedManifest!=boundManifest[eventId]||s.status!=Status.PUBLISHED)revert Invalid();
        escrow.tick(eventId);PokerTournamentEntryEscrow420.Entry memory x=escrow.entryOf(eventId,receipt);
        if(!_live(eventId,receipt)||x.payer!=msg.sender||x.chips!=s.startingStack||reservations[eventId][receipt].receipt!=0)revert Invalid();
        uint64 old=reservedForPerson[eventId][x.person];
        if(old!=0){if(_live(eventId,old))revert Invalid();_release(eventId,old);}
        PokerTournamentEntryEscrow420.EventAccount memory e=escrow.eventOf(eventId);
        if(policies.get(e.policy).status!=PokerTournamentPolicyRegistry420.Status.PUBLISHED||!policies.operators().isActive(s.operatorId)||
            reservedPlayers[eventId]>=escrow.configOf(eventId).maxPlayers)revert Invalid();
        reservations[eventId][receipt]=Reservation(x.person,x.payer,receipt,x.nonce,s.startingStack,false);
        reservedForPerson[eventId][x.person]=receipt;reservedChips[eventId]+=s.startingStack;++reservedPlayers[eventId];
        emit StackReserved(eventId,receipt,x.person,x.nonce,s.startingStack);
    }
    function syncReservation(bytes32 eventId,uint64 receipt) external {
        escrow.tick(eventId);if(_live(eventId,receipt))revert Invalid();_release(eventId,receipt);
    }
    function _release(bytes32 eventId,uint64 receipt) private {
        Reservation storage r=reservations[eventId][receipt];if(r.receipt==0||r.released||reservedForPerson[eventId][r.person]!=receipt)revert Invalid();
        r.released=true;delete reservedForPerson[eventId][r.person];reservedChips[eventId]-=r.chips;--reservedPlayers[eventId];
        emit ReservationReleased(eventId,receipt,r.person,r.chips);
    }
    function reservationOf(bytes32 eventId,uint64 receipt) external view returns(Reservation memory){return reservations[eventId][receipt];}
    function reservationLive(bytes32 eventId,uint64 receipt) external view returns(bool){Reservation storage r=reservations[eventId][receipt];return r.receipt!=0&&!r.released&&_live(eventId,receipt);}
    function acceptsFunds() external pure returns(bool){return false;}
    function liveHandIntegrationEnabled() external pure returns(bool){return false;}
    function ante() external pure returns(uint256){return 0;}
    function freezesBlindClockOnPause() external pure returns(bool){return true;}
}
