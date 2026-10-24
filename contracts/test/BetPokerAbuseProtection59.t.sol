// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerIntegratedAdversarial54.t.sol";
import "../src/bet/PokerAbuseControls420.sol";
import "../src/bet/PokerPlayerRecovery420.sol";

interface VmAbuse59 {function etch(address,bytes calldata)external;}
contract FailedAbuseDependency59 {fallback()external {revert("unavailable abuse policy");}}

/// @notice Protected-hand integration uses genuine Groth16 proofs, actual seat
/// signatures, escrow and segregated bonds. Administrative tests cannot choose
/// a card, turn, winner, payout vector or refund.
contract PokerAbuseProtection59Test is BetPokerIntegratedFundedAdversarial54Test {
    PokerAbuseControls420 internal abuse;
    PokerPlayerRecovery420 internal playerRecovery;
    address constant AUDITOR_A=address(0xA590);
    address constant AUDITOR_B=address(0xB590);
    address constant REVIEWER_A=address(0xC590);
    address constant REVIEWER_B=address(0xD590);
    VmAbuse59 constant faults59=VmAbuse59(address(uint160(uint256(keccak256("hevm cheat code")))));
    event AbuseQualificationIdentity(address controls,bytes32 codeHash,uint256 runtimeBytes,bytes32 policyHash);
    event AbuseQualificationPublicContext(uint256 chainId,uint256 blockNumber,uint64 timestamp,address engine,address seatLedger,bytes32 tableId,address player0,address player1,address controller,address providerA,address providerB);
    event AbuseQualificationPreserved(bytes32 handId,bytes32 admissionRoot,bytes32 terminalTranscript,uint256 player0,uint256 player1,uint256 rake);
    constructor(){abuse=new PokerAbuseControls420(address(ledger),address(deal));playerRecovery=new PokerPlayerRecovery420(address(ws8Engine));}
    // A new call observes Foundry's warped clock; Solidity may legitimately
    // common-subexpression-eliminate block.timestamp within one transaction.
    function currentTime59()external view returns(uint64){return uint64(block.timestamp);}
    function _configuration()private pure returns(PokerAbuseControls420.Policy memory){
        return PokerAbuseControls420.Policy(30,7 days,60,60,10,3,keccak256("5A9.REVIEWED.ADMISSION.AND.ABUSE.POLICY"));
    }
    function _identity(address player,bytes32 group,uint64 until)private {
        uint64 revision=abuse.identityOf(TABLE,player).revision;
        cheat54.prank(AUDITOR_A);bytes32 digest=abuse.proposeIdentity(TABLE,player,group,keccak256(abi.encode("private audit dossier commitment",player,group)),until,revision);
        cheat54.prank(AUDITOR_B);abuse.confirmIdentity(TABLE,player,revision+1,digest);
    }
    function _configurePlayerAbuseControls()internal override {
        bytes32 scope=auth.scopeForTable(TABLE);
        cap.grant(ADMIN,abuse.ACTION_CONFIGURE(),scope,true);
        cap.grant(ADMIN,ledger.ACTION_BIND_ABUSE_CONTROLS(),scope,true);
        cap.grant(AUDITOR_A,abuse.ACTION_ATTEST(),scope,true);cap.grant(AUDITOR_B,abuse.ACTION_ATTEST(),scope,true);
        cap.grant(REVIEWER_A,abuse.ACTION_REVIEW(),scope,true);cap.grant(REVIEWER_B,abuse.ACTION_REVIEW(),scope,true);
        cheat54.prank(ADMIN);abuse.configure(TABLE,_configuration());
        _identity(PLAYER,keccak256("table-local unrelated group A"),uint64(block.timestamp+7 days));
        _identity(PLAYER_B,keccak256("table-local unrelated group B"),uint64(block.timestamp+7 days));
        cheat54.prank(ADMIN);ledger.bindAbuseControls(TABLE,address(abuse));
    }
    function _idle()private {_open();_configurePlayerAbuseControls();}
    function _report(bytes32 id)private returns(bytes32 c){
        uint64 nonce=abuse.playerNonce(TABLE,PLAYER_B);
        cheat54.prank(PLAYER_B);c=abuse.report(id,PLAYER,PokerAbuseControls420.Category.CHIP_DUMPING,keccak256("private bounded investigation dossier"),nonce);
    }
    function _propose(bytes32 c,uint32 duration)private returns(bytes32 digest){
        cheat54.prank(REVIEWER_A);digest=abuse.propose(c,duration,keccak256("independent reviewed evidence and reason"));
    }
    function _confirm(bytes32 c,bytes32 digest)private {cheat54.prank(REVIEWER_B);abuse.confirm(c,digest);}
    function _restriction(bytes32 c)private {
        bytes32 digest=_propose(c,300);_confirm(c,digest);cheat54.warp(abuse.reviewOf(c).executableAfter);abuse.activate(c);
    }
    function _fold(bytes32 id)private {_signed(id,0,PokerNLHEStorage420.Move.FOLD,0,WS8_PLAYER_KEY);}
    function test59LegitimateProtectedFundedHandAndGovernedRestriction()public {
        bytes32 id=_ready();bytes32 root=ledger.abuseAdmission(id);
        require(root!=bytes32(0)&&abuse.admissionOf(id).root==root,"unprotected funded hand");
        emit AbuseQualificationIdentity(address(abuse),address(abuse).codehash,address(abuse).code.length,abuse.policyHash(TABLE));
        emit AbuseQualificationPublicContext(block.chainid,block.number,this.currentTime59(),address(ws8Engine),address(ledger),TABLE,PLAYER,PLAYER_B,registry.getTable(TABLE).controller,deal.providerA(),deal.providerB());
        _showdown(id);_settle(id);bytes32 terminal=ws8Engine.terminalTranscript(id);
        bytes32 c=_report(id);_restriction(c);
        require(ws8Engine.terminalTranscript(id)==terminal&&ledger.abuseAdmission(id)==root,"review rewrote certified hand");
        require(ledger.seatOf(TABLE,0).chips==399&&ledger.seatOf(TABLE,1).chips==399,"subjective restriction chose payout");
        require(abuse.restrictionOf(TABLE,PLAYER).until>block.timestamp,"prospective restriction missing");
        emit AbuseQualificationPreserved(id,root,terminal,399,399,2);
        cheat54.prank(PLAYER);ledger.leave(TABLE);
        require(ledger.playerSeatPlusOne(TABLE,PLAYER)==0&&coin.balanceOf(address(ledger))==399,"restriction confiscated exit");
    }
    function test59UnconfirmedIdentityCannotFundASeat()public {
        _idle();address player=address(0x5901);cap.grant(player,BetIds420.ACTION_POKER_BUY_IN,auth.scopeForTable(TABLE),true);
        coin.mint(player,400);cheat54.prank(player);coin.approve(address(ledger),400);
        cheat54.prank(AUDITOR_A);abuse.proposeIdentity(TABLE,player,keccak256("group"),keccak256("evidence"),uint64(block.timestamp+1 days),0);
        cheat54.expectRevert(PokerAbuseControls420.Ineligible.selector);cheat54.prank(player);ledger.buyIn(TABLE,0,400);
        require(coin.balanceOf(address(ledger))==0,"unconfirmed funds admitted");
    }
    function test59RelatedAccountsCannotCoseatEvenWhenOtherSitsOut()public {
        _idle();_buy();cheat54.prank(PLAYER);ledger.sitOut(TABLE,true);
        _identity(PLAYER_B,abuse.identityOf(TABLE,PLAYER).group,uint64(block.timestamp+1 days));
        cheat54.expectRevert(PokerAbuseControls420.RelatedPlayers.selector);cheat54.prank(PLAYER_B);ledger.buyIn(TABLE,1,400);
        require(ledger.totalChips(TABLE)==400,"related deposit persisted");
    }
    function test59IdentityChangeCannotAdmitRelatedExistingSeats()public {
        _idle();_buy();cheat54.prank(PLAYER_B);ledger.buyIn(TABLE,1,400);
        _identity(PLAYER_B,abuse.identityOf(TABLE,PLAYER).group,uint64(block.timestamp+1 days));
        bytes32 snapshot=deal.snapshotFor(TABLE,3);
        cheat54.expectRevert(PokerAbuseControls420.RelatedPlayers.selector);cheat54.prank(ADMIN);deal.begin(TABLE,1,uint64(block.timestamp+60),keccak256("prior"),snapshot,3);
    }
    function test59PendingIdentityCannotUnilaterallyRevokeConfirmedAdmission()public {
        _idle();bytes32 oldGroup=abuse.identityOf(TABLE,PLAYER).group;
        cheat54.prank(AUDITOR_A);abuse.proposeIdentity(TABLE,PLAYER,keccak256("pending unrelated claim"),keccak256("evidence"),uint64(block.timestamp+1 days),1);
        _buy();require(abuse.identityOf(TABLE,PLAYER).group==oldGroup,"one auditor revoked current identity");
    }
    function test59IdentityApprovalBindsExactProposalAndLiveDistinctAuditors()public {
        _idle();uint64 until=uint64(block.timestamp+1 days);bytes32 group=keccak256("new claim");
        cheat54.prank(AUDITOR_A);bytes32 stale=abuse.proposeIdentity(TABLE,PLAYER,group,keccak256("first"),until,1);
        cheat54.prank(AUDITOR_A);bytes32 current=abuse.proposeIdentity(TABLE,PLAYER,group,keccak256("replacement"),until,1);
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);cheat54.prank(AUDITOR_B);abuse.confirmIdentity(TABLE,PLAYER,2,stale);
        cheat54.expectRevert(PokerAbuseControls420.Unauthorized.selector);cheat54.prank(AUDITOR_A);abuse.confirmIdentity(TABLE,PLAYER,2,current);
        cap.grant(AUDITOR_A,abuse.ACTION_ATTEST(),auth.scopeForTable(TABLE),false);
        cheat54.expectRevert(PokerAbuseControls420.Unauthorized.selector);cheat54.prank(AUDITOR_B);abuse.confirmIdentity(TABLE,PLAYER,2,current);
    }
    function test59ControllerProviderAndPlayerCannotAttestThemselves()public {
        _idle();address[3] memory actors=[ADMIN,PROVIDER_A,PLAYER];
        for(uint8 i;i<3;i++){
            cap.grant(actors[i],abuse.ACTION_ATTEST(),auth.scopeForTable(TABLE),true);
            cheat54.expectRevert(PokerAbuseControls420.Unauthorized.selector);cheat54.prank(actors[i]);
            abuse.proposeIdentity(TABLE,PLAYER,keccak256("forged"),keccak256("evidence"),uint64(block.timestamp+1 days),1);
        }
    }
    function test59ExpiredAndRevokedIdentityCannotStartAnotherHand()public {
        _idle();_buy();cheat54.prank(PLAYER_B);ledger.buyIn(TABLE,1,400);
        cap.grant(AUDITOR_B,abuse.ACTION_ATTEST(),auth.scopeForTable(TABLE),false);
        cheat54.expectRevert(PokerAbuseControls420.Unauthorized.selector);abuse.checkParticipants(TABLE,3);
        cap.grant(AUDITOR_B,abuse.ACTION_ATTEST(),auth.scopeForTable(TABLE),true);
        cheat54.warp(block.timestamp+7 days);cheat54.expectRevert(PokerAbuseControls420.Ineligible.selector);abuse.checkParticipants(TABLE,3);
    }
    function test59SelfExclusionOnlyTightensAndPreservesFundedHandAndExit()public {
        bytes32 id=_ready();uint64 until=uint64(block.timestamp+1 days);
        cheat54.prank(PLAYER);abuse.selfExclude(TABLE,until,0);
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);cheat54.prank(PLAYER);abuse.selfExclude(TABLE,until,1);
        _fold(id);ws8Engine.settle(id,_policy());
        cheat54.expectRevert(PokerAbuseControls420.Ineligible.selector);cheat54.prank(PLAYER);ledger.topUp(TABLE,10);
        cheat54.prank(PLAYER);ledger.leave(TABLE);require(ledger.totalChips(TABLE)==410,"self-exclusion seized chips");
    }
    function test59PlayerAvoidanceIsSymmetricAndCannotRewriteCurrentHand()public {
        bytes32 id=_ready();bytes32 root=ws8Engine.gameOf(id).stateRoot;
        cheat54.prank(PLAYER);abuse.setAvoid(TABLE,PLAYER_B,true,0);
        require(ws8Engine.gameOf(id).stateRoot==root,"avoidance changed turn");_fold(id);ws8Engine.settle(id,_policy());
        cheat54.expectRevert(PokerAbuseControls420.PlayerAvoided.selector);abuse.checkParticipants(TABLE,3);
        cheat54.prank(PLAYER);abuse.setAvoid(TABLE,PLAYER_B,false,1);abuse.checkParticipants(TABLE,3);
    }
    function test59LeaveAndSitOutCooldownsCannotBeBypassedByRebuyOrLegacyReturn()public {
        _idle();_buy();cheat54.prank(PLAYER);ledger.sitOut(TABLE,true);
        cheat54.expectRevert(PokerAbuseControls420.CoolingOff.selector);cheat54.prank(PLAYER);ledger.sitOut(TABLE,false);
        cheat54.warp(block.timestamp+60);cheat54.prank(PLAYER);ledger.sitOut(TABLE,false);
        cheat54.prank(PLAYER);ledger.leave(TABLE);
        cheat54.expectRevert(PokerAbuseControls420.CoolingOff.selector);cheat54.prank(PLAYER);ledger.buyIn(TABLE,1,400);
        cheat54.warp(uint256(ledger.lastExitAt(TABLE,PLAYER))+60);cheat54.prank(PLAYER);ledger.buyIn(TABLE,1,400);
    }
    function test59BindingAndPolicyAreImmutableAndCannotBeInstalledAfterFunding()public {
        _idle();cheat54.expectRevert(PokerAbuseControls420.InvalidConfiguration.selector);cheat54.prank(ADMIN);abuse.configure(TABLE,_configuration());
        cheat54.expectRevert(PokerSeatLedger420.AbuseBindingInvalid.selector);cheat54.prank(ADMIN);ledger.bindAbuseControls(TABLE,address(abuse));
        _buy();require(ledger.abuseControls(TABLE)==address(abuse),"policy overwritten");
    }
    function test59OnlyCanonicalLedgerCanAdmitOrRecordDeals()public {
        bytes32 id=_ready();cheat54.expectRevert(PokerAbuseControls420.Unauthorized.selector);abuse.admitHand(TABLE,id,3);
        cheat54.expectRevert(PokerAbuseControls420.Unauthorized.selector);abuse.noteDealRequested(TABLE,id);
        cheat54.expectRevert(PokerSeatLedger420.Unauthorized.selector);ledger.noteAbuseDeal(TABLE,id);
        require(ledger.abuseAdmission(id)!=bytes32(0),"canonical admission lost");
    }
    function test59PendingDealRequestsAreRateLimitedAndReplaceableAfterDeadline()public {
        _idle();_buy();cheat54.prank(PLAYER_B);ledger.buyIn(TABLE,1,400);bytes32 id=_begin(1);
        bytes32 snapshot=deal.snapshotFor(TABLE,3);
        cheat54.expectRevert(PokerAbuseControls420.RateLimited.selector);cheat54.prank(ADMIN);deal.begin(TABLE,2,uint64(block.timestamp+120),keccak256("prior"),snapshot,3);
        uint64 deadline=deal.getHand(id).deadline;cheat54.warp(deadline);
        snapshot=deal.snapshotFor(TABLE,3);cheat54.prank(ADMIN);
        bytes32 next=deal.begin(TABLE,2,deadline+120,keccak256("prior"),snapshot,3);
        require(next!=id&&deal.lastNonce(TABLE)==2,"bounded replacement failed");
    }
    function test59ReportsRequireFrozenParticipantsAndCannotFreezePayment()public {
        bytes32 id=_ready();bytes32 root=ws8Engine.gameOf(id).stateRoot;
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);abuse.report(id,PLAYER,PokerAbuseControls420.Category.COLLUSION,keccak256("evidence"),0);
        bytes32 c=_report(id);require(!abuse.caseOf(c).finalized,"report auto-sanctioned");
        require(!ws8Disputes.isFrozen(id)&&ws8Engine.gameOf(id).stateRoot==root,"report froze turn/payment");
        _fold(id);ws8Engine.settle(id,_policy());
    }
    function test59DuplicateReportsAndCrossIntentNonceReplayAreRejected()public {
        bytes32 id=_ready();_report(id);
        cheat54.expectRevert(PokerAbuseControls420.RateLimited.selector);cheat54.prank(PLAYER_B);abuse.report(id,PLAYER,PokerAbuseControls420.Category.GRIEFING,keccak256("another"),1);
        cheat54.expectRevert(PokerAbuseControls420.Stale.selector);cheat54.prank(PLAYER_B);abuse.setAvoid(TABLE,PLAYER,true,0);
    }
    function test59OneReviewerControllerProviderOrSubjectCannotRestrict()public {
        bytes32 id=_ready();bytes32 c=_report(id);bytes32 digest=_propose(c,300);
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);abuse.activate(c);
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);cheat54.prank(REVIEWER_A);abuse.confirm(c,digest);
        address[3] memory actors=[ADMIN,PROVIDER_A,PLAYER];
        for(uint8 i;i<3;i++){
            cap.grant(actors[i],abuse.ACTION_REVIEW(),auth.scopeForTable(TABLE),true);
            cheat54.expectRevert(PokerAbuseControls420.Unauthorized.selector);cheat54.prank(actors[i]);abuse.confirm(c,digest);
        }
    }
    function test59RestrictionApprovalAndActivationRecheckExactEvidenceAndLiveRoles()public {
        bytes32 id=_ready();bytes32 c=_report(id);bytes32 digest=_propose(c,300);
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);cheat54.prank(REVIEWER_B);abuse.confirm(c,keccak256("wrong proposal"));
        _confirm(c,digest);cap.grant(REVIEWER_A,abuse.ACTION_REVIEW(),auth.scopeForTable(TABLE),false);
        cheat54.warp(abuse.reviewOf(c).executableAfter);cheat54.expectRevert(PokerAbuseControls420.Unauthorized.selector);abuse.activate(c);
    }
    function test59AppealDelaysOnceAndCannotHoldCurrentHandOrSettlement()public {
        bytes32 id=_ready();bytes32 c=_report(id);bytes32 digest=_propose(c,300);_confirm(c,digest);
        uint64 original=abuse.reviewOf(c).executableAfter;
        cheat54.prank(PLAYER);abuse.appeal(c,keccak256("private counter-evidence"));
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);cheat54.prank(PLAYER);abuse.appeal(c,keccak256("repeat"));
        _fold(id);ws8Engine.settle(id,_policy());cheat54.warp(original);
        cheat54.expectRevert(PokerAbuseControls420.TooEarly.selector);abuse.activate(c);
        cheat54.warp(abuse.reviewOf(c).executableAfter);abuse.activate(c);
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);abuse.activate(c);
    }
    function test59MidHandRestrictionOnlyGatesFutureAdmission()public {
        bytes32 id=_ready();bytes32 root=ws8Engine.gameOf(id).stateRoot;uint64 deadline=ws8Engine.gameOf(id).deadline;
        bytes32 snapshot=ledger.lockedSnapshot(TABLE);bytes32 c=_report(id);_restriction(c);
        require(ws8Engine.gameOf(id).stateRoot==root&&ws8Engine.gameOf(id).deadline==deadline&&ledger.lockedSnapshot(TABLE)==snapshot,"restriction changed funded hand");
        PokerPlayerRecovery420.AbuseState memory state=playerRecovery.abuseState(TABLE,PLAYER,id);
        require(state.controls==address(abuse)&&state.policyHash==abuse.policyHash(TABLE)&&state.admissionRoot==ledger.abuseAdmission(id)&&!state.seatEligibleForNextHand,"reconnect hid prospective restriction");
        require(playerRecovery.snapshot(TABLE,PLAYER,id).turn.allowedMoves!=0,"restriction removed accepted turn");
        _showdown(id);_settle(id);
        cheat54.expectRevert(PokerAbuseControls420.Ineligible.selector);abuse.checkParticipants(TABLE,3);
        cheat54.prank(PLAYER);ledger.leave(TABLE);
    }
    function test59ExpiredReviewCannotBeExecutedLaterAndRestrictionExpiresExactly()public {
        bytes32 id=_ready();_fold(id);ws8Engine.settle(id,_policy());bytes32 c=_report(id);bytes32 digest=_propose(c,300);_confirm(c,digest);
        cheat54.warp(abuse.reviewOf(c).expiresAt+1);cheat54.expectRevert(PokerAbuseControls420.Expired.selector);abuse.activate(c);
        require(abuse.restrictionOf(TABLE,PLAYER).until==0,"expired review imposed restriction");
    }
    function test59BoundedRestrictionExpiresAndDoesNotDestroyHistoricalReceipt()public {
        bytes32 id=_ready();_fold(id);ws8Engine.settle(id,_policy());bytes32 terminal=ws8Engine.terminalTranscript(id);bytes32 c=_report(id);_restriction(c);
        uint64 until=abuse.restrictionOf(TABLE,PLAYER).until;cheat54.warp(until-1);
        cheat54.expectRevert(PokerAbuseControls420.Ineligible.selector);abuse.checkParticipants(TABLE,3);
        cheat54.warp(until);abuse.checkParticipants(TABLE,3);require(ws8Engine.terminalTranscript(id)==terminal,"expiry changed receipt");
    }
    function test59IndependentLiftCannotReplayOrClearAReplacementRestriction()public {
        bytes32 id=_ready();_fold(id);ws8Engine.settle(id,_policy());bytes32 c=_report(id);_restriction(c);
        cheat54.prank(REVIEWER_A);abuse.proposeLift(c,keccak256("reviewed correction"));
        PokerAbuseControls420.Lift memory l=abuse.liftOf(c);
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);cheat54.prank(REVIEWER_B);abuse.confirmLift(c,keccak256("wrong reason"));
        cheat54.prank(REVIEWER_B);abuse.confirmLift(c,l.digest);
        cheat54.expectRevert(PokerAbuseControls420.TooEarly.selector);abuse.activateLift(c);
        cheat54.warp(l.executableAfter);abuse.activateLift(c);abuse.checkParticipants(TABLE,3);
        cheat54.expectRevert(PokerAbuseControls420.Stale.selector);abuse.activateLift(c);
    }
    function test59ReviewerMayWithdrawAfterAppealWithoutAnyCustodyChange()public {
        bytes32 id=_ready();bytes32 c=_report(id);bytes32 digest=_propose(c,300);_confirm(c,digest);
        cheat54.prank(PLAYER);abuse.appeal(c,keccak256("counter-evidence"));
        cheat54.prank(REVIEWER_B);abuse.cancel(c,keccak256("review withdrawn"));
        require(abuse.caseOf(c).finalized&&abuse.restrictionOf(TABLE,PLAYER).until==0,"withdrawn review restricted");
        _escrowUnchanged(id);_fold(id);ws8Engine.settle(id,_policy());
    }
    function test59UnavailablePolicyFailsNewFundingButNeverTrapsFundedExit()public {
        bytes32 id=_ready();FailedAbuseDependency59 failed=new FailedAbuseDependency59();faults59.etch(address(abuse),address(failed).code);
        _fold(id);ws8Engine.settle(id,_policy());
        cheat54.expectRevert(PokerSeatLedger420.AbuseBindingInvalid.selector);cheat54.prank(PLAYER);ledger.topUp(TABLE,10);
        cheat54.prank(PLAYER);ledger.leave(TABLE);require(ledger.totalChips(TABLE)==410,"policy failure trapped cashout");
    }
    function test59MissingProviderRecoveryStillRefundsARestrictedPlayer()public {
        bytes32 id=_ready();_preflop(id);bytes32 c=_report(id);bytes32 digest=_propose(c,7 days);_confirm(c,digest);
        cheat54.warp(abuse.reviewOf(c).executableAfter);abuse.activate(c);
        cheat54.warp(ws8Engine.evidenceDueAt(id)+1);ws8Engine.beginMissingEvidenceRecovery(id);
        (,uint64 finalAt,,,)=ws8Engine.evidenceRecovery(id);cheat54.warp(finalAt);ws8Engine.finalizeMissingEvidenceRecovery(id);
        require(ws8Engine.handAborted(id)&&ledger.seatOf(TABLE,0).chips==400&&abuse.restrictionOf(TABLE,PLAYER).until>this.currentTime59(),"restriction changed canonical refund");
        cheat54.prank(PLAYER);ledger.leave(TABLE);
    }
    function _reserveWithoutProofs(uint64 nonce)private returns(bytes32 id){
        bytes32 snapshot=deal.snapshotFor(TABLE,3);uint64 deadline=this.currentTime59()+120;
        cheat54.prank(ADMIN);id=deal.begin(TABLE,nonce,deadline,keccak256(abi.encode("bounded unproved hand",nonce)),snapshot,3);
        cheat54.prank(PLAYER);ws8Engine.reserve(id);
    }
    function test59DailyReportQuotaCannotBeBypassedAcrossRealFundedReservations()public {
        bytes32 id=_ready();_fold(id);ws8Engine.settle(id,_policy());
        uint64 now_=this.currentTime59();cheat54.warp((uint256(now_)/1 days+1)*1 days+100);_report(id);
        for(uint64 nonce=2;nonce<=4;nonce++){
            bytes32 next=_reserveWithoutProofs(nonce);
            if(nonce<4)_report(next);
            else {
                uint64 expected=abuse.playerNonce(TABLE,PLAYER_B);
                cheat54.expectRevert(PokerAbuseControls420.RateLimited.selector);cheat54.prank(PLAYER_B);
                abuse.report(next,PLAYER,PokerAbuseControls420.Category.GRIEFING,keccak256("fourth report"),expected);
            }
            // No proof is manufactured or accepted: use the canonical timeout
            // refund for these genuinely reserved but unproved hands.
            cheat54.warp(ws8Engine.fundedEvidenceDeadline(next));ws8Engine.cancelWithheldDeal(next);
        }
        require(ledger.totalChips(TABLE)==800&&coin.balanceOf(address(ws8Bonds))==1600,"reports changed escrow or collateral");
    }
    function test59HistoricalReportsUseFrozenPlayersAfterSeatReplacement()public {
        bytes32 id=_ready();_fold(id);ws8Engine.settle(id,_policy());cheat54.prank(PLAYER);ledger.leave(TABLE);
        address replacement=address(0x5903);_identity(replacement,keccak256("unrelated new seat owner"),uint64(this.currentTime59()+1 days));
        cap.grant(replacement,BetIds420.ACTION_POKER_BUY_IN,auth.scopeForTable(TABLE),true);coin.mint(replacement,400);
        cheat54.prank(replacement);coin.approve(address(ledger),400);cheat54.prank(replacement);ledger.buyIn(TABLE,0,400);
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);cheat54.prank(replacement);
        abuse.report(id,PLAYER_B,PokerAbuseControls420.Category.COLLUSION,keccak256("not my hand"),0);
        bytes32 c=_report(id);require(abuse.caseOf(c).target==PLAYER&&abuse.admittedPlayer(id,0)==PLAYER,"replacement rewrote admitted identity");
    }
    function test59FirstBindingCannotBeInstalledAfterLegacyDeposits()public {
        _idle();PokerSeatLedger420 otherLedger=new PokerSeatLedger420(address(registry));
        PokerConfidentialDeal420 otherDeal=new PokerConfidentialDeal420(address(registry),address(otherLedger),PROVIDER_A,PROVIDER_B);
        PokerAbuseControls420 otherControls=new PokerAbuseControls420(address(otherLedger),address(otherDeal));
        cheat54.prank(ADMIN);otherControls.configure(TABLE,_configuration());
        cheat54.prank(PLAYER);coin.approve(address(otherLedger),400);cheat54.prank(PLAYER);otherLedger.buyIn(TABLE,0,400);
        cheat54.expectRevert(PokerSeatLedger420.AbuseBindingInvalid.selector);cheat54.prank(ADMIN);otherLedger.bindAbuseControls(TABLE,address(otherControls));
        require(otherLedger.abuseControls(TABLE)==address(0)&&otherLedger.totalChips(TABLE)==400,"late binding rewrote legacy table");
    }
    function test59IdentityApprovalCannotReplayAcrossControlDeployments()public {
        _idle();PokerAbuseControls420 other=new PokerAbuseControls420(address(ledger),address(deal));
        cheat54.prank(ADMIN);other.configure(TABLE,_configuration());
        address player=address(0x5904);uint64 until=this.currentTime59()+1 days;
        bytes32 group=keccak256("same scoped group");bytes32 evidence=keccak256("same private dossier");
        cheat54.prank(AUDITOR_A);bytes32 own=abuse.proposeIdentity(TABLE,player,group,evidence,until,0);
        cheat54.prank(AUDITOR_A);bytes32 foreign=other.proposeIdentity(TABLE,player,group,evidence,until,0);
        require(own!=foreign,"identity approval was not deployment-bound");
        cheat54.expectRevert(PokerAbuseControls420.InvalidState.selector);cheat54.prank(AUDITOR_B);abuse.confirmIdentity(TABLE,player,1,foreign);
        cheat54.prank(AUDITOR_B);abuse.confirmIdentity(TABLE,player,1,own);
    }
}
