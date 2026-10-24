// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerNLHEStorage420.sol";

/// @dev Fixed engine modules share the exact storage declarations. All mutable
/// entries reject direct calls; delegatecall preserves the engine, caller and
/// atomic escrow/dispute authority. There is no upgrade or arbitrary target API.
abstract contract PokerNLHEModule420 is PokerNLHEStorage420 {
    address public immutable host;
    constructor(address d,address s,address k,address c,address h) PokerNLHEStorage420(d,s,k,c) {
        if(h==address(0))revert InvalidConfiguration();host=h;
    }
    modifier onlyHost(){if(address(this)!=host)revert Unauthorized();_;}
}

contract PokerNLHEAdmissionModule420 is PokerNLHEModule420 {
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
        uint8 button=_canonicalButton(h.tableId,mask);
        _layout().preparedDeal[handId]=PreparedDeal(button,mask,h.epoch,h.seatSnapshotHash,true);
        emit DealAssignmentPrepared(handId,button,mask,h.seatSnapshotHash);
    }

    function start(bytes32 handId,uint256 ante,uint32 timeoutSecs) external onlyHost {
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
        uint8 canonical=_canonicalButton(h.tableId,mask);
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
        _postBlinds(handId,g,button,t.config.smallBlind,t.config.bigBlind);
        _layout().lastBigBlind[h.tableId]=g.bigBlindSeat;
        _commitTurn(handId,g);
        emit HandStarted(handId,button,g.smallBlindSeat,g.bigBlindSeat);
    }

}

contract PokerNLHEPlayModule420 is PokerNLHEModule420 {
    constructor(address d,address s,address k,address c,address h) PokerNLHEModule420(d,s,k,c,h) {}
    function action(bytes32 handId,uint8 seat,Move move,uint256 chips,
        uint64 expiry,bytes32 expectedRoot,bytes calldata signature) external onlyHost {
        Game storage g=_layout().games[handId];
        if(!g.initialized || !_isBetting(g.phase))revert InvalidState();
        _assertLive(handId,g);
        if(block.timestamp>g.deadline)revert Expired();
        if(seat!=g.toAct||(g.pendingMask&_mask(seat))==0)revert WrongTurn();
        if(expectedRoot!=g.stateRoot)revert InvalidAction();
        if(!_actionAuthorized(g.tableId,seat))revert Unauthorized();
        bytes32 moveHash=keccak256(abi.encode(ACTION_DOMAIN,handId,uint8(g.phase),
            seat,uint8(move),chips));
        bytes32 digest=keys.checkSignature(handId,seat,g.nonce+1,expectedRoot,moveHash,expiry,signature);
        if(digest==bytes32(0))revert InvalidAction();
        _apply(handId,g,seat,move,chips);
        _commitTurn(handId,g);
        emit NLHEAction(handId,g.nonce,seat,move,chips,g.stateRoot);
        _layout().actionTranscriptRoot[handId]=keccak256(abi.encode(TRANSCRIPT_DOMAIN,
            _layout().actionTranscriptRoot[handId],handId,g.nonce,seat,uint8(move),chips,
            expectedRoot,g.stateRoot,digest,expiry,keccak256(signature)));
        emit SignedActionEvidence(handId,g.nonce,seat,expectedRoot,digest,expiry,signature);
    }

    function timeout(bytes32 handId) external onlyHost {
        Game storage g=_layout().games[handId];
        if(!g.initialized||!_isBetting(g.phase)||g.pendingMask==0)
            revert InvalidState();
        _assertLive(handId,g);
        if(block.timestamp<=g.deadline)revert TooEarly();
        uint8 seat=g.toAct;
        Player storage p=_layout().players[handId][seat];
        Move move=p.bet<g.currentBet?Move.FOLD:Move.CHECK;
        uint64 nonce=g.nonce+1;
        bytes32 prior=g.stateRoot;
        uint64 deadline=g.deadline;
        _apply(handId,g,seat,move,0);
        _commitTurn(handId,g);
        emit NLHEAction(handId,g.nonce,seat,move,0,g.stateRoot);
        _layout().actionTranscriptRoot[handId]=keccak256(abi.encode(TRANSCRIPT_DOMAIN,
            _layout().actionTranscriptRoot[handId],handId,nonce,seat,uint8(move),uint256(0),
            prior,g.stateRoot,bytes32(0),deadline,bytes32(0)));
        emit TimeoutActionEvidence(handId,nonce,seat,prior,deadline);
        emit NLHETimeout(handId,seat,nonce,move);
    }

    function advanceRevealedStreet(bytes32 handId,uint8 street)external onlyHost {
        Game storage g=_layout().games[handId];
        if(msg.sender!=address(_layout().revealForTable[g.tableId])||msg.sender==address(0))revert Unauthorized();
        if(!PokerNLHEBetting420(address(this)).canRevealStreet(handId,street)||
           !_layout().revealForTable[g.tableId].isStageComplete(handId,street))revert WaitingForReveal();
        // Actual accepted late Groth16 shares close this stage's recovery
        // atomically. A later street may still have its OWN one-time review.
        EvidenceRecovery storage recovery=_layout().evidenceRecovery[handId];
        if(recovery.active){
            if(recovery.failedPhase!=g.phase||recovery.stateRoot!=g.stateRoot)
                revert InvalidState();
            recovery.active=false;
            emit MissingEvidenceRecoveryCorrected(handId,uint8(g.phase));
        }
        _openBettingStreet(handId,g,street,deals.tables().getTable(g.tableId).config.bigBlind);
        _commitTurn(handId,g);
        emit StreetOpened(handId,street);
    }

}

