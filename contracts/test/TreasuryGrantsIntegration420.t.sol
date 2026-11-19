// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./GrantsDeploymentBinding420.t.sol";
import "../src/treasury/TreasuryRouter420.sol";

interface VmRec6 {
    function warp(uint256) external;
    function prank(address) external;
}

contract TreasuryGrantsIntegration420Test is GrantsDeploymentBinding420Test {
    VmRec6 private constant vm = VmRec6(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ALICE = address(0xA11CE);
    address private constant EXECUTOR = address(0xE420);
    bytes32 private constant BUDGET = keccak256("rec6-budget");
    bytes32 private constant OTHER = keccak256("rec6-other");
    bytes32 private constant CIVIC = keccak256("rec6-civic");
    bytes32 private constant PURPOSE = keccak256("rec6-purpose");
    bytes32 private constant PROGRAM = keccak256("rec6-program");
    bytes32 private constant RELEASE = keccak256("rec6-commitment");

    Env private e;
    bytes32 private awardId;
    uint64 private start;

    function setUp() public {
        vm.warp(1000);
        e = _deploy();
        start = uint64(block.timestamp);
        e.treasuryPolicy.setAssetPolicy(address(0), true, 500, 1000, 1 days);
        for (uint256 i; i < 2; ++i) {
            e.treasuryBudgets.createBudget(
                i == 0 ? BUDGET : OTHER, keccak256("vault"), TreasuryIds420.BUDGET_DEVELOPMENT,
                address(0), 1000, start, start + 1000, CIVIC, keccak256("meta")
            );
        }
        e.programs.createProgram(
            PROGRAM, GrantIds420.PROGRAM_DEVELOPMENT, BUDGET, CIVIC, 1000, 600,
            start, start + 1000, keccak256("program-meta")
        );
        bytes32 content = keccak256("application");
        bytes32 app = e.applications.canonicalId(PROGRAM, ALICE, 1, content);
        vm.prank(ALICE);
        e.applications.submit(app, PROGRAM, ALICE, 1, 600, content);
        bytes32 terms = keccak256("terms");
        awardId = e.awards.canonicalId(app, ALICE, 600, terms);
        e.awards.createAward(awardId, app, ALICE, 600, terms);
        e.caps.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY, address(this));
    }

    function _milestone(uint32 ordinal) private returns (bytes32 id) {
        id = e.milestones.canonicalId(awardId, ordinal, 100, PURPOSE);
        e.milestones.createMilestone(id, awardId, ordinal, 100, PURPOSE);
        vm.prank(ALICE);
        e.milestones.submitClaim(id, keccak256("claim"));
    }

    function _schedule(bytes32 budget, address recipient, uint128 amount, bytes32 purpose, uint64 expiry)
        private returns (bytes32 id)
    {
        id = e.treasuryDisbursements.canonicalId(budget, recipient, amount, start, expiry, CIVIC, purpose);
        e.treasuryDisbursements.schedule(id, budget, recipient, amount, start, expiry, CIVIC, purpose);
    }

    function _deny(address target, bytes memory callData) private {
        (bool ok,) = target.call(callData);
        require(!ok, "unexpected success");
    }

    function _approveDenied(bytes32 m, bytes32 d) private {
        _deny(address(e.milestones), abi.encodeCall(e.milestones.approve, (m, d)));
        require(e.milestones.milestone(m).state == GrantMilestoneRegistry420.State.CLAIMED, "approval mutated");
        require(e.milestones.treasuryDisbursementMilestone(d) == bytes32(0), "binding mutated");
    }

    function _grant(bytes32 d) private {
        e.caps.createGrant(
            keccak256(abi.encode(d)), EXECUTOR, TreasuryIds420.COMPONENT_TREASURY,
            TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, e.treasuryAuthorization.scopeForDisbursement(d),
            100, 0, 0, 0, 0
        );
    }

    function testRealUnrelatedRecordsAndDuplicateBindingsRejected() public {
        bytes32 m = _milestone(1);
        _approveDenied(m, _schedule(OTHER, ALICE, 100, PURPOSE, start + 100));
        _approveDenied(m, _schedule(BUDGET, address(0xBAD), 100, PURPOSE, start + 100));
        _approveDenied(m, _schedule(BUDGET, ALICE, 99, PURPOSE, start + 100));
        _approveDenied(m, _schedule(BUDGET, ALICE, 100, keccak256("wrong"), start + 100));
        _approveDenied(m, keccak256("missing"));
        bytes32 d = _schedule(BUDGET, ALICE, 100, PURPOSE, start + 100);
        e.milestones.approve(m, d);
        bytes32 m2 = _milestone(2);
        _deny(address(e.milestones), abi.encodeCall(e.milestones.approve, (m2, d)));
        require(e.milestones.treasuryDisbursementMilestone(d) == m, "binding changed");
    }

    function testRealFailureExpiryCancellationAndCommitmentOnlyPaid() public {
        bytes32 m = _milestone(1);
        bytes32 d = _schedule(BUDGET, ALICE, 100, PURPOSE, start + 10);
        e.milestones.approve(m, d);
        _deny(address(e.treasuryDisbursements), abi.encodeCall(e.treasuryDisbursements.markExecuted, (d, RELEASE)));
        _deny(address(e.milestones), abi.encodeCall(e.milestones.finalizePaid, (m)));
        require(e.treasuryBudgets.budget(BUDGET).executed == 0, "unauthorized execution");
        vm.warp(start + 11);
        _grant(d);
        vm.prank(EXECUTOR);
        _deny(address(e.treasuryDisbursements), abi.encodeCall(e.treasuryDisbursements.markExecuted, (d, RELEASE)));
        _deny(address(e.milestones), abi.encodeCall(e.milestones.cancel, (m)));
        e.treasuryDisbursements.cancel(d);
        e.milestones.cancel(m);
        require(e.treasuryBudgets.budget(BUDGET).committed == 0, "cancel accounting");
        require(e.milestones.treasuryDisbursementMilestone(d) == bytes32(0), "cancel binding");

        bytes32 m2 = _milestone(2);
        bytes32 d2 = _schedule(BUDGET, ALICE, 100, PURPOSE, start + 100);
        e.milestones.approve(m2, d2);
        _grant(d2);
        uint256 balance = ALICE.balance;
        vm.prank(EXECUTOR);
        e.treasuryDisbursements.markExecuted(d2, RELEASE);
        require(ALICE.balance == balance, "Treasury must not transfer custody");
        vm.warp(start + 101);
        e.milestones.finalizePaid(m2);
        require(e.milestones.milestone(m2).state == GrantMilestoneRegistry420.State.PAID, "not paid");
        _deny(address(e.milestones), abi.encodeCall(e.milestones.finalizePaid, (m2)));
        _deny(address(e.milestones), abi.encodeCall(e.milestones.cancel, (m2)));
        require(e.treasuryBudgets.budget(BUDGET).executed == 100, "settlement drift");
    }

    function testAlreadyExpiredScheduledRecordCannotBeApproved() public {
        bytes32 m = _milestone(1);
        bytes32 d = _schedule(BUDGET, ALICE, 100, PURPOSE, start + 10);
        vm.warp(start + 11);
        _approveDenied(m, d);
    }

    function testTreasuryServiceAndGrantsBindingUseSameDisbursementRegistry() public {
        TreasuryRouter420 router = new TreasuryRouter420(address(e.treasuryBudgets), address(e.treasuryDisbursements));
        bytes32 service = keccak256("420/service/treasury/v1");
        bytes32 component = keccak256("420/APP/420TREASURY/TREASURY_ROUTER");
        e.registry.registerComponent(component, address(router), Types420.Version(1, 0, 0), Types420.Lifecycle.ACTIVE);
        e.registry.publishRegisteredService(
            service, address(router), METADATA_HASH, 1, true, ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH, e.dependencyRoot, INTERFACE_HASH
        );
        (address resolved,) = e.registry.resolveActive(service);
        require(address(TreasuryRouter420(resolved).disbursements()) == address(e.milestones.treasury()), "binding drift");
        require(e.registry.resolve(component) == resolved, "component drift");
        require(e.registry.getService(service).codeHash == resolved.codehash, "runtime drift");
    }
}
