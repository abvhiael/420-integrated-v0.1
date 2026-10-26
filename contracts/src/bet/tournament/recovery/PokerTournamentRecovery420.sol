// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../settlement/PokerTournamentPrizeEscrow420.sol";
import "../PokerTournamentRoundEntropy420.sol";

/// @notice Restartable, permissionless orchestration over canonical tournament authorities.
/// @dev No custody, arbitrary calls, privilege, outcome vectors, deadlines or replacement seeds.
contract PokerTournamentRecovery420 {
    bytes32 public constant DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.RECOVERY.V1");
    PokerTournamentPrizeEscrow420 public immutable bank;
    PokerTournamentPrizeHost420 public immutable host;
    PokerTournamentNLHE420 public immutable engine;
    PokerTournamentRoundEntropy420 public immutable entropy;
    bytes32 public immutable bankHash;
    bytes32 public immutable hostHash;
    bytes32 public immutable engineHash;
    bytes32 public immutable entropyHash;
    enum Action {OBSERVE_ENTROPY,OBSERVE_PAUSE,CANCEL_DEAL,CANCEL_DELIVERY,OPEN_EVIDENCE,FINALIZE_EVIDENCE,TIMEOUT,SETTLE,CHECKPOINT,DRAIN_QUEUE,EXPIRE_CHOICES,BEGIN_REFUND,REFUND_CHUNK,BEGIN_PRIZES,LOAD_PRIZES,ALLOCATE_PRIZES,CLAIM_PRIZES,TICK,REFUND_UNSTARTED}
    error Invalid(); error Stale();
    event Advanced(bytes32 indexed eventId,Action action,bytes32 beforeState,bytes32 afterState,uint32 nextCursor);
    constructor(address b){
        if(b.code.length==0)revert Invalid();
        bank=PokerTournamentPrizeEscrow420(b);host=PokerTournamentPrizeHost420(bank.gameplayHost());
        if(address(host).code.length==0||address(host.escrow())!=b||address(host).codehash!=bank.hostCodeHash())revert Invalid();
        engine=PokerTournamentNLHE420(host.nativeEngine());entropy=PokerTournamentRoundEntropy420(host.roundEntropy());
        if(address(engine).code.length==0||address(entropy).code.length==0||address(engine).codehash!=host.nativeEngineCodeHash()||entropy.host()!=address(host))revert Invalid();
        bankHash=b.codehash;hostHash=address(host).codehash;engineHash=address(engine).codehash;entropyHash=address(entropy).codehash;
    }
    function _identities()private view{
        if(address(bank).codehash!=bankHash||address(host).codehash!=hostHash||address(engine).codehash!=engineHash||address(entropy).codehash!=entropyHash||bank.gameplayHost()!=address(host)||host.nativeEngine()!=address(engine)||host.roundEntropy()!=address(entropy))revert Invalid();
    }
    /// @notice Canonical checkpoint, independent of keeper storage and observation time.
    /// Hand actions additionally bind the selected hand's state root; targets recheck all deadlines.
    function snapshot(bytes32 id,uint32 table)public view returns(bytes32){
        _identities();PokerTournamentPurchaseEscrowState420.EventAccount memory e=bank.eventOf(id);
        (,,,,bytes32 context,,)=host.eventState(id);if(e.manifest==0)revert Invalid();
        bytes32 hand=bytes32(0);
        if(table!=0){if(table>bank.configOf(id).maxTables)revert Invalid();hand=host.financialHand(id,table);}
        bytes32 handState=hand==0?bytes32(0):_handState(hand);
        return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,e,context,_phase(id),_finance(id),_facts(id),host.queuedHead(id),handState));
    }
    function _handState(bytes32 hand)private view returns(bytes32){
        (uint64 opened,uint64 at_,bytes32 root,PokerNLHEStorage420.Phase phase,bool active)=engine.evidenceRecovery(hand);
        return keccak256(abi.encode(hand,engine.gameOf(hand),opened,at_,root,phase,active,engine.handSettled(hand),engine.handAborted(hand)));
    }
    function _phase(bytes32 id)private view returns(bytes32){(PokerTournamentHostState420.Phase p,uint32 r,uint32 expected,uint32 resolved,,uint256 chips,bool started)=host.eventState(id);return keccak256(abi.encode(p,r,expected,resolved,chips,started));}
    function _finance(bytes32 id)private view returns(bytes32){(bool ok,bytes memory data)=address(bank).staticcall(abi.encodeCall(bank.financialState,(id)));if(!ok)revert Invalid();return keccak256(data);}
    function _facts(bytes32 id)private view returns(bytes32){(uint32 active,uint32 pending,uint32 queued,uint64 anchor)=host.financialFacts(id);(,,,,,,bytes32 root,uint32 cursor,uint32 unique)=host.standingsState(id);return keccak256(abi.encode(active,pending,queued,anchor,root,cursor,unique));}
    function _hand(bytes32 id,uint32 table)private view returns(bytes32 hand){if(table==0||table>bank.configOf(id).maxTables)revert Invalid();hand=host.financialHand(id,table);PokerTournamentHostState420.Frozen memory f=host.frozenHand(hand);if(hand==0||f.eventId!=id||f.table!=host.tableId(id,table)||!f.reserved)revert Invalid();}
    function _limit(uint32 value,uint32 maximum)private pure{if(value==0||value>maximum)revert Invalid();}
    function advance(bytes32 id,bytes32 expected,Action action,uint32 table,uint32 cursor,uint32 limit)external returns(uint32 next){
        bytes32 beforeState=snapshot(id,table);if(expected!=beforeState)revert Stale();
        if(uint8(action)<=uint8(Action.SETTLE)&&uint8(action)>=uint8(Action.CANCEL_DEAL)){
            if(cursor!=0||limit!=0)revert Invalid();bytes32 hand=_hand(id,table);
            if(action==Action.CANCEL_DEAL)engine.cancelWithheldDeal(hand);
            else if(action==Action.CANCEL_DELIVERY)engine.cancelWithheldDelivery(hand);
            else if(action==Action.OPEN_EVIDENCE)engine.beginMissingEvidenceRecovery(hand);
            else if(action==Action.FINALIZE_EVIDENCE)engine.finalizeMissingEvidenceRecovery(hand);
            else if(action==Action.TIMEOUT)engine.timeout(hand);
            else engine.settle(hand,PokerCanonicalRake420.Policy(0,0,true,true));
        }else{
            if(table!=0)revert Invalid();
            if(action==Action.DRAIN_QUEUE){_limit(limit,16);_recovery(id);if(cursor!=0)revert Invalid();for(uint32 n;n<limit;n++){uint64 head=host.queuedHead(id);if(head==0)break;bank.refundUnseated(id,head);}}
            else if(action==Action.EXPIRE_CHOICES){_limit(limit,16);_recovery(id);(,,,,,,,,uint32 unique)=host.standingsState(id);if(cursor>=unique)revert Invalid();next=cursor;for(uint32 n;n<limit&&next<unique;n++){bytes32 person=host.standingsPersonAt(id,next++);(PokerTournamentStandings420.Person memory p,,)=host.standing(id,person);if(p.status==PokerTournamentStandings420.Status.REBUY_PENDING&&block.timestamp>=p.rebuyUntil)host.expireRebuy(id,person);}}
            else if(action==Action.REFUND_CHUNK){_limit(limit,32);if(cursor!=0)revert Invalid();bank.processRefunds(id,limit);}
            else if(action==Action.LOAD_PRIZES){_limit(limit,16);if(cursor!=0)revert Invalid();bank.loadPrizes(id,limit);}
            else if(action==Action.ALLOCATE_PRIZES){_limit(limit,4);if(cursor!=0)revert Invalid();bank.allocatePrizes(id,limit);}
            else if(action==Action.CLAIM_PRIZES){_limit(limit,16);(,,,,,,,,uint32 unique)=host.standingsState(id);if(cursor>=unique)revert Invalid();next=cursor;for(uint32 n;n<limit&&next<unique;n++){bytes32 person=host.standingsPersonAt(id,next++);if(!bank.prizeRow(id,person).claimed)bank.claimPrize(id,person);}}
            else if(action==Action.REFUND_UNSTARTED){_limit(limit,16);if(bank.started(id))revert Invalid();uint64 count=bank.eventOf(id).receipts;if(cursor>=count)revert Invalid();next=cursor;for(uint32 n;n<limit&&next<count;n++){uint64 index=uint64(++next);if(!bank.entryOf(id,index).refunded)bank.refundCancelled(id,index);}}
            else{
                if(cursor!=0||limit!=0)revert Invalid();
                if(action==Action.OBSERVE_ENTROPY)host.requireEntropyRecovery(id);
                else if(action==Action.OBSERVE_PAUSE){host.observePause(id);_recovery(id);}
                else if(action==Action.CHECKPOINT)bank.checkpointRecovery(id);
                else if(action==Action.BEGIN_REFUND)bank.beginFullRefund(id);
                else if(action==Action.BEGIN_PRIZES)bank.beginPrizes(id);
                else if(action==Action.TICK)bank.tick(id);
                else revert Invalid();
            }
        }
        emit Advanced(id,action,beforeState,snapshot(id,table),next);
    }
    function _recovery(bytes32 id)private view{(PokerTournamentHostState420.Phase p,,,,,,)=host.eventState(id);if(p!=PokerTournamentHostState420.Phase.RECOVERY_REQUIRED)revert Invalid();}
}
