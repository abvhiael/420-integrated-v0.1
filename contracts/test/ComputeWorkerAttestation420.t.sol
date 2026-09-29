// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeWorkerAttestedEligibility420.sol";
import "./helpers/ComputeWorkerCapabilityMock420.sol";

interface VmComputeWorkerAttestation420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

contract ComputeWorkerAttestation420Test {
    VmComputeWorkerAttestation420 private constant vm =
        VmComputeWorkerAttestation420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xA11CE);
    address private constant ATTESTER = address(0xA77E57);
    address private constant OUTSIDER = address(0xBAD);

    uint256 private constant EXEC_KEY = 0xBEEF;
    uint256 private constant NEXT_EXEC_KEY = 0xCAFE;
    uint256 private constant PROVENANCE_KEY = 0xD00D;

    bytes32 private constant POLICY = keccak256("trusted-gpu-policy");
    bytes32 private constant SCHEMA = keccak256("benchmark-schema-v1");
    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant SECURITY = keccak256("security");
    bytes32 private constant ENDPOINT = keccak256("endpoint");
    bytes32 private constant HARDWARE = keccak256("hardware");
    bytes32 private constant RUNTIME = keccak256("runtime");
    bytes32 private constant RESOURCE_CAP = keccak256("resource-capability");
    bytes32 private constant WORKER_CAP = keccak256("worker-capability-v1");
    bytes32 private constant WORKER_CAP_V2 = keccak256("worker-capability-v2");
    bytes32 private constant EVIDENCE_A = keccak256("independent-benchmark-evidence-a");
    bytes32 private constant EVIDENCE_B = keccak256("independent-benchmark-evidence-b");

    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeWorkerRegistry420 private workers;
    ComputeWorkerAttestation420 private attestations;
    ComputeWorkerAttestedEligibility420 private eligibility;

    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;
    bytes32 private workerId;
    address private executionSigner;
    address private nextExecutionSigner;
    address private provenanceSigner;

    function setUp() public {
        executionSigner = vm.addr(EXEC_KEY);
        nextExecutionSigner = vm.addr(NEXT_EXEC_KEY);
        provenanceSigner = vm.addr(PROVENANCE_KEY);

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        ComputeWorkerCapabilityMock420 workerCaps = new ComputeWorkerCapabilityMock420();
        workerCaps.setAllowPrincipal(OPERATOR, true);
        workerCaps.setAllowPrincipal(GOV, true);
        ComputeAuthorization420 workerAuthorization = new ComputeAuthorization420(address(workerCaps));
        workers = new ComputeWorkerRegistry420(address(resources), address(workerAuthorization), GOV);
        attestations = new ComputeWorkerAttestation420(address(workers), GOV);
        eligibility = new ComputeWorkerAttestedEligibility420(address(workers), address(attestations));

        vm.prank(OPERATOR);
        providerId = providers.register(MANIFEST, SECURITY, OPERATOR);
        vm.prank(GOV);
        providers.activate(providerId);

        vm.prank(OPERATOR);
        nodeId = nodes.register(providerId, MANIFEST, ENDPOINT, uint64(block.timestamp + 30 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);

        bytes32 gpuClass = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(nodeId, gpuClass, HARDWARE, RUNTIME, RESOURCE_CAP, 8);
        vm.prank(OPERATOR);
        resources.activate(resourceId);

        workerId = _registerWorker(WORKER_CAP);
        vm.prank(OPERATOR);
        workers.activate(workerId);

        bytes32 benchmarkType = attestations.EVIDENCE_BENCHMARK_V1();
        vm.prank(GOV);
        attestations.publishPolicy(POLICY, benchmarkType, SCHEMA, 7 days);
        vm.prank(GOV);
        attestations.setAttester(POLICY, ATTESTER, true);
        vm.prank(GOV);
        attestations.setAttester(POLICY, provenanceSigner, true);
    }

    function _sign(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _registerWorker(bytes32 capabilityProfileHash) private returns (bytes32 id) {
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        uint64 serial = workers.nextSerial() + 1;
        bytes32 digest = workers.registrationDigest(
            serial,
            r.providerId,
            r.nodeId,
            resourceId,
            r.revision,
            OPERATOR,
            executionSigner,
            capabilityProfileHash,
            bytes32(0)
        );
        bytes memory proof = _sign(EXEC_KEY, digest);
        vm.prank(OPERATOR);
        id = workers.register(resourceId, executionSigner, capabilityProfileHash, bytes32(0), proof);
    }

    function _attest(bytes32 subjectWorkerId, uint64 subjectRevision, bytes32 evidenceHash)
        private returns (bytes32 id)
    {
        vm.prank(ATTESTER);
        id = attestations.attest(
            subjectWorkerId,
            subjectRevision,
            POLICY,
            evidenceHash,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days)
        );
    }

    function _currentAttestation(bytes32 evidenceHash) private returns (bytes32 id) {
        id = _attest(workerId, workers.worker(workerId).revision, evidenceHash);
    }

    function testSelfReportedClaimCannotSatisfyRequiredAttestation() public {
        uint64 revision = workers.worker(workerId).revision;
        require(
            eligibility.isEligible(workerId, revision, false, bytes32(0), bytes32(0)),
            "base worker predicate unexpectedly failed"
        );
        require(
            !eligibility.isEligible(workerId, revision, true, POLICY, bytes32(0)),
            "self-reported capability bypassed required attestation"
        );
    }

    function testAuthorizedAttestationBindsExactCanonicalWorkerState() public {
        uint64 revision = workers.worker(workerId).revision;
        bytes32 evidenceId = _currentAttestation(EVIDENCE_A);
        ComputeWorkerAttestation420.Attestation memory a = attestations.attestation(evidenceId);
        ComputeWorkerRegistry420.Worker memory w = workers.worker(workerId);

        require(a.workerId == workerId && a.workerRevision == revision, "worker subject not bound");
        require(a.resourceId == resourceId && a.resourceRevision == w.resourceRevision, "resource subject not bound");
        require(a.capabilityProfileHash == w.capabilityProfileHash, "profile subject not bound");
        require(a.executionKeyCommitment == w.executionKeyCommitment, "key subject not bound");
        require(
            eligibility.isEligible(workerId, revision, true, POLICY, evidenceId),
            "valid independent evidence rejected"
        );
    }

    function testProfileRefreshInvalidatesOldEvidenceUntilReattested() public {
        uint64 oldRevision = workers.worker(workerId).revision;
        bytes32 oldEvidence = _currentAttestation(EVIDENCE_A);

        vm.prank(OPERATOR);
        workers.refreshProfile(workerId, WORKER_CAP_V2, bytes32(0));
        vm.prank(OPERATOR);
        workers.activate(workerId);

        uint64 newRevision = workers.worker(workerId).revision;
        require(newRevision != oldRevision, "worker revision did not advance");
        require(
            !eligibility.isEligible(workerId, newRevision, true, POLICY, oldEvidence),
            "old capability evidence survived profile revision"
        );

        bytes32 newEvidence = _currentAttestation(EVIDENCE_B);
        require(
            eligibility.isEligible(workerId, newRevision, true, POLICY, newEvidence),
            "reattested profile rejected"
        );
        require(
            attestations.attestation(oldEvidence).capabilityProfileHash == WORKER_CAP,
            "historical attestation rewritten"
        );
    }

    function testKeyRotationInvalidatesOldEvidenceUntilNewKeyIsAttested() public {
        uint64 oldRevision = workers.worker(workerId).revision;
        bytes32 oldEvidence = _currentAttestation(EVIDENCE_A);
        bytes32 digest = workers.rotationDigest(workerId, nextExecutionSigner);
        bytes memory proof = _sign(NEXT_EXEC_KEY, digest);

        vm.prank(OPERATOR);
        workers.rotateExecutionKey(workerId, nextExecutionSigner, proof);
        vm.prank(OPERATOR);
        workers.activate(workerId);

        uint64 newRevision = workers.worker(workerId).revision;
        require(
            !eligibility.isEligible(workerId, newRevision, true, POLICY, oldEvidence),
            "old key evidence survived rotation"
        );
        bytes32 newEvidence = _currentAttestation(EVIDENCE_B);
        require(
            attestations.attestation(newEvidence).executionKeyCommitment
                == workers.executionKeyCommitment(nextExecutionSigner),
            "new key not bound into attestation"
        );
        require(
            eligibility.isEligible(workerId, newRevision, true, POLICY, newEvidence),
            "new-key attestation rejected"
        );
        require(oldRevision < newRevision, "rotation did not revision worker");
    }

    function testExpiryRevocationAndFutureNotBeforeFailClosed() public {
        uint64 revision = workers.worker(workerId).revision;
        uint256 start = block.timestamp;
        uint64 validAfter = uint64(start + 1 hours);
        uint64 expiresAt = uint64(start + 2 hours);

        vm.prank(ATTESTER);
        bytes32 futureEvidence = attestations.attest(
            workerId,
            revision,
            POLICY,
            EVIDENCE_A,
            validAfter,
            expiresAt
        );
        require(
            !eligibility.isEligible(workerId, revision, true, POLICY, futureEvidence),
            "future-dated evidence active early"
        );
        vm.warp(uint256(validAfter));
        require(
            eligibility.isEligible(workerId, revision, true, POLICY, futureEvidence),
            "evidence not active at validAfter"
        );
        vm.warp(uint256(expiresAt) + 1);
        require(
            !eligibility.isEligible(workerId, revision, true, POLICY, futureEvidence),
            "expired evidence accepted"
        );

        bytes32 revocable = _currentAttestation(EVIDENCE_B);
        require(
            eligibility.isEligible(workerId, revision, true, POLICY, revocable),
            "fresh evidence rejected"
        );
        vm.prank(ATTESTER);
        attestations.revoke(revocable);
        require(
            !eligibility.isEligible(workerId, revision, true, POLICY, revocable),
            "revoked evidence accepted"
        );
    }

    function testAttesterRevocationAndPolicySupersessionInvalidateNewAdmission() public {
        uint64 revision = workers.worker(workerId).revision;
        bytes32 evidenceId = _currentAttestation(EVIDENCE_A);
        require(
            eligibility.isEligible(workerId, revision, true, POLICY, evidenceId),
            "baseline evidence rejected"
        );

        vm.prank(GOV);
        attestations.setAttester(POLICY, ATTESTER, false);
        require(
            !eligibility.isEligible(workerId, revision, true, POLICY, evidenceId),
            "untrusted attester remained valid for new admission"
        );

        vm.prank(GOV);
        attestations.setAttester(POLICY, ATTESTER, true);
        require(
            eligibility.isEligible(workerId, revision, true, POLICY, evidenceId),
            "attester restoration failed"
        );

        bytes32 benchmarkType = attestations.EVIDENCE_BENCHMARK_V1();
        vm.prank(GOV);
        attestations.publishPolicy(POLICY, benchmarkType, keccak256("benchmark-schema-v2"), 3 days);
        require(
            !eligibility.isEligible(workerId, revision, true, POLICY, evidenceId),
            "stale policy revision evidence accepted"
        );

        bytes32 fresh = _currentAttestation(EVIDENCE_B);
        require(
            eligibility.isEligible(workerId, revision, true, POLICY, fresh),
            "current policy evidence rejected"
        );
    }

    function testUnauthorizedAttestationReplayAndCrossWorkerReuseFailClosed() public {
        uint64 revision = workers.worker(workerId).revision;
        vm.prank(OUTSIDER);
        (bool ok,) = address(attestations).call(
            abi.encodeCall(
                attestations.attest,
                (
                    workerId,
                    revision,
                    POLICY,
                    EVIDENCE_A,
                    uint64(block.timestamp),
                    uint64(block.timestamp + 1 days)
                )
            )
        );
        require(!ok && attestations.nextEvidenceSerial() == 0, "unauthorized attester published evidence");

        bytes32 evidenceId = _currentAttestation(EVIDENCE_A);
        vm.prank(ATTESTER);
        (ok,) = address(attestations).call(
            abi.encodeCall(
                attestations.attest,
                (
                    workerId,
                    revision,
                    POLICY,
                    EVIDENCE_A,
                    uint64(block.timestamp),
                    uint64(block.timestamp + 1 days)
                )
            )
        );
        require(!ok && attestations.nextEvidenceSerial() == 1, "identical evidence replay accepted");

        bytes32 secondWorker = _registerWorker(WORKER_CAP);
        vm.prank(OPERATOR);
        workers.activate(secondWorker);
        uint64 secondRevision = workers.worker(secondWorker).revision;
        require(
            !eligibility.isEligible(secondWorker, secondRevision, true, POLICY, evidenceId),
            "cross-worker evidence replay accepted"
        );
    }

    function testAttestationAuthorityCannotMutateWorkerLifecycle() public {
        uint64 revision = workers.worker(workerId).revision;
        bytes32 evidenceId = _currentAttestation(EVIDENCE_A);
        require(
            eligibility.isEligible(workerId, revision, true, POLICY, evidenceId),
            "baseline evidence rejected"
        );

        vm.prank(ATTESTER);
        (bool ok,) = address(workers).call(abi.encodeCall(workers.suspend, (workerId)));
        require(!ok, "attester gained worker lifecycle authority");
        require(
            eligibility.isEligible(workerId, revision, true, POLICY, evidenceId),
            "failed authority escalation mutated worker"
        );
    }

    function _claim(
        bytes32 evidenceType,
        uint32 schemaRevision,
        bytes32 sourceCommitment,
        bytes32 evidenceHash,
        address issuer
    ) private view returns (ComputeWorkerAttestation420.ProvenanceClaim memory claim) {
        claim = ComputeWorkerAttestation420.ProvenanceClaim({
            evidenceType: evidenceType,
            schemaRevision: schemaRevision,
            sourceCommitment: sourceCommitment,
            evidenceHash: evidenceHash,
            issuedAt: uint64(block.timestamp),
            validAfter: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp + 1 days),
            issuer: issuer
        });
    }

    function _signedProvenance(
        bytes32 subjectWorkerId,
        uint64 subjectRevision,
        bytes32 policyId,
        uint32 policyRevision,
        ComputeWorkerAttestation420.ProvenanceClaim memory claim,
        uint256 signerKey
    ) private returns (bytes32 id) {
        bytes32 digest = attestations.provenanceDigest(
            subjectWorkerId, subjectRevision, policyId, policyRevision, claim
        );
        bytes memory signature = _sign(signerKey, digest);
        id = attestations.attestProvenance(
            subjectWorkerId, subjectRevision, policyId, policyRevision, claim, signature
        );
    }

    function testSignedBenchmarkProvenanceIsExplicitAndReconstructable() public {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerAttestation420.Policy memory p = attestations.policy(POLICY, 1);
        bytes32 source = keccak256("ipfs://benchmark-manifest");
        ComputeWorkerAttestation420.ProvenanceClaim memory claim =
            _claim(attestations.EVIDENCE_BENCHMARK_V1(), p.schemaRevision, source, EVIDENCE_A, provenanceSigner);

        bytes32 digest = attestations.provenanceDigest(workerId, revision, POLICY, 1, claim);
        bytes32 id = _signedProvenance(workerId, revision, POLICY, 1, claim, PROVENANCE_KEY);
        ComputeWorkerAttestation420.Attestation memory a = attestations.attestation(id);

        require(a.evidenceType == attestations.EVIDENCE_BENCHMARK_V1(), "benchmark type not bound");
        require(a.schemaHash == SCHEMA && a.schemaRevision == 1, "schema not bound");
        require(a.sourceCommitment == source && a.evidenceHash == EVIDENCE_A, "source/evidence not bound");
        require(a.provenanceDigest == digest, "provenance digest not reconstructable");
        require(a.attester == provenanceSigner, "issuer not bound");
        require(a.authorizationMode == attestations.PROVENANCE_AUTH_ECDSA_V1(), "signature mode not bound");
        require(a.signatureHash != bytes32(0), "signature commitment missing");
        require(
            eligibility.isEligible(workerId, revision, true, POLICY, id),
            "signed benchmark provenance rejected"
        );
    }

    function testBenchmarkTeeAndInspectionTypesRemainDistinct() public {
        bytes32 teePolicy = keccak256("tee-policy");
        bytes32 inspectionPolicy = keccak256("inspection-policy");
        vm.prank(GOV);
        attestations.publishPolicyVersioned(
            teePolicy, attestations.EVIDENCE_TEE_V1(), keccak256("tee-schema-v1"), 7, 2 days
        );
        vm.prank(GOV);
        attestations.publishPolicyVersioned(
            inspectionPolicy, attestations.EVIDENCE_INSPECTION_V1(), keccak256("inspection-schema-v1"), 11, 2 days
        );
        vm.prank(GOV);
        attestations.setAttester(teePolicy, provenanceSigner, true);
        vm.prank(GOV);
        attestations.setAttester(inspectionPolicy, provenanceSigner, true);

        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerAttestation420.ProvenanceClaim memory teeClaim =
            _claim(attestations.EVIDENCE_TEE_V1(), 7, keccak256("tee-source"), keccak256("tee-evidence"), provenanceSigner);
        ComputeWorkerAttestation420.ProvenanceClaim memory inspectionClaim =
            _claim(attestations.EVIDENCE_INSPECTION_V1(), 11, keccak256("inspection-source"), keccak256("inspection-evidence"), provenanceSigner);

        bytes32 teeId = _signedProvenance(workerId, revision, teePolicy, 1, teeClaim, PROVENANCE_KEY);
        bytes32 inspectionId = _signedProvenance(workerId, revision, inspectionPolicy, 1, inspectionClaim, PROVENANCE_KEY);

        require(attestations.attestation(teeId).evidenceType == attestations.EVIDENCE_TEE_V1(), "tee type collapsed");
        require(
            attestations.attestation(inspectionId).evidenceType == attestations.EVIDENCE_INSPECTION_V1(),
            "inspection type collapsed"
        );
        require(
            !eligibility.isEligible(workerId, revision, true, teePolicy, inspectionId),
            "inspection evidence substituted for tee"
        );
        require(
            !eligibility.isEligible(workerId, revision, true, inspectionPolicy, teeId),
            "tee evidence substituted for inspection"
        );
    }

    function testForgedSignatureWrongTypeAndWrongSchemaFailClosed() public {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerAttestation420.Policy memory p = attestations.policy(POLICY, 1);
        ComputeWorkerAttestation420.ProvenanceClaim memory valid =
            _claim(attestations.EVIDENCE_BENCHMARK_V1(), p.schemaRevision, keccak256("source"), EVIDENCE_A, provenanceSigner);

        bytes32 digest = attestations.provenanceDigest(workerId, revision, POLICY, 1, valid);
        bytes memory forged = _sign(EXEC_KEY, digest);
        (bool ok,) = address(attestations).call(
            abi.encodeCall(attestations.attestProvenance, (workerId, revision, POLICY, uint32(1), valid, forged))
        );
        require(!ok && attestations.nextEvidenceSerial() == 0, "forged provenance accepted");

        ComputeWorkerAttestation420.ProvenanceClaim memory wrongType = valid;
        wrongType.evidenceType = attestations.EVIDENCE_TEE_V1();
        bytes memory wrongTypeSig = _sign(
            PROVENANCE_KEY,
            attestations.provenanceDigest(workerId, revision, POLICY, 1, wrongType)
        );
        (ok,) = address(attestations).call(
            abi.encodeCall(attestations.attestProvenance, (workerId, revision, POLICY, uint32(1), wrongType, wrongTypeSig))
        );
        require(!ok && attestations.nextEvidenceSerial() == 0, "wrong evidence type accepted");

        ComputeWorkerAttestation420.ProvenanceClaim memory wrongSchema = valid;
        wrongSchema.schemaRevision = p.schemaRevision + 1;
        bytes memory wrongSchemaSig = _sign(
            PROVENANCE_KEY,
            attestations.provenanceDigest(workerId, revision, POLICY, 1, wrongSchema)
        );
        (ok,) = address(attestations).call(
            abi.encodeCall(attestations.attestProvenance, (workerId, revision, POLICY, uint32(1), wrongSchema, wrongSchemaSig))
        );
        require(!ok && attestations.nextEvidenceSerial() == 0, "wrong schema revision accepted");
    }

    function testEvidenceSubstitutionCrossSubjectReuseAndReplayFailClosed() public {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerAttestation420.Policy memory p = attestations.policy(POLICY, 1);
        ComputeWorkerAttestation420.ProvenanceClaim memory claim =
            _claim(attestations.EVIDENCE_BENCHMARK_V1(), p.schemaRevision, keccak256("source-a"), EVIDENCE_A, provenanceSigner);
        bytes32 digest = attestations.provenanceDigest(workerId, revision, POLICY, 1, claim);
        bytes memory signature = _sign(PROVENANCE_KEY, digest);

        ComputeWorkerAttestation420.ProvenanceClaim memory substituted = claim;
        substituted.sourceCommitment = keccak256("source-b");
        (bool ok,) = address(attestations).call(
            abi.encodeCall(attestations.attestProvenance, (workerId, revision, POLICY, uint32(1), substituted, signature))
        );
        require(!ok && attestations.nextEvidenceSerial() == 0, "source substitution accepted");

        bytes32 secondWorker = _registerWorker(WORKER_CAP);
        vm.prank(OPERATOR);
        workers.activate(secondWorker);
        uint64 secondRevision = workers.worker(secondWorker).revision;
        (ok,) = address(attestations).call(
            abi.encodeCall(attestations.attestProvenance, (secondWorker, secondRevision, POLICY, uint32(1), claim, signature))
        );
        require(!ok && attestations.nextEvidenceSerial() == 0, "cross-subject signed evidence reused");

        bytes32 id = attestations.attestProvenance(workerId, revision, POLICY, 1, claim, signature);
        require(id != bytes32(0), "valid provenance missing");
        (ok,) = address(attestations).call(
            abi.encodeCall(attestations.attestProvenance, (workerId, revision, POLICY, uint32(1), claim, signature))
        );
        require(!ok && attestations.nextEvidenceSerial() == 1, "signed provenance replay accepted");
    }

    function testStalePolicyRevokedIssuerAndRevokedEvidenceFailClosed() public {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerAttestation420.Policy memory p = attestations.policy(POLICY, 1);
        ComputeWorkerAttestation420.ProvenanceClaim memory claim =
            _claim(attestations.EVIDENCE_BENCHMARK_V1(), p.schemaRevision, keccak256("source"), EVIDENCE_A, provenanceSigner);
        bytes32 id = _signedProvenance(workerId, revision, POLICY, 1, claim, PROVENANCE_KEY);
        require(eligibility.isEligible(workerId, revision, true, POLICY, id), "baseline provenance rejected");

        vm.prank(GOV);
        attestations.setAttester(POLICY, provenanceSigner, false);
        require(!eligibility.isEligible(workerId, revision, true, POLICY, id), "revoked issuer still eligible");

        vm.prank(GOV);
        attestations.setAttester(POLICY, provenanceSigner, true);
        vm.prank(GOV);
        attestations.publishPolicyVersioned(
            POLICY, attestations.EVIDENCE_BENCHMARK_V1(), keccak256("benchmark-schema-v2"), 2, 3 days
        );
        require(!eligibility.isEligible(workerId, revision, true, POLICY, id), "stale policy evidence still eligible");

        bytes memory staleSignature = _sign(
            PROVENANCE_KEY,
            attestations.provenanceDigest(workerId, revision, POLICY, 1, claim)
        );
        (bool ok,) = address(attestations).call(
            abi.encodeCall(attestations.attestProvenance, (workerId, revision, POLICY, uint32(1), claim, staleSignature))
        );
        require(!ok, "stale policy revision published");

        ComputeWorkerAttestation420.ProvenanceClaim memory current =
            _claim(attestations.EVIDENCE_BENCHMARK_V1(), 2, keccak256("source-v2"), EVIDENCE_B, provenanceSigner);
        bytes32 currentId = _signedProvenance(workerId, revision, POLICY, 2, current, PROVENANCE_KEY);
        vm.prank(provenanceSigner);
        attestations.revoke(currentId);
        require(!eligibility.isEligible(workerId, revision, true, POLICY, currentId), "revoked evidence eligible");
    }

    function testFutureIssuanceIsRejectedWithoutStateMutation() public {
        uint64 revision = workers.worker(workerId).revision;
        ComputeWorkerAttestation420.Policy memory p = attestations.policy(POLICY, 1);
        ComputeWorkerAttestation420.ProvenanceClaim memory claim =
            _claim(attestations.EVIDENCE_BENCHMARK_V1(), p.schemaRevision, keccak256("future-source"), EVIDENCE_A, provenanceSigner);
        claim.issuedAt = uint64(block.timestamp + 1);
        claim.validAfter = claim.issuedAt;

        bytes32 digest = attestations.provenanceDigest(workerId, revision, POLICY, 1, claim);
        bytes memory signature = _sign(PROVENANCE_KEY, digest);
        (bool ok,) = address(attestations).call(
            abi.encodeCall(attestations.attestProvenance, (workerId, revision, POLICY, uint32(1), claim, signature))
        );
        require(!ok && attestations.nextEvidenceSerial() == 0, "future issuance accepted");
    }
}
