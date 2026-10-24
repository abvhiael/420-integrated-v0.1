#!/usr/bin/env python3
"""Require actual successful execution of every 5A.5 and affected native owner."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FUNDED = '''ProductionConstructorFitsSixteenMillionGasBudget
FixedModulesFitDeploymentLimitsAndRejectDirectMutation
ImmutableTurnPolicyRejectsStarterChosenClock
PolicyRequiresGovernanceBoundResolverAndValidDuration
EveryActionAtomicallyCommitsActorClockAndDeadline
ControllerCannotOverwriteOrExpireNativeTurnClock
SignedActionsRemainRelayerSafeAndReplayProtected
WrongOwnerNonceAndChainSignaturesCannotAdvanceTurn
RevokedActionCapabilityCannotActButTimeoutStaysPermissionless
SignerSerialInvalidatesOldSignatureAfterRotateBack
ActionWinsExactDeadlineTieAndTimeoutCannotFireEarly
ExpiredSignedActionLosesToDeterministicTimeoutFoldAndSettlement
TimeoutChecksWithoutBetAndCannotReplayAcrossRevealWindow
OldDeadlineCannotExpireNextActorsFreshTurn
DisputeCannotFreezeTurnOrRewriteObjectiveOutcome
PausedTableCannotStartButDeliveredEscrowRecovers
SuspendedOperatorCannotStartButDeliveredEscrowRecovers
EmergencyCannotStartButDeliveredEscrowRecovers
ExistingFundedPlaySurvivesNewHandPauseAndOperatorSuspension
GenuineAllInRunoutRequiresProofsButNoArtificialTurns
RefundedRevealWindowCannotResumeBettingOrDiscloseCards'''.splitlines()
KERNEL = '''EverySparseSeatMaskHasCanonicalBlindsAndTurn
ThreeToHeadsUpNeverRepeatsSurvivingBigBlind
HeadsUpButtonAndBlindsRotateBetweenHands
ShortBigBlindChargesOnlyActualLoneOpponentCall
MatchedLoneBlindAndBothAllInSkipArtificialActions
MultiwayShortBlindRetainsNominalBringInWithLiveOpponents
NoRaiseIntoEmptySidePotAgainstOnlyAllInPlayers
CumulativeShortAllInsReopenOnlyWithAnotherLiveOpponent
SingleShortAllInDoesNotReopenPreviouslyActingSeat
AllFourRoundsWaitForEveryPendingNonAllInSeat
FuzzBlindConservationAndPendingActor'''.splitlines()
SHOWDOWN = '''SharedBoardTieSealsCanonicalReceipt
GenuineSingleWinnerShowdown
UncontestedWinnerNeedsNoHoleOrBoardDisclosure
EverySurvivorMustHaveBothAuthenticatedHoleCards
PrematureSettlementAndRankingCannotChooseWinner
FoldedHoleCardsCannotBePubliclyOpened
CallerCannotSubmitPayoutVectorToLedger
OutOfTablePayoutSlotsAreRejected
ChangedCalculatorRuntimeCannotSettle
ChangedCalculatorRuntimeCannotProposeDisputedWinner
RakeTransferFailureRollsBackReceiptAndCustody
BondCloseFailureRollsBackPaidRakeAndReceipt
RakeCallbackCannotPublishSecondReceiptOrSettleTwice
DisputedShowdownAppealHoldsPaymentUntilExactDeadline
ReceiptAndRanksSurviveCashoutAndTablePause
WrongRakePolicyCannotPublishReceipt
LateShowdownProofsClosePendingRecoveryOnSettlement
TerminalReceiptRejectsReplayActionsAndRecovery'''.splitlines()
ABUSE = ['test59LegitimateProtectedFundedHandAndGovernedRestriction', 'test59UnconfirmedIdentityCannotFundASeat', 'test59RelatedAccountsCannotCoseatEvenWhenOtherSitsOut', 'test59IdentityChangeCannotAdmitRelatedExistingSeats', 'test59PendingIdentityCannotUnilaterallyRevokeConfirmedAdmission', 'test59IdentityApprovalBindsExactProposalAndLiveDistinctAuditors', 'test59ControllerProviderAndPlayerCannotAttestThemselves', 'test59ExpiredAndRevokedIdentityCannotStartAnotherHand', 'test59SelfExclusionOnlyTightensAndPreservesFundedHandAndExit', 'test59PlayerAvoidanceIsSymmetricAndCannotRewriteCurrentHand', 'test59LeaveAndSitOutCooldownsCannotBeBypassedByRebuyOrLegacyReturn', 'test59BindingAndPolicyAreImmutableAndCannotBeInstalledAfterFunding', 'test59OnlyCanonicalLedgerCanAdmitOrRecordDeals', 'test59PendingDealRequestsAreRateLimitedAndReplaceableAfterDeadline', 'test59ReportsRequireFrozenParticipantsAndCannotFreezePayment', 'test59DuplicateReportsAndCrossIntentNonceReplayAreRejected', 'test59OneReviewerControllerProviderOrSubjectCannotRestrict', 'test59RestrictionApprovalAndActivationRecheckExactEvidenceAndLiveRoles', 'test59AppealDelaysOnceAndCannotHoldCurrentHandOrSettlement', 'test59MidHandRestrictionOnlyGatesFutureAdmission', 'test59ExpiredReviewCannotBeExecutedLaterAndRestrictionExpiresExactly', 'test59BoundedRestrictionExpiresAndDoesNotDestroyHistoricalReceipt', 'test59IndependentLiftCannotReplayOrClearAReplacementRestriction', 'test59ReviewerMayWithdrawAfterAppealWithoutAnyCustodyChange', 'test59UnavailablePolicyFailsNewFundingButNeverTrapsFundedExit', 'test59MissingProviderRecoveryStillRefundsARestrictedPlayer', 'test59DailyReportQuotaCannotBeBypassedAcrossRealFundedReservations', 'test59HistoricalReportsUseFrozenPlayersAfterSeatReplacement', 'test59FirstBindingCannotBeInstalledAfterLegacyDeposits', 'test59IdentityApprovalCannotReplayAcrossControlDeployments']
LIFECYCLE = ['test58DisconnectedTurnReconnectionAndTimeoutEvidence', 'test58QueuedExitAfterGenuineShowdown', 'test58QueuedSitOutCannotChangeCurrentCardsActionsOrSnapshot', 'test58QueuedExitCannotCashOutActiveOrFoldedHand', 'test58CancelExitDoesNotSilentlyReturnOrCancelSitOut', 'test58ReconnectRequiresExplicitReturnAndDoesNotGrantNewTurn', 'test58TimeoutCheckContinuesVerifiedStreetAndSitsOutNextHand', 'test58DisconnectedAllInPlayerRetainsProvenShowdownEligibility', 'test58DisconnectDuringFundedAdmissionDoesNotInvalidateExistingHand', 'test58IdleDisconnectedSeatCannotBeginNewDeal', 'test58IdleEligibilityChangeInvalidatesPreparedUnfundedDeal', 'test58OnlySeatOwnerCanRequestPresenceOrExit', 'test58StaleNonceAndSeatEpochCannotOverwriteNewerIntent', 'test58TimeoutInvalidatesStaleLifecycleIntent', 'test58TransportAndOtherEnginesCannotFabricateTimeout', 'test58RevokedPresenceCapabilityCannotChangeIntentButTimeoutWorks', 'test58QueuedCashoutRechecksCurrentWithdrawalCapability', 'test58ExitRemainsAvailableWhenPausedAndOperatorSuspended', 'test58UnavailableProvidersRefundThenQueuedExit', 'test58DisconnectedRecipientWithoutAcknowledgmentUsesBoundedRefund', 'test58QueuedLeaveSurvivesBoundedMissingStreetRecovery', 'test58FailedCashoutAtomicallyPreservesSeatIntentAndEscrow', 'test58CashoutCallbackCannotReenterCompleteLeave', 'test58ExitReplayAndRebuyCannotReusePreviousSeatIntent', 'test58ReconnectSnapshotRotatedSignerAndCanonicalTurn', 'test58SnapshotRejectsWrongHandAndUnknownTable', 'test58CannotReturnWhileDisconnectedOrLeaving']
OWNERS = ['PokerNLHEBetting54Case'+str(i)+'Test' for i in range(1,11)] + [
    'PokerNLHEBetting54WS3AdversarialTest', 'PokerNativeOutcome54Test',
    'PokerLiveCardReveals54Test', 'PokerActionDisputeClock54Test',
    'PokerWS5Recovery54Test', 'PokerLedgerReentrancy54Test',
    'PokerCanonicalSettlement54Test', 'PokerHandRank54Test', 'PokerSeatLedger53Test', 'PokerConfidentialDeal54Test']

def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: verify-poker-5a5-execution.py evidence-directory report.json')
    directory, output = map(Path, sys.argv[1:])
    files = sorted(directory.glob('foundry-*.json'))
    if not files:
        raise SystemExit('no actual Foundry execution')
    owners = {}
    for file in files:
        data = json.loads(file.read_text(encoding='utf-8-sig'))
        if not data:
            raise SystemExit('zero-test execution: ' + str(file))
        for path, suite in data.items():
            owner = path.rsplit(':', 1)[-1]
            tests = suite['test_results']
            if not tests or any(r['status'] != 'Success' for r in tests.values()):
                raise SystemExit('failed/skipped/empty native owner: ' + owner)
            normalized = {name.split('(')[0]: r for name, r in tests.items()}
            owners.setdefault(owner, {}).update(normalized)
    mandatory = {}
    for owner, names, prefix in [
            ('PokerBettingRounds55Test', FUNDED, 'test55'),
            ('PokerBettingKernel55Test', KERNEL, 'test')]:
        tests = owners.get(owner, {})
        for suffix in names:
            name = prefix + suffix
            if name not in tests:
                raise SystemExit('mandatory actual test missing: ' + owner + '.' + name)
            mandatory[owner+'.'+name] = 'Success'
        if owner == 'PokerBettingKernel55Test':
            fuzz = tests['testFuzzBlindConservationAndPendingActor']
            if fuzz.get('kind', {}).get('Fuzz', {}).get('runs', 0) < 2500:
                raise SystemExit('at least 2500 actual blind-conservation fuzz executions required')
    for owner in OWNERS:
        if owner not in owners:
            raise SystemExit('affected inherited native owner was not executed: ' + owner)
    evaluation_names = [
        'NineTierRakeRemainderCannotDeadlockSettlement',
        'SparseSeatsSplitEachPotAndAssignOddChipsClockwise',
        'NineDifferentAllInLevelsSelectOnlyCoveredWinners',
        'InvalidGrossButtonFeeAndWinnerRejected',
        'FullWidthPotAndExactRakeDoNotOverflow',
        'TwoTripsThreePairsAndBoardOnlyBestFive',
        'EveryHandCategoryHasCanonicalOrdering',
        'FuzzProportionalChargeBounds',
        'IndependentSevenCardVectorsAgainstNativeEvaluator',
        'IndependentTwoThroughNineSeatPotVectors',
        'IndependentFullWidthIntegerDivisionVectors']
    evaluation = owners.get('PokerEvaluation56Test', {})
    if set(evaluation) != {'test'+name for name in evaluation_names}:
        raise SystemExit('mandatory 5A.6 native execution missing or unexpected')
    if evaluation['testFuzzProportionalChargeBounds'].get('kind', {}).get('Fuzz', {}).get('runs', 0) < 2500:
        raise SystemExit('2500 actual 5A.6 fuzz executions required')
    showdown = owners.get('PokerShowdown57Test', {})
    if set(showdown) != {'test57'+name for name in SHOWDOWN}:
        raise SystemExit('mandatory 5A.7 funded showdown execution missing or unexpected')
    lifecycle = owners.get('PokerPlayerLifecycle58Test', {})
    if set(lifecycle) != set(LIFECYCLE):
        raise SystemExit('mandatory actual 5A.8 lifecycle execution missing or unexpected')
    abuse = owners.get('PokerAbuseProtection59Test', {})
    if set(abuse) != set(ABUSE):
        raise SystemExit('mandatory actual 5A.9 protected-hand execution missing or unexpected')
    tap = directory / 'node.tap'
    text = tap.read_text(encoding='utf-8-sig')
    passes = re.findall(r'^# pass (\d+)\s*$', text, re.M)
    if len(passes) != 1 or int(passes[0]) < 74 or re.search(r'^[ \t]*not ok\b|^[ \t]*(?:ok|not ok)\b[^\r\n]*#\s*(?:SKIP|TODO)\b', text, re.M | re.I):
        raise SystemExit('actual independent replay execution incomplete or failed/skipped')
    for field in ('fail', 'cancelled', 'skipped', 'todo'):
        if not re.search(r'^# '+field+r' 0\s*$', text, re.M):
            raise SystemExit('nonzero/missing Node result: '+field)
    args = ['git', '-c', 'safe.directory='+ROOT.as_posix()]
    sha = subprocess.check_output(args+['rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = subprocess.run(args+['diff', '--quiet', 'HEAD'], cwd=ROOT).returncode != 0
    for file in ('contracts/test/BetPokerAbuseProtection59.t.sol',
                 'contracts/src/bet/PokerAbuseControls420.sol',
                 'contracts/src/bet/IPokerAbuseControls420.sol',
                 'clients/420bet-poker/crypto/nlhe-abuse-monitor.mjs',
                 'scripts/bet/verify-poker-5a9-abuse.mjs',
                 'contracts/test/BetPokerPlayerLifecycle58.t.sol',
                 'contracts/src/bet/PokerPlayerRecovery420.sol',
                 'clients/420bet-poker/crypto/nlhe-player-lifecycle.mjs',
                 'contracts/test/BetPokerShowdown57.t.sol',
                 'clients/420bet-poker/zkshuffle/fixtures/ws8/winner/manifest.json',
                 'contracts/test/BetPokerBettingRounds55.t.sol',
                 'clients/420bet-poker/crypto/nlhe-5a5.test.mjs',
                 'scripts/bet/verify-poker-5a5-execution.py',
                 'contracts/src/bet/PokerNLHEStorage420.sol',
                 'contracts/src/bet/PokerNLHEModules420.sol',
                 'contracts/src/bet/PokerNLHEModuleFactories420.sol'):
        dirty |= subprocess.run(args+['ls-files', '--error-unmatch', file], cwd=ROOT,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0
    report = dict(level=1, qualifiedSHA=None if dirty else sha,
                  sourceCommit=sha, trackedWorkingTreeDirty=dirty,
                  mandatoryTests=mandatory, abuse5A9Tests={name:'Success' for name in abuse}, lifecycle5A8Tests={name:'Success' for name in lifecycle}, showdown5A7Tests={name: 'Success' for name in showdown}, evaluation5A6Tests={name: 'Success' for name in evaluation}, nativeOwners={o: len(t) for o,t in owners.items()},
                  totalPassed=sum(map(len, owners.values())), independentTestsPassed=int(passes[0]),
                  executionSHA256={p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files+[tap]})
    output.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
