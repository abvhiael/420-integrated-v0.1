// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerActionKeys420.sol";
import "./PokerNLHEBetting420.sol";
import "./PokerPrivateShuffleGate420.sol";
import "./PokerActionDisputeClock420.sol";
import "./PokerCanonicalRake420.sol";
import "./PokerDeckDisclosure420.sol";
import "./PokerProviderAccountability420.sol";
import "./PokerDeliveryProofBook420.sol";

interface IPokerNativeOutcome420 {
    function engine() external view returns(address);
    function reveals() external view returns(address);
    function rakeEngine() external view returns(address);
    function calculate(bytes32 handId,PokerCanonicalRake420.Policy calldata policy)
        external view returns(uint256[9] memory finalChips,uint256 fee);
}
interface IPokerAuthenticatedStreet420 {
    function engine() external view returns(PokerNLHEBetting420);
    function isStageComplete(bytes32 handId,uint8 street) external view returns(bool);
}

/// @notice Native on-chain NLHE betting state machine. No controller can insert
/// arbitrary stacks, skip a betting transition, reopen an illegal underraise,
/// or choose the player to act. Settlement must consume these stored values.
/// @dev Does not itself implement seven-card hand ranking or finalize funds.
///      The latter MUST run against cryptographically authenticated revelations.
interface IPokerMissingShareEvidence420 {
    function missingProviders(bytes32 handId,uint8 street)external view returns(uint8);
}
abstract contract PokerNLHEStorage420 {
    bytes32 public constant ACTION_DOMAIN=keccak256("420.BET.POKER.NLHE.AUTHENTICATED.ACTION.V1");
    bytes32 public constant STATE_DOMAIN=keccak256("420.BET.POKER.NLHE.STATE.V1");
    bytes32 public constant TRANSCRIPT_DOMAIN=keccak256("420.BET.POKER.NLHE.INDEPENDENT.REPLAY.V1");
    bytes32 public constant ACTION_BIND_DELIVERY=keccak256("BET_POKER_BIND_PRIVATE_DELIVERY.V1");
    bytes32 public constant ACTION_BIND_OUTCOME=keccak256("BET_POKER_BIND_CANONICAL_OUTCOME.V1");
    bytes32 public constant ACTION_BIND_REVEALS=keccak256("BET_POKER_BIND_REVEAL_ENGINE.V1");

    enum Phase {NONE,PREFLOP,AWAIT_FLOP,FLOP,AWAIT_TURN,TURN,AWAIT_RIVER,RIVER,SHOWDOWN,UNCONTESTED}
    enum Move {FOLD,CHECK,CALL,RAISE}
    struct Player {
        uint256 stack;
        uint256 bet;
        uint256 contributed;
        uint256 lastFacing;
        bool acted;
        bool folded;
        bool allIn;
    }
    struct Game {
        bytes32 tableId;
        bytes32 stateRoot;
        uint16 seatsMask;
        uint16 pendingMask;
        uint8 button;
        uint8 smallBlindSeat;
        uint8 bigBlindSeat;
        uint8 toAct;
        uint64 nonce;
        uint64 deadline;
        uint32 actionTimeout;
        uint256 currentBet;
        uint256 minRaise;
        uint256 initialChips;
        uint256 pot;
        Phase phase;
        bool initialized;
    }
    struct Turn {
        uint8 seat;
        address player;
        address signer;
        uint64 nonce;
        uint64 deadline;
        bytes32 stateRoot;
        uint256 callChips;
        uint256 minimumRaiseChips;
        uint256 maximumRaiseChips;
        uint8 allowedMoves;
        bool shortAllInOnly;
        bool canTimeout;
    }
    PokerConfidentialDeal420 public immutable deals;
    PokerSeatLedger420 public immutable ledger;
    PokerPrivateShuffleGate420 public immutable shuffle;
    PokerActionKeys420 public immutable keys;
    PokerActionDisputeClock420 public immutable disputes;
    BetAuthorization420 public immutable authorization;
    bytes32 public constant ACTION_BIND_TURN_POLICY=keccak256("BET_POKER_BIND_TURN_POLICY.V1");
    bytes32 public constant TURN_POLICY_DOMAIN=keccak256("420.BET.POKER.NLHE.TURN.POLICY.V1");
    event TurnPolicyBound(bytes32 indexed tableId,uint32 secondsPerTurn,bytes32 policyHash);
    event TurnCommitted(bytes32 indexed handId,uint64 nextNonce,uint8 seat,uint64 deadline,bytes32 stateRoot,bool active);
    bytes32 public constant ACTION_BIND_PROVIDER_BOND=
        keccak256("BET_POKER_BIND_PROVIDER_ACCOUNTABILITY.V1");
    event ProviderBondBound(bytes32 indexed tableId,address bond);

    // The active funded-hand escrow snapshot and initial evidence window are
    // captured at reservation, before any provider can delay a proof.
    // Exactly one bounded recovery review per canonical missing-proof phase.
    // Later stages may open their own windows after genuine late correction.
    event MissingEvidenceRecoveryCorrected(bytes32 indexed handId,uint8 failedPhase);
    struct EvidenceRecovery {uint64 openedAt;uint64 finalizableAt;bytes32 stateRoot;Phase failedPhase;bool active;}
    uint64 public constant PROOF_DELIVERY_WINDOW=1 hours;
    uint64 public constant RECOVERY_REVIEW_WINDOW=2 days+1 hours;
    event MissingEvidenceRecoveryOpened(bytes32 indexed handId,uint8 phase,bytes32 stateRoot,uint64 finalizableAt);
    event MissingEvidenceRecoveryVoided(bytes32 indexed handId,bytes32 indexed tableId);
    event UnverifiedDeliveryAborted(bytes32 indexed handId,bytes32 indexed tableId);

    struct PreparedDeal {uint8 button;uint16 mask;uint64 epoch;bytes32 seatSnapshot;bool ready;}
    event DealAssignmentPrepared(bytes32 indexed handId,uint8 button,uint16 seatMask,bytes32 seatSnapshot);

    event SignedActionEvidence(bytes32 indexed handId,uint64 nonce,uint8 seat,
        bytes32 priorStateRoot,bytes32 signerDigest,uint64 expiry,bytes signature);
    event TimeoutActionEvidence(bytes32 indexed handId,uint64 nonce,uint8 seat,
        bytes32 priorStateRoot,uint64 actionDeadline);
    event TerminalTranscriptSealed(bytes32 indexed handId,bytes32 transcriptHash);
    event DeliveryBound(bytes32 indexed tableId,address gate);
    event OutcomeBound(bytes32 indexed tableId,address outcome);
    event NativeHandSettled(bytes32 indexed handId,bytes32 indexed tableId,uint256 rake);
    event UnprovedDealAborted(bytes32 indexed handId,bytes32 indexed tableId);

    error InvalidConfiguration();error InvalidState();error WrongTurn();
    error Unauthorized();error InvalidAction();error Expired();error WaitingForReveal();
    event HandStarted(bytes32 indexed handId,uint8 button,uint8 smallBlindSeat,uint8 bigBlindSeat);
    event NLHEAction(bytes32 indexed handId,uint64 nonce,uint8 seat,Move action,uint256 chips,bytes32 stateRoot);
    event NLHETimeout(bytes32 indexed handId,uint8 indexed seat,uint64 nonce,Move autoAction);
    event StreetOpened(bytes32 indexed handId,uint8 street);
    event RevealsBound(address indexed gate);


    error TooEarly();
    bytes32 public constant RESOLUTION_DOMAIN=keccak256("420.BET.POKER.NATIVE.RESOLUTION.V1");
    struct SettlementReceipt {
        bytes32 tableId;
        bytes32 stateRoot;
        bytes32 actionRoot;
        bytes32 escrowSnapshot;
        bytes32 calculatorCodeHash;
        bytes32 terminalTranscript;
        uint256[9] finalChips;
        uint256 rake;
        uint64 actionNonce;
        uint64 settledAt;
        uint16 seatsMask;
        bool contested;
    }
    event SettlementReceiptRecorded(bytes32 indexed handId,bytes32 indexed transcript,
        uint256[9] finalChips,uint256 rake);
    /// @custom:storage-location erc7201:420.bet.poker.nlhe
    struct Layout {
        mapping(bytes32=>IPokerAuthenticatedStreet420) revealForTable;
        mapping(bytes32=>Game) games;
        mapping(bytes32=>mapping(uint8=>Player)) players;
        mapping(bytes32=>uint8) lastButton;
        mapping(bytes32=>uint8) lastBigBlind;
        mapping(bytes32=>bool) hasButton;
        mapping(bytes32=>uint32) turnSecondsForTable;
        mapping(bytes32=>bytes32) turnPolicyForHand;
        mapping(bytes32=>bool) flopOpened;
        mapping(bytes32=>bool) handSettled;
        mapping(bytes32=>bool) handAborted;
        mapping(bytes32=>PokerProviderAccountability420) bondForTable;
        mapping(bytes32=>uint64) evidenceDueAt;
        mapping(bytes32=>uint64) fundedEvidenceDeadline;
        mapping(bytes32=>bytes32) fundedSnapshot;
        mapping(bytes32=>uint16) recoveryStageMask;
        mapping(bytes32=>EvidenceRecovery) evidenceRecovery;
        mapping(bytes32=>PreparedDeal) preparedDeal;
        mapping(bytes32=>address) outcomeForTable;
        mapping(bytes32=>bytes32) outcomeCodeHash;
        mapping(bytes32=>bytes32) terminalTranscript;
        mapping(bytes32=>bytes32) actionTranscriptRoot;
        mapping(bytes32=>PokerDeckDisclosure420) deliveryForTable;
        mapping(bytes32=>SettlementReceipt) settlementReceipts;
    }
    /// @dev Identical immutable dependency and funded-state admission for both
    /// direct settlement and a disputed native outcome proposal.
    function _checkedOutcome(bytes32 handId)internal view returns(address calculator){
        Game storage g=_layout().games[handId];
        calculator=_layout().outcomeForTable[g.tableId];
        if(!g.initialized||_layout().handSettled[handId]||_layout().handAborted[handId]||
           (g.phase!=Phase.SHOWDOWN&&g.phase!=Phase.UNCONTESTED)||
           calculator==address(0)||address(_layout().revealForTable[g.tableId])==address(0)||
           ledger.activeHand(g.tableId)!=handId||
           _layout().fundedSnapshot[handId]==bytes32(0)||
           ledger.lockedSnapshot(g.tableId)!=_layout().fundedSnapshot[handId]||
           ledger.lockedMask(g.tableId)!=g.seatsMask||
           _layout().outcomeCodeHash[g.tableId]==bytes32(0)||
           calculator.codehash!=_layout().outcomeCodeHash[g.tableId])revert InvalidState();
    }
    function _recordSettlement(bytes32 handId,Game storage g,uint256[9] memory balances,uint256 fee)internal {
        SettlementReceipt storage r=_layout().settlementReceipts[handId];
        r.tableId=g.tableId;r.stateRoot=g.stateRoot;
        r.actionRoot=_layout().actionTranscriptRoot[handId];
        r.escrowSnapshot=_layout().fundedSnapshot[handId];
        r.calculatorCodeHash=_layout().outcomeCodeHash[g.tableId];
        r.terminalTranscript=_layout().terminalTranscript[handId];
        r.finalChips=balances;r.rake=fee;r.actionNonce=g.nonce;
        r.settledAt=uint64(block.timestamp);r.seatsMask=g.seatsMask;
        r.contested=g.phase==Phase.SHOWDOWN;
        emit SettlementReceiptRecorded(handId,r.terminalTranscript,balances,fee);
    }
    bytes32 internal constant STATE_STORAGE_LOCATION=0xc82808a11c315da0b37d34e330c3c1512e3c74004acb522adf12173c8e40f200;
    function _layout() internal pure returns(Layout storage state) {
        bytes32 position=STATE_STORAGE_LOCATION;
        assembly ("memory-safe") {state.slot:=position}
    }






















    constructor(address deals_,address shuffle_,address keys_,address disputes_) {
        if(deals_==address(0)||shuffle_==address(0)||keys_==address(0)||disputes_==address(0))
            revert InvalidConfiguration();
        deals=PokerConfidentialDeal420(deals_);
        ledger=deals.ledger();
        shuffle=PokerPrivateShuffleGate420(shuffle_);
        keys=PokerActionKeys420(keys_);
        disputes=PokerActionDisputeClock420(disputes_);
        authorization=deals.authorization();
        if(address(shuffle.deals())!=deals_||address(keys.deals())!=deals_||
           address(disputes.deals())!=deals_)
            revert InvalidConfiguration();
    }



    function _actionAuthorized(bytes32 tableId,uint8 seat) internal view returns(bool){
        PokerSeatLedger420.Seat memory s=ledger.seatOf(tableId,seat);
        (address signer,uint64 epoch,uint64 serial)=keys.keys(tableId,s.player);
        // A closed interval requires the exact seat epoch, including both stale
        // and future bindings, while avoiding a balance-equality heuristic.
        return s.player!=address(0)&&signer!=address(0)&&serial>0&&epoch>=s.epoch&&epoch<=s.epoch&&
            authorization.isAuthorized(s.player,BetIds420.ACTION_POKER_ACTION,
                authorization.scopeForTable(tableId),0);
    }

    function _admissionAvailable(bytes32 handId) internal view returns(bool){
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        PokerTableRegistry420.Table memory t=deals.tables().getTable(h.tableId);
        if(t.status!=PokerTableRegistry420.Status.OPEN||
           !deals.tables().operators().isActive(t.config.operatorId)||
           deals.tables().emergency().isHalted(BetTypes420.EmergencyDomain.POKER_NEW_HANDS,h.versionId))return false;
        uint16 mask=deals.handSeatMask(handId);
        for(uint8 i;i<9;i++)if(_participates(mask,i)&&!_actionAuthorized(h.tableId,i))return false;
        return true;
    }

    function _assertLive(bytes32 handId,Game storage g) internal view {
        if(_layout().handSettled[handId]||_layout().handAborted[handId]||ledger.handConsumed(handId)||
           ledger.activeHand(g.tableId)!=handId||_layout().fundedSnapshot[handId]==bytes32(0)||
           ledger.lockedSnapshot(g.tableId)!=_layout().fundedSnapshot[handId])revert InvalidState();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED||h.epoch!=ledger.seatingEpoch(g.tableId)||
           h.seatSnapshotHash!=deals.snapshotFor(g.tableId,g.seatsMask))revert InvalidState();
        (uint64 deadline,uint64 nonce,uint8 seat,bytes32 root,bool active)=disputes.nativeTurnOf(handId);
        if(!active||deadline!=g.deadline||nonce!=g.nonce+1||seat!=g.toAct||root!=g.stateRoot)
            revert InvalidState();
    }

    function _commitTurn(bytes32 handId,Game storage g) internal {
        bool active=_isBetting(g.phase)&&g.pendingMask!=0;
        if(!active){g.deadline=0;g.toAct=type(uint8).max;}
        g.stateRoot=keccak256(abi.encode(STATE_DOMAIN,handId,g.stateRoot,
            _layout().turnPolicyForHand[handId],uint8(g.phase),g.toAct,g.deadline,g.nonce,
            g.pendingMask,g.currentBet,g.minRaise,g.pot));
        disputes.syncTurn(handId,g.nonce+1,g.toAct,g.deadline,g.stateRoot,active);
        emit TurnCommitted(handId,g.nonce+1,g.toAct,g.deadline,g.stateRoot,active);
    }

    function _nativeResolutionHash(bytes32 handId,bytes32 stateRoot,
        uint256[9] memory balances,uint256 fee)internal view returns(bytes32){
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        return keccak256(abi.encode(RESOLUTION_DOMAIN,block.chainid,address(this),
            handId,stateRoot,h.seatSnapshotHash,ledger.lockedSnapshot(h.tableId),
            balances,fee));
    }









    function _mask(uint8 seat) internal pure returns(uint16){return uint16(1)<<seat;}

    function _participates(uint16 mask,uint8 i)internal pure returns(bool){return (mask&_mask(i))!=0;}

    function _nextSeat(uint16 mask,uint8 from)internal pure returns(uint8){
        for(uint8 j=1;j<=9;j++){
            uint8 i=uint8((uint256(from)+j)%9);
            if(_participates(mask,i))return i;
        }
        revert InvalidState();
    }

    function _pendingFor(bytes32 handId,uint16 mask)internal view returns(uint16 pending) {
        for(uint8 i=0;i<9;i++)if(_participates(mask,i)){
            Player storage p=_layout().players[handId][i];
            if(!p.folded&&!p.allIn)pending|=_mask(i);
        }
    }

    function _nextToAct(bytes32 handId,uint16 mask,uint8 from)internal view returns(uint8) {
        for(uint8 j=1;j<=9;j++){
            uint8 i=uint8((uint256(from)+j)%9);
            if(_participates(mask,i)){
                Player storage p=_layout().players[handId][i];
                if(!p.folded&&!p.allIn)return i;
            }
        }
        return type(uint8).max;
    }

    function _alive(bytes32 handId,uint16 mask)internal view returns(uint8 count) {
        for(uint8 i=0;i<9;i++)if(_participates(mask,i)&&!_layout().players[handId][i].folded)count++;
    }

    function _liveToAct(bytes32 handId,uint16 mask)internal view returns(uint8 count) {
        for(uint8 i=0;i<9;i++)if(_participates(mask,i)){
            Player storage p=_layout().players[handId][i];if(!p.folded&&!p.allIn)count++;
        }
    }

    function _debit(bytes32 handId,Game storage g,uint8 seat,uint256 amount,bool streetBet)internal {
        Player storage p=_layout().players[handId][seat];
        if(amount>p.stack)revert InvalidAction();
        p.stack-=amount;p.contributed+=amount;g.pot+=amount;
        if(streetBet)p.bet+=amount;
        if(p.stack==0)p.allIn=true;
    }

    function _bond(bytes32 tableId)internal view returns(PokerProviderAccountability420 bond){
        bond=_layout().bondForTable[tableId];
        if(address(bond)==address(0))revert InvalidState();
    }

    function _missingPrivateShareProviders(bytes32 handId,bytes32 tableId)
        internal view returns(uint8 fault){
        PokerDeckDisclosure420 delivery=_layout().deliveryForTable[tableId];
        if(address(delivery)==address(0))return 0;
        IPokerDeliveryProofBook420 abstractBook=delivery.proofBookForTable(tableId);
        if(address(abstractBook)==address(0))return 0;
        uint16 mask=deals.handSeatMask(handId);
        uint8 n=0;for(uint8 i=0;i<9;i++)if(_participates(mask,i))n++;
        if(n<2||n>9)return 0;
        uint32 required=(uint32(1)<<(2*n))-1;
        PokerDeliveryProofBook420 book=PokerDeliveryProofBook420(address(abstractBook));
        if((book.proofMaskOf(handId,0)&required)!=required)fault|=1;
        if((book.proofMaskOf(handId,1)&required)!=required)fault|=2;
    }

    function _missingRequiredEvidence(bytes32 handId,Game storage g)
        internal view returns(bool){
        uint8 stage;
        if(g.phase==Phase.AWAIT_FLOP)stage=1;
        else if(g.phase==Phase.AWAIT_TURN)stage=2;
        else if(g.phase==Phase.AWAIT_RIVER)stage=3;
        else if(g.phase==Phase.SHOWDOWN)stage=4;
        else return false;
        IPokerAuthenticatedStreet420 source=_layout().revealForTable[g.tableId];
        return address(source)==address(0)||!source.isStageComplete(handId,stage);
    }

    function _canonicalButton(bytes32 tableId,uint16 mask) internal view returns(uint8 button){
        button=_layout().hasButton[tableId]?_nextSeat(mask,_layout().lastButton[tableId]):_nextSeat(mask,8);
        uint8 n=0;for(uint8 i;i<9;i++)if(_participates(mask,i))n++;
        // At a three-plus to heads-up transition, do not charge the surviving
        // previous big blind twice merely because the old button left the table.
        if(n==2&&_layout().hasButton[tableId]&&_nextSeat(mask,button)==_layout().lastBigBlind[tableId])
            button=_layout().lastBigBlind[tableId];
    }

    function _postBlinds(bytes32 handId,Game storage g,uint8 button,uint256 smallBlind,uint256 bigBlind) internal {
        uint8 n=0;for(uint8 i;i<9;i++)if(_participates(g.seatsMask,i))n++;
        if(n<2||!_participates(g.seatsMask,button)||bigBlind!=2*smallBlind||smallBlind==0)
            revert InvalidConfiguration();
        uint8 sb=n==2?button:_nextSeat(g.seatsMask,button);
        uint8 bb=_nextSeat(g.seatsMask,sb);
        g.button=button;g.smallBlindSeat=sb;g.bigBlindSeat=bb;
        g.phase=Phase.PREFLOP;g.minRaise=bigBlind;
        _debit(handId,g,sb,smallBlind<_layout().players[handId][sb].stack?smallBlind:_layout().players[handId][sb].stack,true);
        _debit(handId,g,bb,bigBlind<_layout().players[handId][bb].stack?bigBlind:_layout().players[handId][bb].stack,true);
        g.currentBet=bigBlind;g.pendingMask=_pendingFor(handId,g.seatsMask);
        if(_liveToAct(handId,g.seatsMask)<=1){
            // A lone player cannot bet into an empty side pot. They respond only
            // to actual posted chips, not the unmatched nominal short big blind.
            g.currentBet=0;
            for(uint8 i;i<9;i++)if(_participates(g.seatsMask,i)&&_layout().players[handId][i].bet>g.currentBet)
                g.currentBet=_layout().players[handId][i].bet;
            for(uint8 i;i<9;i++)if((g.pendingMask&_mask(i))!=0&&_layout().players[handId][i].bet>=g.currentBet)
                g.pendingMask&=~_mask(i);
        }
        g.toAct=n==2&&(g.pendingMask&_mask(sb))!=0?sb:_nextToAct(handId,g.seatsMask,bb);
        g.deadline=uint64(block.timestamp+g.actionTimeout);
        if(g.pendingMask<1)_endRound(handId,g);
    }



    function _isBetting(Phase phase)internal pure returns(bool){
        return phase==Phase.PREFLOP||phase==Phase.FLOP||
            phase==Phase.TURN||phase==Phase.RIVER;
    }

    function _apply(bytes32 handId,Game storage g,uint8 seat,Move move,uint256 chips)internal {
        Player storage p=_layout().players[handId][seat];
        if(p.folded||p.allIn)revert InvalidAction();
        uint256 owed=g.currentBet>p.bet?g.currentBet-p.bet:0;
        if(move==Move.FOLD){
            if(chips!=0)revert InvalidAction();p.folded=true;
        }else if(move==Move.CHECK){
            if(chips!=0||owed!=0)revert InvalidAction();
        }else if(move==Move.CALL){
            uint256 required=owed>p.stack?p.stack:owed;
            if(owed==0||chips!=required)revert InvalidAction();
            _debit(handId,g,seat,chips,true);
        }else if(move==Move.RAISE){
            if(_liveToAct(handId,g.seatsMask)<2)revert InvalidAction();
            if(chips<=owed||chips>p.stack)revert InvalidAction();
            if(p.acted && g.currentBet-p.lastFacing<g.minRaise)
                revert InvalidAction();
            uint256 increment=p.bet+chips-g.currentBet;
            bool full=increment>=g.minRaise;
            if(!full&&chips!=p.stack)revert InvalidAction();
            _debit(handId,g,seat,chips,true);
            g.currentBet=p.bet;
            if(full){
                g.minRaise=increment;
                g.pendingMask=_pendingFor(handId,g.seatsMask)&~_mask(seat);
            }else{
                for(uint8 i=0;i<9;i++)if(i!=seat&&_participates(g.seatsMask,i)){
                    Player storage other=_layout().players[handId][i];
                    if(!other.folded&&!other.allIn&&other.bet<g.currentBet)
                        g.pendingMask|=_mask(i);
                }
            }
        }else revert InvalidAction();
        p.acted=true;p.lastFacing=g.currentBet;
        g.pendingMask&=~_mask(seat);
        g.nonce++;
        g.stateRoot=keccak256(abi.encode(STATE_DOMAIN,block.chainid,address(this),
            handId,g.stateRoot,g.nonce,seat,move,chips,
            g.currentBet,g.minRaise,g.pot,g.pendingMask,p.stack,p.bet,p.contributed,p.folded,p.allIn));
        if(_alive(handId,g.seatsMask)==1){
            g.phase=Phase.UNCONTESTED;g.pendingMask=0;g.toAct=type(uint8).max;g.deadline=0;
        }else if(g.pendingMask==0)_endRound(handId,g);
        else{
            g.toAct=_nextPending(handId,g.seatsMask,g.pendingMask,seat);
            g.deadline=uint64(block.timestamp+g.actionTimeout);
        }
    }

    function _nextPending(bytes32 handId,uint16 mask,uint16 pending,uint8 from)
        internal pure returns(uint8){
        handId;mask;
        for(uint8 j=1;j<=9;j++){
            uint8 i=uint8((uint256(from)+j)%9);
            if((pending&_mask(i))!=0)return i;
        }
        revert InvalidState();
    }

    function _endRound(bytes32 handId,Game storage g)private{
        g.pendingMask=0;g.toAct=type(uint8).max;g.deadline=0;
        if(g.phase==Phase.PREFLOP)g.phase=Phase.AWAIT_FLOP;
        else if(g.phase==Phase.FLOP)g.phase=Phase.AWAIT_TURN;
        else if(g.phase==Phase.TURN)g.phase=Phase.AWAIT_RIVER;
        else if(g.phase==Phase.RIVER)g.phase=Phase.SHOWDOWN;
        else revert InvalidState();
        g.stateRoot=keccak256(abi.encode(STATE_DOMAIN,handId,g.stateRoot,uint8(g.phase),g.pot));
        _layout().evidenceDueAt[handId]=uint64(block.timestamp+PROOF_DELIVERY_WINDOW);
    }



    function _openBettingStreet(bytes32 handId,Game storage g,uint8 street,uint256 bigBlind) internal {
        g.phase=street==1?Phase.FLOP:street==2?Phase.TURN:Phase.RIVER;
        if(street==1)_layout().flopOpened[handId]=true;
        for(uint8 i=0;i<9;i++)if(_participates(g.seatsMask,i)){
            Player storage p=_layout().players[handId][i];p.bet=0;p.acted=false;p.lastFacing=0;
        }
        g.currentBet=0;
        g.minRaise=bigBlind;
        if(_liveToAct(handId,g.seatsMask)<=1){
            _endRound(handId,g);return;
        }
        g.pendingMask=_pendingFor(handId,g.seatsMask);
        g.toAct=_nextToAct(handId,g.seatsMask,g.button);
        g.deadline=uint64(block.timestamp+g.actionTimeout);
        g.stateRoot=keccak256(abi.encode(STATE_DOMAIN,handId,g.stateRoot,uint8(g.phase)));

    }

    function _turnPolicyHash(bytes32 tableId) internal view returns(bytes32){
        uint32 secondsPerTurn=_layout().turnSecondsForTable[tableId];
        if(secondsPerTurn==0)return bytes32(0);
        return keccak256(abi.encode(TURN_POLICY_DOMAIN,block.chainid,address(this),tableId,secondsPerTurn));
    }
}
