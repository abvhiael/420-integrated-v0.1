// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../src/bet/fantasy/FantasyDisputeController420.sol";
import "../../src/system/CapabilityRegistry420.sol";
import "../../src/oracle/OracleRouter420.sol";
import "../../src/oracle/OracleProviderRegistry420.sol";
import "../../src/oracle/OracleFeedRegistry420.sol";
import "../../src/oracle/OracleRiskPolicy420.sol";
import "../../src/oracle/OracleIds420.sol";
import "../../src/token/ERC20Template420.sol";

interface VmFantasy420 {
    function prank(address) external;
    function warp(uint256) external;
    function deal(address, uint256) external;
    function expectRevert(bytes4) external;
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
}

contract FantasyRejectingRecipient420 {
    function withdraw(FantasyDisputeController420 d) external {
        d.withdrawCredit();
    }

    receive() external payable {
        revert("no native transfer");
    }
}

contract FantasyReentrantRecipient420 {
    FantasyDisputeController420 controller;
    bool public blocked;

    function withdraw(FantasyDisputeController420 d) external {
        controller = d;
        d.withdrawCredit();
    }

    receive() external payable {
        try controller.withdrawCredit() {
            revert("reentrancy succeeded");
        } catch (bytes memory failure) {
            require(
                failure.length >= 4 && bytes4(failure) == FantasyDisputeController420.Reentrancy.selector,
                "expected actual reentrancy guard"
            );
            blocked = true;
        }
    }
}

/// Test-only contest boundary. This is NOT a production pool or sports-data verifier.
/// Real authorization, Identity420, OracleRouter420, tokens and bond transfers are used.
contract FantasyHostHarness420 is IFantasyDisputeHost420 {
    mapping(bytes32 => bytes32) public currentCandidate;

    function candidateIsCurrent(bytes32 id, bytes32 candidate) external view returns (bool) {
        return candidate != 0 && currentCandidate[id] == candidate;
    }
    FantasyDisputeController420 public controller;
    mapping(bytes32 => bool) public entrants;
    mapping(bytes32 => bool) public interests;

    constructor(FantasyDisputeController420 c) {
        controller = c;
    }

    function setEntrant(bytes32 subject, bool value) external {
        entrants[subject] = value;
    }

    function setInterested(bytes32 subject, bool value) external {
        interests[subject] = value;
    }

    function isEntrant(bytes32, bytes32 subject) external view returns (bool) {
        return entrants[subject];
    }

    function isInterested(bytes32, bytes32 subject) external view returns (bool) {
        return interests[subject];
    }

    function register(bytes32 id, FantasyDisputeController420.Config calldata c) external {
        controller.registerPool(id, c);
    }

    function start(bytes32 id, uint64 at) external {
        controller.startCorrection(id, at);
    }

    function publish(bytes32 id, FantasyDisputeController420.Candidate calldata c) external {
        currentCandidate[id] = controller.candidateDigest(id, c);
        controller.publishCandidate(id, c);
    }

    function cancel(bytes32 id) external {
        controller.cancelByHost(id, keccak256("host-cancellation"));
    }
}

