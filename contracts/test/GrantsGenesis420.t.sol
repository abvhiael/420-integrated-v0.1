// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/grants/GrantIds420.sol";
import "../src/grants/GrantAuthorization420.sol";
import "../src/grants/GrantProgramRegistry420.sol";
import "../src/grants/GrantApplicationRegistry420.sol";
import "../src/grants/GrantAwardRegistry420.sol";
import "../src/grants/GrantMilestoneRegistry420.sol";

interface VmGrants420 {
    function prank(
        address
    ) external;
    function warp(
        uint256
    ) external;
}

contract MockGrantCaps420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal ok;

    function key(
        address p,
        bytes32 c,
        bytes32 a,
        bytes32 s
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(p, c, a, s));
    }

    function set(
        address p,
        bytes32 c,
        bytes32 a,
        bytes32 s,
        bool v
    ) external {
        ok[key(p, c, a, s)] = v;
    }

    function grant(
        bytes32
    ) external pure returns (CapabilityGrant memory g) {
        return g;
    }

    function isAuthorized(
        address p,
        bytes32 c,
        bytes32 a,
        bytes32 s,
        uint256
    ) external view returns (bool) {
        return ok[key(p, c, a, s)];
    }
}

contract MockGrantTreasury420 is ITreasuryDisbursementGrant420 {
    mapping(bytes32 => Disbursement) internal ds;

    function set(
        bytes32 id,
        bytes32 budget,
        address recipient,
        address asset,
        uint128 amount,
        bytes32 civic,
        bytes32 purpose,
        State state,
        bytes32 releaseHash
    ) external {
        ds[id] = Disbursement(
            budget, recipient, asset, amount, 0, type(uint64).max, civic, purpose, releaseHash, state, true
        );
    }

    function disbursement(
        bytes32 id
    ) external view returns (Disbursement memory) {
        return ds[id];
    }
}

