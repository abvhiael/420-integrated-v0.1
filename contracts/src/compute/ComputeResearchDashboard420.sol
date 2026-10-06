// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

interface IComputeResearchDashboardProject420 {
    struct Project {
        address owner;
        bytes32 researchDomain;
        bytes32 definitionCommitment;
        bytes32 predecessorCommitment;
        uint64 createdAt;
        uint64 updatedAt;
        uint64 revision;
        bool acceptingNewWork;
        uint8 status;
    }

    function systemName() external view returns (string memory);
    function protocolVersion() external view returns (uint32);
    function project(bytes32 projectId) external view returns (Project memory);
    function revision(bytes32 projectId, uint64 revision_) external view returns (Project memory);
    function commitment(bytes32 projectId, uint64 revision_) external view returns (bytes32);
    function currentCommitment(bytes32 projectId) external view returns (bytes32);
}

interface IComputeResearchDashboardProvenance420 {
    struct ProvenanceView {
        bytes32 jobId;
        bytes32 unitId;
        bytes32 scientificWorkUnitCommitment;
        bytes32 attemptRef;
        uint64 attempt;
        address worker;
        bytes32 resultCommitment;
        bytes32 executionEvidenceCommitment;
        address verifier;
        bytes32 verificationRef;
        bytes32 outputSchemaCommitment;
        uint64 recordedAt;
        bool exists;
    }

    function systemName() external view returns (string memory);
    function protocolVersion() external view returns (uint32);
    function source() external view returns (address);
    function provenance(bytes32 provenanceId) external view returns (ProvenanceView memory);
    function isCanonical(bytes32 provenanceId) external view returns (bool);
}

interface IComputeResearchDashboardResultSource420 {
    struct ContextView {
        bytes32 unitId;
        bytes32 attemptRef;
        uint64 attempt;
        address worker;
        bytes32 resultCommitment;
        bytes32 executionEvidenceCommitment;
        bytes32 manifestHash;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        bytes32 fundingRef;
        bytes32 verificationStrategyCommitment;
        uint64 deadline;
        address verifier;
        bytes32 verificationRef;
        bool verificationRecorded;
    }

    function systemName() external view returns (string memory);
    function protocolVersion() external view returns (uint32);
    function context(bytes32 jobId) external view returns (ContextView memory);
}

interface IComputeResearchDashboardLineage420 {
    struct LineageRecord {
        bytes32 provenanceId;
        bytes32 scientificWorkUnitCommitment;
        address publisher;
        bytes32 metadataSchemaCommitment;
        bytes32 metadataCommitment;
        bytes32 relationCommitment;
        bytes32 parentSetCommitment;
        uint32 parentCount;
        uint64 recordedAt;
        bool exists;
    }

    function systemName() external view returns (string memory);
    function protocolVersion() external view returns (uint32);
    function provenanceRegistry() external view returns (address);
    function resultSource() external view returns (address);
    function projectRegistry() external view returns (address);
    function record(bytes32 lineageId) external view returns (LineageRecord memory);
    function parentProvenanceIds(bytes32 lineageId) external view returns (bytes32[] memory);
    function isCanonical(bytes32 lineageId) external view returns (bool);
}

interface IComputeResearchDashboardPublication420 {
    struct Policy {
        bytes32 lineageId;
        address publisher;
        uint8 visibility;
        bytes32 accessPolicyCommitment;
        bytes32 retentionPolicyCommitment;
        bytes32 publicationManifestCommitment;
        bytes32 predecessorCommitment;
        uint64 notBefore;
        uint64 retainUntil;
        uint64 revision;
        bool active;
    }

    function systemName() external view returns (string memory);
    function protocolVersion() external view returns (uint32);
    function lineageRegistry() external view returns (address);
    function policyForLineage(bytes32 lineageId) external view returns (bytes32);
    function policy(bytes32 policyId) external view returns (Policy memory);
    function currentCommitment(bytes32 policyId) external view returns (bytes32);
    function isCurrentPolicy(bytes32 policyId, uint64 revision_, bytes32 exactCommitment)
        external view returns (bool);
    function isPublicationAuthorized(bytes32 policyId) external view returns (bool);
}

