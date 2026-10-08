// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeUsefulContributionAccounting420.sol";

contract MockUsefulRewardGateForAccounting420 is IComputeUsefulRewardGate420 {
    mapping(bytes32 => RewardGate) private _gates;
    mapping(bytes32 => bool) public acceptable;

    function setGate(
        bytes32 gateId,
        bytes32 jobId,
        uint64 gatedAt,
        bool current
    ) external {
        _gates[gateId] = RewardGate({
            gateId: gateId,
            jobId: jobId,
            verificationRef: keccak256(abi.encode("verification", gateId)),
            resultCommitment: keccak256(abi.encode("result", gateId)),
            verifier: address(0xB0B),
            jobRevision: 7,
            fundedSnapshot: 100 ether,
            gatedAt: gatedAt,
            exists: true
        });
        acceptable[gateId] = current;
    }

    function setCurrent(bytes32 gateId, bool current) external {
        acceptable[gateId] = current;
    }

    function rewardGate(bytes32 gateId) external view returns (RewardGate memory g) {
        g = _gates[gateId];
        require(g.exists, "unknown gate");
    }

    function currentlyVerified(bytes32 gateId) external view returns (bool) {
        return acceptable[gateId];
    }
}

contract MockUsefulContributionSource420 is IComputeUsefulContributionSource420 {
    mapping(bytes32 => ContributionEvidence) private _evidence;

    function set(bytes32 ref, ContributionEvidence calldata evidence) external {
        _evidence[ref] = evidence;
    }

    function contributionEvidence(bytes32 ref)
        external
        view
        returns (ContributionEvidence memory evidence)
    {
        evidence = _evidence[ref];
    }
}

