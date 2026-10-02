// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeSlashPolicy420.sol";
import "../src/compute/ComputeStakeSlashAuthorization420.sol";
import "../src/compute/ComputeStakeSlashDistributionPolicy420.sol";
import "../src/interfaces/IComputeObjectiveSlashEvidence420.sol";
import "../src/interfaces/IComputeSlashableCollateral420.sol";

interface VmComputeStakeSlashAuthorization420 {
    function prank(address caller) external;
    function warp(uint256) external;
}

contract MockSlashDistributionExecutor420 {
    address public immutable authorizer;
    address public immutable policies;

    constructor(address authorizer_, address policies_) {
        authorizer = authorizer_;
        policies = policies_;
    }
}

contract MockObjectiveSlashEvidence420 is IComputeObjectiveSlashEvidence420 {
    mapping(bytes32 => Evidence) private _evidence;

    function set(bytes32 evidenceRef, Evidence calldata evidence) external {
        _evidence[evidenceRef] = evidence;
    }

    function slashEvidence(bytes32 evidenceRef)
        external
        view
        returns (Evidence memory evidence)
    {
        evidence = _evidence[evidenceRef];
    }
}

contract MockSlashableCollateral420 is IComputeSlashableCollateral420 {
    struct Snapshot {
        uint8 subjectKind;
        bytes32 subjectRef;
        address beneficiary;
        bytes32 stakePolicyId;
        uint64 positionRevision;
        uint64 openedAt;
        uint32 slashPolicyRevision;
        bytes32 slashPolicyCommitment;
        uint256 slashableAmount;
        bool active;
        bool exiting;
        bool exists;
    }

    address public immutable override slashAuthorization;
    mapping(bytes32 => Snapshot) private _snapshots;

    constructor(address slashAuthorization_) {
        slashAuthorization = slashAuthorization_;
    }

    function set(bytes32 positionId, Snapshot calldata s) external {
        _snapshots[positionId] = s;
    }

    function slashSnapshot(bytes32 positionId) external view returns (
        uint8 subjectKind,
        bytes32 subjectRef,
        address beneficiary,
        bytes32 stakePolicyId,
        uint64 positionRevision,
        uint64 openedAt,
        uint32 slashPolicyRevision,
        bytes32 slashPolicyCommitment,
        uint256 slashableAmount,
        bool active,
        bool exiting,
        bool exists
    ) {
        Snapshot memory s = _snapshots[positionId];
        return (
            s.subjectKind,
            s.subjectRef,
            s.beneficiary,
            s.stakePolicyId,
            s.positionRevision,
            s.openedAt,
            s.slashPolicyRevision,
            s.slashPolicyCommitment,
            s.slashableAmount,
            s.active,
            s.exiting,
            s.exists
        );
    }
}