contract PokerNLHECustodyModule420 is PokerNLHEModule420 {
    constructor(address d,address s,address k,address c,address h) PokerNLHEModule420(d,s,k,c,h) {}
    function reserve(bytes32 handId) external onlyHost {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.AWAITING &&
           h.state!=PokerConfidentialDeal420.State.COMMITTED)revert InvalidState();
        bool permitted=msg.sender==deals.tables().getTable(h.tableId).controller;
        uint16 mask=deals.handSeatMask(handId);
        for(uint8 i=0;i<9;i++)if(_participates(mask,i)&&
            ledger.seatOf(h.tableId,i).player==msg.sender)permitted=true;
        // An accepted funded hand must have its single governance-bound
        // native dispute resolver installed BEFORE chips are locked. A
        // malicious dispute must never strand escrow behind an unbound hook.
        if(disputes.resolverForTable(h.tableId)!=address(this)||
           _layout().turnSecondsForTable[h.tableId]==0||disputes.turnEngineForTable(h.tableId)!=address(this))revert InvalidState();
        if(!permitted||ledger.settlementCoordinator(h.tableId)!=address(this)||
           h.seatSnapshotHash!=deals.snapshotFor(h.tableId,mask))
            revert Unauthorized();
        bytes32 reservedSnapshot=ledger.reserveHand(h.tableId,handId,mask,h.epoch);
        if(reservedSnapshot==bytes32(0) ||
           reservedSnapshot!=ledger.lockedSnapshot(h.tableId))revert InvalidState();
        _bond(h.tableId).lock(handId);
        if(_layout().fundedSnapshot[handId]!=bytes32(0)||_layout().fundedEvidenceDeadline[handId]!=0)
            revert InvalidState();
        _layout().fundedSnapshot[handId]=reservedSnapshot;
        _layout().fundedEvidenceDeadline[handId]=uint64(uint256(h.deadline)+PROOF_DELIVERY_WINDOW);
        _layout().turnPolicyForHand[handId]=_turnPolicyHash(h.tableId);
        disputes.syncTurn(handId,1,type(uint8).max,0,reservedSnapshot,false);
    }

    function cancelUnavailableStart(bytes32 handId) external onlyHost {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(_layout().games[handId].initialized||_layout().handAborted[handId]||_layout().handSettled[handId]||
           ledger.activeHand(h.tableId)!=handId||_layout().fundedSnapshot[handId]==bytes32(0)||
           ledger.lockedSnapshot(h.tableId)!=_layout().fundedSnapshot[handId]||_admissionAvailable(handId))revert InvalidState();
        if(block.timestamp<_layout().fundedEvidenceDeadline[handId])revert TooEarly();
        _layout().handAborted[handId]=true;
        if(disputes.isFrozen(handId))disputes.finalizeUnprovableVoid(handId);
        ledger.cancelReservedHand(h.tableId,handId);
        _bond(h.tableId).close(handId,0);
        emit UnverifiedDeliveryAborted(handId,h.tableId);
    }

    function cancelWithheldDeal(bytes32 handId) external onlyHost {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        Game storage g=_layout().games[handId];
        if(g.initialized||_layout().handAborted[handId]||_layout().handSettled[handId]||
           ledger.activeHand(h.tableId)!=handId||
           shuffle.isProofComplete(handId))revert InvalidState();
        if(_layout().fundedSnapshot[handId]==bytes32(0)||
           ledger.lockedSnapshot(h.tableId)!=_layout().fundedSnapshot[handId])revert InvalidState();
        if(block.timestamp<_layout().fundedEvidenceDeadline[handId])revert TooEarly();
        _layout().handAborted[handId]=true;
        // A bounded disputed withholding review must also reach one terminal
        // dispute-clock state; never strand an already-refunded hand as frozen.
        if(disputes.isFrozen(handId))disputes.finalizeUnprovableVoid(handId);
        PokerPrivateShuffleGate420.Record memory record=shuffle.recordOf(handId);
        uint8 missing=0;
        if(record.stage==1)missing=2; // provider B failed its authenticated second stage
        else if(record.stage==0&&shuffle.initialDeck().rootOf(handId)!=bytes32(0))
            missing=1; // provider A failed after a proven initial deck
        ledger.cancelReservedHand(h.tableId,handId);
        _bond(h.tableId).close(handId,missing);
        emit UnprovedDealAborted(handId,h.tableId);
    }

    function cancelWithheldDelivery(bytes32 handId) external onlyHost {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(_layout().games[handId].initialized||_layout().handAborted[handId]||_layout().handSettled[handId]||
            ledger.activeHand(h.tableId)!=handId||!shuffle.isProofComplete(handId))
            revert InvalidState();
        if(_layout().fundedSnapshot[handId]==bytes32(0)||
           ledger.lockedSnapshot(h.tableId)!=_layout().fundedSnapshot[handId])revert InvalidState();
        if(block.timestamp<_layout().fundedEvidenceDeadline[handId])revert TooEarly();
        if(address(_layout().deliveryForTable[h.tableId])!=address(0)&&
            _layout().deliveryForTable[h.tableId].allAcknowledged(handId))revert InvalidState();
        _layout().handAborted[handId]=true;
        if(disputes.isFrozen(handId))disputes.finalizeUnprovableVoid(handId);
        uint8 faults=_missingPrivateShareProviders(handId,h.tableId);
        ledger.cancelReservedHand(h.tableId,handId);
        _bond(h.tableId).close(handId,faults);
        emit UnverifiedDeliveryAborted(handId,h.tableId);
    }

    function beginMissingEvidenceRecovery(bytes32 handId) external onlyHost {
        Game storage g=_layout().games[handId];
        if(!g.initialized||_layout().handSettled[handId]||_layout().handAborted[handId]||
            _layout().evidenceRecovery[handId].active||
            (_layout().recoveryStageMask[handId]&(uint16(1)<<uint8(g.phase)))!=0||
            ledger.activeHand(g.tableId)!=handId||
            _layout().fundedSnapshot[handId]==bytes32(0)||
            ledger.lockedSnapshot(g.tableId)!=_layout().fundedSnapshot[handId]||
            _layout().evidenceDueAt[handId]<1||
            block.timestamp<=_layout().evidenceDueAt[handId]||
            !_missingRequiredEvidence(handId,g))revert InvalidState();
        // A delayed caller cannot move finality indefinitely: the bounded
        // review period starts at the immutable street evidence deadline.
        uint64 end=uint64(uint256(_layout().evidenceDueAt[handId])+RECOVERY_REVIEW_WINDOW);
        _layout().recoveryStageMask[handId]|=uint16(1)<<uint8(g.phase);
        _layout().evidenceRecovery[handId]=EvidenceRecovery(uint64(block.timestamp),end,
            g.stateRoot,g.phase,true);
        emit MissingEvidenceRecoveryOpened(handId,uint8(g.phase),g.stateRoot,end);
    }

    function finalizeMissingEvidenceRecovery(bytes32 handId) external onlyHost {
        Game storage g=_layout().games[handId];
        EvidenceRecovery memory r=_layout().evidenceRecovery[handId];
        if(!r.active||_layout().handSettled[handId]||_layout().handAborted[handId]||
            g.stateRoot!=r.stateRoot||g.phase!=r.failedPhase||
            ledger.activeHand(g.tableId)!=handId||
            _layout().fundedSnapshot[handId]==bytes32(0)||
            ledger.lockedSnapshot(g.tableId)!=_layout().fundedSnapshot[handId]||
            !_missingRequiredEvidence(handId,g))revert InvalidState();
        if(block.timestamp<r.finalizableAt)revert TooEarly();
        // Only the governance-bound native resolver may close an expired
        // independent dispute, and only under the same missing-proof guard.
        // All terminal effects precede external resolver or ledger calls.
        // A reverting resolver/ledger atomically restores these flags.
        // Compute attribution with the live authorization window still intact.
        // This external view is a STATICCALL and cannot mutate custody.
        uint8 blame=0;
        if(address(_layout().revealForTable[g.tableId])!=address(0)){
            uint8 street=uint8(r.failedPhase)/2; // the four canonical missing-evidence phases are 2,4,6,8
            blame=IPokerMissingShareEvidence420(address(_layout().revealForTable[g.tableId]))
                .missingProviders(handId,street);
        }
        _layout().handAborted[handId]=true;
        _layout().evidenceRecovery[handId].active=false;
        if(disputes.isFrozen(handId))disputes.finalizeUnprovableVoid(handId);
        ledger.cancelReservedHand(g.tableId,handId);
        _bond(g.tableId).close(handId,blame);
        emit MissingEvidenceRecoveryVoided(handId,g.tableId);
    }

}