/// @notice CMP-4.9 authority-free read model for canonical scientific research dashboard consumers.
/// @dev Aggregates authoritative public reads only. It owns no research/job/result/publication state,
/// grants no authority and performs no enumeration/indexing; CMP-7/CMP-8 may consume this same graph.
contract ComputeResearchDashboard420 is I420System {
    bytes32 public constant DASHBOARD_SCHEMA_V1 =
        keccak256("420Integrated.ComputeMarket.ResearchDashboard.v1");
    bytes32 public constant SCIENTIFIC_UNIT_DOMAIN_V1 =
        keccak256("420Integrated.ComputeMarket.ScientificWorkUnit.v1");

    struct Components {
        address projects;
        address provenance;
        address resultSource;
        address lineage;
        address publication;
    }

    struct ProjectView {
        bytes32 projectId;
        address owner;
        bytes32 researchDomain;
        bytes32 definitionCommitment;
        bytes32 projectCommitment;
        uint64 revision;
        bool acceptingNewWork;
        uint8 status;
    }

    struct ResultQuery {
        bytes32 lineageId;
        bytes32 projectId;
        uint64 projectRevision;
        bytes32 researchProjectCommitment;
        bytes32 executableContainerCommitment;
        bytes32 parametersCommitment;
        bytes32 resourceClass;
    }

    struct ResultView {
        bytes32 lineageId;
        bytes32 provenanceId;
        bytes32 jobId;
        bytes32 unitId;
        bytes32 scientificWorkUnitCommitment;
        bytes32 resultCommitment;
        bytes32 executionEvidenceCommitment;
        bytes32 outputSchemaCommitment;
        address worker;
        address verifier;
        bytes32 verificationRef;
        bytes32 metadataSchemaCommitment;
        bytes32 metadataCommitment;
        bytes32 parentSetCommitment;
        uint32 parentCount;
        bytes32 policyId;
        bytes32 policyCommitment;
        uint64 policyRevision;
        uint8 visibility;
        uint64 notBefore;
        uint64 retainUntil;
        bool policyActive;
        bool provenanceCanonical;
        bool lineageCanonical;
        bool policyCurrent;
        bool publicationAuthorized;
    }

    IComputeResearchDashboardProject420 public immutable projects;
    IComputeResearchDashboardProvenance420 public immutable provenance;
    IComputeResearchDashboardResultSource420 public immutable resultSource;
    IComputeResearchDashboardLineage420 public immutable lineage;
    IComputeResearchDashboardPublication420 public immutable publication;

    error InvalidConfiguration();
    error InvalidQuery();
    error NonCanonicalResult();

    constructor(
        address projects_,
        address provenance_,
        address lineage_,
        address publication_
    ) {
        if (
            projects_.code.length == 0 || provenance_.code.length == 0
                || lineage_.code.length == 0 || publication_.code.length == 0
        ) revert InvalidConfiguration();

        IComputeResearchDashboardProject420 projectsCandidate =
            IComputeResearchDashboardProject420(projects_);
        IComputeResearchDashboardProvenance420 provenanceCandidate =
            IComputeResearchDashboardProvenance420(provenance_);
        IComputeResearchDashboardLineage420 lineageCandidate =
            IComputeResearchDashboardLineage420(lineage_);
        IComputeResearchDashboardPublication420 publicationCandidate =
            IComputeResearchDashboardPublication420(publication_);

        if (
            keccak256(bytes(projectsCandidate.systemName()))
                != keccak256(bytes("ComputeResearchProjectRegistry420"))
                || projectsCandidate.protocolVersion() != 1
                || keccak256(bytes(provenanceCandidate.systemName()))
                    != keccak256(bytes("ComputeScientificResultProvenance420"))
                || provenanceCandidate.protocolVersion() != 1
                || keccak256(bytes(lineageCandidate.systemName()))
                    != keccak256(bytes("ComputeScientificMetadataLineage420"))
                || lineageCandidate.protocolVersion() != 1
                || keccak256(bytes(publicationCandidate.systemName()))
                    != keccak256(bytes("ComputeScientificPublicationRetention420"))
                || publicationCandidate.protocolVersion() != 1
        ) revert InvalidConfiguration();

        address resultSource_ = provenanceCandidate.source();
        if (resultSource_.code.length == 0) revert InvalidConfiguration();
        IComputeResearchDashboardResultSource420 resultSourceCandidate =
            IComputeResearchDashboardResultSource420(resultSource_);
        if (
            keccak256(bytes(resultSourceCandidate.systemName()))
                != keccak256(bytes("ComputeScientificResultSource420"))
                || resultSourceCandidate.protocolVersion() != 1
                || lineageCandidate.provenanceRegistry() != provenance_
                || lineageCandidate.resultSource() != resultSource_
                || lineageCandidate.projectRegistry() != projects_
                || publicationCandidate.lineageRegistry() != lineage_
        ) revert InvalidConfiguration();

        projects = projectsCandidate;
        provenance = provenanceCandidate;
        resultSource = resultSourceCandidate;
        lineage = lineageCandidate;
        publication = publicationCandidate;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeResearchDashboard420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function schemaVersion() external pure returns (uint32) {
        return 1;
    }

    function components() external view returns (Components memory) {
        return Components({
            projects: address(projects),
            provenance: address(provenance),
            resultSource: address(resultSource),
            lineage: address(lineage),
            publication: address(publication)
        });
    }

    function currentProject(bytes32 projectId) external view returns (ProjectView memory out) {
        IComputeResearchDashboardProject420.Project memory p = projects.project(projectId);
        out = _projectView(projectId, p, projects.currentCommitment(projectId));
    }

    function projectRevision(bytes32 projectId, uint64 revision_)
        external view returns (ProjectView memory out)
    {
        IComputeResearchDashboardProject420.Project memory p =
            projects.revision(projectId, revision_);
        out = _projectView(projectId, p, projects.commitment(projectId, revision_));
    }

    function researchResult(ResultQuery calldata q) external view returns (ResultView memory out) {
        if (
            q.lineageId == bytes32(0) || q.projectId == bytes32(0) || q.projectRevision == 0
                || q.researchProjectCommitment == bytes32(0)
                || q.executableContainerCommitment == bytes32(0)
                || q.parametersCommitment == bytes32(0) || q.resourceClass == bytes32(0)
        ) revert InvalidQuery();

        IComputeResearchDashboardLineage420.LineageRecord memory l = lineage.record(q.lineageId);
        if (!l.exists) revert InvalidQuery();

        IComputeResearchDashboardProvenance420.ProvenanceView memory p =
            provenance.provenance(l.provenanceId);
        IComputeResearchDashboardResultSource420.ContextView memory c =
            resultSource.context(p.jobId);

        bytes32 projectCommitment = projects.commitment(q.projectId, q.projectRevision);
        if (projectCommitment != q.researchProjectCommitment) revert InvalidQuery();

        bytes32 scientific = keccak256(
            abi.encode(
                SCIENTIFIC_UNIT_DOMAIN_V1,
                uint32(1),
                block.chainid,
                c.unitId,
                q.researchProjectCommitment,
                c.manifestHash,
                q.executableContainerCommitment,
                c.inputCommitment,
                q.parametersCommitment,
                q.resourceClass,
                c.outputSchemaCommitment,
                c.verificationStrategyCommitment,
                c.deadline,
                c.fundingRef
            )
        );

        if (
            scientific != l.scientificWorkUnitCommitment
                || scientific != p.scientificWorkUnitCommitment
                || c.unitId != p.unitId || c.resultCommitment != p.resultCommitment
                || c.executionEvidenceCommitment != p.executionEvidenceCommitment
                || c.outputSchemaCommitment != p.outputSchemaCommitment
                || c.verifier != p.verifier || c.verificationRef != p.verificationRef
                || !c.verificationRecorded
        ) revert InvalidQuery();

        bool provenanceCanonical = provenance.isCanonical(l.provenanceId);
        bool lineageCanonical = lineage.isCanonical(q.lineageId);
        if (!provenanceCanonical || !lineageCanonical) revert NonCanonicalResult();

        out.lineageId = q.lineageId;
        out.provenanceId = l.provenanceId;
        out.jobId = p.jobId;
        out.unitId = p.unitId;
        out.scientificWorkUnitCommitment = scientific;
        out.resultCommitment = p.resultCommitment;
        out.executionEvidenceCommitment = p.executionEvidenceCommitment;
        out.outputSchemaCommitment = p.outputSchemaCommitment;
        out.worker = p.worker;
        out.verifier = p.verifier;
        out.verificationRef = p.verificationRef;
        out.metadataSchemaCommitment = l.metadataSchemaCommitment;
        out.metadataCommitment = l.metadataCommitment;
        out.parentSetCommitment = l.parentSetCommitment;
        out.parentCount = l.parentCount;
        out.provenanceCanonical = true;
        out.lineageCanonical = true;

        bytes32 policyId = publication.policyForLineage(q.lineageId);
        if (policyId != bytes32(0)) {
            IComputeResearchDashboardPublication420.Policy memory policy_ =
                publication.policy(policyId);
            bytes32 policyCommitment = publication.currentCommitment(policyId);
            out.policyId = policyId;
            out.policyCommitment = policyCommitment;
            out.policyRevision = policy_.revision;
            out.visibility = policy_.visibility;
            out.notBefore = policy_.notBefore;
            out.retainUntil = policy_.retainUntil;
            out.policyActive = policy_.active;
            out.policyCurrent = publication.isCurrentPolicy(
                policyId, policy_.revision, policyCommitment
            );
            out.publicationAuthorized = publication.isPublicationAuthorized(policyId);
        }
    }

    function parentProvenanceIds(bytes32 lineageId) external view returns (bytes32[] memory) {
        if (!lineage.isCanonical(lineageId)) revert NonCanonicalResult();
        return lineage.parentProvenanceIds(lineageId);
    }

    function _projectView(
        bytes32 projectId,
        IComputeResearchDashboardProject420.Project memory p,
        bytes32 projectCommitment
    ) private pure returns (ProjectView memory out) {
        out.projectId = projectId;
        out.owner = p.owner;
        out.researchDomain = p.researchDomain;
        out.definitionCommitment = p.definitionCommitment;
        out.projectCommitment = projectCommitment;
        out.revision = p.revision;
        out.acceptingNewWork = p.acceptingNewWork;
        out.status = p.status;
    }
}