abstract contract FantasyDisputeFixture420 {
    VmFantasy420 constant vm = VmFantasy420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant POOL = keccak256("nhl-pool");
    bytes32 constant FEED = keccak256("candidate-feed");
    bytes32 constant ISSUER = keccak256("verified-issuer");
    bytes32 constant TYPE = keccak256("fantasy-resolver");
    bytes32 constant PLAYER = keccak256("player-identity");
    bytes32 constant PLAYER2 = keccak256("second-player-identity");
    bytes32 constant ADMIN_ID = keccak256("admin-identity");
    bytes32 constant DELEGATE_ID = keccak256("delegate-identity");
    bytes32 constant ADMIN_CRED = keccak256("admin-credential");
    bytes32 constant DELEGATE_CRED = keccak256("delegate-credential");
    bytes32 constant PA = keccak256("reporter-a");
    bytes32 constant PB = keccak256("reporter-b");
    address constant USER = address(0x100);
    address constant USER2 = address(0x101);
    address constant ADMIN = address(0x200);
    address constant DELEGATE_USER = address(0x300);
    address constant COMMUNITY = address(0x400);
    address constant OP_A = address(0x500);
    address constant OP_B = address(0x600);
    CapabilityRegistry420 cap;
    BetAuthorization420 auth;
    Identity420 identity;
    OracleProviderRegistry420 providers;
    OracleFeedRegistry420 feeds;
    OracleRouter420 router;
    FantasyDisputeController420 d;
    FantasyHostHarness420 host;
    uint256 grantNonce;
    uint256 observationNonce;
    bytes32 grantId;
    bytes32 currentCandidate;
    uint64 currentReviewEnd;
    uint64 currentDeadline;

    function setUp() public virtual {
        vm.warp(1000);
        cap = new CapabilityRegistry420();
        cap.registerProtocolComponent(BetIds420.COMPONENT_BET, address(this));
        auth = new BetAuthorization420(address(cap));
        identity = new Identity420(address(this));
        identity.setIssuer(ISSUER, address(this), keccak256("issuer-evidence"), true);
        vm.prank(USER);
        identity.createProfile(PLAYER, keccak256("player"));
        vm.prank(USER2);
        identity.createProfile(PLAYER2, keccak256("player2"));
        vm.prank(ADMIN);
        identity.createProfile(ADMIN_ID, keccak256("admin"));
        vm.prank(DELEGATE_USER);
        identity.createProfile(DELEGATE_ID, keccak256("delegate"));
        identity.issueCredential(ADMIN_CRED, ISSUER, ADMIN_ID, TYPE, keccak256("verified-admin"), 0);
        identity.issueCredential(DELEGATE_CRED, ISSUER, DELEGATE_ID, TYPE, keccak256("verified-delegate"), 0);
        providers = new OracleProviderRegistry420(address(this));
        providers.setProvider(PA, OP_A, keccak256("a"), bytes32(0), true);
        providers.setProvider(PB, OP_B, keccak256("b"), bytes32(0), true);
        feeds = new OracleFeedRegistry420(address(this), address(providers));
        router = new OracleRouter420(
            address(this), address(providers), address(feeds), address(new OracleRiskPolicy420(address(this)))
        );
        d = new FantasyDisputeController420(
            address(auth), address(identity), address(router), TYPE, address(0), COMMUNITY
        );
        host = new FantasyHostHarness420(d);
        host.setEntrant(PLAYER, true);
        host.setEntrant(PLAYER2, true);
        _register(POOL, true, 100 ether, 0);
        _feed(FEED);
        vm.deal(USER, 1000 ether);
        vm.deal(USER2, 1000 ether);
    }

    function _grant(address who, bytes32 action, bytes32 scope) internal returns (bytes32 id) {
        id = keccak256(abi.encode("grant", ++grantNonce));
        cap.createGrant(id, who, BetIds420.COMPONENT_BET, action, scope, 0, 0, 0, 0, 0);
    }

    function _register(bytes32 id, bool paid, uint256 fee, uint256 prize) internal {
        _grant(address(host), d.REGISTER(), auth.scopeForContest(id));
        FantasyDisputeController420.Config memory c = FantasyDisputeController420.Config(
            address(host),
            keccak256("manifest"),
            keccak256("source-policy"),
            keccak256("scoring"),
            FEED,
            fee,
            prize,
            paid
        );
        host.register(id, c);
    }

    function _feed(bytes32 feed) internal {
        feeds.setFeed(
            feed,
            OracleIds420.FEED_OUTCOME,
            OracleIds420.AGGREGATION_QUORUM_EQUAL,
            7 days,
            0,
            2,
            keccak256("report-policy"),
            true
        );
        feeds.setSource(feed, PA, true);
        feeds.setSource(feed, PB, true);
    }

    function _report(bytes32 feed, bytes32 result) internal {
        vm.warp(block.timestamp + 1);
        vm.prank(OP_A);
        router.submitObservation(
            feed,
            PA,
            keccak256(abi.encode(++observationNonce)),
            0,
            result,
            keccak256("raw-a"),
            uint64(block.timestamp),
            10000
        );
        vm.prank(OP_B);
        router.submitObservation(
            feed,
            PB,
            keccak256(abi.encode(++observationNonce)),
            0,
            result,
            keccak256("raw-b"),
            uint64(block.timestamp),
            10000
        );
    }

    function _candidate(uint64 revision) internal pure returns (FantasyDisputeController420.Candidate memory) {
        return FantasyDisputeController420.Candidate(
            keccak256(abi.encode("stats", revision)),
            keccak256(abi.encode("rankings", revision)),
            keccak256(abi.encode("evidence", revision)),
            1000,
            revision
        );
    }

    function _publish(uint64 revision) internal {
        FantasyDisputeController420.Candidate memory c = _candidate(revision);
        _report(FEED, d.candidateDigest(POOL, c));
        host.publish(POOL, c);
        currentCandidate = d.candidateDigest(POOL, c);
        currentReviewEnd = d.poolOf(POOL).reviewUntil;
        currentDeadline = d.poolOf(POOL).deadline;
    }

    function _review() internal {
        host.start(POOL, 1000);
        _publish(1);
        vm.warp(d.poolOf(POOL).correctionEnd);
    }

    function _challenge() internal returns (bytes32 id) {
        vm.prank(USER);
        id = d.challenge{value: 50 ether}(POOL, PLAYER, keccak256("claim-evidence"));
        _grant(ADMIN, d.RESOLVE(), d.claimScope(id));
    }

    function _resolve(bytes32 claimId, bool upheld) internal {
        vm.warp(currentReviewEnd);
        vm.prank(ADMIN);
        d.resolve(claimId, upheld, keccak256("reason"), currentCandidate, ADMIN_ID, ADMIN_CRED, 0);
    }

    function _delegate(bytes32 claimId) internal returns (uint64 epoch) {
        _grant(address(this), d.ENABLE_DELEGATION(), auth.scopeGlobal());
        d.enableDelegation();
        grantId = _grant(ADMIN, d.DELEGATE(), d.claimScope(claimId));
        vm.prank(ADMIN);
        d.delegateResolver(claimId, DELEGATE_ID, DELEGATE_CRED, currentDeadline);
        epoch = d.delegationEpoch(claimId);
        vm.prank(DELEGATE_USER);
        d.acceptDelegation(claimId, epoch);
    }

    function _delegateResolve(bytes32 claimId, uint64 epoch) internal {
        vm.warp(currentReviewEnd);
        vm.prank(DELEGATE_USER);
        d.resolve(claimId, false, keccak256("reason"), currentCandidate, DELEGATE_ID, DELEGATE_CRED, epoch);
    }
}