contract GrantsGenesis420Test {
    VmGrants420 constant vm = VmGrants420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant DELEGATE = address(0xD1E);
    address constant ASSET = address(0x420);

    struct Env {
        MockGrantCaps420 caps;
        GrantAuthorization420 auth;
        GrantProgramRegistry420 programs;
        GrantApplicationRegistry420 applications;
        GrantAwardRegistry420 awards;
        MockGrantTreasury420 treasury;
        GrantMilestoneRegistry420 milestones;
    }

    function setup() internal returns (Env memory e) {
        e.caps = new MockGrantCaps420();
        e.auth = new GrantAuthorization420(address(e.caps));
        e.programs = new GrantProgramRegistry420(address(this));
        e.applications = new GrantApplicationRegistry420(address(e.auth), address(e.programs));
        e.awards = new GrantAwardRegistry420(address(this), address(e.programs), address(e.applications));
        e.programs.bindAwardRegistry(address(e.awards));
        e.treasury = new MockGrantTreasury420();
        e.milestones = new GrantMilestoneRegistry420(
            address(this), address(e.auth), address(e.programs), address(e.awards), address(e.treasury)
        );
    }

    function makeProgram(
        Env memory e
    ) internal returns (bytes32 p, bytes32 budget, bytes32 civic) {
        p = keccak256("program");
        budget = keccak256("budget");
        civic = keccak256("civic");
        e.programs
            .createProgram(
                p,
                GrantIds420.PROGRAM_DEVELOPMENT,
                budget,
                civic,
                1000,
                700,
                uint64(block.timestamp),
                uint64(block.timestamp + 1000),
                keccak256("program-meta")
            );
    }

    function submit(
        Env memory e,
        bytes32 p,
        uint128 amount,
        uint256 nonce
    ) internal returns (bytes32 app) {
        bytes32 content = keccak256(abi.encode("application", nonce));
        app = e.applications.canonicalId(p, ALICE, nonce, content);
        vm.prank(ALICE);
        e.applications.submit(app, p, ALICE, nonce, amount, content);
    }

    function award(
        Env memory e,
        bytes32 app,
        uint128 amount
    ) internal returns (bytes32 a) {
        bytes32 terms = keccak256(abi.encode("terms", app));
        a = e.awards.canonicalId(app, ALICE, amount, terms);
        e.awards.createAward(a, app, ALICE, amount, terms);
    }

    function claimedMilestone(
        Env memory e,
        bytes32 awardId,
        uint32 ordinal,
        uint128 amount,
        bytes32 purpose
    ) internal returns (bytes32 milestoneId) {
        milestoneId = e.milestones.canonicalId(awardId, ordinal, amount, purpose);
        e.milestones.createMilestone(milestoneId, awardId, ordinal, amount, purpose);
        vm.prank(ALICE);
        e.milestones.submitClaim(milestoneId, keccak256(abi.encode("evidence", ordinal)));
    }

    function testApplicationReplayAndDelegationDefaultDeny() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);
        bytes32 content = keccak256("delegated");
        bytes32 id = e.applications.canonicalId(p, ALICE, 1, content);

        vm.prank(DELEGATE);
        (bool denied,) = address(e.applications)
            .call(
                abi.encodeWithSelector(e.applications.submit.selector, id, p, ALICE, uint256(1), uint128(500), content)
            );
        require(!denied, "default allow");

        e.caps
            .set(
                DELEGATE,
                GrantIds420.COMPONENT_GRANTS,
                GrantIds420.ACTION_SUBMIT_APPLICATION,
                e.auth.scopeProgram(p),
                true
            );
        vm.prank(DELEGATE);
        e.applications.submit(id, p, ALICE, 1, 500, content);

        vm.prank(ALICE);
        (bool replay,) = address(e.applications)
            .call(
                abi.encodeWithSelector(e.applications.submit.selector, id, p, ALICE, uint256(1), uint128(500), content)
            );
        require(!replay, "application replay");
    }

    function testApplicationNonceCannotBeReusedWithDifferentContent() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);
        bytes32 firstContent = keccak256("first");
        bytes32 firstId = e.applications.canonicalId(p, ALICE, 9, firstContent);
        vm.prank(ALICE);
        e.applications.submit(firstId, p, ALICE, 9, 300, firstContent);

        bytes32 secondContent = keccak256("second");
        bytes32 secondId = e.applications.canonicalId(p, ALICE, 9, secondContent);
        vm.prank(ALICE);
        (bool reused,) = address(e.applications)
            .call(
                abi.encodeWithSelector(
                    e.applications.submit.selector, secondId, p, ALICE, uint256(9), uint128(300), secondContent
                )
            );
        require(!reused, "application nonce replay accepted");
    }

    function testProgramAndAwardCapsFailClosedAndAccountingAgrees() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);

        bytes32 app1 = submit(e, p, 700, 1);
        award(e, app1, 700);

        require(e.programs.program(p).awarded == 700, "program accounting stale");
        require(e.awards.programAwarded(p) == 700, "award accounting disagrees");

        bytes32 app2 = submit(e, p, 400, 2);
        bytes32 terms = keccak256("terms2");
        bytes32 a2 = e.awards.canonicalId(app2, ALICE, 400, terms);
        (bool over,) = address(e.awards)
            .call(abi.encodeWithSelector(e.awards.createAward.selector, a2, app2, ALICE, uint128(400), terms));
        require(!over, "program cap bypass");
        require(e.programs.program(p).awarded == 700, "failed award changed accounting");
    }

    function testApplicationCannotBeOverAwardedAcrossMultipleAwards() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);
        bytes32 app = submit(e, p, 500, 1);

        bytes32 terms1 = keccak256("partial-1");
        bytes32 a1 = e.awards.canonicalId(app, ALICE, 300, terms1);
        e.awards.createAward(a1, app, ALICE, 300, terms1);

        bytes32 terms2 = keccak256("partial-2");
        bytes32 a2 = e.awards.canonicalId(app, ALICE, 300, terms2);
        (bool over,) = address(e.awards)
            .call(abi.encodeWithSelector(e.awards.createAward.selector, a2, app, ALICE, uint128(300), terms2));
        require(!over, "application over-awarded");
        require(e.awards.applicationAwarded(app) == 300, "failed award changed application accounting");
    }

    function testOnlyBoundAwardRegistryCanReserveProgramCap() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);
        (bool direct,) =
            address(e.programs).call(abi.encodeWithSelector(e.programs.reserveAward.selector, p, uint128(1)));
        require(!direct, "governance bypassed bound award registry");
    }

    function testInactiveProgramRejectsNewAward() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);
        bytes32 app = submit(e, p, 500, 1);
        e.programs.setActive(p, false);

        bytes32 terms = keccak256("inactive-terms");
        bytes32 awardId = e.awards.canonicalId(app, ALICE, 500, terms);
        (bool created,) = address(e.awards)
            .call(abi.encodeWithSelector(e.awards.createAward.selector, awardId, app, ALICE, uint128(500), terms));
        require(!created, "inactive program accepted award");
    }

    function testMilestoneMustMatchTreasuryExactlyAndFinalizeAfterExecution() public {
        Env memory e = setup();
        (bytes32 p, bytes32 budget, bytes32 civic) = makeProgram(e);
        bytes32 app = submit(e, p, 600, 1);
        bytes32 a = award(e, app, 600);
        bytes32 purpose = keccak256("milestone-purpose");
        bytes32 m = claimedMilestone(e, a, 1, 300, purpose);

        bytes32 d = keccak256("treasury-disbursement");
        e.treasury
            .set(
                d, budget, ALICE, ASSET, 299, civic, purpose, ITreasuryDisbursementGrant420.State.SCHEDULED, bytes32(0)
            );
        (bool mismatch,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector, m, d));
        require(!mismatch, "amount mismatch accepted");

        e.treasury
            .set(
                d, budget, ALICE, ASSET, 300, civic, purpose, ITreasuryDisbursementGrant420.State.SCHEDULED, bytes32(0)
            );
        e.milestones.approve(m, d);

        (bool early,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.finalizePaid.selector, m));
        require(!early, "paid before treasury execution");

        e.treasury
            .set(d, budget, ALICE, ASSET, 300, civic, purpose, ITreasuryDisbursementGrant420.State.EXECUTED, bytes32(0));
        (bool noReleaseCommitment,) =
            address(e.milestones).call(abi.encodeWithSelector(e.milestones.finalizePaid.selector, m));
        require(!noReleaseCommitment, "paid without vault release commitment");

        e.treasury
            .set(
                d,
                budget,
                ALICE,
                ASSET,
                300,
                civic,
                purpose,
                ITreasuryDisbursementGrant420.State.EXECUTED,
                keccak256("vault-release")
            );
        e.milestones.finalizePaid(m);
        require(e.milestones.milestone(m).state == GrantMilestoneRegistry420.State.PAID, "not paid");
    }

    function testTreasuryDisbursementCannotPayTwoMilestones() public {
        Env memory e = setup();
        (bytes32 p, bytes32 budget, bytes32 civic) = makeProgram(e);
        bytes32 app = submit(e, p, 600, 1);
        bytes32 a = award(e, app, 600);
        bytes32 purpose = keccak256("shared-purpose");

        bytes32 m1 = claimedMilestone(e, a, 1, 300, purpose);
        bytes32 m2 = claimedMilestone(e, a, 2, 300, purpose);
        bytes32 d = keccak256("one-disbursement");
        e.treasury
            .set(
                d, budget, ALICE, ASSET, 300, civic, purpose, ITreasuryDisbursementGrant420.State.SCHEDULED, bytes32(0)
            );

        e.milestones.approve(m1, d);
        (bool replay,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector, m2, d));
        require(!replay, "treasury disbursement replay accepted");
        require(e.milestones.treasuryDisbursementMilestone(d) == m1, "binding changed");
    }

    function testCancelledAwardCannotApproveClaimedMilestone() public {
        Env memory e = setup();
        (bytes32 p, bytes32 budget, bytes32 civic) = makeProgram(e);
        bytes32 app = submit(e, p, 400, 1);
        bytes32 a = award(e, app, 400);
        bytes32 purpose = keccak256("cancelled-award");
        bytes32 m = claimedMilestone(e, a, 1, 400, purpose);
        bytes32 d = keccak256("cancelled-award-disbursement");
        e.treasury
            .set(
                d, budget, ALICE, ASSET, 400, civic, purpose, ITreasuryDisbursementGrant420.State.SCHEDULED, bytes32(0)
            );

        e.awards.cancel(a);
        (bool approved,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector, m, d));
        require(!approved, "cancelled award approved milestone");
    }

    function testApprovedMilestoneRequiresTreasuryCancellationBeforeGrantCancellation() public {
        Env memory e = setup();
        (bytes32 p, bytes32 budget, bytes32 civic) = makeProgram(e);
        bytes32 app = submit(e, p, 600, 1);
        bytes32 a = award(e, app, 600);
        bytes32 purpose = keccak256("rebindable-purpose");
        bytes32 m = claimedMilestone(e, a, 1, 300, purpose);
        bytes32 d = keccak256("rebindable-disbursement");
        e.treasury
            .set(
                d, budget, ALICE, ASSET, 300, civic, purpose, ITreasuryDisbursementGrant420.State.SCHEDULED, bytes32(0)
            );

        e.milestones.approve(m, d);
        (bool orphaned,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.cancel.selector, m));
        require(!orphaned, "scheduled Treasury payment detached from Grants");

        e.treasury
            .set(
                d, budget, ALICE, ASSET, 300, civic, purpose, ITreasuryDisbursementGrant420.State.CANCELLED, bytes32(0)
            );
        e.milestones.cancel(m);
        require(e.milestones.treasuryDisbursementMilestone(d) == bytes32(0), "binding not released");
        require(e.milestones.milestoneTotal(a) == 0, "cancelled milestone capacity not released");
    }

    function testExecutedTreasuryPaymentCannotBeHiddenByMilestoneCancellation() public {
        Env memory e = setup();
        (bytes32 p, bytes32 budget, bytes32 civic) = makeProgram(e);
        bytes32 app = submit(e, p, 300, 1);
        bytes32 a = award(e, app, 300);
        bytes32 purpose = keccak256("executed-payment");
        bytes32 m = claimedMilestone(e, a, 1, 300, purpose);
        bytes32 d = keccak256("executed-payment-disbursement");
        e.treasury
            .set(
                d, budget, ALICE, ASSET, 300, civic, purpose, ITreasuryDisbursementGrant420.State.SCHEDULED, bytes32(0)
            );
        e.milestones.approve(m, d);
        e.treasury
            .set(
                d,
                budget,
                ALICE,
                ASSET,
                300,
                civic,
                purpose,
                ITreasuryDisbursementGrant420.State.EXECUTED,
                keccak256("release")
            );

        (bool cancelled,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.cancel.selector, m));
        require(!cancelled, "executed payment hidden by cancellation");
        e.milestones.finalizePaid(m);
    }

    function testMilestoneOrdinalCannotBeReusedAndCancelledCapacityCanBeReplaced() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);
        bytes32 app = submit(e, p, 500, 1);
        bytes32 a = award(e, app, 500);

        bytes32 p1 = keccak256("ordinal-one");
        bytes32 m1 = e.milestones.canonicalId(a, 1, 300, p1);
        e.milestones.createMilestone(m1, a, 1, 300, p1);

        bytes32 p1b = keccak256("ordinal-one-different");
        bytes32 duplicateOrdinal = e.milestones.canonicalId(a, 1, 200, p1b);
        (bool reused,) = address(e.milestones)
            .call(
                abi.encodeWithSelector(
                    e.milestones.createMilestone.selector, duplicateOrdinal, a, uint32(1), uint128(200), p1b
                )
            );
        require(!reused, "milestone ordinal replay accepted");

        e.milestones.cancel(m1);
        require(e.milestones.milestoneTotal(a) == 0, "cancelled capacity not released");

        bytes32 p2 = keccak256("ordinal-two");
        bytes32 m2 = e.milestones.canonicalId(a, 2, 500, p2);
        e.milestones.createMilestone(m2, a, 2, 500, p2);
        require(e.milestones.milestoneTotal(a) == 500, "replacement milestone capacity unavailable");
    }

    function testPerAwardCapFailsClosed() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);
        bytes32 content = keccak256("per-award-cap");
        bytes32 app = e.applications.canonicalId(p, ALICE, 1, content);

        vm.prank(ALICE);
        (bool overRequested,) = address(e.applications)
            .call(
                abi.encodeWithSelector(
                    e.applications.submit.selector, app, p, ALICE, uint256(1), uint128(701), content
                )
            );
        require(!overRequested, "application exceeded per-award cap");
        require(!e.applications.applicationNonceUsed(p, ALICE, 1), "failed capped application consumed nonce");

        vm.prank(ALICE);
        e.applications.submit(app, p, ALICE, 1, 700, content);
        bytes32 a = award(e, app, 700);

        require(e.awards.award(a).amount == 700, "max award boundary rejected");
        require(e.programs.program(p).awarded == 700, "max award not reserved");
    }

    function testTreasuryBindingRejectsEveryCanonicalFieldMismatch() public {
        Env memory e = setup();
        (bytes32 p, bytes32 budget, bytes32 civic) = makeProgram(e);
        bytes32 app = submit(e, p, 300, 1);
        bytes32 a = award(e, app, 300);
        bytes32 purpose = keccak256("treasury-field-matrix");
        bytes32 m = claimedMilestone(e, a, 1, 300, purpose);
        bytes32 d = keccak256("treasury-field-matrix-disbursement");

        e.treasury
            .set(
                d,
                keccak256("wrong-budget"),
                ALICE,
                ASSET,
                300,
                civic,
                purpose,
                ITreasuryDisbursementGrant420.State.SCHEDULED,
                bytes32(0)
            );
        (bool badBudget,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector, m, d));
        require(!badBudget, "budget mismatch accepted");

        e.treasury
            .set(
                d,
                budget,
                DELEGATE,
                ASSET,
                300,
                civic,
                purpose,
                ITreasuryDisbursementGrant420.State.SCHEDULED,
                bytes32(0)
            );
        (bool badRecipient,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector, m, d));
        require(!badRecipient, "recipient mismatch accepted");

        e.treasury
            .set(
                d, budget, ALICE, ASSET, 299, civic, purpose, ITreasuryDisbursementGrant420.State.SCHEDULED, bytes32(0)
            );
        (bool badAmount,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector, m, d));
        require(!badAmount, "amount mismatch accepted");

        e.treasury
            .set(
                d,
                budget,
                ALICE,
                ASSET,
                300,
                keccak256("wrong-civic"),
                purpose,
                ITreasuryDisbursementGrant420.State.SCHEDULED,
                bytes32(0)
            );
        (bool badCivic,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector, m, d));
        require(!badCivic, "civic mismatch accepted");

        e.treasury
            .set(
                d,
                budget,
                ALICE,
                ASSET,
                300,
                civic,
                keccak256("wrong-purpose"),
                ITreasuryDisbursementGrant420.State.SCHEDULED,
                bytes32(0)
            );
        (bool badPurpose,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector, m, d));
        require(!badPurpose, "purpose mismatch accepted");

        e.treasury
            .set(
                d,
                budget,
                ALICE,
                ASSET,
                300,
                civic,
                purpose,
                ITreasuryDisbursementGrant420.State.EXECUTED,
                keccak256("release")
            );
        (bool badState,) = address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector, m, d));
        require(!badState, "non-scheduled Treasury state accepted");

        require(e.milestones.treasuryDisbursementMilestone(d) == bytes32(0), "failed mismatch bound disbursement");
        require(e.milestones.milestone(m).state == GrantMilestoneRegistry420.State.CLAIMED, "mismatch changed state");
    }

    function testMilestoneDelegationIsDefaultDenyAndScopeBound() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);
        bytes32 app = submit(e, p, 300, 1);
        bytes32 a = award(e, app, 300);
        bytes32 purpose = keccak256("delegated-milestone");
        bytes32 m = e.milestones.canonicalId(a, 1, 300, purpose);
        e.milestones.createMilestone(m, a, 1, 300, purpose);
        bytes32 claimHash = keccak256("delegated-claim");

        vm.prank(DELEGATE);
        (bool defaultAllowed,) =
            address(e.milestones).call(abi.encodeWithSelector(e.milestones.submitClaim.selector, m, claimHash));
        require(!defaultAllowed, "milestone delegation default allow");

        e.caps
            .set(
                DELEGATE,
                GrantIds420.COMPONENT_GRANTS,
                GrantIds420.ACTION_SUBMIT_MILESTONE,
                e.auth.scopeAward(keccak256("wrong-award")),
                true
            );
        vm.prank(DELEGATE);
        (bool wrongScope,) =
            address(e.milestones).call(abi.encodeWithSelector(e.milestones.submitClaim.selector, m, claimHash));
        require(!wrongScope, "wrong award scope accepted");

        e.caps
            .set(
                DELEGATE,
                GrantIds420.COMPONENT_GRANTS,
                GrantIds420.ACTION_SUBMIT_APPLICATION,
                e.auth.scopeAward(a),
                true
            );
        vm.prank(DELEGATE);
        (bool wrongAction,) =
            address(e.milestones).call(abi.encodeWithSelector(e.milestones.submitClaim.selector, m, claimHash));
        require(!wrongAction, "wrong action capability accepted");

        e.caps
            .set(
                DELEGATE, GrantIds420.COMPONENT_GRANTS, GrantIds420.ACTION_SUBMIT_MILESTONE, e.auth.scopeAward(a), true
            );
        vm.prank(DELEGATE);
        e.milestones.submitClaim(m, claimHash);

        GrantMilestoneRegistry420.Milestone memory claimed = e.milestones.milestone(m);
        require(claimed.state == GrantMilestoneRegistry420.State.CLAIMED, "scoped milestone delegation failed");
        require(claimed.claimHash == claimHash, "delegated claim hash mismatch");
    }

    function testMilestoneTotalCannotExceedAward() public {
        Env memory e = setup();
        (bytes32 p,,) = makeProgram(e);
        bytes32 app = submit(e, p, 500, 1);
        bytes32 a = award(e, app, 500);

        bytes32 p1 = keccak256("p1");
        bytes32 m1 = e.milestones.canonicalId(a, 1, 300, p1);
        e.milestones.createMilestone(m1, a, 1, 300, p1);

        bytes32 p2 = keccak256("p2");
        bytes32 m2 = e.milestones.canonicalId(a, 2, 300, p2);
        (bool over,) = address(e.milestones)
            .call(abi.encodeWithSelector(e.milestones.createMilestone.selector, m2, a, uint32(2), uint128(300), p2));
        require(!over, "milestone cap bypass");
    }
}