contract PokerNLHESettlementModule420 is PokerNLHEModule420 {
    constructor(address d,address s,address k,address c,address h) PokerNLHEModule420(d,s,k,c,h) {}
    function bindReveals(bytes32 tableId,address gate) external onlyHost {
        if(address(_layout().revealForTable[tableId])!=address(0)||gate==address(0)||gate.code.length==0)
            revert InvalidConfiguration();
        if(!authorization.isAuthorized(msg.sender,ACTION_BIND_REVEALS,
            authorization.scopeForTable(tableId),0))revert Unauthorized();
        // A public reveal contract must be associated with this exact on-chain
        // betting engine, not merely expose a compatible method selector.
        if(address(IPokerAuthenticatedStreet420(gate).engine())!=address(this))
            revert InvalidConfiguration();
        _layout().revealForTable[tableId]=IPokerAuthenticatedStreet420(gate);
        emit RevealsBound(gate);
    }

    function bindDelivery(bytes32 tableId,address gate) external onlyHost {
        if(address(_layout().deliveryForTable[tableId])!=address(0)||gate==address(0)||
           gate.code.length==0)revert InvalidConfiguration();
        if(!authorization.isAuthorized(msg.sender,ACTION_BIND_DELIVERY,
            authorization.scopeForTable(tableId),0))revert Unauthorized();
        PokerDeckDisclosure420 delivery=PokerDeckDisclosure420(gate);
        if(address(delivery.deals())!=address(deals))revert InvalidConfiguration();
        _layout().deliveryForTable[tableId]=delivery;
        emit DeliveryBound(tableId,gate);
    }

    function bindOutcome(bytes32 tableId,address calculator) external onlyHost {
        if(_layout().outcomeForTable[tableId]!=address(0)||calculator==address(0)||
           calculator.code.length==0)revert InvalidConfiguration();
        if(!authorization.isAuthorized(msg.sender,ACTION_BIND_OUTCOME,
            authorization.scopeForTable(tableId),0))revert Unauthorized();
        // Refuse a calculator bound to a different engine or a different
        // authenticated revelation channel, even if table governance submits it.
        if(address(_layout().revealForTable[tableId])==address(0) ||
           IPokerNativeOutcome420(calculator).engine()!=address(this) ||
           IPokerNativeOutcome420(calculator).reveals()!=address(_layout().revealForTable[tableId]) ||
           IPokerNativeOutcome420(calculator).rakeEngine()==address(0) ||
           address(PokerCanonicalRake420(IPokerNativeOutcome420(calculator).rakeEngine()).tables())
               !=address(deals.tables()))
            revert InvalidConfiguration();
        _layout().outcomeForTable[tableId]=calculator;
        _layout().outcomeCodeHash[tableId]=calculator.codehash;
        emit OutcomeBound(tableId,calculator);
    }

    function bindProviderBond(bytes32 tableId,address bond)external onlyHost {
        if(bond==address(0)||bond.code.length==0||
           address(_layout().bondForTable[tableId])!=address(0))revert InvalidState();
        if(!deals.authorization().isAuthorized(msg.sender,ACTION_BIND_PROVIDER_BOND,
            deals.authorization().scopeForTable(tableId),0))revert Unauthorized();
        PokerProviderAccountability420 policy=PokerProviderAccountability420(bond);
        if(address(policy.deals())!=address(deals)||policy.nativeEngine()!=address(this))
            revert InvalidState();
        _layout().bondForTable[tableId]=policy;
        emit ProviderBondBound(tableId,bond);
    }

    function settle(bytes32 handId,PokerCanonicalRake420.Policy calldata policy) external onlyHost {
        Game storage g=_layout().games[handId];
        if(!g.initialized||_layout().handSettled[handId]||
           (g.phase!=Phase.SHOWDOWN&&g.phase!=Phase.UNCONTESTED)||
           _layout().outcomeForTable[g.tableId]==address(0)||
           ledger.activeHand(g.tableId)!=handId)revert InvalidState();
        if(address(_layout().revealForTable[g.tableId])==address(0))revert InvalidState();
        if(_layout().outcomeCodeHash[g.tableId]==bytes32(0)||
           _layout().outcomeForTable[g.tableId].codehash!=_layout().outcomeCodeHash[g.tableId])revert InvalidState();
        (uint256[9] memory balances,uint256 fee)=
            IPokerNativeOutcome420(_layout().outcomeForTable[g.tableId]).calculate(handId,policy);
        // Mark the hand consumed before any external dispute/ledger call.
        // Reverts atomically restore this flag if either dependency fails.
        _layout().handSettled[handId]=true;
        _layout().terminalTranscript[handId]=keccak256(abi.encode(STATE_DOMAIN,handId,
            g.tableId,g.stateRoot,g.nonce,_layout().actionTranscriptRoot[handId],g.pot,g.initialChips,
            _layout().fundedSnapshot[handId],_layout().outcomeCodeHash[g.tableId],
            policy.rakeBps,policy.cap,policy.noFlopNoDrop,
            policy.noRakeOnUncontested,balances,fee));
        emit TerminalTranscriptSealed(handId,_layout().terminalTranscript[handId]);
        if(disputes.isFrozen(handId))
            disputes.finalizeVerifiedOutcome(handId,_nativeResolutionHash(handId,g.stateRoot,balances,fee));
        ledger.settleReservedHand(g.tableId,handId,balances,fee);
        _bond(g.tableId).close(handId,0);
        emit NativeHandSettled(handId,g.tableId,fee);
    }

    function proposeDisputeResolution(bytes32 handId,
        PokerCanonicalRake420.Policy calldata policy) external onlyHost {
        Game storage g=_layout().games[handId];
        if(!g.initialized||_layout().handSettled[handId]||
           (g.phase!=Phase.SHOWDOWN&&g.phase!=Phase.UNCONTESTED)||
           !disputes.isFrozen(handId)||_layout().outcomeForTable[g.tableId]==address(0)||
           ledger.activeHand(g.tableId)!=handId)revert InvalidState();
        (uint256[9] memory balances,uint256 fee)=
            IPokerNativeOutcome420(_layout().outcomeForTable[g.tableId]).calculate(handId,policy);
        disputes.proposeVerifiedOutcome(handId,
            _nativeResolutionHash(handId,g.stateRoot,balances,fee));
    }

}
