// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../PokerNLHEModules420.sol";
interface ITournamentButton420 {function button(bytes32)external view returns(uint8);}
contract PokerTournamentAdmission420 is PokerNLHEModule420 {
    constructor(address d,address s,address k,address c,address h) PokerNLHEModule420(d,s,k,c,h) {}
    function bindTurnPolicy(bytes32 tableId,uint32 secondsPerTurn) external onlyHost {
        PokerTableRegistry420.Table memory table=deals.tables().getTable(tableId);
        if(!table.exists||table.config.rulesetId!=deals.tables().RULESET())revert InvalidConfiguration();
        if(secondsPerTurn<30||secondsPerTurn>3600||_layout().turnSecondsForTable[tableId]!=0||
           ledger.activeHand(tableId)!=bytes32(0)||_layout().hasButton[tableId])revert InvalidConfiguration();
        if(!authorization.isAuthorized(msg.sender,ACTION_BIND_TURN_POLICY,
            authorization.scopeForTable(tableId),0))revert Unauthorized();
        if(disputes.resolverForTable(tableId)!=address(this))revert InvalidConfiguration();
        _layout().turnSecondsForTable[tableId]=secondsPerTurn;
        disputes.bindTurnEngine(tableId);
        emit TurnPolicyBound(tableId,secondsPerTurn,_turnPolicyHash(tableId));
    }

    function prepareDealAssignment(bytes32 handId) external onlyHost {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        uint16 mask=deals.handSeatMask(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED||
           !shuffle.isProofComplete(handId)||_layout().preparedDeal[handId].ready||
           ledger.activeHand(h.tableId)!=handId||mask==0||
           ledger.seatingEpoch(h.tableId)!=h.epoch||
           deals.snapshotFor(h.tableId,mask)!=h.seatSnapshotHash)
           revert InvalidState();
        uint8 button=ITournamentButton420(address(ledger)).button(h.tableId);
        _layout().preparedDeal[handId]=PreparedDeal(button,mask,h.epoch,h.seatSnapshotHash,true);
        emit DealAssignmentPrepared(handId,button,mask,h.seatSnapshotHash);
    }

    function start(bytes32 handId,uint256 ante,uint32 timeoutSecs) external onlyHost {
        if(msg.sender!=address(ledger))revert Unauthorized();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED||
           !shuffle.isProofComplete(handId)||timeoutSecs!=_layout().turnSecondsForTable[h.tableId]||timeoutSecs==0||ante!=0)
            revert InvalidState();
        if(!_admissionAvailable(handId))revert Unauthorized();
        if(address(_layout().deliveryForTable[h.tableId])==address(0)||
           !_layout().deliveryForTable[h.tableId].allAcknowledged(handId))revert InvalidState();
        Game storage g=_layout().games[handId];
        if(g.initialized||ledger.activeHand(h.tableId)!=handId||
           ledger.seatingEpoch(h.tableId)!=h.epoch||
           h.seatSnapshotHash!=deals.snapshotFor(h.tableId,deals.handSeatMask(handId)))
            revert InvalidState();
        PokerTableRegistry420.Table memory t=deals.tables().getTable(h.tableId);
        uint16 mask=deals.handSeatMask(handId);
        PreparedDeal memory assigned=_layout().preparedDeal[handId];
        if(!assigned.ready||assigned.mask!=mask||assigned.epoch!=h.epoch||
           assigned.seatSnapshot!=h.seatSnapshotHash)revert InvalidState();
        uint8 button=assigned.button;
        uint8 canonical=ITournamentButton420(address(ledger)).button(h.tableId);
        if(button!=canonical)revert InvalidState();
        _layout().hasButton[h.tableId]=true;
        _layout().lastButton[h.tableId]=button;
        g.tableId=h.tableId;g.seatsMask=mask;g.actionTimeout=timeoutSecs;
        g.initialized=true;
        for(uint8 i;i<9;i++)if(_participates(mask,i)){
            PokerSeatLedger420.Seat memory seat=ledger.seatOf(h.tableId,i);
            if(seat.player==address(0)||seat.sittingOut||seat.chips==0)revert InvalidState();
            _layout().players[handId][i].stack=seat.chips;g.initialChips+=seat.chips;
        }
        g.stateRoot=keccak256(abi.encode(STATE_DOMAIN,block.chainid,address(this),handId,
            h.tableId,h.rulesetId,h.configHash,h.seatSnapshotHash,mask,g.initialChips,_layout().turnPolicyForHand[handId]));
        bytes32 abuseRoot=ledger.abuseAdmission(handId);
        if(abuseRoot!=bytes32(0))g.stateRoot=keccak256(abi.encode(g.stateRoot,keccak256("420.BET.POKER.ABUSE.ADMISSION.V1"),abuseRoot));
        _postBlinds(handId,g,button,t.config.smallBlind,t.config.bigBlind);
        _layout().lastBigBlind[h.tableId]=g.bigBlindSeat;
        _commitTurn(handId,g);
        emit HandStarted(handId,button,g.smallBlindSeat,g.bigBlindSeat);
    }

}

library PokerTournamentAdmissionFactory420 {
    function deploy(address d,address s,address k,address c,address host)external returns(address){return address(new PokerTournamentAdmission420(d,s,k,c,host));}
}
