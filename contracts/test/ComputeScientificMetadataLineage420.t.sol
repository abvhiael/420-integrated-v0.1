// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeScientificMetadataLineage420.sol";

contract MetadataResultSourceMock420 is IComputeScientificCanonicalResultLineageSource420 {
    mapping(bytes32 => ContextView) internal contexts;

    function systemName() external pure returns (string memory) { return "ComputeScientificResultSource420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function set(bytes32 jobId, ContextView memory c) external { contexts[jobId] = c; }
    function context(bytes32 jobId) external view returns (ContextView memory) { return contexts[jobId]; }
}

contract MetadataProvenanceMock420 is IComputeScientificProvenanceLineageSource420 {
    address public immutable source;
    mapping(bytes32 => ProvenanceView) internal records;
    mapping(bytes32 => bool) internal canonical;

    constructor(address source_) { source = source_; }
    function systemName() external pure returns (string memory) { return "ComputeScientificResultProvenance420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function set(bytes32 id, ProvenanceView memory p, bool ok) external { records[id] = p; canonical[id] = ok; }
    function provenance(bytes32 id) external view returns (ProvenanceView memory) {
        ProvenanceView memory p = records[id];
        require(p.exists, "missing provenance");
        return p;
    }
    function isCanonical(bytes32 id) external view returns (bool) { return canonical[id]; }
}

contract MetadataProjectMock420 is IComputeResearchProjectLineageSource420 {
    mapping(bytes32 => mapping(uint64 => ProjectView)) internal projects;
    mapping(bytes32 => mapping(uint64 => bytes32)) internal commitments;

    function systemName() external pure returns (string memory) { return "ComputeResearchProjectRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function set(bytes32 id, uint64 rev, ProjectView memory p, bytes32 c) external {
        projects[id][rev] = p; commitments[id][rev] = c;
    }
    function revision(bytes32 id, uint64 rev) external view returns (ProjectView memory) { return projects[id][rev]; }
    function commitment(bytes32 id, uint64 rev) external view returns (bytes32) { return commitments[id][rev]; }
}

contract MetadataOutsider420 {
    function record(
        ComputeScientificMetadataLineage420 target,
        bytes32 provenanceId,
        ComputeScientificMetadataLineage420.ScientificBindingWitness calldata witness,
        bytes32 schema,
        bytes32 metadata,
        bytes32 relation,
        bytes32[] calldata parents
    ) external returns (bytes32) {
        return target.recordMetadataLineage(provenanceId, witness, schema, metadata, relation, parents);
    }
}

contract ComputeScientificMetadataLineage420Test {
    MetadataResultSourceMock420 source;
    MetadataProvenanceMock420 provenance;
    MetadataProjectMock420 projects;
    ComputeScientificMetadataLineage420 lineage;

    bytes32 constant PROJECT_ID = keccak256("project-id");
    bytes32 constant PROJECT_COMMITMENT = keccak256("project-commitment");
    bytes32 constant ENVIRONMENT = keccak256("environment");
    bytes32 constant PARAMETERS = keccak256("parameters");
    bytes32 constant RESOURCE = keccak256("resource");
    bytes32 constant MANIFEST = keccak256("manifest");
    bytes32 constant INPUT = keccak256("input");
    bytes32 constant OUTPUT_SCHEMA = keccak256("output-schema");
    bytes32 constant FUNDING = keccak256("funding");
    bytes32 constant VERIFY_POLICY = keccak256("verify-policy");
    bytes32 constant VERIFY_REF = keccak256("verify-ref");
    bytes32 constant EXECUTION = keccak256("execution");
    bytes32 constant SCHEMA = keccak256("metadata-schema");

    function setUp() public {
        source = new MetadataResultSourceMock420();
        provenance = new MetadataProvenanceMock420(address(source));
        projects = new MetadataProjectMock420();
        lineage = new ComputeScientificMetadataLineage420(provenance, projects);
        _setProject();
        _setProvenance(keccak256("root-prov"), keccak256("root-job"), keccak256("root-result"), true);
    }

    function _setProject() internal {
        IComputeResearchProjectLineageSource420.ProjectView memory p =
            IComputeResearchProjectLineageSource420.ProjectView({
                owner: address(this),
                researchDomain: keccak256("domain"),
                definitionCommitment: keccak256("definition"),
                predecessorCommitment: bytes32(0),
                createdAt: 1,
                updatedAt: 1,
                revision: 1,
                acceptingNewWork: true,
                status: 1
            });
        projects.set(PROJECT_ID, 1, p, PROJECT_COMMITMENT);
    }

    function _witness()
        internal
        pure
        returns (ComputeScientificMetadataLineage420.ScientificBindingWitness memory w)
    {
        w.projectId = PROJECT_ID;
        w.projectRevision = 1;
        w.researchProjectCommitment = PROJECT_COMMITMENT;
        w.executableContainerCommitment = ENVIRONMENT;
        w.parametersCommitment = PARAMETERS;
        w.resourceClass = RESOURCE;
    }

    function _scientific(bytes32 jobId) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                lineage.SCIENTIFIC_UNIT_DOMAIN_V1(),
                uint32(1),
                block.chainid,
                jobId,
                PROJECT_COMMITMENT,
                MANIFEST,
                ENVIRONMENT,
                INPUT,
                PARAMETERS,
                RESOURCE,
                OUTPUT_SCHEMA,
                VERIFY_POLICY,
                uint64(1000),
                FUNDING
            )
        );
    }

    function _setProvenance(bytes32 provenanceId, bytes32 jobId, bytes32 result, bool canonical) internal {
        IComputeScientificCanonicalResultLineageSource420.ContextView memory c =
            IComputeScientificCanonicalResultLineageSource420.ContextView({
                unitId: jobId,
                attemptRef: keccak256(abi.encode("attempt", jobId)),
                attempt: 1,
                worker: address(0xBEEF),
                resultCommitment: result,
                executionEvidenceCommitment: EXECUTION,
                manifestHash: MANIFEST,
                inputCommitment: INPUT,
                outputSchemaCommitment: OUTPUT_SCHEMA,
                fundingRef: FUNDING,
                verificationStrategyCommitment: VERIFY_POLICY,
                deadline: 1000,
                verifier: address(0xCAFE),
                verificationRef: VERIFY_REF,
                verificationRecorded: true
            });
        source.set(jobId, c);
        IComputeScientificProvenanceLineageSource420.ProvenanceView memory p =
            IComputeScientificProvenanceLineageSource420.ProvenanceView({
                jobId: jobId,
                unitId: jobId,
                scientificWorkUnitCommitment: _scientific(jobId),
                attemptRef: c.attemptRef,
                attempt: 1,
                worker: c.worker,
                resultCommitment: result,
                executionEvidenceCommitment: EXECUTION,
                verifier: c.verifier,
                verificationRef: VERIFY_REF,
                outputSchemaCommitment: OUTPUT_SCHEMA,
                recordedAt: 2,
                exists: true
            });
        provenance.set(provenanceId, p, canonical);
    }

    function _root(bytes32 provenanceId, bytes32 metadata) internal returns (bytes32) {
        bytes32[] memory none = new bytes32[](0);
        return lineage.recordMetadataLineage(
            provenanceId, _witness(), SCHEMA, metadata, bytes32(0), none
        );
    }

    function testProjectOwnerCanRecordCanonicalRootMetadata() public {
        bytes32 prov = keccak256("root-prov");
        bytes32 id = _root(prov, keccak256("root-metadata"));
        ComputeScientificMetadataLineage420.LineageRecord memory r = lineage.record(id);
        require(r.provenanceId == prov && r.publisher == address(this), "identity");
        require(r.parentCount == 0 && r.relationCommitment == bytes32(0), "root semantics");
        require(r.metadataSchemaCommitment == SCHEMA && r.metadataCommitment != bytes32(0), "metadata");
        require(lineage.lineageForProvenance(prov) == id && lineage.isCanonical(id), "canonical");
    }

    function testDerivedLineageRequiresExistingCanonicalParentsAndBindsThem() public {
        bytes32 parent = keccak256("root-prov");
        _root(parent, keccak256("parent-metadata"));
        bytes32 child = keccak256("child-prov");
        bytes32 childJob = keccak256("child-job");
        _setProvenance(child, childJob, keccak256("child-result"), true);

        bytes32[] memory parents = new bytes32[](1);
        parents[0] = parent;
        bytes32 id = lineage.recordMetadataLineage(
            child, _witness(), SCHEMA, keccak256("child-metadata"), keccak256("derived-from"), parents
        );
        bytes32[] memory stored = lineage.parentProvenanceIds(id);
        require(stored.length == 1 && stored[0] == parent, "parent edge");
        require(lineage.isCanonical(id), "derived canonical");
    }

    function testUnauthorizedProjectPublisherFailsClosed() public {
        MetadataOutsider420 outsider = new MetadataOutsider420();
        bytes32[] memory none = new bytes32[](0);
        (bool ok,) = address(outsider).call(
            abi.encodeCall(
                outsider.record,
                (
                    lineage,
                    keccak256("root-prov"),
                    _witness(),
                    SCHEMA,
                    keccak256("metadata"),
                    bytes32(0),
                    none
                )
            )
        );
        require(!ok && lineage.lineageForProvenance(keccak256("root-prov")) == bytes32(0), "outsider");
    }

    function testScientificWitnessSubstitutionFailsClosed() public {
        bytes32[] memory none = new bytes32[](0);
        ComputeScientificMetadataLineage420.ScientificBindingWitness memory w = _witness();
        w.parametersCommitment = keccak256("wrong-parameters");
        (bool ok,) = address(lineage).call(
            abi.encodeCall(
                lineage.recordMetadataLineage,
                (
                    keccak256("root-prov"),
                    w,
                    SCHEMA,
                    keccak256("metadata"),
                    bytes32(0),
                    none
                )
            )
        );
        require(!ok, "witness substitution");
    }

    function testParentOrderingDuplicationMissingAndRelationRulesFailClosed() public {
        bytes32 root = keccak256("root-prov");
        _root(root, keccak256("root-metadata"));
        bytes32 p2 = keccak256("p2-prov");
        _setProvenance(p2, keccak256("p2-job"), keccak256("p2-result"), true);
        _root(p2, keccak256("p2-metadata"));

        bytes32 child = keccak256("child-prov");
        _setProvenance(child, keccak256("child-job"), keccak256("child-result"), true);

        bytes32[] memory parents = new bytes32[](2);
        parents[0] = root > p2 ? root : p2;
        parents[1] = root > p2 ? p2 : root;
        (bool ok,) = address(lineage).call(
            abi.encodeCall(
                lineage.recordMetadataLineage,
                (child, _witness(), SCHEMA, keccak256("m"), keccak256("rel"), parents)
            )
        );
        require(!ok, "unsorted parents");

        bytes32[] memory none = new bytes32[](0);
        (ok,) = address(lineage).call(
            abi.encodeCall(
                lineage.recordMetadataLineage,
                (child, _witness(), SCHEMA, keccak256("m"), keccak256("rel"), none)
            )
        );
        require(!ok, "root relation accepted");
    }

    function testCanonicalSourceDriftInvalidatesLineage() public {
        bytes32 prov = keccak256("root-prov");
        bytes32 id = _root(prov, keccak256("metadata"));
        IComputeScientificProvenanceLineageSource420.ProvenanceView memory p = provenance.provenance(prov);
        provenance.set(prov, p, false);
        require(!lineage.isCanonical(id), "source drift");
    }

    function testLineageIdentityIsRegistryAndPublisherBoundWithoutExtraAuthority() public {
        bytes32 prov = keccak256("root-prov");
        bytes32 first = _root(prov, keccak256("metadata"));
        bytes32 second = _root(prov, keccak256("metadata"));
        require(first == second, "idempotency");
        ComputeScientificMetadataLineage420.LineageRecord memory r = lineage.record(first);
        require(r.publisher == address(this) && r.metadataCommitment == keccak256("metadata"), "binding");
    }
}