contract ComputeStakeSlashAuthorization420Test {
    VmComputeStakeSlashAuthorization420 private constant vm =
        VmComputeStakeSlashAuthorization420(
            address(uint160(uint256(keccak256("hevm cheat code"))))
        );

    address private constant GOV = address(0x420);
    address private constant WORKER = address(0xA11CE);
    address private constant VERIFIER = address(0xB0B);
    address private constant TREASURY = address(0x7777);

    bytes32 private constant STAKE_POLICY = keccak256("cmp/stake/slash/auth");
    bytes32 private constant WORKER_ID = keccak256("worker-id");
    bytes32 private constant WORKER_POSITION = keccak256("worker-position");
    bytes32 private constant VERIFIER_POSITION = keccak256("verifier-position");
    bytes32 private constant VIOLATION = keccak256("objective-violation");
    bytes32 private constant VERIFY_POLICY = keccak256("verification-policy");
    bytes32 private constant VERIFY_COMMITMENT = keccak256("verification-policy-commitment");

    ComputeStakeSlashPolicy420 private policies;
    ComputeStakeSlashAuthorization420 private authorizer;
    ComputeStakeSlashDistributionPolicy420 private distributionPolicies;
    MockSlashDistributionExecutor420 private distributionExecutor;
    MockObjectiveSlashEvidence420 private evidence;
    MockSlashableCollateral420 private workerSource;
    MockSlashableCollateral420 private verifierSource;

    uint32 private workerPolicyRevision;
    uint32 private verifierPolicyRevision;

    function setUp() public {
        evidence = new MockObjectiveSlashEvidence420();
        policies = new ComputeStakeSlashPolicy420(GOV);

        vm.prank(GOV);
        workerPolicyRevision = policies.publish(
            STAKE_POLICY,
            1,
            address(evidence),
            VIOLATION,
            bytes32(0),
            0,
            bytes32(0),
            2500,
            0
        );

        vm.prank(GOV);
        verifierPolicyRevision = policies.publish(
            STAKE_POLICY,
            2,
            address(evidence),
            VIOLATION,
            VERIFY_POLICY,
            7,
            VERIFY_COMMITMENT,
            5000,
            40 ether
        );

        distributionPolicies = new ComputeStakeSlashDistributionPolicy420(GOV);
        vm.prank(GOV);
        distributionPolicies.publish(
            policies.commitment(STAKE_POLICY, 1, workerPolicyRevision),
            address(0),
            TREASURY,
            0,
            0,
            0,
            10_000
        );
        vm.prank(GOV);
        distributionPolicies.publish(
            policies.commitment(STAKE_POLICY, 2, verifierPolicyRevision),
            address(0),
            TREASURY,
            0,
            0,
            0,
            10_000
        );
        authorizer = new ComputeStakeSlashAuthorization420(address(policies));
        workerSource = new MockSlashableCollateral420(address(authorizer));
        verifierSource = new MockSlashableCollateral420(address(authorizer));
        authorizer.bindSources(address(workerSource), address(verifierSource));
        distributionExecutor =
            new MockSlashDistributionExecutor420(address(authorizer), address(distributionPolicies));
        authorizer.bindDistribution(address(distributionPolicies), address(distributionExecutor));

        workerSource.set(
            WORKER_POSITION,
            MockSlashableCollateral420.Snapshot({
                subjectKind: 1,
                subjectRef: WORKER_ID,
                beneficiary: WORKER,
                stakePolicyId: STAKE_POLICY,
                positionRevision: 3,
                openedAt: uint64(block.timestamp),
                slashPolicyRevision: workerPolicyRevision,
                slashPolicyCommitment:
                    policies.commitment(STAKE_POLICY, 1, workerPolicyRevision),
                slashableAmount: 100 ether,
                active: true,
                exiting: false,
                exists: true
            })
        );

        verifierSource.set(
            VERIFIER_POSITION,
            MockSlashableCollateral420.Snapshot({
                subjectKind: 2,
                subjectRef: bytes32(uint256(uint160(VERIFIER))),
                beneficiary: VERIFIER,
                stakePolicyId: STAKE_POLICY,
                positionRevision: 2,
                openedAt: uint64(block.timestamp),
                slashPolicyRevision: verifierPolicyRevision,
                slashPolicyCommitment:
                    policies.commitment(STAKE_POLICY, 2, verifierPolicyRevision),
                slashableAmount: 100 ether,
                active: true,
                exiting: true,
                exists: true
            })
        );
    }

    function _workerEvidence(bytes32 ref, bytes32 misconductKey) private {
        evidence.set(
            ref,
            IComputeObjectiveSlashEvidence420.Evidence({
                subjectKind: 1,
                subjectRef: WORKER_ID,
                subjectAccount: WORKER,
                stakePolicyId: STAKE_POLICY,
                verificationPolicyId: bytes32(0),
                verificationPolicyRevision: 0,
                verificationPolicyCommitment: bytes32(0),
                violationCode: VIOLATION,
                misconductKey: misconductKey,
                evidenceCommitment: keccak256(abi.encode("worker-evidence", ref)),
                evidenceAt: uint64(block.timestamp),
                finalObjective: true
            })
        );
    }

    function _verifierEvidence(bytes32 ref, bytes32 misconductKey) private {
        evidence.set(
            ref,
            IComputeObjectiveSlashEvidence420.Evidence({
                subjectKind: 2,
                subjectRef: bytes32(uint256(uint160(VERIFIER))),
                subjectAccount: VERIFIER,
                stakePolicyId: bytes32(0),
                verificationPolicyId: VERIFY_POLICY,
                verificationPolicyRevision: 7,
                verificationPolicyCommitment: VERIFY_COMMITMENT,
                violationCode: VIOLATION,
                misconductKey: misconductKey,
                evidenceCommitment: keccak256(abi.encode("verifier-evidence", ref)),
                evidenceAt: uint64(block.timestamp),
                finalObjective: true
            })
        );
    }

    function testWorkerObjectiveEvidenceAuthorizesBoundedAmountAndReplayFails() public {
        bytes32 ref = keccak256("worker-evidence-1");
        bytes32 misconduct = keccak256("misconduct-1");
        _workerEvidence(ref, misconduct);

        (bytes32 authorizationRef, uint256 amount) =
            authorizer.authorize(WORKER_POSITION, 1, workerPolicyRevision, ref);

        require(authorizationRef != bytes32(0), "authorization missing");
        require(amount == 25 ether, "worker slash amount");
        require(authorizer.outstandingSlash(WORKER_POSITION) == 25 ether, "worker hold");

        ComputeStakeSlashAuthorization420.Authorization memory a =
            authorizer.authorization(authorizationRef);
        require(
            a.positionId == WORKER_POSITION
                && a.subjectRef == WORKER_ID
                && a.subjectAccount == WORKER
                && a.misconductKey == misconduct
                && a.amount == 25 ether,
            "authorization record"
        );

        (bool ok,) = address(authorizer).call(
            abi.encodeCall(
                authorizer.authorize,
                (WORKER_POSITION, uint8(1), workerPolicyRevision, ref)
            )
        );
        require(!ok, "misconduct replay authorized");
    }

    function testVerifierAuthorizationRequiresExactVerificationPolicyAndCapsAmount() public {
        bytes32 ref = keccak256("verifier-evidence-1");
        _verifierEvidence(ref, keccak256("verifier-misconduct-1"));

        (bytes32 authorizationRef, uint256 amount) =
            authorizer.authorize(VERIFIER_POSITION, 2, verifierPolicyRevision, ref);

        require(authorizationRef != bytes32(0), "verifier authorization missing");
        require(amount == 40 ether, "max slash cap ignored");
        require(authorizer.outstandingSlash(VERIFIER_POSITION) == 40 ether, "verifier hold");
    }

    function testVerificationPolicyMismatchFailsClosed() public {
        bytes32 ref = keccak256("verifier-evidence-bad-policy");
        _verifierEvidence(ref, keccak256("verifier-misconduct-bad-policy"));

        IComputeObjectiveSlashEvidence420.Evidence memory e = evidence.slashEvidence(ref);
        e.verificationPolicyRevision = 8;
        evidence.set(ref, e);

        (bool ok,) = address(authorizer).call(
            abi.encodeCall(
                authorizer.authorize,
                (VERIFIER_POSITION, uint8(2), verifierPolicyRevision, ref)
            )
        );
        require(!ok, "wrong verification policy authorized");
        require(authorizer.outstandingSlash(VERIFIER_POSITION) == 0, "failed auth reserved slash");
    }

    function testSubjectOrStakePolicyMismatchFailsClosed() public {
        bytes32 ref = keccak256("worker-evidence-mismatch");
        _workerEvidence(ref, keccak256("worker-misconduct-mismatch"));

        IComputeObjectiveSlashEvidence420.Evidence memory e = evidence.slashEvidence(ref);
        e.subjectRef = keccak256("other-worker");
        evidence.set(ref, e);
        (bool ok,) = address(authorizer).call(
            abi.encodeCall(
                authorizer.authorize,
                (WORKER_POSITION, uint8(1), workerPolicyRevision, ref)
            )
        );
        require(!ok, "wrong worker authorized");

        e.subjectRef = WORKER_ID;
        e.stakePolicyId = keccak256("other-stake-policy");
        evidence.set(ref, e);
        (ok,) = address(authorizer).call(
            abi.encodeCall(
                authorizer.authorize,
                (WORKER_POSITION, uint8(1), workerPolicyRevision, ref)
            )
        );
        require(!ok, "wrong stake policy authorized");
    }

    function testLaterSlashPolicyRevisionCannotApplyRetroactively() public {
        vm.prank(GOV);
        uint32 later = policies.publish(
            STAKE_POLICY,
            1,
            address(evidence),
            VIOLATION,
            bytes32(0),
            0,
            bytes32(0),
            9000,
            0
        );

        bytes32 ref = keccak256("worker-evidence-later-policy");
        _workerEvidence(ref, keccak256("worker-misconduct-later-policy"));

        (bool ok,) = address(authorizer).call(
            abi.encodeCall(authorizer.authorize, (WORKER_POSITION, uint8(1), later, ref))
        );
        require(!ok, "retroactive policy authorized");

        (, uint256 amount) =
            authorizer.authorize(WORKER_POSITION, 1, workerPolicyRevision, ref);
        require(amount == 25 ether, "frozen policy not honored");
    }

    function testMultipleDistinctMisconductCannotReserveBeyondSlashable() public {
        vm.prank(GOV);
        uint32 aggressive = policies.publish(
            keccak256("cmp/stake/aggressive"),
            1,
            address(evidence),
            VIOLATION,
            bytes32(0),
            0,
            bytes32(0),
            6000,
            0
        );
        bytes32 aggressiveStake = keccak256("cmp/stake/aggressive");
        vm.prank(GOV);
        distributionPolicies.publish(
            policies.commitment(aggressiveStake, 1, aggressive),
            address(0),
            TREASURY,
            0,
            0,
            0,
            10_000
        );
        bytes32 position = keccak256("worker-position-aggressive");
        workerSource.set(
            position,
            MockSlashableCollateral420.Snapshot({
                subjectKind: 1,
                subjectRef: WORKER_ID,
                beneficiary: WORKER,
                stakePolicyId: aggressiveStake,
                positionRevision: 1,
                openedAt: uint64(block.timestamp),
                slashPolicyRevision: aggressive,
                slashPolicyCommitment: policies.commitment(aggressiveStake, 1, aggressive),
                slashableAmount: 100 ether,
                active: true,
                exiting: false,
                exists: true
            })
        );

        bytes32 ref1 = keccak256("aggressive-1");
        bytes32 ref2 = keccak256("aggressive-2");
        IComputeObjectiveSlashEvidence420.Evidence memory e =
            IComputeObjectiveSlashEvidence420.Evidence({
                subjectKind: 1,
                subjectRef: WORKER_ID,
                subjectAccount: WORKER,
                stakePolicyId: aggressiveStake,
                verificationPolicyId: bytes32(0),
                verificationPolicyRevision: 0,
                verificationPolicyCommitment: bytes32(0),
                violationCode: VIOLATION,
                misconductKey: keccak256("aggressive-misconduct-1"),
                evidenceCommitment: keccak256("aggressive-evidence-1"),
                evidenceAt: uint64(block.timestamp),
                finalObjective: true
            });
        evidence.set(ref1, e);
        e.misconductKey = keccak256("aggressive-misconduct-2");
        e.evidenceCommitment = keccak256("aggressive-evidence-2");
        evidence.set(ref2, e);

        (, uint256 first) = authorizer.authorize(position, 1, aggressive, ref1);
        (, uint256 second) = authorizer.authorize(position, 1, aggressive, ref2);
        require(first == 60 ether && second == 40 ether, "slash reservation cap");
        require(authorizer.outstandingSlash(position) == 100 ether, "over/under reserved");
    }

    function testNonFinalEvidenceCannotAuthorize() public {
        bytes32 ref = keccak256("worker-evidence-not-final");
        _workerEvidence(ref, keccak256("worker-misconduct-not-final"));
        IComputeObjectiveSlashEvidence420.Evidence memory e = evidence.slashEvidence(ref);
        e.finalObjective = false;
        evidence.set(ref, e);

        (bool ok,) = address(authorizer).call(
            abi.encodeCall(
                authorizer.authorize,
                (WORKER_POSITION, uint8(1), workerPolicyRevision, ref)
            )
        );
        require(!ok, "non-final evidence authorized");
    }
}
