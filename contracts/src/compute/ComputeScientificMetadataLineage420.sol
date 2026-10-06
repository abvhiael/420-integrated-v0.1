// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

interface IComputeScientificProvenanceLineageSource420 {
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

interface IComputeScientificCanonicalResultLineageSource420 {
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

interface IComputeResearchProjectLineageSource420 {
    struct ProjectView {
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
    function revision(bytes32 projectId, uint64 revision_) external view returns (ProjectView memory);
    function commitment(bytes32 projectId, uint64 revision_) external view returns (bytes32);
}

/// @notice CMP-4.7 project-authenticated scientific metadata and result-lineage registry.
/// @dev Stores commitments and canonical provenance references only. It does not own jobs, results,
/// verification, dataset access, publication/retention, funding, settlement, rewards, slashing or governance.
contract ComputeScientificMetadataLineage420 is I420System {
    bytes32 public constant SCIENTIFIC_UNIT_DOMAIN_V1 =
        keccak256("420Integrated.ComputeMarket.ScientificWorkUnit.v1");
    bytes32 public constant PARENT_SET_DOMAIN =
        keccak256("420/COMPUTE/SCIENTIFIC_LINEAGE_PARENT_SET/V1");
    bytes32 public constant LINEAGE_DOMAIN =
        keccak256("420/COMPUTE/SCIENTIFIC_METADATA_LINEAGE/V1");
    uint32 public constant MAX_PARENTS = 32;

    struct ScientificBindingWitness {
        bytes32 projectId;
        uint64 projectRevision;
        bytes32 researchProjectCommitment;
        bytes32 executableContainerCommitment;
        bytes32 parametersCommitment;
        bytes32 resourceClass;
    }

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

    IComputeScientificProvenanceLineageSource420 public immutable provenanceRegistry;
    IComputeScientificCanonicalResultLineageSource420 public immutable resultSource;
    IComputeResearchProjectLineageSource420 public immutable projectRegistry;

    mapping(bytes32 => LineageRecord) private _records;
    mapping(bytes32 => bytes32[]) private _parents;
    mapping(bytes32 => bytes32) public lineageForProvenance;

    error InvalidSource();
    error InvalidMetadata();
    error Unauthorized();
    error InvalidLineage();
    error ConflictingLineage();

    event ScientificMetadataLineageRecorded(
        bytes32 indexed lineageId,
        bytes32 indexed provenanceId,
        address indexed publisher,
        bytes32 metadataCommitment,
        bytes32 parentSetCommitment,
        uint32 parentCount
    );

    constructor(
        IComputeScientificProvenanceLineageSource420 provenanceRegistry_,
        IComputeResearchProjectLineageSource420 projectRegistry_
    ) {
        if (
            address(provenanceRegistry_) == address(0)
                || address(provenanceRegistry_).code.length == 0
                || address(projectRegistry_) == address(0)
                || address(projectRegistry_).code.length == 0
        ) revert InvalidSource();
        if (
            keccak256(bytes(provenanceRegistry_.systemName()))
                != keccak256(bytes("ComputeScientificResultProvenance420"))
                || provenanceRegistry_.protocolVersion() != 1
                || keccak256(bytes(projectRegistry_.systemName()))
                    != keccak256(bytes("ComputeResearchProjectRegistry420"))
                || projectRegistry_.protocolVersion() != 1
        ) revert InvalidSource();

        address resultSource_ = provenanceRegistry_.source();
        if (resultSource_ == address(0) || resultSource_.code.length == 0) revert InvalidSource();
        IComputeScientificCanonicalResultLineageSource420 candidate =
            IComputeScientificCanonicalResultLineageSource420(resultSource_);
        if (
            keccak256(bytes(candidate.systemName()))
                != keccak256(bytes("ComputeScientificResultSource420"))
                || candidate.protocolVersion() != 1
        ) revert InvalidSource();

        provenanceRegistry = provenanceRegistry_;
        resultSource = candidate;
        projectRegistry = projectRegistry_;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeScientificMetadataLineage420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function recordMetadataLineage(
        bytes32 provenanceId,
        ScientificBindingWitness calldata witness,
        bytes32 metadataSchemaCommitment,
        bytes32 metadataCommitment,
        bytes32 relationCommitment,
        bytes32[] calldata parentProvenanceIds
    ) external returns (bytes32 lineageId) {
        if (
            provenanceId == bytes32(0) || witness.projectId == bytes32(0)
                || witness.projectRevision == 0 || witness.researchProjectCommitment == bytes32(0)
                || witness.executableContainerCommitment == bytes32(0)
                || witness.parametersCommitment == bytes32(0)
                || witness.resourceClass == bytes32(0)
                || metadataSchemaCommitment == bytes32(0)
                || metadataCommitment == bytes32(0)
                || parentProvenanceIds.length > MAX_PARENTS
        ) revert InvalidMetadata();

        if (
            (parentProvenanceIds.length == 0 && relationCommitment != bytes32(0))
                || (parentProvenanceIds.length != 0 && relationCommitment == bytes32(0))
        ) revert InvalidLineage();

        IComputeScientificProvenanceLineageSource420.ProvenanceView memory p =
            provenanceRegistry.provenance(provenanceId);
        if (!p.exists || !provenanceRegistry.isCanonical(provenanceId)) revert InvalidLineage();

        IComputeScientificCanonicalResultLineageSource420.ContextView memory c =
            resultSource.context(p.jobId);
        if (
            !c.verificationRecorded || c.unitId != p.unitId || c.resultCommitment != p.resultCommitment
                || c.outputSchemaCommitment != p.outputSchemaCommitment
                || c.executionEvidenceCommitment != p.executionEvidenceCommitment
                || c.verifier != p.verifier || c.verificationRef != p.verificationRef
        ) revert InvalidLineage();

        bytes32 projectCommitment =
            projectRegistry.commitment(witness.projectId, witness.projectRevision);
        if (projectCommitment != witness.researchProjectCommitment) revert InvalidMetadata();
        IComputeResearchProjectLineageSource420.ProjectView memory project =
            projectRegistry.revision(witness.projectId, witness.projectRevision);
        if (project.owner == address(0) || project.owner != msg.sender) revert Unauthorized();

        bytes32 scientific = keccak256(
            abi.encode(
                SCIENTIFIC_UNIT_DOMAIN_V1,
                uint32(1),
                block.chainid,
                c.unitId,
                witness.researchProjectCommitment,
                c.manifestHash,
                witness.executableContainerCommitment,
                c.inputCommitment,
                witness.parametersCommitment,
                witness.resourceClass,
                c.outputSchemaCommitment,
                c.verificationStrategyCommitment,
                c.deadline,
                c.fundingRef
            )
        );
        if (scientific != p.scientificWorkUnitCommitment) revert InvalidMetadata();

        bytes32 parentSetCommitment = _validateParents(provenanceId, parentProvenanceIds);
        lineageId = keccak256(
            abi.encode(
                LINEAGE_DOMAIN,
                block.chainid,
                address(this),
                address(provenanceRegistry),
                address(projectRegistry),
                provenanceId,
                p.scientificWorkUnitCommitment,
                p.resultCommitment,
                msg.sender,
                metadataSchemaCommitment,
                metadataCommitment,
                relationCommitment,
                parentSetCommitment
            )
        );

        bytes32 existing = lineageForProvenance[provenanceId];
        if (existing != bytes32(0)) {
            if (existing != lineageId) revert ConflictingLineage();
            return existing;
        }

        _records[lineageId] = LineageRecord({
            provenanceId: provenanceId,
            scientificWorkUnitCommitment: p.scientificWorkUnitCommitment,
            publisher: msg.sender,
            metadataSchemaCommitment: metadataSchemaCommitment,
            metadataCommitment: metadataCommitment,
            relationCommitment: relationCommitment,
            parentSetCommitment: parentSetCommitment,
            parentCount: uint32(parentProvenanceIds.length),
            recordedAt: uint64(block.timestamp),
            exists: true
        });
        lineageForProvenance[provenanceId] = lineageId;
        for (uint256 i = 0; i < parentProvenanceIds.length; ++i) {
            _parents[lineageId].push(parentProvenanceIds[i]);
        }

        emit ScientificMetadataLineageRecorded(
            lineageId,
            provenanceId,
            msg.sender,
            metadataCommitment,
            parentSetCommitment,
            uint32(parentProvenanceIds.length)
        );
    }

    function record(bytes32 lineageId) external view returns (LineageRecord memory r) {
        r = _records[lineageId];
        if (!r.exists) revert InvalidLineage();
    }

    function parentProvenanceIds(bytes32 lineageId) external view returns (bytes32[] memory) {
        if (!_records[lineageId].exists) revert InvalidLineage();
        return _parents[lineageId];
    }

    function isCanonical(bytes32 lineageId) external view returns (bool) {
        LineageRecord memory r = _records[lineageId];
        if (!r.exists || lineageForProvenance[r.provenanceId] != lineageId) return false;
        if (!provenanceRegistry.isCanonical(r.provenanceId)) return false;
        bytes32[] storage parents_ = _parents[lineageId];
        if (parents_.length != r.parentCount) return false;
        for (uint256 i = 0; i < parents_.length; ++i) {
            bytes32 parentProvenanceId = parents_[i];
            if (!provenanceRegistry.isCanonical(parentProvenanceId)) return false;
            bytes32 parentLineageId = lineageForProvenance[parentProvenanceId];
            if (parentLineageId == bytes32(0) || !_records[parentLineageId].exists) return false;
        }
        return true;
    }

    function _validateParents(bytes32 provenanceId, bytes32[] calldata parents_)
        private view returns (bytes32 parentSetCommitment)
    {
        bytes32 previous;
        for (uint256 i = 0; i < parents_.length; ++i) {
            bytes32 parent = parents_[i];
            if (
                parent == bytes32(0) || parent == provenanceId || (i != 0 && parent <= previous)
                    || !provenanceRegistry.isCanonical(parent)
                    || lineageForProvenance[parent] == bytes32(0)
            ) revert InvalidLineage();
            previous = parent;
        }
        parentSetCommitment =
            keccak256(abi.encode(PARENT_SET_DOMAIN, block.chainid, address(this), parents_));
    }
}
