// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPurchaseFactories420.sol";
/// @notice Tournament-only nonredeemable stacks and canonical hand-result authority.
/// @dev Fixed, runtime-pinned modules. No chip cashout, arbitrary result setter, payout or upgrade endpoint.
contract PokerTournamentPurchasesHost420 is PokerTournamentPurchasesState420 {
    address public immutable configurationModule;bytes32 public immutable configurationCodeHash;
    address public immutable admissionModule;bytes32 public immutable admissionCodeHash;
    address public immutable ledgerModule;bytes32 public immutable ledgerCodeHash;
    address public immutable roundsModule;bytes32 public immutable roundsCodeHash;
    address public immutable balanceModule;bytes32 public immutable balanceCodeHash;
    address public immutable purchaseModule;bytes32 public immutable purchaseCodeHash;
    address public immutable chipModule;bytes32 public immutable chipCodeHash;
    address public immutable closureModule;bytes32 public immutable closureCodeHash;
    constructor(address e,address b,address x)PokerTournamentPurchasesState420(e,b,x){
        configurationModule=PokerTournamentPurchasesConfigurationFactory420.deploy(e,b,x,address(this));configurationCodeHash=configurationModule.codehash;
        admissionModule=PokerTournamentHostAdmissionFactory420.deploy(e,b,x,address(this));admissionCodeHash=admissionModule.codehash;
        ledgerModule=PokerTournamentHostLedgerFactory420.deploy(e,b,x,address(this));ledgerCodeHash=ledgerModule.codehash;
        roundsModule=PokerTournamentPurchaseRoundsFactory420.deploy(e,b,x,address(this));roundsCodeHash=roundsModule.codehash;
        balanceModule=PokerTournamentHostBalanceFactory420.deploy(e,b,x,address(this));balanceCodeHash=balanceModule.codehash;
        purchaseModule=PokerTournamentQueuedAdmissionsFactory420.deploy(e,b,x,address(this));purchaseCodeHash=purchaseModule.codehash;
        chipModule=PokerTournamentChipPurchasesFactory420.deploy(e,b,x,address(this));chipCodeHash=chipModule.codehash;
        closureModule=PokerTournamentPurchaseClosureFactory420.deploy(e,b,x,address(this));closureCodeHash=closureModule.codehash;
    }
    function bindEngine(address engine_) external {_delegate(configurationModule,configurationCodeHash);}
    function bindEntropy(address entropy_) external {_delegate(configurationModule,configurationCodeHash);}
    function bindEvent(bytes32 id,address assignments,bytes32 profile,uint32 entropyTimeout,uint32 turnSeconds) external {_delegate(configurationModule,configurationCodeHash);}
    function configureTable(bytes32 id,uint32 table,address delivery,address proofBook,address reveals,address outcome,address bond) external {_delegate(configurationModule,configurationCodeHash);}
    function bootstrap(bytes32 id,uint32 limit) external {_delegate(admissionModule,admissionCodeHash);}
    function reserveHand(bytes32 table,bytes32 hand,uint16 mask,uint64 epoch) external returns(bytes32) {_delegate(ledgerModule,ledgerCodeHash);}
    function settleReservedHand(bytes32 table,bytes32 hand,uint256[9] calldata after_,uint256 rake) external {_delegate(ledgerModule,ledgerCodeHash);}
    function cancelReservedHand(bytes32 table,bytes32 hand) external {_delegate(ledgerModule,ledgerCodeHash);}
    function markTimedOut(bytes32 table,bytes32 hand,uint8 seat) external {_delegate(ledgerModule,ledgerCodeHash);}
    function prepareRound(bytes32 id) external {_delegate(roundsModule,roundsCodeHash);}
    function openRound(bytes32 id) external {_delegate(roundsModule,roundsCodeHash);}
    function beginHand(bytes32 id,uint32 table) external returns(bytes32) {_delegate(roundsModule,roundsCodeHash);}
    function startHand(bytes32 hand) external {_delegate(roundsModule,roundsCodeHash);}
    function expireRebuy(bytes32 id,bytes32 person) external {_delegate(closureModule,closureCodeHash);}
    function processRound(bytes32 id,uint32 limit) external {_delegate(closureModule,closureCodeHash);}
    function finalizeStandings(bytes32 id,uint32 limit) external {_delegate(closureModule,closureCodeHash);}
    function pause(bytes32 id) external {_delegate(closureModule,closureCodeHash);}
    function resume(bytes32 id) external {_delegate(closureModule,closureCodeHash);}
    function observePause(bytes32 id)external{_delegate(closureModule,closureCodeHash);}
    function balance(bytes32 id) external returns(PokerTournamentTableBalance420.Result) {_delegate(balanceModule,balanceCodeHash);}
    function requireEntropyRecovery(bytes32 id) external {_delegate(balanceModule,balanceCodeHash);}
    function acceptPaidRequest(bytes32 id,uint64 receipt)external{_delegate(purchaseModule,purchaseCodeHash);}
    function discardPaidRequest(bytes32 id,uint64 receipt)external{_delegate(purchaseModule,purchaseCodeHash);}
    function resolveRequests(bytes32 id,uint32 limit)external returns(bool){_delegate(purchaseModule,purchaseCodeHash);}
    function resolveAtBarrier(bytes32 id,uint32 limit)external returns(bool){_delegate(purchaseModule,purchaseCodeHash);}
    function activateQueuedRequest(bytes32 id,uint64 receipt)external{_delegate(purchaseModule,purchaseCodeHash);}
    function acceptRebuy(bytes32 id,uint64 receipt)external{_delegate(chipModule,chipCodeHash);}
    function acceptAddOn(bytes32 id,uint64 receipt)external{_delegate(chipModule,chipCodeHash);}
    function openAddOnBreak(bytes32 id)external{_delegate(chipModule,chipCodeHash);}
    function closeAddOnBreak(bytes32 id)external{_delegate(chipModule,chipCodeHash);}
    function ensurePurchaseBoundary(bytes32 id)external returns(bool){_delegate(chipModule,chipCodeHash);}
    function _delegate(address target,bytes32 expected)private {
        if(target.codehash!=expected||expected==0)revert Invalid();
        assembly("memory-safe"){let p:=mload(0x40) calldatacopy(p,0,calldatasize()) let ok:=delegatecall(gas(),target,p,calldatasize(),0,0) returndatacopy(p,0,returndatasize()) if iszero(ok){revert(p,returndatasize())} return(p,returndatasize())}
    }
    function tables()external view returns(PokerTableRegistry420){return PokerTableRegistry420(address(this));}
    function getTable(bytes32 key)external view returns(PokerTableRegistry420.Table memory){return _table(key);}
    function nativeEngine()external view returns(address){return _state().engine;}
    function nativeEngineCodeHash()external view returns(bytes32){return _state().engineCodeHash;}
    function roundEntropy()external view returns(address){return _state().entropy;}
    function seatOf(bytes32 table,uint8 seat)external view returns(PokerSeatLedger420.Seat memory){return _seat(table,seat);}
    function button(bytes32 table)external view returns(uint8){TableRef storage t=_state().tableRefs[table];return _state().seating[t.eventId].tables[t.id].button;}
    function playerSeatPlusOne(bytes32 table,address actor)external view returns(uint8){for(uint8 i;i<9;i++)if(_seat(table,i).player==actor&&actor!=address(0))return i+1;return 0;}
    function seatingEpoch(bytes32 table)external view returns(uint64){return _state().seatVersion[table];}
    function activeHand(bytes32 table)external view returns(bytes32){return _state().activeHand[table];}
    function handConsumed(bytes32 hand)external view returns(bool){return _state().consumed[hand];}
    function settlementCoordinator(bytes32 table)external view returns(address){return _state().tableRefs[table].configured?_state().engine:address(0);}
    function rakeDestination(bytes32)external view returns(address){return escrow.developmentFund();}
    function lockedSnapshot(bytes32 table)external view returns(bytes32){return _state().frozen[_state().activeHand[table]].snapshot;}
    function lockedTotal(bytes32 table)external view returns(uint256){return _state().frozen[_state().activeHand[table]].total;}
    function reservedInHand(bytes32 table)external view returns(uint256){return _state().frozen[_state().activeHand[table]].total;}
    function lockedMask(bytes32 table)external view returns(uint16){return _state().frozen[_state().activeHand[table]].mask;}
    function lockedEpoch(bytes32 table)external view returns(uint64){return _state().frozen[_state().activeHand[table]].epoch;}
    function totalChips(bytes32 table)external view returns(uint256 total){for(uint8 i;i<9;i++)total+=_seat(table,i).chips;}
    function eligibleForNextHand(bytes32 table,uint8 seat)external view returns(bool){return _eligible(table,seat);}
    function checkAbuseParticipants(bytes32 table,uint16 mask)external view {
        TableRef storage t=_state().tableRefs[table];if(mask!=_state().seating[t.eventId].tables[t.id].mask)revert Invalid();
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0&&!_eligible(table,i))revert Unauthorized();
    }
    function noteAbuseDeal(bytes32 table,bytes32 hand)external view {
        State storage s=_state();if(msg.sender!=s.deals||PokerConfidentialDeal420(s.deals).getHand(hand).tableId!=table||s.plans[table].hand!=0)revert Unauthorized();
    }
    function abuseAdmission(bytes32)external pure returns(bytes32){return 0;}
    function genuineStartedHand(bytes32 id,bytes32 hand)external view returns(bool){
        State storage s=_state();Frozen storage f=s.frozen[hand];PokerTournamentNLHE420 engine=_engine();
        return s.events[id].started&&f.eventId==id&&f.reserved&&f.admission==keccak256(abi.encode(DOMAIN,s.events[id].context,hand,f.snapshot))&&engine.gameOf(hand).initialized&&!engine.handAborted(hand)&&s.activeHand[f.table]==hand&&engine.fundedSnapshot(hand)==f.snapshot&&engine.shuffle().isProofComplete(hand);
    }
    function purchaseRiskAllowed(bytes32 id)external view returns(bool){return _risk(id);}
    function purchaseEligibility(bytes32 id,bytes32 person,uint8 kind)external view returns(bool,uint32,uint16){if(kind>uint8(PokerTournamentPurchaseEscrowState420.Kind.ADD_ON))return(false,0,0);return _eligibility(id,person,PokerTournamentPurchaseEscrowState420.Kind(kind));}
    function canRefundRequest(bytes32 id,uint64 receipt)external view returns(bool){return _refundEligible(id,receipt);}
    function extraAllowed(bytes32 id,bytes32 person)external view returns(bool){PokerTournamentPurchaseEscrowState420.Kind k=_config(id).purchaseKind==PokerTournamentPolicy420.PurchaseKind.REBUY?PokerTournamentPurchaseEscrowState420.Kind.REBUY:PokerTournamentPurchaseEscrowState420.Kind.RE_ENTRY;(bool yes,,)=_eligibility(id,person,k);return yes;}
    function lateAllowed(bytes32 id,bytes32 person)external view returns(bool){(bool yes,,)=_eligibility(id,person,PokerTournamentPurchaseEscrowState420.Kind.LATE);return yes;}
    function admittedUniquePlayers(bytes32 id)external view returns(uint32){return _state().events[id].started?uint32(_state().standings[id].people.length):0;}
    function purchaseState(bytes32 id)external view returns(BreakState,uint64,uint64,uint32,bytes32,bool){PurchaseEvent storage p=_purchases().events[id];return(p.breakState,p.openedAt,p.closesAt,p.queue.length,p.purchaseRoot,p.addOn);}
    function purchasePlanOf(bytes32 id)external view returns(bytes32,bytes32,uint32){PurchaseEvent storage p=_purchases().events[id];return(p.plan,p.planDigest,p.window);}
    function addOnClaimed(bytes32 id,bytes32 person)external view returns(bool){return _purchases().events[id].claimed[person];}
    function queuedHead(bytes32 id)external view returns(uint64){return _purchases().events[id].queue.head;}
    function blindPosition(bytes32 id)external view returns(PokerTournamentStructure420.Position memory){Event storage e=_state().events[id];PurchaseEvent storage p=_purchases().events[id];uint256 elapsed=e.clock.state==PokerTournamentStructure420.State.NONE?0:PokerTournamentStructure420.elapsed(e.clock,block.timestamp);if(p.breakState==BreakState.OPEN&&block.timestamp>p.closesAt)elapsed+=block.timestamp-p.closesAt;return PokerTournamentStructure420.at(e.levels,elapsed);}
    function eventState(bytes32 id)external view returns(Phase phase,uint32 round,uint32 expected,uint32 resolved,bytes32 context,uint256 issuedChips,bool started){Event storage e=_state().events[id];return(e.phase,e.round,e.expected,e.resolved,e.context,e.issuedChips,e.started);}
    function eventPurpose(bytes32 id)external view returns(bytes32){return _state().events[id].purpose;}
    function eventDraw(bytes32 id)external view returns(bytes32,bytes32){return(_state().events[id].drawRequest,_state().events[id].drawSeed);}
    function finalTableOf(bytes32 id)external view returns(bool,uint32){bool current=_state().events[id].finalTable&&_state().seating[id].open.length==1;return(current,current?_state().events[id].finalTableId:0);}
    function frozenHand(bytes32 hand)external view returns(Frozen memory){return _state().frozen[hand];}
    function standingsState(bytes32 id)external view returns(uint32 live,uint32 pending,uint32 wave,bool waveOpen,bool finished,bytes32 champion,bytes32 root,uint32 finalCursor,uint32 unique){PokerTournamentStandings420.Book storage b=_state().standings[id];return(b.live,b.pending,b.wave,b.waveOpen,b.finished,b.champion,b.resultRoot,b.finalCursor,uint32(b.people.length));}
    function standing(bytes32 id,bytes32 person)external view returns(PokerTournamentStandings420.Person memory,uint32,uint32){PokerTournamentStandings420.Book storage b=_state().standings[id];return(b.byPerson[person],b.rank[person],b.rankEnd[person]);}
    function standingsPersonAt(bytes32 id,uint32 index)external view returns(bytes32){return _state().standings[id].people[index];}
    function provisionalChipRank(bytes32 id,bytes32 person)external view returns(uint32 first,uint32 last){
        State storage s=_state();if(s.standings[id].byPerson[person].status!=PokerTournamentStandings420.Status.ACTIVE||s.events[id].phase==Phase.COMPLETE)return(0,0);
        uint128 chips=s.seating[id].people[person].chips;if(chips==0)return(0,0);first=1;uint32 tied=0;
        for(uint256 i;i<s.standings[id].people.length;i++){bytes32 other=s.standings[id].people[i];if(s.standings[id].byPerson[other].status!=PokerTournamentStandings420.Status.ACTIVE)continue;uint128 amount=s.seating[id].people[other].chips;if(amount>chips)++first;else if(amount==chips)++tied;}
        return(first,first+tied-1);
    }
    function tournamentPlayer(bytes32 id,bytes32 person)external view returns(PokerTournamentTableBalance420.Player memory){return _state().seating[id].people[person];}
    function tournamentTable(bytes32 id,uint32 table)external view returns(PokerTournamentTableBalance420.Table memory){return _state().seating[id].tables[table];}
    function tournamentTableCount(bytes32 id)external view returns(uint256){return _state().seating[id].open.length;}
    function chipConservation(bytes32 id)external view returns(bool){State storage s=_state();uint256 total=0;for(uint256 i;i<s.standings[id].people.length;i++)total+=s.seating[id].people[s.standings[id].people[i]].chips;return total==s.events[id].issuedChips;}
}
