// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeUsefulRewardVerification420.sol";

contract MockUsefulRewardFundingGate420 is IComputeUsefulRewardFundingGate420 {
    uint8 public constant TARGET_JOB = 1;
    bytes32 public constant rewardVaultId = keccak256("cmp6/mock/reward-vault");
    mapping(bytes32 => uint256) public fundedByTarget;

    function setFunded(uint8 targetKind, bytes32 targetRef, uint256 amount) external {
        fundedByTarget[keccak256(abi.encode(targetKind, targetRef))] = amount;
    }
}

contract MockUsefulRewardVerificationEvidence420 is IComputeJobVerificationEvidence420 {
    mapping(bytes32 => bool) private _approved;

    function key(
        bytes32 jobId,
        bytes32 resultCommitment,
        address verifier,
        bytes32 decisionRef,
        bool approved
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(jobId, resultCommitment, verifier, decisionRef, approved));
    }

    function setVerified(
        bytes32 jobId,
        bytes32 resultCommitment,
        address verifier,
        bytes32 decisionRef,
        bool approved,
        bool value
    ) external {
        _approved[key(jobId, resultCommitment, verifier, decisionRef, approved)] = value;
    }

    function verified(
        bytes32 jobId,
        bytes32 resultCommitment,
        address verifier,
        bytes32 decisionRef,
        bool approved
    ) external view returns (bool) {
        return _approved[key(jobId, resultCommitment, verifier, decisionRef, approved)];
    }
}

contract MockUsefulRewardJobRegistry420 {
    mapping(bytes32 => ComputeJobRegistry420.Job) private _jobs;
    IComputeJobVerificationEvidence420 public immutable verificationEvidence;

    constructor(address verification_) {
        verificationEvidence = IComputeJobVerificationEvidence420(verification_);
    }

    function setJob(bytes32 jobId, ComputeJobRegistry420.Job calldata j) external {
        _jobs[jobId] = j;
    }

    function job(bytes32 jobId) external view returns (ComputeJobRegistry420.Job memory j) {
        j = _jobs[jobId];
        require(j.status != ComputeJobRegistry420.Status.NONE, "unknown job");
    }
}

