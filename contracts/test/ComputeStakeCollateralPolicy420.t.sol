// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeCollateralPolicy420.sol";

interface VmComputeStakeCollateralPolicy420 {
    function prank(address caller) external;
}

contract ComputeStakeCollateralPolicy420Test {
    VmComputeStakeCollateralPolicy420 private constant vm =
        VmComputeStakeCollateralPolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OUTSIDER = address(0xBAD);
    address private constant VERIFIER_AUTHORITY = address(0xA11CE);

    bytes32 private constant POLICY = keccak256("cmp/stake/minimums");
    bytes32 private constant WORKER_POSITION = keccak256("worker-position");
    bytes32 private constant VERIFIER_POSITION = keccak256("verifier-position");

    ComputeStakeCollateralPolicy420 private policies;

    function setUp() public {
        policies = new ComputeStakeCollateralPolicy420(GOV);
    }

    function _publishBoth(
        uint256 workerActive,
        uint256 workerSlashable,
        uint256 verifierActive,
        uint256 verifierSlashable
    ) private returns (uint32 revision) {
        vm.prank(GOV);
        revision = policies.publish(
            POLICY,
            true,
            workerActive,
            workerSlashable,
            true,
            true,
            verifierActive,
            verifierSlashable,
            true
        );
    }

    function _worker(
        uint256 activeAmount,
        uint256 slashableAmount,
        bool active,
        bool exiting
    ) private pure returns (IComputeStakeSource420.PositionRead memory p) {
        p = IComputeStakeSource420.PositionRead({
            positionId: WORKER_POSITION,
            positionRevision: 1,
            activeAmount: activeAmount,
            slashableAmount: slashableAmount,
            active: active,
            exiting: exiting,
            withdrawableAt: 0
        });
    }

    function _verifier(
        uint256 activeAmount,
        uint256 slashableAmount,
        bool active,
        bool exiting
    ) private pure returns (IComputeVerifierStakeSource420.PositionRead memory p) {
        p = IComputeVerifierStakeSource420.PositionRead({
            positionId: VERIFIER_POSITION,
            positionRevision: 1,
            authority: VERIFIER_AUTHORITY,
            verifierRevision: 3,
            activeAmount: activeAmount,
            slashableAmount: slashableAmount,
            active: active,
            exiting: exiting,
            withdrawableAt: 0
        });
    }

    function testOnlyGovernanceCanPublishAndToggleAcceptance() public {
        vm.prank(OUTSIDER);
        (bool ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (POLICY, true, 100 ether, 80 ether, true, true, 200 ether, 150 ether, true)
            )
        );
        require(!ok, "outsider published");

        uint32 revision = _publishBoth(100 ether, 80 ether, 200 ether, 150 ether);
        bytes32 commitment = policies.commitment(POLICY, revision);
        require(policies.isCurrentAcceptable(POLICY, revision, commitment), "current not accepted");

        vm.prank(OUTSIDER);
        (ok,) = address(policies).call(
            abi.encodeCall(policies.setNewAcceptance, (POLICY, false))
        );
        require(!ok, "outsider toggled acceptance");

        vm.prank(GOV);
        policies.setNewAcceptance(POLICY, false);
        require(!policies.isCurrentAcceptable(POLICY, revision, commitment), "suspension ignored");

        vm.prank(GOV);
        policies.setNewAcceptance(POLICY, true);
        require(policies.isCurrentAcceptable(POLICY, revision, commitment), "reenable failed");
    }

    function testInvalidMinimumShapesFailClosed() public {
        vm.prank(GOV);
        (bool ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (POLICY, false, 0, 0, false, false, 0, 0, false)
            )
        );
        require(!ok, "empty policy accepted");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (POLICY, true, 0, 0, false, false, 0, 0, false)
            )
        );
        require(!ok, "required worker with zero minimum accepted");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (POLICY, true, 100 ether, 101 ether, false, false, 0, 0, false)
            )
        );
        require(!ok, "worker slashable above active accepted");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (POLICY, false, 1 ether, 0, false, true, 10 ether, 5 ether, false)
            )
        );
        require(!ok, "disabled worker carried nonzero minimum");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (POLICY, false, 0, 0, false, true, 10 ether, 11 ether, false)
            )
        );
        require(!ok, "verifier slashable above active accepted");
    }

    function testPolicyRevisionsAreImmutableAndCommitmentBound() public {
        uint32 r1 = _publishBoth(100 ether, 80 ether, 200 ether, 150 ether);
        bytes32 c1 = policies.commitment(POLICY, r1);

        vm.prank(GOV);
        uint32 r2 = policies.publish(
            POLICY,
            true,
            120 ether,
            90 ether,
            false,
            true,
            220 ether,
            170 ether,
            false
        );
        bytes32 c2 = policies.commitment(POLICY, r2);

        require(r1 == 1 && r2 == 2, "revision sequence");
        require(c1 != c2, "commitment did not change");
        require(!policies.isCurrentAcceptable(POLICY, r1, c1), "stale revision accepted");
        require(policies.isCurrentAcceptable(POLICY, r2, c2), "current revision rejected");

        ComputeStakeCollateralPolicy420.Policy memory p1 = policies.policy(POLICY, r1);
        ComputeStakeCollateralPolicy420.Policy memory p2 = policies.policy(POLICY, r2);
        require(
            p1.minimumWorkerActiveAmount == 100 ether
                && p1.minimumVerifierActiveAmount == 200 ether
                && p1.rejectWorkerExiting
                && p1.rejectVerifierExiting,
            "r1 rewritten"
        );
        require(
            p2.minimumWorkerActiveAmount == 120 ether
                && p2.minimumVerifierActiveAmount == 220 ether
                && !p2.rejectWorkerExiting
                && !p2.rejectVerifierExiting,
            "r2 wrong"
        );

        vm.prank(GOV);
        policies.setNewAcceptance(POLICY, false);
        require(policies.commitment(POLICY, r1) == c1, "acceptance rewrote old commitment");
        require(policies.commitment(POLICY, r2) == c2, "acceptance rewrote current commitment");
    }

    function testWorkerMinimumsEnforceExactBoundaryAndExitPolicy() public {
        uint32 revision = _publishBoth(100 ether, 80 ether, 200 ether, 150 ether);

        require(
            policies.workerPositionPasses(POLICY, revision, _worker(100 ether, 80 ether, true, false)),
            "exact worker boundary failed"
        );
        require(
            !policies.workerPositionPasses(POLICY, revision, _worker(99 ether, 80 ether, true, false)),
            "under-active worker passed"
        );
        require(
            !policies.workerPositionPasses(POLICY, revision, _worker(100 ether, 79 ether, true, false)),
            "under-slashable worker passed"
        );
        require(
            !policies.workerPositionPasses(POLICY, revision, _worker(100 ether, 80 ether, false, false)),
            "inactive worker passed"
        );
        require(
            !policies.workerPositionPasses(POLICY, revision, _worker(100 ether, 80 ether, true, true)),
            "exiting worker passed"
        );

        IComputeStakeSource420.PositionRead memory missing;
        require(!policies.workerPositionPasses(POLICY, revision, missing), "missing worker passed");
    }

    function testVerifierMinimumsEnforceExactBoundaryAndExitPolicy() public {
        uint32 revision = _publishBoth(100 ether, 80 ether, 200 ether, 150 ether);

        require(
            policies.verifierPositionPasses(POLICY, revision, _verifier(200 ether, 150 ether, true, false)),
            "exact verifier boundary failed"
        );
        require(
            !policies.verifierPositionPasses(POLICY, revision, _verifier(199 ether, 150 ether, true, false)),
            "under-active verifier passed"
        );
        require(
            !policies.verifierPositionPasses(POLICY, revision, _verifier(200 ether, 149 ether, true, false)),
            "under-slashable verifier passed"
        );
        require(
            !policies.verifierPositionPasses(POLICY, revision, _verifier(200 ether, 150 ether, false, false)),
            "inactive verifier passed"
        );
        require(
            !policies.verifierPositionPasses(POLICY, revision, _verifier(200 ether, 150 ether, true, true)),
            "exiting verifier passed"
        );

        IComputeVerifierStakeSource420.PositionRead memory missing;
        require(!policies.verifierPositionPasses(POLICY, revision, missing), "missing verifier passed");
    }

    function testOptionalRoleDoesNotInventCollateralRequirement() public {
        vm.prank(GOV);
        uint32 workerOnly = policies.publish(
            POLICY,
            true,
            50 ether,
            40 ether,
            false,
            false,
            0,
            0,
            false
        );

        IComputeVerifierStakeSource420.PositionRead memory noVerifier;
        require(
            policies.verifierPositionPasses(POLICY, workerOnly, noVerifier),
            "optional verifier was required"
        );

        vm.prank(GOV);
        uint32 verifierOnly = policies.publish(
            POLICY,
            false,
            0,
            0,
            false,
            true,
            70 ether,
            60 ether,
            false
        );

        IComputeStakeSource420.PositionRead memory noWorker;
        require(
            policies.workerPositionPasses(POLICY, verifierOnly, noWorker),
            "optional worker was required"
        );
    }

    function testWorkerAndVerifierMinimumsAreIndependent() public {
        uint32 revision = _publishBoth(100 ether, 80 ether, 200 ether, 150 ether);

        require(
            policies.workerPositionPasses(POLICY, revision, _worker(100 ether, 80 ether, true, false)),
            "worker should pass"
        );
        require(
            !policies.verifierPositionPasses(POLICY, revision, _verifier(199 ether, 150 ether, true, false)),
            "worker pass leaked to verifier"
        );
    }
}
