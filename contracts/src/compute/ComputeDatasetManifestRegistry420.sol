// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

interface IComputeResearchProjectDatasetSource420 {
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
    function project(bytes32 projectId) external view returns (ProjectView memory);
    function isCurrentAcceptable(bytes32 projectId, uint64 revision, bytes32 exactCommitment)
        external view returns (bool);
}

/// @notice CMP-4.4 revisioned scientific dataset manifests.
/// @dev Stores only bounded commitments/metadata. Raw dataset bytes, retrieval locators, credentials,
///      access grants and secrets remain off-chain and independently authorized.
contract ComputeDatasetManifestRegistry420 is I420System {
    bytes32 public constant DATASET_DOMAIN =
        keccak256("420/COMPUTE/DATASET_MANIFEST/V1");
    bytes32 public constant COMMITMENT_DOMAIN =
        keccak256("420/COMPUTE/DATASET_MANIFEST_COMMITMENT/V1");

    struct DatasetManifest {
        address controller;
        bytes32 projectId;
        uint64 projectRevision;
        bytes32 projectCommitment;
        bytes32 contentCommitment;
        bytes32 schemaCommitment;
        bytes32 accessPolicyCommitment;
        bytes32 provenanceCommitment;
        bytes32 partitionCommitment;
        uint64 byteLength;
        bytes32 predecessorCommitment;
        uint64 revision;
        bool active;
    }

    IComputeResearchProjectDatasetSource420 public immutable projectRegistry;
    uint64 public nextDatasetNonce;

    mapping(bytes32 => DatasetManifest) private _datasets;
    mapping(bytes32 => mapping(uint64 => DatasetManifest)) private _history;

    error InvalidProjectSource();
    error InvalidManifest();
    error UnknownDataset();
    error Unauthorized();
    error StaleRevision();
    error SerialExhausted();
    error NoChange();

    event DatasetManifestRegistered(
        bytes32 indexed datasetId,
        bytes32 indexed projectId,
        address indexed controller,
        uint64 revision,
        bytes32 manifestCommitment
    );
    event DatasetManifestRevised(
        bytes32 indexed datasetId,
        uint64 indexed previousRevision,
        uint64 indexed currentRevision,
        bytes32 manifestCommitment
    );
    event DatasetManifestActivationSet(
        bytes32 indexed datasetId,
        bool active,
        uint64 revision,
        bytes32 manifestCommitment
    );

    constructor(IComputeResearchProjectDatasetSource420 projectRegistry_) {
        address source = address(projectRegistry_);
        if (source == address(0) || source.code.length == 0) revert InvalidProjectSource();
        if (
            keccak256(bytes(projectRegistry_.systemName()))
                != keccak256(bytes("ComputeResearchProjectRegistry420"))
                || projectRegistry_.protocolVersion() != 1
        ) revert InvalidProjectSource();
        projectRegistry = projectRegistry_;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeDatasetManifestRegistry420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function registerDataset(
        bytes32 projectId,
        uint64 projectRevision,
        bytes32 projectCommitment,
        bytes32 contentCommitment,
        bytes32 schemaCommitment,
        bytes32 accessPolicyCommitment,
        bytes32 provenanceCommitment,
        bytes32 partitionCommitment,
        uint64 byteLength
    ) external returns (bytes32 datasetId) {
        _validateFields(
            contentCommitment,
            schemaCommitment,
            accessPolicyCommitment,
            provenanceCommitment,
            partitionCommitment,
            byteLength
        );
        _requireProjectController(projectId, msg.sender);
        if (!projectRegistry.isCurrentAcceptable(projectId, projectRevision, projectCommitment)) {
            revert InvalidManifest();
        }
        if (nextDatasetNonce == type(uint64).max) revert SerialExhausted();

        uint64 nonce = ++nextDatasetNonce;
        datasetId = keccak256(abi.encode(
            DATASET_DOMAIN, block.chainid, address(this), projectId, msg.sender, nonce
        ));
        if (_datasets[datasetId].revision != 0) revert InvalidManifest();

        DatasetManifest memory d = DatasetManifest({
            controller: msg.sender,
            projectId: projectId,
            projectRevision: projectRevision,
            projectCommitment: projectCommitment,
            contentCommitment: contentCommitment,
            schemaCommitment: schemaCommitment,
            accessPolicyCommitment: accessPolicyCommitment,
            provenanceCommitment: provenanceCommitment,
            partitionCommitment: partitionCommitment,
            byteLength: byteLength,
            predecessorCommitment: bytes32(0),
            revision: 1,
            active: true
        });
        _datasets[datasetId] = d;
        _history[datasetId][1] = d;
        emit DatasetManifestRegistered(
            datasetId, projectId, msg.sender, 1, _commitment(datasetId, d)
        );
    }

    function reviseDataset(
        bytes32 datasetId,
        uint64 expectedRevision,
        uint64 projectRevision,
        bytes32 projectCommitment,
        bytes32 contentCommitment,
        bytes32 schemaCommitment,
        bytes32 accessPolicyCommitment,
        bytes32 provenanceCommitment,
        bytes32 partitionCommitment,
        uint64 byteLength
    ) external {
        DatasetManifest storage d = _guardController(datasetId, expectedRevision);
        _validateFields(
            contentCommitment,
            schemaCommitment,
            accessPolicyCommitment,
            provenanceCommitment,
            partitionCommitment,
            byteLength
        );
        if (!projectRegistry.isCurrentAcceptable(d.projectId, projectRevision, projectCommitment)) {
            revert InvalidManifest();
        }
        if (
            d.projectRevision == projectRevision
                && d.projectCommitment == projectCommitment
                && d.contentCommitment == contentCommitment
                && d.schemaCommitment == schemaCommitment
                && d.accessPolicyCommitment == accessPolicyCommitment
                && d.provenanceCommitment == provenanceCommitment
                && d.partitionCommitment == partitionCommitment
                && d.byteLength == byteLength
        ) revert NoChange();

        uint64 previousRevision = d.revision;
        bytes32 predecessor = _commitment(datasetId, d);
        d.projectRevision = projectRevision;
        d.projectCommitment = projectCommitment;
        d.contentCommitment = contentCommitment;
        d.schemaCommitment = schemaCommitment;
        d.accessPolicyCommitment = accessPolicyCommitment;
        d.provenanceCommitment = provenanceCommitment;
        d.partitionCommitment = partitionCommitment;
        d.byteLength = byteLength;
        d.predecessorCommitment = predecessor;
        d.revision = previousRevision + 1;
        _history[datasetId][d.revision] = d;

        emit DatasetManifestRevised(
            datasetId, previousRevision, d.revision, _commitment(datasetId, d)
        );
    }

    function setActive(bytes32 datasetId, uint64 expectedRevision, bool active) external {
        DatasetManifest storage d = _guardController(datasetId, expectedRevision);
        if (d.active == active) revert NoChange();
        if (
            active
                && !projectRegistry.isCurrentAcceptable(
                    d.projectId, d.projectRevision, d.projectCommitment
                )
        ) revert InvalidManifest();

        bytes32 predecessor = _commitment(datasetId, d);
        d.active = active;
        d.predecessorCommitment = predecessor;
        d.revision += 1;
        _history[datasetId][d.revision] = d;
        emit DatasetManifestActivationSet(
            datasetId, active, d.revision, _commitment(datasetId, d)
        );
    }

    function dataset(bytes32 datasetId) external view returns (DatasetManifest memory) {
        DatasetManifest memory d = _datasets[datasetId];
        if (d.revision == 0) revert UnknownDataset();
        return d;
    }

    function revision(bytes32 datasetId, uint64 revision_)
        external view returns (DatasetManifest memory)
    {
        DatasetManifest memory d = _history[datasetId][revision_];
        if (d.revision == 0) revert UnknownDataset();
        return d;
    }

    function commitment(bytes32 datasetId, uint64 revision_) public view returns (bytes32) {
        DatasetManifest memory d = _history[datasetId][revision_];
        if (d.revision == 0) revert UnknownDataset();
        return _commitment(datasetId, d);
    }

    function currentCommitment(bytes32 datasetId) external view returns (bytes32) {
        DatasetManifest memory d = _datasets[datasetId];
        if (d.revision == 0) revert UnknownDataset();
        return _commitment(datasetId, d);
    }

    /// @notice Admission check for new scientific work.
    /// @dev This is manifest/content eligibility only. It is not a dataset access grant.
    function isCurrentUsable(
        bytes32 datasetId,
        uint64 revision_,
        bytes32 exactManifestCommitment,
        bytes32 expectedInputCommitment
    ) external view returns (bool) {
        DatasetManifest memory d = _datasets[datasetId];
        if (
            d.revision == 0 || !d.active || d.revision != revision_
                || exactManifestCommitment == bytes32(0)
                || exactManifestCommitment != _commitment(datasetId, d)
                || expectedInputCommitment == bytes32(0)
                || expectedInputCommitment != d.contentCommitment
        ) return false;

        return projectRegistry.isCurrentAcceptable(
            d.projectId, d.projectRevision, d.projectCommitment
        );
    }

    function _guardController(bytes32 datasetId, uint64 expectedRevision)
        private view returns (DatasetManifest storage d)
    {
        d = _datasets[datasetId];
        if (d.revision == 0) revert UnknownDataset();
        if (d.revision != expectedRevision) revert StaleRevision();
        _requireProjectController(d.projectId, msg.sender);
        if (msg.sender != d.controller) revert Unauthorized();
    }

    function _requireProjectController(bytes32 projectId, address actor) private view {
        IComputeResearchProjectDatasetSource420.ProjectView memory p =
            projectRegistry.project(projectId);
        if (p.owner == address(0) || p.owner != actor) revert Unauthorized();
    }

    function _validateFields(
        bytes32 contentCommitment,
        bytes32 schemaCommitment,
        bytes32 accessPolicyCommitment,
        bytes32 provenanceCommitment,
        bytes32 partitionCommitment,
        uint64 byteLength
    ) private pure {
        if (
            contentCommitment == bytes32(0)
                || schemaCommitment == bytes32(0)
                || accessPolicyCommitment == bytes32(0)
                || provenanceCommitment == bytes32(0)
                || partitionCommitment == bytes32(0)
                || byteLength == 0
        ) revert InvalidManifest();
    }

    function _commitment(bytes32 datasetId, DatasetManifest memory d)
        private view returns (bytes32)
    {
        return keccak256(abi.encode(
            COMMITMENT_DOMAIN,
            block.chainid,
            address(this),
            address(projectRegistry),
            datasetId,
            d.controller,
            d.projectId,
            d.projectRevision,
            d.projectCommitment,
            d.contentCommitment,
            d.schemaCommitment,
            d.accessPolicyCommitment,
            d.provenanceCommitment,
            d.partitionCommitment,
            d.byteLength,
            d.predecessorCommitment,
            d.revision,
            d.active
        ));
    }
}