contract ComputeUsefulContributionAccounting420Test {
    bytes32 private constant POLICY_WORK = keccak256("cmp6/policy/work-units");
    bytes32 private constant POLICY_CPU = keccak256("cmp6/policy/cpu-ms");
    bytes32 private constant POLICY_GPU = keccak256("cmp6/policy/gpu-ms");
    bytes32 private constant POLICY_CREDIT = keccak256("cmp6/policy/project-credit");
    bytes32 private constant POLICY_CUSTOM = keccak256("cmp6/policy/custom");

    bytes32 private constant METRIC_WORK = keccak256("cmp6/metric/verified-work-unit");
    bytes32 private constant METRIC_CPU = keccak256("cmp6/metric/cpu-milliseconds");
    bytes32 private constant METRIC_GPU = keccak256("cmp6/metric/gpu-milliseconds");
    bytes32 private constant METRIC_CREDIT = keccak256("cmp6/metric/project-credit");
    bytes32 private constant METRIC_CUSTOM = keccak256("cmp6/metric/custom/science-points");

    bytes32 private constant GATE_ID = keccak256("cmp6/gate/job-1");
    bytes32 private constant JOB_ID = keccak256("cmp6/job/1");
    bytes32 private constant PROJECT = keccak256("cmp6/project/cancer");
    address private constant CONTRIBUTOR = address(0xA11CE);

    ComputeUsefulContributionPolicy420 private policies;
    MockUsefulRewardGateForAccounting420 private gate;
    MockUsefulContributionSource420 private source;
    ComputeUsefulContributionAccounting420 private accounting;

    function setUp() public {
        source = new MockUsefulContributionSource420();
        gate = new MockUsefulRewardGateForAccounting420();
        policies = new ComputeUsefulContributionPolicy420(address(this));
        accounting = new ComputeUsefulContributionAccounting420(address(policies), address(gate));

        gate.setGate(GATE_ID, JOB_ID, uint64(block.timestamp), true);

        policies.publish(
            POLICY_WORK,
            policies.METRIC_WORK_UNITS(),
            METRIC_WORK,
            address(source),
            1_000_000
        );
        policies.publish(
            POLICY_CPU,
            policies.METRIC_CPU_MILLISECONDS(),
            METRIC_CPU,
            address(source),
            365 days * 1000
        );
        policies.publish(
            POLICY_GPU,
            policies.METRIC_GPU_MILLISECONDS(),
            METRIC_GPU,
            address(source),
            365 days * 1000
        );
        policies.publish(
            POLICY_CREDIT,
            policies.METRIC_PROJECT_CREDIT(),
            METRIC_CREDIT,
            address(source),
            1e24
        );
        policies.publish(
            POLICY_CUSTOM,
            policies.METRIC_CUSTOM(),
            METRIC_CUSTOM,
            address(source),
            1e24
        );
    }

    function _evidence(
        bytes32 gateId,
        uint8 metricKind,
        bytes32 metricId,
        uint256 amount,
        bool finalMeasured
    ) private view returns (IComputeUsefulContributionSource420.ContributionEvidence memory e) {
        e = IComputeUsefulContributionSource420.ContributionEvidence({
            gateId: gateId,
            contributor: CONTRIBUTOR,
            projectRef: PROJECT,
            metricKind: metricKind,
            metricId: metricId,
            amount: amount,
            observedAt: uint64(block.timestamp),
            evidenceCommitment: keccak256(abi.encode(gateId, metricId, amount)),
            finalMeasured: finalMeasured
        });
    }

    function testVerifiedWorkUnitsRecordExactTypedAccounting() public {
        bytes32 ref = keccak256("cmp6/contribution/work/1");
        source.set(
            ref,
            _evidence(
                GATE_ID,
                policies.METRIC_WORK_UNITS(),
                METRIC_WORK,
                42,
                true
            )
        );

        bytes32 id = accounting.recordContribution(POLICY_WORK, 1, ref);
        ComputeUsefulContributionAccounting420.ContributionRecord memory r =
            accounting.contribution(id);

        require(r.jobId == JOB_ID, "job drift");
        require(r.gateId == GATE_ID, "gate drift");
        require(r.contributor == CONTRIBUTOR, "contributor drift");
        require(r.projectRef == PROJECT, "project drift");
        require(r.metricKind == policies.METRIC_WORK_UNITS(), "metric kind drift");
        require(r.metricId == METRIC_WORK, "metric id drift");
        require(r.amount == 42, "amount drift");
        require(accounting.totalByContributorMetric(CONTRIBUTOR, METRIC_WORK) == 42, "contributor total");
        require(accounting.totalByProjectMetric(PROJECT, METRIC_WORK) == 42, "project total");
        require(accounting.totalByJobMetric(JOB_ID, METRIC_WORK) == 42, "job total");
        require(accounting.totalByMetric(METRIC_WORK) == 42, "global total");
    }

    function testCpuGpuProjectCreditAndCustomMetricsRemainDistinct() public {
        bytes32 cpuRef = keccak256("cmp6/contribution/cpu");
        bytes32 gpuRef = keccak256("cmp6/contribution/gpu");
        bytes32 creditRef = keccak256("cmp6/contribution/credit");
        bytes32 customRef = keccak256("cmp6/contribution/custom");

        source.set(cpuRef, _evidence(GATE_ID, policies.METRIC_CPU_MILLISECONDS(), METRIC_CPU, 3_600_000, true));
        source.set(gpuRef, _evidence(GATE_ID, policies.METRIC_GPU_MILLISECONDS(), METRIC_GPU, 1_800_000, true));
        source.set(creditRef, _evidence(GATE_ID, policies.METRIC_PROJECT_CREDIT(), METRIC_CREDIT, 250, true));
        source.set(customRef, _evidence(GATE_ID, policies.METRIC_CUSTOM(), METRIC_CUSTOM, 77, true));

        accounting.recordContribution(POLICY_CPU, 1, cpuRef);
        accounting.recordContribution(POLICY_GPU, 1, gpuRef);
        accounting.recordContribution(POLICY_CREDIT, 1, creditRef);
        accounting.recordContribution(POLICY_CUSTOM, 1, customRef);

        require(accounting.totalByMetric(METRIC_CPU) == 3_600_000, "cpu accounting");
        require(accounting.totalByMetric(METRIC_GPU) == 1_800_000, "gpu accounting");
        require(accounting.totalByMetric(METRIC_CREDIT) == 250, "credit accounting");
        require(accounting.totalByMetric(METRIC_CUSTOM) == 77, "custom accounting");
        require(accounting.totalByMetric(METRIC_WORK) == 0, "metric collision");
    }

    function testUnverifiedGateAndPreGateMeasurementFailClosed() public {
        bytes32 ref = keccak256("cmp6/contribution/unverified");
        source.set(
            ref,
            _evidence(GATE_ID, policies.METRIC_WORK_UNITS(), METRIC_WORK, 1, true)
        );
        gate.setCurrent(GATE_ID, false);

        (bool ok,) = address(accounting).call(
            abi.encodeCall(accounting.recordContribution, (POLICY_WORK, uint32(1), ref))
        );
        require(!ok, "unverified contribution recorded");

        gate.setCurrent(GATE_ID, true);
        bytes32 oldRef = keccak256("cmp6/contribution/pre-gate");
        IComputeUsefulContributionSource420.ContributionEvidence memory e =
            _evidence(GATE_ID, policies.METRIC_WORK_UNITS(), METRIC_WORK, 1, true);
        e.observedAt = uint64(block.timestamp - 1);
        source.set(oldRef, e);

        (ok,) = address(accounting).call(
            abi.encodeCall(accounting.recordContribution, (POLICY_WORK, uint32(1), oldRef))
        );
        require(!ok, "pre-gate measurement recorded");
    }

    function testMetricPolicyMismatchNonFinalZeroAndOverCapFailClosed() public {
        bytes32 mismatch = keccak256("cmp6/contribution/mismatch");
        source.set(
            mismatch,
            _evidence(GATE_ID, policies.METRIC_GPU_MILLISECONDS(), METRIC_GPU, 100, true)
        );
        (bool ok,) = address(accounting).call(
            abi.encodeCall(accounting.recordContribution, (POLICY_CPU, uint32(1), mismatch))
        );
        require(!ok, "metric mismatch accepted");

        bytes32 nonFinal = keccak256("cmp6/contribution/non-final");
        source.set(
            nonFinal,
            _evidence(GATE_ID, policies.METRIC_WORK_UNITS(), METRIC_WORK, 1, false)
        );
        (ok,) = address(accounting).call(
            abi.encodeCall(accounting.recordContribution, (POLICY_WORK, uint32(1), nonFinal))
        );
        require(!ok, "non-final measurement accepted");

        bytes32 zero = keccak256("cmp6/contribution/zero");
        source.set(
            zero,
            _evidence(GATE_ID, policies.METRIC_WORK_UNITS(), METRIC_WORK, 0, true)
        );
        (ok,) = address(accounting).call(
            abi.encodeCall(accounting.recordContribution, (POLICY_WORK, uint32(1), zero))
        );
        require(!ok, "zero measurement accepted");

        bytes32 over = keccak256("cmp6/contribution/over-cap");
        source.set(
            over,
            _evidence(GATE_ID, policies.METRIC_WORK_UNITS(), METRIC_WORK, 1_000_001, true)
        );
        (ok,) = address(accounting).call(
            abi.encodeCall(accounting.recordContribution, (POLICY_WORK, uint32(1), over))
        );
        require(!ok, "over-cap measurement accepted");
    }

    function testSourceReferenceReplayFailsClosedWithoutDoubleAccounting() public {
        bytes32 ref = keccak256("cmp6/contribution/replay");
        source.set(
            ref,
            _evidence(GATE_ID, policies.METRIC_WORK_UNITS(), METRIC_WORK, 9, true)
        );

        accounting.recordContribution(POLICY_WORK, 1, ref);
        (bool ok,) = address(accounting).call(
            abi.encodeCall(accounting.recordContribution, (POLICY_WORK, uint32(1), ref))
        );
        require(!ok, "duplicate contribution accepted");
        require(accounting.totalByMetric(METRIC_WORK) == 9, "replay changed accounting");
    }

    function testPolicyRevisionsAreAppendOnlyAndSourceCodeHashPinned() public {
        bytes32 first = policies.commitment(POLICY_WORK, 1);
        uint32 secondRevision = policies.publish(
            POLICY_WORK,
            policies.METRIC_WORK_UNITS(),
            METRIC_WORK,
            address(source),
            2_000_000
        );
        require(secondRevision == 2, "revision not appended");
        require(policies.commitment(POLICY_WORK, 1) == first, "old policy rewritten");
        require(policies.commitment(POLICY_WORK, 2) != first, "revision commitment collision");

        ComputeUsefulContributionPolicy420.Policy memory p = policies.policy(POLICY_WORK, 1);
        require(p.sourceCodeHash == address(source).codehash, "source code hash not frozen");
    }
}
