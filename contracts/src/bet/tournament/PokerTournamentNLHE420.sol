// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../PokerNLHEStorage420.sol";
import "../PokerNLHEModuleFactories420.sol";
import "./PokerTournamentAdmission420.sol";

/// @notice Native NLHE authority with fixed, code-hash-pinned implementation
/// modules. All views read this engine's storage. Mutations execute atomically
/// in this same context; no controller can select or replace a module.
contract PokerTournamentNLHE420 is PokerNLHEStorage420 {
    address public immutable admissionModule;
    bytes32 public immutable admissionModuleCodeHash;
    address public immutable playModule;
    bytes32 public immutable playModuleCodeHash;
    address public immutable custodyModule;
    bytes32 public immutable custodyModuleCodeHash;
    address public immutable settlementModule;
    bytes32 public immutable settlementModuleCodeHash;
    constructor(address d,address s,address k,address c) PokerNLHEStorage420(d,s,k,c) {
        admissionModule=PokerTournamentAdmissionFactory420.deploy(d,s,k,c,address(this));
        if(PokerNLHEModule420(admissionModule).host()!=address(this))revert InvalidConfiguration();
        admissionModuleCodeHash=admissionModule.codehash;
        playModule=PokerNLHEPlayFactory420.deploy(d,s,k,c,address(this));
        if(PokerNLHEModule420(playModule).host()!=address(this))revert InvalidConfiguration();
        playModuleCodeHash=playModule.codehash;
        custodyModule=PokerNLHECustodyFactory420.deploy(d,s,k,c,address(this));
        if(PokerNLHEModule420(custodyModule).host()!=address(this))revert InvalidConfiguration();
        custodyModuleCodeHash=custodyModule.codehash;
        settlementModule=PokerNLHESettlementFactory420.deploy(d,s,k,c,address(this));
        if(PokerNLHEModule420(settlementModule).host()!=address(this))revert InvalidConfiguration();
        settlementModuleCodeHash=settlementModule.codehash;
    }
    function bindTurnPolicy(bytes32 tableId,uint32 secondsPerTurn) external {
        _delegate(admissionModule,admissionModuleCodeHash);
    }
    function prepareDealAssignment(bytes32 handId) external {
        _delegate(admissionModule,admissionModuleCodeHash);
    }
    function start(bytes32 handId,uint256 ante,uint32 timeoutSecs) external {
        _delegate(admissionModule,admissionModuleCodeHash);
    }
    function action(bytes32 handId,uint8 seat,Move move,uint256 chips,
        uint64 expiry,bytes32 expectedRoot,bytes calldata signature) external {
        _delegate(playModule,playModuleCodeHash);
    }
    function timeout(bytes32 handId) external {
        _delegate(playModule,playModuleCodeHash);
    }
    function advanceRevealedStreet(bytes32 handId,uint8 street)external {
        _delegate(playModule,playModuleCodeHash);
    }
    function reserve(bytes32 handId) external {
        _delegate(custodyModule,custodyModuleCodeHash);
    }
    function cancelUnavailableStart(bytes32 handId) external {
        _delegate(custodyModule,custodyModuleCodeHash);
    }
    function cancelWithheldDeal(bytes32 handId) external {
        _delegate(custodyModule,custodyModuleCodeHash);
    }
    function cancelWithheldDelivery(bytes32 handId) external {
        _delegate(custodyModule,custodyModuleCodeHash);
    }
    function beginMissingEvidenceRecovery(bytes32 handId) external {
        _delegate(custodyModule,custodyModuleCodeHash);
    }
    function finalizeMissingEvidenceRecovery(bytes32 handId) external {
        _delegate(custodyModule,custodyModuleCodeHash);
    }
    function bindReveals(bytes32 tableId,address gate) external {
        _delegate(settlementModule,settlementModuleCodeHash);
    }
    function bindDelivery(bytes32 tableId,address gate) external {
        _delegate(settlementModule,settlementModuleCodeHash);
    }
    function bindOutcome(bytes32 tableId,address calculator) external {
        _delegate(settlementModule,settlementModuleCodeHash);
    }
    function bindProviderBond(bytes32 tableId,address bond)external {
        _delegate(settlementModule,settlementModuleCodeHash);
    }
    function settle(bytes32 handId,PokerCanonicalRake420.Policy calldata policy) external {
        _delegate(settlementModule,settlementModuleCodeHash);
    }
    function proposeDisputeResolution(bytes32 handId,
        PokerCanonicalRake420.Policy calldata policy) external {
        _delegate(settlementModule,settlementModuleCodeHash);
    }
    function _delegate(address target,bytes32 expectedCodeHash) private {
        if(target.codehash!=expectedCodeHash||expectedCodeHash==bytes32(0))revert InvalidState();
        assembly ("memory-safe") {
            let ptr:=mload(0x40)
            calldatacopy(ptr,0,calldatasize())
            let ok:=delegatecall(gas(),target,ptr,calldatasize(),0,0)
            returndatacopy(ptr,0,returndatasize())
            if iszero(ok){revert(ptr,returndatasize())}
            return(ptr,returndatasize())
        }
    }
    function revealForTable(bytes32 id) external view returns(IPokerAuthenticatedStreet420){return _layout().revealForTable[id];}

    function lastButton(bytes32 id) external view returns(uint8){return _layout().lastButton[id];}

    function lastBigBlind(bytes32 id) external view returns(uint8){return _layout().lastBigBlind[id];}

    function hasButton(bytes32 id) external view returns(bool){return _layout().hasButton[id];}

    function turnSecondsForTable(bytes32 id) external view returns(uint32){return _layout().turnSecondsForTable[id];}

    function turnPolicyForHand(bytes32 id) external view returns(bytes32){return _layout().turnPolicyForHand[id];}

    function flopOpened(bytes32 id) external view returns(bool){return _layout().flopOpened[id];}

    function settlementReceipt(bytes32 id)external view returns(SettlementReceipt memory){
        return _layout().settlementReceipts[id];
    }

    function handSettled(bytes32 id) external view returns(bool){return _layout().handSettled[id];}

    function handAborted(bytes32 id) external view returns(bool){return _layout().handAborted[id];}

    function bondForTable(bytes32 id) external view returns(PokerProviderAccountability420){return _layout().bondForTable[id];}

    function evidenceDueAt(bytes32 id) external view returns(uint64){return _layout().evidenceDueAt[id];}

    function fundedEvidenceDeadline(bytes32 id) external view returns(uint64){return _layout().fundedEvidenceDeadline[id];}

    function fundedSnapshot(bytes32 id) external view returns(bytes32){return _layout().fundedSnapshot[id];}

    function recoveryStageMask(bytes32 id) external view returns(uint16){return _layout().recoveryStageMask[id];}

    function evidenceRecovery(bytes32 id) external view returns(uint64 openedAt,uint64 finalizableAt,bytes32 stateRoot,Phase failedPhase,bool active){
        EvidenceRecovery storage r=_layout().evidenceRecovery[id];
        return(r.openedAt,r.finalizableAt,r.stateRoot,r.failedPhase,r.active);
    }

    function preparedDeal(bytes32 id) external view returns(uint8 button,uint16 mask,uint64 epoch,bytes32 seatSnapshot,bool ready){
        PreparedDeal storage r=_layout().preparedDeal[id];
        return(r.button,r.mask,r.epoch,r.seatSnapshot,r.ready);
    }

    function outcomeForTable(bytes32 id) external view returns(address){return _layout().outcomeForTable[id];}

    function outcomeCodeHash(bytes32 id) external view returns(bytes32){return _layout().outcomeCodeHash[id];}

    function terminalTranscript(bytes32 id) external view returns(bytes32){return _layout().terminalTranscript[id];}

    function actionTranscriptRoot(bytes32 id) external view returns(bytes32){return _layout().actionTranscriptRoot[id];}

    function deliveryForTable(bytes32 id) external view returns(PokerDeckDisclosure420){return _layout().deliveryForTable[id];}

    function turnPolicyHash(bytes32 tableId) public view returns(bytes32){return _turnPolicyHash(tableId);}

    function isHandInitialized(bytes32 handId) external view returns(bool){return _layout().games[handId].initialized;}

    function gameOf(bytes32 handId) external view returns(Game memory){return _layout().games[handId];}

    function playerOf(bytes32 handId,uint8 seat) external view returns(Player memory){return _layout().players[handId][seat];}

    function turnOf(bytes32 handId) external view returns(Turn memory t){
        Game storage g=_layout().games[handId];
        t.seat=type(uint8).max;t.nonce=g.nonce+1;t.deadline=g.deadline;t.stateRoot=g.stateRoot;
        if(!g.initialized||!_isBetting(g.phase)||g.pendingMask==0||_layout().handSettled[handId]||
           _layout().handAborted[handId]||ledger.activeHand(g.tableId)!=handId)return t;
        t.seat=g.toAct;
        PokerSeatLedger420.Seat memory s=ledger.seatOf(g.tableId,t.seat);t.player=s.player;
        uint64 signerEpoch;uint64 signerSerial;
        (t.signer,signerEpoch,signerSerial)=keys.keys(g.tableId,s.player);
        if(signerSerial<1||signerEpoch<s.epoch||signerEpoch>s.epoch)t.signer=address(0);
        t.canTimeout=block.timestamp>g.deadline;
        Player storage p=_layout().players[handId][t.seat];
        uint256 owed=g.currentBet>p.bet?g.currentBet-p.bet:0;
        t.callChips=owed<p.stack?owed:p.stack;t.maximumRaiseChips=p.stack;
        bool overflow=owed>type(uint256).max-g.minRaise;
        t.minimumRaiseChips=overflow?type(uint256).max:owed+g.minRaise;
        t.shortAllInOnly=overflow||t.minimumRaiseChips>p.stack;
        if(t.canTimeout||!_actionAuthorized(g.tableId,t.seat))return t;
        t.allowedMoves=uint8(1)<<uint8(Move.FOLD);
        t.allowedMoves|=owed==0?uint8(1)<<uint8(Move.CHECK):uint8(1)<<uint8(Move.CALL);
        if(_liveToAct(handId,g.seatsMask)>=2&&p.stack>owed&&
           (!p.acted||g.currentBet-p.lastFacing>=g.minRaise))
            t.allowedMoves|=uint8(1)<<uint8(Move.RAISE);
    }

    function holeSeatForPosition(bytes32 handId,uint8 pos) external view returns(uint8){
        PreparedDeal memory a=_layout().preparedDeal[handId];
        if(!a.ready)revert InvalidState();
        uint8 n=0;
        for(uint8 i=0;i<9;i++)if(_participates(a.mask,i))n++;
        if(n<2||pos>=2*n)revert InvalidState();
        uint8 seat=n==2?a.button:_nextSeat(a.mask,a.button);
        for(uint8 i=0;i<pos%n;i++)seat=_nextSeat(a.mask,seat);
        return seat;
    }

    function canRevealStreet(bytes32 handId,uint8 street)external view returns(bool){
        Game storage g=_layout().games[handId];
        if(!g.initialized||_layout().handAborted[handId]||_layout().handSettled[handId]||ledger.activeHand(g.tableId)!=handId)return false;
        Phase phase=g.phase;
        if(street<1||street>4)return false;
        uint8 expected=street<2?uint8(Phase.AWAIT_FLOP):
            street<3?uint8(Phase.AWAIT_TURN):
            street<4?uint8(Phase.AWAIT_RIVER):uint8(Phase.SHOWDOWN);
        // Exact phase gating expressed as a closed interval, never broadened.
        return uint8(phase)>=expected&&uint8(phase)<=expected;
    }

}