contract ComputeUsefulRewardVerification420Test {
    bytes32 private constant JOB_ID = keccak256("cmp6/job/verified");
    bytes32 private constant RESULT = keccak256("cmp6/result");
    bytes32 private constant VERIFICATION_REF = keccak256("cmp6/verification");
    address private constant VERIFIER = address(0xB0B);

    MockUsefulRewardFundingGate420 private funding;
    MockUsefulRewardVerificationEvidence420 private evidence;
    MockUsefulRewardJobRegistry420 private jobs;
    ComputeUsefulRewardVerification420 private gate;

    function setUp() public {
        funding = new MockUsefulRewardFundingGate420();
        evidence = new MockUsefulRewardVerificationEvidence420();
        jobs = new MockUsefulRewardJobRegistry420(address(evidence));
        gate = new ComputeUsefulRewardVerification420(address(funding), address(jobs));

        funding.setFunded(1, JOB_ID, 25 ether);
        _setJob(ComputeJobRegistry420.Status.VERIFIED, 7, RESULT, VERIFIER, VERIFICATION_REF);
        evidence.setVerified(JOB_ID, RESULT, VERIFIER, VERIFICATION_REF, true, true);
    }

    function _setJob(
        ComputeJobRegistry420.Status status,
        uint64 revision,
        bytes32 resultCommitment,
        address verifier,
        bytes32 verificationRef
    ) private {
        ComputeJobRegistry420.Job memory j;
        j.owner = address(0xA11CE);
        j.requestId = keccak256("cmp6/request");
        j.requestCommitment = keccak256("cmp6/request/commitment");
        j.manifestHash = keccak256("cmp6/manifest");
        j.workloadType = keccak256("cmp6/workload");
        j.inputCommitment = keccak256("cmp6/input");
        j.outputSchemaCommitment = keccak256("cmp6/output");
        j.matchId = keccak256("cmp6/match");
        j.fundingRef = keccak256("cmp6/job/funding");
        j.acceptanceRef = keccak256("cmp6/acceptance");
        j.assignmentRef = keccak256("cmp6/assignment");
        j.worker = address(0xC0DE);
        j.resultCommitment = resultCommitment;
        j.verifier = verifier;
        j.verificationRef = verificationRef;
        j.deadline = uint64(block.timestamp + 1 days);
        j.revision = revision;
        j.status = status;
        jobs.setJob(JOB_ID, j);
    }

    function testFundedVerifiedJobCreatesImmutableGate() public {
        bytes32 gateId = gate.gateJobReward(JOB_ID, 7);
        ComputeUsefulRewardVerification420.RewardGate memory g = gate.rewardGate(gateId);

        require(g.jobId == JOB_ID, "job drift");
        require(g.verificationRef == VERIFICATION_REF, "verification drift");
        require(g.resultCommitment == RESULT, "result drift");
        require(g.verifier == VERIFIER, "verifier drift");
        require(g.jobRevision == 7, "revision drift");
        require(g.fundedSnapshot == 25 ether, "funding snapshot drift");
        require(gate.gateForJob(JOB_ID) == gateId, "job gate missing");
        require(gate.currentlyVerified(gateId), "current verification not recognized");
    }

    function testUnfundedJobCannotCreateRewardGate() public {
        bytes32 other = keccak256("cmp6/job/unfunded");
        ComputeJobRegistry420.Job memory j;
        j.owner = address(0xA11CE);
        j.resultCommitment = RESULT;
        j.verifier = VERIFIER;
        j.verificationRef = VERIFICATION_REF;
        j.revision = 1;
        j.status = ComputeJobRegistry420.Status.VERIFIED;
        jobs.setJob(other, j);
        evidence.setVerified(other, RESULT, VERIFIER, VERIFICATION_REF, true, true);

        (bool ok,) = address(gate).call(
            abi.encodeCall(gate.gateJobReward, (other, uint64(1)))
        );
        require(!ok, "unfunded job gated");
    }

    function testNonVerifiedRejectedAndStaleRevisionFailClosed() public {
        _setJob(ComputeJobRegistry420.Status.RESULT_COMMITTED, 7, RESULT, VERIFIER, VERIFICATION_REF);
        (bool ok,) = address(gate).call(
            abi.encodeCall(gate.gateJobReward, (JOB_ID, uint64(7)))
        );
        require(!ok, "non-verified job gated");

        _setJob(ComputeJobRegistry420.Status.VERIFIED, 7, RESULT, VERIFIER, VERIFICATION_REF);
        evidence.setVerified(JOB_ID, RESULT, VERIFIER, VERIFICATION_REF, true, false);
        (ok,) = address(gate).call(
            abi.encodeCall(gate.gateJobReward, (JOB_ID, uint64(7)))
        );
        require(!ok, "rejected evidence gated");

        evidence.setVerified(JOB_ID, RESULT, VERIFIER, VERIFICATION_REF, true, true);
        (ok,) = address(gate).call(
            abi.encodeCall(gate.gateJobReward, (JOB_ID, uint64(6)))
        );
        require(!ok, "stale revision gated");
    }

    function testGateReplayFailsClosed() public {
        bytes32 gateId = gate.gateJobReward(JOB_ID, 7);
        (bool ok,) = address(gate).call(
            abi.encodeCall(gate.gateJobReward, (JOB_ID, uint64(7)))
        );
        require(!ok, "duplicate reward gate");
        require(gate.gateForJob(JOB_ID) == gateId, "replay mutated gate");
    }

    function testCurrentEligibilityFailsClosedOnDisputeOrEvidenceRevocation() public {
        bytes32 gateId = gate.gateJobReward(JOB_ID, 7);
        require(gate.currentlyVerified(gateId), "baseline not eligible");

        _setJob(ComputeJobRegistry420.Status.DISPUTED, 8, RESULT, VERIFIER, VERIFICATION_REF);
        require(!gate.currentlyVerified(gateId), "disputed job still eligible");

        _setJob(ComputeJobRegistry420.Status.VERIFIED, 9, RESULT, VERIFIER, VERIFICATION_REF);
        evidence.setVerified(JOB_ID, RESULT, VERIFIER, VERIFICATION_REF, true, false);
        require(!gate.currentlyVerified(gateId), "revoked verification still eligible");

        evidence.setVerified(JOB_ID, RESULT, VERIFIER, VERIFICATION_REF, true, true);
        require(gate.currentlyVerified(gateId), "restored verification not eligible");
    }

    function testVerificationIdentityDriftFailsCurrentEligibility() public {
        bytes32 gateId = gate.gateJobReward(JOB_ID, 7);

        _setJob(
            ComputeJobRegistry420.Status.VERIFIED,
            8,
            keccak256("other/result"),
            VERIFIER,
            VERIFICATION_REF
        );
        require(!gate.currentlyVerified(gateId), "result drift accepted");

        _setJob(
            ComputeJobRegistry420.Status.VERIFIED,
            9,
            RESULT,
            address(0xDEAD),
            VERIFICATION_REF
        );
        require(!gate.currentlyVerified(gateId), "verifier drift accepted");

        _setJob(
            ComputeJobRegistry420.Status.VERIFIED,
            10,
            RESULT,
            VERIFIER,
            keccak256("other/verification")
        );
        require(!gate.currentlyVerified(gateId), "verification ref drift accepted");
    }
}
