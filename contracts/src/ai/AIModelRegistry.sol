// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract AIModelRegistry is SystemAccess, I420System {
    enum ModelState { NONE, ACTIVE, SUSPENDED, RETIRED }
    enum VersionState { NONE, ACTIVE, DEPRECATED }

    struct Model {
        address creator;
        bytes32 metadataHash;
        bytes32 licensePolicyId;
        uint64 createdAt;
        uint32 revision;
        ModelState state;
        bool exists;
    }

    struct ModelVersion {
        bytes32 modelId;
        uint32 version;
        bytes32 artifactManifestHash;
        bytes32 artifactHash;
        bytes32 runtimeProfileId;
        bytes32 computeRequirementId;
        bytes32 schemaHash;
        bytes32 verificationProfileId;
        bytes32 licensePolicyId;
        uint64 createdAt;
        VersionState state;
        bool exists;
    }

    mapping(bytes32 => Model) public models;
    mapping(bytes32 => ModelVersion) public modelVersions;
    mapping(bytes32 => mapping(uint32 => bytes32)) public versionIdByNumber;

    error InvalidId();
    error AlreadyExists();
    error NotFound();
    error NotCreator();
    error InvalidStateTransition();
    error InvalidVersion();

    event ModelRegistered(bytes32 indexed modelId, address indexed creator, bytes32 metadataHash, bytes32 licensePolicyId);
    event ModelUpdated(bytes32 indexed modelId, bytes32 metadataHash, bytes32 licensePolicyId, uint32 revision);
    event ModelStateChanged(bytes32 indexed modelId, ModelState previousState, ModelState newState, uint32 revision);
    event ModelVersionRegistered(bytes32 indexed modelVersionId, bytes32 indexed modelId, uint32 version, bytes32 artifactHash, bytes32 artifactManifestHash);
    event ModelVersionDeprecated(bytes32 indexed modelVersionId);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "AIModelRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function registerModel(bytes32 modelId, bytes32 metadataHash, bytes32 licensePolicyId) external {
        if (modelId == bytes32(0)) revert InvalidId();
        if (models[modelId].exists) revert AlreadyExists();
        models[modelId] = Model({
            creator: msg.sender,
            metadataHash: metadataHash,
            licensePolicyId: licensePolicyId,
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: ModelState.ACTIVE,
            exists: true
        });
        emit ModelRegistered(modelId, msg.sender, metadataHash, licensePolicyId);
    }

    /// @notice Legacy registration shape retained for compatibility. The caller becomes creator.
    function register(bytes32 modelId, bytes32, bytes32 artifactHash, bytes32 metadataHash, uint32 version) external {
        if (version == 0) revert InvalidVersion();
        if (!models[modelId].exists) {
            if (modelId == bytes32(0)) revert InvalidId();
            models[modelId] = Model(msg.sender, metadataHash, bytes32(0), uint64(block.timestamp), 1, ModelState.ACTIVE, true);
            emit ModelRegistered(modelId, msg.sender, metadataHash, bytes32(0));
        } else if (models[modelId].creator != msg.sender) {
            revert NotCreator();
        }
        bytes32 modelVersionId = keccak256(abi.encode(modelId, version));
        _registerVersion(modelVersionId, modelId, version, artifactHash, artifactHash, bytes32(0), bytes32(0), bytes32(0), bytes32(0), models[modelId].licensePolicyId);
    }

    function updateModel(bytes32 modelId, bytes32 metadataHash, bytes32 licensePolicyId) external {
        Model storage m = _creator(modelId);
        if (m.state == ModelState.RETIRED) revert InvalidStateTransition();
        m.metadataHash = metadataHash;
        m.licensePolicyId = licensePolicyId;
        m.revision += 1;
        emit ModelUpdated(modelId, metadataHash, licensePolicyId, m.revision);
    }

    function registerVersion(
        bytes32 modelVersionId,
        bytes32 modelId,
        uint32 version,
        bytes32 artifactManifestHash,
        bytes32 artifactHash,
        bytes32 runtimeProfileId,
        bytes32 computeRequirementId,
        bytes32 schemaHash,
        bytes32 verificationProfileId,
        bytes32 licensePolicyId
    ) external {
        _creator(modelId);
        _registerVersion(modelVersionId, modelId, version, artifactManifestHash, artifactHash, runtimeProfileId, computeRequirementId, schemaHash, verificationProfileId, licensePolicyId);
    }

    function deprecateVersion(bytes32 modelVersionId) external {
        ModelVersion storage v = modelVersions[modelVersionId];
        if (!v.exists) revert NotFound();
        Model storage m = _creator(v.modelId);
        if (m.state == ModelState.RETIRED || v.state != VersionState.ACTIVE) revert InvalidStateTransition();
        v.state = VersionState.DEPRECATED;
        emit ModelVersionDeprecated(modelVersionId);
    }

    function suspendModel(bytes32 modelId) external onlyGovernance {
        Model storage m = _getModel(modelId);
        if (m.state != ModelState.ACTIVE) revert InvalidStateTransition();
        _setModelState(modelId, m, ModelState.SUSPENDED);
    }

    function reactivateModel(bytes32 modelId) external onlyGovernance {
        Model storage m = _getModel(modelId);
        if (m.state != ModelState.SUSPENDED) revert InvalidStateTransition();
        _setModelState(modelId, m, ModelState.ACTIVE);
    }

    function retireModel(bytes32 modelId) external {
        Model storage m = _creator(modelId);
        if (m.state == ModelState.RETIRED) revert InvalidStateTransition();
        _setModelState(modelId, m, ModelState.RETIRED);
    }

    function isVersionOperational(bytes32 modelVersionId) external view returns (bool) {
        ModelVersion storage v = modelVersions[modelVersionId];
        if (!v.exists || v.state != VersionState.ACTIVE) return false;
        Model storage m = models[v.modelId];
        return m.exists && m.state == ModelState.ACTIVE;
    }

    function _registerVersion(
        bytes32 modelVersionId,
        bytes32 modelId,
        uint32 version,
        bytes32 artifactManifestHash,
        bytes32 artifactHash,
        bytes32 runtimeProfileId,
        bytes32 computeRequirementId,
        bytes32 schemaHash,
        bytes32 verificationProfileId,
        bytes32 licensePolicyId
    ) private {
        if (modelVersionId == bytes32(0) || artifactHash == bytes32(0) || artifactManifestHash == bytes32(0)) revert InvalidId();
        if (version == 0) revert InvalidVersion();
        Model storage m = _getModel(modelId);
        if (m.creator != msg.sender) revert NotCreator();
        if (m.state != ModelState.ACTIVE) revert InvalidStateTransition();
        if (modelVersions[modelVersionId].exists || versionIdByNumber[modelId][version] != bytes32(0)) revert AlreadyExists();
        modelVersions[modelVersionId] = ModelVersion({
            modelId: modelId,
            version: version,
            artifactManifestHash: artifactManifestHash,
            artifactHash: artifactHash,
            runtimeProfileId: runtimeProfileId,
            computeRequirementId: computeRequirementId,
            schemaHash: schemaHash,
            verificationProfileId: verificationProfileId,
            licensePolicyId: licensePolicyId,
            createdAt: uint64(block.timestamp),
            state: VersionState.ACTIVE,
            exists: true
        });
        versionIdByNumber[modelId][version] = modelVersionId;
        emit ModelVersionRegistered(modelVersionId, modelId, version, artifactHash, artifactManifestHash);
    }

    function _creator(bytes32 modelId) private view returns (Model storage m) {
        m = _getModel(modelId);
        if (msg.sender != m.creator) revert NotCreator();
    }

    function _getModel(bytes32 modelId) private view returns (Model storage m) {
        m = models[modelId];
        if (!m.exists) revert NotFound();
    }

    function _setModelState(bytes32 modelId, Model storage m, ModelState next) private {
        ModelState previous = m.state;
        m.state = next;
        m.revision += 1;
        emit ModelStateChanged(modelId, previous, next, m.revision);
    }
}