contract FantasyDisputeController420Test is FantasyDisputeFixture420 {
    function testUnchallengedCanonicalCandidateFinalizesWithoutLiveFeedDependency() public {
        _review();
        vm.warp(d.poolOf(POOL).challengeEnd + 20 days);
        d.finalize(POOL);
        require(d.canSettle(POOL), "accepted root frozen");
    }

    function testDeniedBondGoesOnlyToCommunity() public {
        _review();
        bytes32 claimId = _challenge();
        _resolve(claimId, false);
        d.collectBond(claimId);
        require(d.credit(COMMUNITY) == 50 ether, "community credit");
        vm.prank(COMMUNITY);
        d.withdrawCredit();
        require(COMMUNITY.balance == 50 ether && d.totalLiability() == 0, "real transfer");
        d.finalize(POOL);
        require(d.canSettle(POOL), "final");
    }

    function testUpheldBondReturnedButInvalidCandidateCannotSettle() public {
        _review();
        bytes32 claimId = _challenge();
        _resolve(claimId, true);
        d.collectBond(claimId);
        vm.prank(USER);
        d.withdrawCredit();
        require(USER.balance == 1000 ether, "full return");
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.finalize(POOL);
    }

    function testUpheldCorrectionGetsFullReviewAndNoDeadlineExtension() public {
        _review();
        bytes32 claimId = _challenge();
        _resolve(claimId, true);
        uint64 deadline = d.poolOf(POOL).deadline;
        _publish(2);
        require(d.poolOf(POOL).deadline == deadline, "deadline fixed");
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.finalize(POOL);
        vm.warp(d.poolOf(POOL).reviewUntil);
        d.finalize(POOL);
    }

    function testTimeoutCancelsAndRefundsUnresolvedBond() public {
        _review();
        bytes32 claimId = _challenge();
        vm.warp(d.poolOf(POOL).deadline);
        d.expire(POOL);
        d.collectBond(claimId);
        vm.prank(USER);
        d.withdrawCredit();
        require(USER.balance == 1000 ether && !d.canSettle(POOL), "timeout refund");
    }

    function testHostCancellationRefundsPendingButRetainsDeniedOutcome() public {
        _review();
        bytes32 first = _challenge();
        vm.prank(USER2);
        bytes32 second = d.challenge{value: 50 ether}(POOL, PLAYER2, keccak256("other-evidence"));
        _resolve(first, false);
        host.cancel(POOL);
        d.collectBond(first);
        d.collectBond(second);
        require(d.credit(COMMUNITY) == 50 ether && d.credit(USER2) == 50 ether, "outcomes preserved");
    }

    function testFreePrizeBondTenPercentAndPrizeLessPoolZero() public {
        bytes32 free = keccak256("free");
        bytes32 noPrize = keccak256("free-no-prize");
        _register(free, false, 0, 500 ether);
        _register(noPrize, false, 0, 0);
        require(d.bondFor(free) == 50 ether && d.bondFor(noPrize) == 0, "free policy");
    }

    function testDuplicateClaimRejectedWithoutExtraCustody() public {
        _review();
        _challenge();
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        _challenge();
        require(d.totalLiability() == 50 ether, "one bond");
    }

    function testWrongPaymentRejectedAtomically() public {
        _review();
        vm.prank(USER);
        vm.expectRevert(FantasyDisputeController420.InvalidInput.selector);
        d.challenge{value: 49 ether}(POOL, PLAYER, keccak256("evidence"));
        require(d.totalLiability() == 0 && d.poolOf(POOL).pending == 0, "rollback");
    }

    function testNonEntrantCannotChallenge() public {
        _review();
        vm.prank(ADMIN);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.challenge(POOL, ADMIN_ID, keccak256("evidence"));
    }

    function testWrongIdentityControllerCannotChallenge() public {
        _review();
        vm.prank(ADMIN);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.challenge(POOL, PLAYER, keccak256("evidence"));
    }

    function testChallengeAtExactEndRejected() public {
        _review();
        vm.warp(d.poolOf(POOL).challengeEnd);
        vm.expectRevert(FantasyDisputeController420.InvalidTime.selector);
        _challenge();
    }

    function testChallengeBeforeCorrectionEndRejected() public {
        _review();
        vm.warp(d.poolOf(POOL).correctionEnd - 1);
        vm.expectRevert(FantasyDisputeController420.InvalidTime.selector);
        _challenge();
    }

    function testPendingClaimBlocksFinalization() public {
        _review();
        _challenge();
        vm.warp(d.poolOf(POOL).challengeEnd);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.finalize(POOL);
    }

    function testUnverifiedResolverRejected() public {
        _review();
        bytes32 c = _challenge();
        identity.revokeCredential(ADMIN_CRED);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _resolve(c, false);
    }

    function testResolverConflictRejected() public {
        _review();
        bytes32 c = _challenge();
        host.setInterested(ADMIN_ID, true);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _resolve(c, false);
    }

    function testEntrantCannotResolveEvenWithCapability() public {
        _review();
        bytes32 c = _challenge();
        host.setEntrant(ADMIN_ID, true);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _resolve(c, false);
    }

    function testResolutionAtDeadlineRejectedThenTimeoutWorks() public {
        _review();
        bytes32 c = _challenge();
        _grant(ADMIN, d.RESOLVE(), d.claimScope(c));
        vm.warp(d.poolOf(POOL).deadline);
        vm.prank(ADMIN);
        vm.expectRevert(FantasyDisputeController420.InvalidTime.selector);
        d.resolve(c, false, keccak256("reason"), currentCandidate, ADMIN_ID, ADMIN_CRED, 0);
        d.expire(POOL);
    }

    function testDuplicateDecisionAndBondCollectionRejected() public {
        _review();
        bytes32 c = _challenge();
        _resolve(c, false);
        d.collectBond(c);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        _resolve(c, false);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.collectBond(c);
    }

    function testScopedDelegateResolvesAfterAcceptance() public {
        _review();
        bytes32 c = _challenge();
        uint64 epoch = _delegate(c);
        _delegateResolve(c, epoch);
        require(d.claimOf(c).verdict == FantasyDisputeController420.Verdict.DENIED, "delegate verdict");
    }

    function testRevokedDelegationRejected() public {
        _review();
        bytes32 c = _challenge();
        uint64 epoch = _delegate(c);
        vm.prank(ADMIN);
        d.revokeDelegation(c);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _delegateResolve(c, epoch);
    }

    function testRevokedGrantorCapabilityRejected() public {
        _review();
        bytes32 c = _challenge();
        uint64 epoch = _delegate(c);
        cap.revokeGrant(grantId);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _delegateResolve(c, epoch);
    }

    function testRevokedDelegateCredentialRejected() public {
        _review();
        bytes32 c = _challenge();
        uint64 epoch = _delegate(c);
        identity.revokeCredential(DELEGATE_CRED);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _delegateResolve(c, epoch);
    }

    function testDelegateCannotSubdelegate() public {
        _review();
        bytes32 c = _challenge();
        _delegate(c);
        vm.prank(DELEGATE_USER);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.delegateResolver(c, ADMIN_ID, ADMIN_CRED, currentDeadline);
    }

    function testUnendorsedCandidateCannotPublish() public {
        host.start(POOL, 1000);
        _report(FEED, keccak256("wrong-root"));
        vm.expectRevert(FantasyDisputeController420.InvalidEvidence.selector);
        host.publish(POOL, _candidate(1));
    }

    function testCanonicalOracleVerdictCanExecuteWithoutAdmin() public {
        _review();
        bytes32 c = _challenge();
        vm.warp(d.poolOf(POOL).challengeEnd);
        bytes32 reason = keccak256("deterministic-replay-result");
        _feed(d.verdictFeed(c));
        _report(d.verdictFeed(c), d.verdictDigest(c, false, reason));
        d.resolveCanonical(c, false, reason);
        d.finalize(POOL);
        require(d.canSettle(POOL), "oracle verdict");
    }

    function testForgedCanonicalVerdictRejected() public {
        _review();
        bytes32 c = _challenge();
        vm.warp(d.poolOf(POOL).challengeEnd);
        _feed(d.verdictFeed(c));
        _report(d.verdictFeed(c), keccak256("forged"));
        vm.expectRevert(FantasyDisputeController420.InvalidEvidence.selector);
        d.resolveCanonical(c, false, keccak256("reason"));
    }

    function testCorrectionCannotExtendPastFixedDeadline() public {
        _review();
        bytes32 c = _challenge();
        _resolve(c, true);
        vm.warp(d.poolOf(POOL).deadline - 1 hours);
        FantasyDisputeController420.Candidate memory candidate = _candidate(2);
        _report(FEED, d.candidateDigest(POOL, candidate));
        vm.expectRevert(FantasyDisputeController420.InvalidTime.selector);
        host.publish(POOL, candidate);
        vm.warp(d.poolOf(POOL).deadline);
        d.expire(POOL);
    }

    function testNoCandidateExpiresInsteadOfFinalizing() public {
        host.start(POOL, 1000);
        vm.warp(d.poolOf(POOL).deadline);
        d.expire(POOL);
        require(!d.canSettle(POOL), "no fabricated result");
    }

    function testFuzzBondRoundingConservesBound(uint128 value) public {
        bytes32 id = keccak256(abi.encode("fuzz", value));
        _register(id, false, 0, value);
        uint256 bond = d.bondFor(id);
        require(bond * 10 >= value && (bond == 0 || (bond - 1) * 10 < value), "ceil ten percent");
    }

    function testFuzzPaidBondCeiling(uint128 value) public {
        uint256 fee = uint256(value) + 1;
        bytes32 id = keccak256(abi.encode("paid-fuzz", value));
        _register(id, true, fee, 0);
        uint256 bond = d.bondFor(id);
        require(bond * 2 >= fee && (bond - 1) * 2 < fee, "ceil half entry fee");
    }

    function testUnauthorizedHostRegistrationRejected() public {
        FantasyDisputeController420.Config memory cfg = d.configOf(POOL);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        host.register(keccak256("ungranted-pool"), cfg);
    }

    function testManifestCannotBeOverwritten() public {
        FantasyDisputeController420.Config memory cfg = d.configOf(POOL);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        host.register(POOL, cfg);
    }

    function testOnlyHostCanStartCancelOrPublish() public {
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.startCorrection(POOL, 1000);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.cancelByHost(POOL, keccak256("bad"));
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.publishCandidate(POOL, _candidate(1));
    }

    function testCorrectionClockCannotRestart() public {
        host.start(POOL, 1000);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        host.start(POOL, 1000);
    }

    function testBackdatedExpiredCorrectionRejected() public {
        vm.warp(1000 + 1 days);
        vm.expectRevert(FantasyDisputeController420.InvalidTime.selector);
        host.start(POOL, 1000);
    }

    function testPrematureResolutionRejected() public {
        _review();
        bytes32 c = _challenge();
        vm.prank(ADMIN);
        vm.expectRevert(FantasyDisputeController420.InvalidTime.selector);
        d.resolve(c, false, keccak256("reason"), currentCandidate, ADMIN_ID, ADMIN_CRED, 0);
    }

    function testStaleExpectedCandidateRejected() public {
        _review();
        bytes32 c = _challenge();
        vm.warp(currentReviewEnd);
        vm.prank(ADMIN);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.resolve(c, false, keccak256("reason"), keccak256("other-candidate"), ADMIN_ID, ADMIN_CRED, 0);
    }

    function testCandidateCannotChangeDuringChallengeWindow() public {
        _review();
        FantasyDisputeController420.Candidate memory candidate = _candidate(2);
        _report(FEED, d.candidateDigest(POOL, candidate));
        vm.expectRevert(FantasyDisputeController420.InvalidTime.selector);
        host.publish(POOL, candidate);
    }

    function testCandidateRevisionCannotRollBack() public {
        host.start(POOL, 1000);
        _publish(2);
        _report(FEED, d.candidateDigest(POOL, _candidate(1)));
        vm.expectRevert(FantasyDisputeController420.InvalidEvidence.selector);
        host.publish(POOL, _candidate(1));
    }

    function testCanonicalSingleReporterCannotFabricateQuorum() public {
        host.start(POOL, 1000);
        bytes32 digest = d.candidateDigest(POOL, _candidate(1));
        vm.warp(1001);
        vm.prank(OP_A);
        router.submitObservation(FEED, PA, keccak256("single"), 0, digest, bytes32(0), 1001, 10000);
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);
        host.publish(POOL, _candidate(1));
    }

    function testStaleCandidateOracleEvidenceRejected() public {
        host.start(POOL, 1000);
        _report(FEED, d.candidateDigest(POOL, _candidate(1)));
        feeds.setFeed(FEED, OracleIds420.FEED_OUTCOME, OracleIds420.AGGREGATION_QUORUM_EQUAL, 1, 0, 2, bytes32(0), true);
        vm.warp(1010);
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);
        host.publish(POOL, _candidate(1));
    }

    function testConflictingSourcesDoNotProduceAveragedFacts() public {
        host.start(POOL, 1000);
        vm.warp(1001);
        bytes32 digest = d.candidateDigest(POOL, _candidate(1));
        vm.prank(OP_A);
        router.submitObservation(FEED, PA, keccak256("conflict-a"), 0, digest, bytes32(0), 1001, 10000);
        vm.prank(OP_B);
        router.submitObservation(
            FEED, PB, keccak256("conflict-b"), 0, keccak256("other-facts"), bytes32(0), 1001, 10000
        );
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);
        host.publish(POOL, _candidate(1));
    }

    function testCrossPoolCandidateReplayRejected() public {
        bytes32 other = keccak256("other-pool");
        _register(other, true, 100 ether, 0);
        host.start(other, 1000);
        _report(FEED, d.candidateDigest(POOL, _candidate(1)));
        vm.expectRevert(FantasyDisputeController420.InvalidEvidence.selector);
        host.publish(other, _candidate(1));
    }

    function testDelegationDisabledAtLaunch() public {
        _review();
        bytes32 c = _challenge();
        _grant(ADMIN, d.DELEGATE(), d.claimScope(c));
        vm.prank(ADMIN);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.delegateResolver(c, DELEGATE_ID, DELEGATE_CRED, currentDeadline);
    }

    function testUnacceptedDelegationCannotResolve() public {
        _review();
        bytes32 c = _challenge();
        _grant(address(this), d.ENABLE_DELEGATION(), auth.scopeGlobal());
        d.enableDelegation();
        _grant(ADMIN, d.DELEGATE(), d.claimScope(c));
        vm.prank(ADMIN);
        d.delegateResolver(c, DELEGATE_ID, DELEGATE_CRED, currentDeadline);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _delegateResolve(c, 1);
    }

    function testExpiredDelegateCannotResolve() public {
        _review();
        bytes32 c = _challenge();
        _delegate(c);
        vm.prank(ADMIN);
        d.delegateResolver(c, DELEGATE_ID, DELEGATE_CRED, currentReviewEnd);
        vm.prank(DELEGATE_USER);
        d.acceptDelegation(c, 2);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _delegateResolve(c, 2);
    }

    function testIdentityKeyRotationRevokesOldDelegateSigner() public {
        _review();
        bytes32 c = _challenge();
        uint64 epoch = _delegate(c);
        vm.prank(DELEGATE_USER);
        identity.transferProfileController(DELEGATE_ID, address(0x777));
        vm.prank(address(0x777));
        identity.acceptProfileController(DELEGATE_ID);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        _delegateResolve(c, epoch);
    }

    function testUnresolvedClaimCannotBeCollectedAsDenied() public {
        _review();
        bytes32 c = _challenge();
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.collectBond(c);
    }

    function testFinalizedPoolCannotBeCanceled() public {
        _review();
        vm.warp(currentReviewEnd);
        d.finalize(POOL);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        host.cancel(POOL);
    }

    function testCleanPoolCannotBeTimeoutCanceled() public {
        _review();
        vm.warp(currentDeadline);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.expire(POOL);
        d.finalize(POOL);
    }

    function testCorrectedCandidateCanBeChallengedAndTimeoutRefunded() public {
        _review();
        bytes32 first = _challenge();
        _resolve(first, true);
        _publish(2);
        bytes32 second = _challenge();
        require(first != second, "generation-bound claims");
        vm.warp(currentDeadline);
        d.expire(POOL);
        d.collectBond(first);
        d.collectBond(second);
        require(d.credit(USER) == 100 ether, "both bonds refunded");
    }

    function testTokenBondCustodyAndExactCommunityPayout() public {
        ERC20Template420 token = new ERC20Template420(
            "Test asset",
            "T",
            address(this),
            1000 ether,
            1000 ether,
            false,
            false,
            false,
            false,
            keccak256("test-template")
        );
        FantasyDisputeController420 tokenController = new FantasyDisputeController420(
            address(auth), address(identity), address(router), TYPE, address(token), COMMUNITY
        );
        FantasyHostHarness420 tokenHost = new FantasyHostHarness420(tokenController);
        _grant(address(tokenHost), tokenController.REGISTER(), auth.scopeForContest(POOL));
        FantasyDisputeController420.Config memory cfg = d.configOf(POOL);
        cfg.host = address(tokenHost);
        tokenHost.register(POOL, cfg);
        tokenHost.setEntrant(PLAYER, true);
        tokenHost.start(POOL, 1000);
        _report(FEED, tokenController.candidateDigest(POOL, _candidate(1)));
        tokenHost.publish(POOL, _candidate(1));
        token.transfer(USER, 100 ether);
        vm.prank(USER);
        token.approve(address(tokenController), 50 ether);
        vm.warp(tokenController.poolOf(POOL).correctionEnd);
        vm.prank(USER);
        bytes32 c = tokenController.challenge(POOL, PLAYER, keccak256("token-claim"));
        require(token.balanceOf(address(tokenController)) == 50 ether, "real token escrow");
        _grant(ADMIN, tokenController.RESOLVE(), tokenController.claimScope(c));
        vm.warp(tokenController.poolOf(POOL).challengeEnd);
        bytes32 candidate = tokenController.claimOf(c).candidate;
        vm.prank(ADMIN);
        tokenController.resolve(c, false, keccak256("reason"), candidate, ADMIN_ID, ADMIN_CRED, 0);
        tokenController.collectBond(c);
        vm.prank(COMMUNITY);
        tokenController.withdrawCredit();
        require(token.balanceOf(COMMUNITY) == 50 ether && tokenController.totalLiability() == 0, "exact token delivery");
    }

    function testRejectingCommunityCannotBlockFinalityOrOtherCredit() public {
        FantasyRejectingRecipient420 rejector = new FantasyRejectingRecipient420();
        d = new FantasyDisputeController420(
            address(auth), address(identity), address(router), TYPE, address(0), address(rejector)
        );
        host = new FantasyHostHarness420(d);
        host.setEntrant(PLAYER, true);
        _register(POOL, true, 100 ether, 0);
        _review();
        bytes32 c = _challenge();
        _resolve(c, false);
        d.collectBond(c);
        d.finalize(POOL);
        vm.expectRevert(FantasyDisputeController420.TransferFailed.selector);
        rejector.withdraw(d);
        require(
            d.credit(address(rejector)) == 50 ether && d.totalLiability() == 50 ether && d.canSettle(POOL),
            "failed withdrawal rolled back"
        );
    }

    function testReentrantRecipientCannotWithdrawTwice() public {
        FantasyReentrantRecipient420 recipient = new FantasyReentrantRecipient420();
        d = new FantasyDisputeController420(
            address(auth), address(identity), address(router), TYPE, address(0), address(recipient)
        );
        host = new FantasyHostHarness420(d);
        host.setEntrant(PLAYER, true);
        _register(POOL, true, 100 ether, 0);
        _review();
        bytes32 c = _challenge();
        _resolve(c, false);
        d.collectBond(c);
        recipient.withdraw(d);
        require(
            recipient.blocked() && address(recipient).balance == 50 ether && d.totalLiability() == 0,
            "single withdrawal"
        );
    }

    function testEvidenceVariationCannotFloodSameRevision() public {
        _review();
        _challenge();
        vm.prank(USER);
        vm.expectRevert(FantasyDisputeController420.InvalidState.selector);
        d.challenge{value: 50 ether}(POOL, PLAYER, keccak256("different-evidence"));
        require(d.poolOf(POOL).pending == 1 && d.totalLiability() == 50 ether, "one per revision");
    }

    function testFreePoolActualBondRefund() public {
        bytes32 id = keccak256("free-prize-pool");
        _register(id, false, 0, 500 ether);
        host.start(id, 1000);
        FantasyDisputeController420.Candidate memory candidate = _candidate(1);
        bytes32 digest = d.candidateDigest(id, candidate);
        _report(FEED, digest);
        host.publish(id, candidate);
        vm.warp(d.poolOf(id).correctionEnd);
        vm.prank(USER);
        bytes32 c = d.challenge{value: 50 ether}(id, PLAYER, keccak256("free-claim"));
        _grant(ADMIN, d.RESOLVE(), d.claimScope(c));
        vm.warp(d.poolOf(id).challengeEnd);
        vm.prank(ADMIN);
        d.resolve(c, true, keccak256("upheld"), digest, ADMIN_ID, ADMIN_CRED, 0);
        d.collectBond(c);
        vm.prank(USER);
        d.withdrawCredit();
        require(USER.balance == 1000 ether && d.totalLiability() == 0, "free bond full return");
    }

    function testPrizeLessFreePoolChallengeRequiresNoBond() public {
        bytes32 id = keccak256("free-without-prize");
        _register(id, false, 0, 0);
        host.start(id, 1000);
        FantasyDisputeController420.Candidate memory candidate = _candidate(1);
        _report(FEED, d.candidateDigest(id, candidate));
        host.publish(id, candidate);
        vm.warp(d.poolOf(id).correctionEnd);
        vm.prank(USER);
        bytes32 c = d.challenge(id, PLAYER, keccak256("no-prize-claim"));
        require(d.claimOf(c).bond == 0 && d.poolOf(id).pending == 1, "zero bond claim");
    }

    function testDifferentIdentityWithSamePayerCannotSelfAdjudicate() public {
        _review();
        bytes32 c = _challenge();
        bytes32 alternate = keccak256("alternate");
        bytes32 credential = keccak256("alternate-cred");
        vm.prank(USER);
        identity.createProfile(alternate, keccak256("alt"));
        identity.issueCredential(credential, ISSUER, alternate, TYPE, keccak256("verified"), 0);
        _grant(USER, d.RESOLVE(), d.claimScope(c));
        vm.warp(currentReviewEnd);
        vm.prank(USER);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.resolve(c, false, keccak256("self"), currentCandidate, alternate, credential, 0);
    }

    function testVerifiedIdentityAloneDoesNotGrantResolutionAuthority() public {
        _review();
        bytes32 c = _challenge();
        vm.warp(currentReviewEnd);
        vm.prank(DELEGATE_USER);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.resolve(c, false, keccak256("reason"), currentCandidate, DELEGATE_ID, DELEGATE_CRED, 0);
    }

    function testClaimScopedCapabilityCannotResolveAnotherClaim() public {
        _review();
        bytes32 first = _challenge();
        vm.prank(USER2);
        bytes32 second = d.challenge{value: 50 ether}(POOL, PLAYER2, keccak256("second"));
        vm.warp(currentReviewEnd);
        vm.prank(ADMIN);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.resolve(second, false, keccak256("reason"), currentCandidate, ADMIN_ID, ADMIN_CRED, 0);
        require(d.claimOf(first).verdict == FantasyDisputeController420.Verdict.PENDING, "first untouched");
    }

    function testDelegateCannotUseAnotherSubjectsCredential() public {
        _review();
        bytes32 c = _challenge();
        _grant(address(this), d.ENABLE_DELEGATION(), auth.scopeGlobal());
        d.enableDelegation();
        _grant(ADMIN, d.DELEGATE(), d.claimScope(c));
        vm.prank(ADMIN);
        vm.expectRevert(FantasyDisputeController420.Unauthorized.selector);
        d.delegateResolver(c, DELEGATE_ID, ADMIN_CRED, currentDeadline);
    }

    function testFuzzNativeBondConservation(uint96 rawFee, bool upheld) public {
        uint256 fee = uint256(rawFee) + 1;
        bytes32 id = keccak256("conservation-pool");
        _register(id, true, fee, 0);
        host.start(id, 1000);
        FantasyDisputeController420.Candidate memory candidate = _candidate(1);
        bytes32 digest = d.candidateDigest(id, candidate);
        _report(FEED, digest);
        host.publish(id, candidate);
        vm.warp(d.poolOf(id).correctionEnd);
        uint256 bond = d.bondFor(id);
        vm.deal(USER, bond + 7);
        vm.prank(USER);
        bytes32 c = d.challenge{value: bond}(id, PLAYER, keccak256("conservation"));
        require(address(d).balance == bond && d.totalLiability() == bond, "funded liability");
        _grant(ADMIN, d.RESOLVE(), d.claimScope(c));
        vm.warp(d.poolOf(id).challengeEnd);
        vm.prank(ADMIN);
        d.resolve(c, upheld, keccak256("reason"), digest, ADMIN_ID, ADMIN_CRED, 0);
        d.collectBond(c);
        address beneficiary = upheld ? USER : COMMUNITY;
        uint256 beforeBalance = beneficiary.balance;
        vm.prank(beneficiary);
        d.withdrawCredit();
        require(
            beneficiary.balance == beforeBalance + bond && d.totalLiability() == 0 && address(d).balance == 0,
            "conserved every unit"
        );
    }
}
