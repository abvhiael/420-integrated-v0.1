// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeIndependentVerifierSelector420.sol";
import "../src/compute/ComputePolicyRegistry420.sol";

interface VmCMP145 {
    function prank(address caller) external;
}

contract CMP145Fixture420 is
    IComputeJobRequestEvidence420,
    IComputeJobFundingEvidence420,
    IComputeJobMatchEvidence420,
    IComputeJobWorkerEvidence420,
    IComputeJobVerificationEvidence420,
    IComputeJobSettlementEvidence420,
    IComputeJobRefundEvidence420,
    IComputeAcceptedMatchRuntime420
{
    address public override jobs;
    address public payer;
    uint256 public maxSpend;
    bytes32 public activeJob;
    address public owner;
    address public operator;

    constructor(address payer_) { payer = payer_; maxSpend = 100 ether; }

    function bindJobs(address jobs_) external { jobs = jobs_; }
    function setParties(bytes32 jobId, address owner_, address operator_) external {
        activeJob = jobId; owner = owner_; operator = operator_;
    }

    function fundingTerms(bytes32) external view returns (address, uint256) { return (payer, maxSpend); }
    function validRequest(bytes32,address,bytes32,bytes32,bytes32,bytes32,bytes32,uint64)
        external pure returns (bool) { return true; }
    function funded(bytes32,address,bytes32) external pure returns (bool) { return true; }
    function matched(bytes32,bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function accepted(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function authorizedAssignment(bytes32,bytes32,address,bytes32) external pure returns (bool) { return true; }
    function committedResult(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function verified(bytes32,bytes32,address,bytes32,bool) external pure returns (bool) { return true; }
    function settled(bytes32,bytes32,bytes32) external pure returns (bool) { return true; }
    function refunded(bytes32,bytes32) external pure returns (bool) { return true; }
    function authorizedResource(bytes32,bytes32,bytes32,bytes32,address) external pure returns (bool) { return true; }

    function matchParties(bytes32) external view returns (bytes32,address,address,bool) {
        return (activeJob, owner, operator, activeJob != bytes32(0));
    }

    function acceptIntoJob(bytes32 jobId, uint64 expectedRevision, bytes32 acceptanceRef) external {
        ComputeJobRegistry420(jobs).recordAcceptance(jobId, expectedRevision, acceptanceRef);
    }

    function assignIntoJob(bytes32 jobId, uint64 expectedRevision, address worker, bytes32 assignmentRef) external {
        ComputeJobRegistry420(jobs).assignWorker(jobId, expectedRevision, worker, assignmentRef);
    }
}

contract ComputeIndependentVerifierSelector420Test {
    VmCMP145 private constant vm =
        VmCMP145(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant ATTESTOR = address(0x421);
    address private constant PLACEHOLDER_SELECTOR = address(0x422);
    address private constant SELECTION_AUTHORITY = address(0x423);
    address private constant OWNER = address(0xA11CE);
    address private constant PAYER = address(0xBEEF);
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant VERIFIER = address(0xD00D);
    address private constant CONFLICTED = address(0xD00E);
    address private constant OUTSIDER = address(0xBAD);

    bytes32 private constant REQUEST = keccak256("request");
    bytes32 private constant REQUEST_COMMITMENT = keccak256("request-commitment");
    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant WORKLOAD = keccak256("GPU_INFERENCE");
    bytes32 private constant INPUT = keccak256("input");
    bytes32 private constant OUTPUT = keccak256("output");
    bytes32 private constant FUNDING = keccak256("funding");
    bytes32 private constant MATCH = keccak256("match");
    bytes32 private constant ACCEPTANCE = keccak256("acceptance");
    bytes32 private constant PROFILE = keccak256("profile");
    bytes32 private constant POLICY = keccak256("verification-policy");
    bytes32 private constant POLICY_TERMS = keccak256("verification-terms");
    bytes32 private constant POLICY_SCHEMA = keccak256("verification-schema");
    bytes32 private constant SELECTION_EVIDENCE = keccak256("reviewed-selection-evidence");

    CMP145Fixture420 private fixture;
    ComputeJobRegistry420 private jobs;
    ComputePolicyRegistry420 private policies;
    ComputeVerifierRegistry420 private verifierRegistry;
    ComputeVerifierCapabilityRegistry420 private capabilities;
    ComputeVerifierIndependencePolicy420 private independence;
    ComputeIndependentVerifierSelector420 private selector;
    bytes32 private jobId;
    bytes32 private verifierId;
    bytes32 private conflictedId;

    function setUp() public {
        fixture = new CMP145Fixture420(PAYER);
        policies = new ComputePolicyRegistry420(GOV);
        jobs = new ComputeJobRegistry420(
            address(fixture), address(fixture), address(fixture),
            address(fixture), address(fixture), address(fixture)
        );
        fixture.bindJobs(address(jobs));
        jobs.bindVerificationPolicyRegistry(address(policies));

        verifierRegistry = new ComputeVerifierRegistry420(GOV);
        capabilities = new ComputeVerifierCapabilityRegistry420(address(verifierRegistry), GOV);
        independence = new ComputeVerifierIndependencePolicy420(GOV, ATTESTOR, PLACEHOLDER_SELECTOR);

        selector = new ComputeIndependentVerifierSelector420(
            address(jobs),
            address(fixture),
            address(verifierRegistry),
            address(capabilities),
            address(independence),
            SELECTION_AUTHORITY
        );

        vm.prank(GOV);
        independence.setAuthorities(ATTESTOR, address(selector));

        _attest(OWNER, keccak256("owner-controller"), 1);
        _attest(PAYER, keccak256("payer-controller"), 2);
        _attest(OPERATOR, keccak256("operator-controller"), 3);
        _attest(VERIFIER, keccak256("independent-controller"), 4);
        _attest(CONFLICTED, keccak256("owner-controller"), 5);

        verifierId = _registerVerifier(VERIFIER, keccak256("verifier-registration"));
        conflictedId = _registerVerifier(CONFLICTED, keccak256("conflicted-registration"));

        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();
        vm.prank(GOV);
        capabilities.setCapability(verifierId, independentClass, WORKLOAD, true, keccak256("capability-a"));
        vm.prank(GOV);
        capabilities.setCapability(conflictedId, independentClass, WORKLOAD, true, keccak256("capability-b"));

        bytes32 verificationKind = policies.KIND_VERIFICATION();
        vm.prank(GOV);
        policies.publish(POLICY, verificationKind, POLICY_TERMS, POLICY_SCHEMA, 1 days, 100, 100 ether);

        vm.prank(OWNER);
        jobId = jobs.createJob(
            REQUEST, REQUEST_COMMITMENT, MANIFEST, WORKLOAD, INPUT, OUTPUT,
            uint64(block.timestamp + 1 days)
        );
        fixture.setParties(jobId, OWNER, OPERATOR);

        vm.prank(OWNER);
        jobs.recordFunding(jobId, 1, FUNDING);
        vm.prank(OWNER);
        jobs.recordMatch(jobId, 2, MATCH);
        fixture.acceptIntoJob(jobId, 3, ACCEPTANCE);

        bytes32 commitment = policies.commitment(POLICY, 1);
        vm.prank(OWNER);
        jobs.bindVerificationPolicy(jobId, 4, POLICY, 1, commitment);
    }

    function _attest(address account, bytes32 controller, uint256 salt) private {
        vm.prank(ATTESTOR);
        independence.attest(
            account,
            controller,
            keccak256(abi.encode("controller-evidence", salt)),
            uint64(block.timestamp + 1 days)
        );
    }

    function _registerVerifier(address authority, bytes32 manifest) private returns (bytes32 id) {
        vm.prank(authority);
        id = verifierRegistry.register(manifest);
        vm.prank(GOV);
        verifierRegistry.activate(id);
    }

    function _select(bytes32 id, address authority) private returns (bytes32 ref) {
        uint64 revision = verifierRegistry.verifier(id).revision;
        require(verifierRegistry.verifier(id).authority == authority, "authority fixture drift");
        vm.prank(SELECTION_AUTHORITY);
        ref = selector.select(
            jobId,
            id,
            revision,
            PROFILE,
            SELECTION_EVIDENCE,
            uint64(block.timestamp + 1 hours)
        );
    }

    function testDesignatedSelectorChoosesOnlyActiveCapableIndependentVerifier() public {
        bytes32 ref = _select(verifierId, VERIFIER);
        require(ref != bytes32(0), "selection ref missing");

        ComputeIndependentVerifierSelector420.Selection memory s = selector.selection(jobId);
        require(s.active, "selection inactive");
        require(s.verifierId == verifierId && s.verifier == VERIFIER, "wrong verifier");
        require(s.jobRevision == 5, "wrong job revision");
        require(s.workloadClass == WORKLOAD && s.profileId == PROFILE, "wrong workload/profile");
        require(s.verificationPolicyId == POLICY && s.verificationPolicyRevision == 1, "policy not bound");
        require(
            independence.eligible(jobId, VERIFIER, PROFILE, OWNER, PAYER, OPERATOR),
            "policy appointment not eligible"
        );
    }

    function testWorkerOwnerPayerVerifierAndOutsiderCannotChooseVerifier() public {
        uint64 revision = verifierRegistry.verifier(verifierId).revision;
        address[5] memory callers = [OPERATOR, OWNER, PAYER, VERIFIER, OUTSIDER];
        for (uint256 i = 0; i < callers.length; ++i) {
            vm.prank(callers[i]);
            (bool ok,) = address(selector).call(
                abi.encodeCall(
                    selector.select,
                    (
                        jobId,
                        verifierId,
                        revision,
                        PROFILE,
                        SELECTION_EVIDENCE,
                        uint64(block.timestamp + 1 hours)
                    )
                )
            );
            require(!ok, "unauthorized party selected verifier");
        }
    }

    function testSharedControllerFriendlyVerifierFailsClosed() public {
        uint64 revision = verifierRegistry.verifier(conflictedId).revision;
        vm.prank(SELECTION_AUTHORITY);
        (bool ok,) = address(selector).call(
            abi.encodeCall(
                selector.select,
                (
                    jobId,
                    conflictedId,
                    revision,
                    PROFILE,
                    SELECTION_EVIDENCE,
                    uint64(block.timestamp + 1 hours)
                )
            )
        );
        require(!ok, "shared-controller friendly verifier selected");
        require(!independence.appointment(jobId).active, "conflicted appointment persisted");
    }

    function testWrongWorkloadOrSuspendedVerifierFailsClosed() public {
        bytes32 cpu = keccak256("CPU_GENERAL");
        bytes32 second = _registerVerifier(OUTSIDER, keccak256("other-registration"));
        _attest(OUTSIDER, keccak256("other-controller"), 6);

        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();
        vm.prank(GOV);
        capabilities.setCapability(second, independentClass, cpu, true, keccak256("cpu-only"));

        uint64 secondRevision = verifierRegistry.verifier(second).revision;
        vm.prank(SELECTION_AUTHORITY);
        (bool ok,) = address(selector).call(
            abi.encodeCall(
                selector.select,
                (
                    jobId,
                    second,
                    secondRevision,
                    PROFILE,
                    SELECTION_EVIDENCE,
                    uint64(block.timestamp + 1 hours)
                )
            )
        );
        require(!ok, "wrong-workload verifier selected");

        vm.prank(GOV);
        verifierRegistry.suspend(verifierId);
        uint64 suspendedRevision = verifierRegistry.verifier(verifierId).revision;

        vm.prank(SELECTION_AUTHORITY);
        (ok,) = address(selector).call(
            abi.encodeCall(
                selector.select,
                (
                    jobId,
                    verifierId,
                    suspendedRevision,
                    PROFILE,
                    SELECTION_EVIDENCE,
                    uint64(block.timestamp + 1 hours)
                )
            )
        );
        require(!ok, "suspended verifier selected");
    }

    function testSelectionMustOccurBeforeExecution() public {
        fixture.assignIntoJob(jobId, 5, OPERATOR, keccak256("assignment"));
        require(jobs.job(jobId).status == ComputeJobRegistry420.Status.RUNNING, "fixture did not run");

        uint64 revision = verifierRegistry.verifier(verifierId).revision;
        vm.prank(SELECTION_AUTHORITY);
        (bool ok,) = address(selector).call(
            abi.encodeCall(
                selector.select,
                (
                    jobId,
                    verifierId,
                    revision,
                    PROFILE,
                    SELECTION_EVIDENCE,
                    uint64(block.timestamp + 1 hours)
                )
            )
        );
        require(!ok, "post-execution verifier selection accepted");
    }

    function testSelectorRevocationIsVersionedAndAllowsReviewedReplacementBeforeExecution() public {
        _select(verifierId, VERIFIER);

        vm.prank(SELECTION_AUTHORITY);
        selector.revoke(jobId, keccak256("selection-revoked"));

        ComputeIndependentVerifierSelector420.Selection memory old = selector.selectionRevision(jobId, 1);
        ComputeIndependentVerifierSelector420.Selection memory revoked = selector.selection(jobId);
        require(old.active, "historical selection rewritten");
        require(!revoked.active && revoked.revision == 2, "revocation revision missing");
        require(!independence.appointment(jobId).active, "appointment remained active");

        address replacementAuthority = address(0xD00F);
        _attest(replacementAuthority, keccak256("replacement-controller"), 7);
        bytes32 replacementId = _registerVerifier(replacementAuthority, keccak256("replacement-registration"));
        bytes32 independentClass = capabilities.INDEPENDENT_VERIFIER();
        vm.prank(GOV);
        capabilities.setCapability(
            replacementId,
            independentClass,
            WORKLOAD,
            true,
            keccak256("replacement-capability")
        );

        uint64 replacementRevision = verifierRegistry.verifier(replacementId).revision;
        vm.prank(SELECTION_AUTHORITY);
        selector.select(
            jobId,
            replacementId,
            replacementRevision,
            PROFILE,
            keccak256("replacement-reviewed-selection"),
            uint64(block.timestamp + 1 hours)
        );

        ComputeIndependentVerifierSelector420.Selection memory replacement = selector.selection(jobId);
        require(replacement.active && replacement.revision == 3, "replacement not versioned");
        require(replacement.verifier == replacementAuthority, "wrong replacement");
    }

    function testPolicySelectorRotationInvalidatesOldSelectorContract() public {
        vm.prank(GOV);
        independence.setAuthorities(ATTESTOR, address(0x9999));

        uint64 revision = verifierRegistry.verifier(verifierId).revision;
        vm.prank(SELECTION_AUTHORITY);
        (bool ok,) = address(selector).call(
            abi.encodeCall(
                selector.select,
                (
                    jobId,
                    verifierId,
                    revision,
                    PROFILE,
                    SELECTION_EVIDENCE,
                    uint64(block.timestamp + 1 hours)
                )
            )
        );
        require(!ok, "rotated-out selector retained appointment authority");
    }
}
