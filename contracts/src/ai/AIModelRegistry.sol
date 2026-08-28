// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract AIModelRegistry is SystemAccess, I420System {
    enum ModelState {
        NONE,
        ACTIVE,
        SUSPENDED,
        RETIRED
    }

    enum VersionState {
        NONE,
        ACTIVE,
        DEPRECATED
    }

    /// @notice Training permission is independent from ownership and ordinary licensing.
    /// @dev The zero value is intentionally DENIED so every legacy and uninitialized version fails closed.
    enum TrainingRightsMode {
        DENIED,
        GRANT_ONLY
    }

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

    /// @notice Immutable disclosure and training-rights declaration attached to one permanent weights identity.
    /// @dev Kept outside ModelVersion to preserve the frozen V2 getter/storage shape.
    struct Model420Metadata {
        bytes32 architectureHash;
        bytes32 capabilitiesHash;
        bytes32 aiDisclosureHash;
        bytes32 trainingRightsDeclarationHash;
        address trainingRightsController;
        TrainingRightsMode trainingRightsMode;
        bool exists;
    }

    struct Model420Registration {
        bytes32 modelVersionId;
        bytes32 modelId;
        uint32 version;
        bytes32 storageManifestHash;
        bytes32 weightsHash;
        bytes32 runtimeProfileId;
        bytes32 computeRequirementId;
        bytes32 schemaHash;
        bytes32 verificationProfileId;
        bytes32 licensePolicyId;
        bytes32 architectureHash;
        bytes32 capabilitiesHash;
        bytes32 aiDisclosureHash;
        bytes32 trainingRightsDeclarationHash;
        address trainingRightsController;
        TrainingRightsMode trainingRightsMode;
    }

    struct TrainingGrant {
        bytes32 modelVersionId;
        address grantee;
        bytes32 scopeHash;
        uint64 grantedAt;
        uint64 expiresAt;
        bool revoked;
        bool exists;
    }

    mapping(bytes32 => Model) public models;
    mapping(bytes32 => ModelVersion) private _modelVersions;
    mapping(bytes32 => mapping(uint32 => bytes32)) public versionIdByNumber;
    mapping(bytes32 => Model420Metadata) public model420Metadata;
    mapping(bytes32 => TrainingGrant) public trainingGrants;

    error InvalidId();
    error AlreadyExists();
    error NotFound();
    error NotCreator();
    error NotTrainingRightsController();
    error TrainingRightsDenied();
    error InvalidStateTransition();
    error InvalidVersion();
    error InvalidGrant();

    event ModelRegistered(bytes32 indexed modelId, address indexed creator, bytes32 metadataHash, bytes32 licensePolicyId);
    event ModelUpdated(bytes32 indexed modelId, bytes32 metadataHash, bytes32 licensePolicyId, uint32 revision);
    event ModelStateChanged(bytes32 indexed modelId, ModelState previousState, ModelState newState, uint32 revision);
    event ModelVersionRegistered(
        bytes32 indexed modelVersionId,
        bytes32 indexed modelId,
        uint32 version,
        bytes32 artifactHash,
        bytes32 artifactManifestHash
    );
    event Model420Declared(
        bytes32 indexed modelVersionId,
        bytes32 architectureHash,
        bytes32 capabilitiesHash,
        bytes32 aiDisclosureHash,
        bytes32 trainingRightsDeclarationHash,
        address indexed trainingRightsController,
        TrainingRightsMode trainingRightsMode
    );
    event TrainingRightsControllerTransferred(
        bytes32 indexed modelVersionId, address indexed previousController, address indexed newController
    );
    event TrainingGrantCreated(
        bytes32 indexed grantId,
        bytes32 indexed modelVersionId,
        address indexed grantee,
        bytes32 scopeHash,
        uint64 expiresAt
    );
    event TrainingGrantRevoked(bytes32 indexed grantId, bytes32 indexed modelVersionId, address indexed grantee);
    event ModelVersionDeprecated(bytes32 indexed modelVersionId);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "AIModelRegistry";
    }

    function protocolVersion() external pure returns (uint32) {
        return 3;
    }

    /// @notice ABI-compatible replacement for the compiler-generated public mapping getter.
    /// @dev The final three fields share one storage slot and are decoded explicitly.
    function modelVersions(bytes32 modelVersionId)
        external
        view
        returns (
            bytes32,
            uint32,
            bytes32,
            bytes32,
            bytes32,
            bytes32,
            bytes32,
            bytes32,
            bytes32,
            uint64,
            VersionState,
            bool
        )
    {
        assembly ("memory-safe") {
            mstore(0x00, modelVersionId)
            mstore(0x20, _modelVersions.slot)
            let slot := keccak256(0x00, 0x40)
            let ptr := mload(0x40)

            mstore(ptr, sload(slot))
            mstore(add(ptr, 0x20), and(sload(add(slot, 1)), 0xffffffff))
            mstore(add(ptr, 0x40), sload(add(slot, 2)))
            mstore(add(ptr, 0x60), sload(add(slot, 3)))
            mstore(add(ptr, 0x80), sload(add(slot, 4)))
            mstore(add(ptr, 0xa0), sload(add(slot, 5)))
            mstore(add(ptr, 0xc0), sload(add(slot, 6)))
            mstore(add(ptr, 0xe0), sload(add(slot, 7)))
            mstore(add(ptr, 0x100), sload(add(slot, 8)))

            let packed := sload(add(slot, 9))
            mstore(add(ptr, 0x120), and(packed, 0xffffffffffffffff))
            mstore(add(ptr, 0x140), and(shr(64, packed), 0xff))
            mstore(add(ptr, 0x160), and(shr(72, packed), 0xff))
            return(ptr, 0x180)
        }
    }

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
    /// @dev Legacy versions are permanently training-DENIED unless a new version is explicitly registered with grantable rights.
    function register(bytes32 modelId, bytes32, bytes32 artifactHash, bytes32 metadataHash, uint32 version) external {
        if (version == 0) revert InvalidVersion();
        if (!models[modelId].exists) {
            if (modelId == bytes32(0)) revert InvalidId();
            models[modelId] = Model(
                msg.sender, metadataHash, bytes32(0), uint64(block.timestamp), 1, ModelState.ACTIVE, true
            );
            emit ModelRegistered(modelId, msg.sender, metadataHash, bytes32(0));
        } else if (models[modelId].creator != msg.sender) {
            revert NotCreator();
        }

        bytes32 modelVersionId = keccak256(abi.encode(modelId, version));
        _validateNewVersion(modelVersionId, modelId, version, artifactHash, artifactHash);
        _storeVersion(
            modelVersionId,
            modelId,
            version,
            artifactHash,
            artifactHash,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            models[modelId].licensePolicyId
        );
        _declareModel420(
            modelVersionId,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            msg.sender,
            TrainingRightsMode.DENIED
        );
    }

    function updateModel(bytes32 modelId, bytes32 metadataHash, bytes32 licensePolicyId) external {
        Model storage m = _creator(modelId);
        if (m.state == ModelState.RETIRED) revert InvalidStateTransition();
        m.metadataHash = metadataHash;
        m.licensePolicyId = licensePolicyId;
        m.revision += 1;
        emit ModelUpdated(modelId, metadataHash, licensePolicyId, m.revision);
    }

    /// @notice V2-compatible version registration. Training rights fail closed by construction.
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
        _validateNewVersion(modelVersionId, modelId, version, artifactManifestHash, artifactHash);
        _storeVersion(
            modelVersionId,
            modelId,
            version,
            artifactManifestHash,
            artifactHash,
            runtimeProfileId,
            computeRequirementId,
            schemaHash,
            verificationProfileId,
            licensePolicyId
        );
        _declareModel420(
            modelVersionId,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            msg.sender,
            TrainingRightsMode.DENIED
        );
    }

    /// @notice Register a permanent Model420 identity with explicit disclosure and training-rights declaration.
    /// @dev Ordinary licensePolicyId never grants AI training rights. GRANT_ONLY still authorizes nobody until a grant exists.
    function registerModel420Version(Model420Registration calldata r) external {
        _validateNewVersion(r.modelVersionId, r.modelId, r.version, r.storageManifestHash, r.weightsHash);
        if (r.trainingRightsController == address(0)) revert InvalidGrant();
        if (
            r.architectureHash == bytes32(0) || r.capabilitiesHash == bytes32(0) || r.aiDisclosureHash == bytes32(0)
                || r.trainingRightsDeclarationHash == bytes32(0)
        ) revert InvalidId();

        _storeVersion(
            r.modelVersionId,
            r.modelId,
            r.version,
            r.storageManifestHash,
            r.weightsHash,
            r.runtimeProfileId,
            r.computeRequirementId,
            r.schemaHash,
            r.verificationProfileId,
            r.licensePolicyId
        );
        _declareModel420(
            r.modelVersionId,
            r.architectureHash,
            r.capabilitiesHash,
            r.aiDisclosureHash,
            r.trainingRightsDeclarationHash,
            r.trainingRightsController,
            r.trainingRightsMode
        );
    }

    /// @notice Return the permanent Model420 identity fields requested by ecosystem clients.
    function model420(bytes32 modelVersionId)
        external
        view
        returns (
            bytes32 modelId,
            address creator,
            bytes32 architectureHash,
            uint32 version,
            bytes32 weightsHash,
            bytes32 licensePolicyId,
            bytes32 storageManifestHash,
            bytes32 capabilitiesHash,
            bytes32 aiDisclosureHash,
            bytes32 trainingRightsDeclarationHash,
            TrainingRightsMode trainingRightsMode,
            address trainingRightsController,
            VersionState versionState,
            bool exists
        )
    {
        ModelVersion storage v = _modelVersions[modelVersionId];
        Model420Metadata storage d = model420Metadata[modelVersionId];
        if (!v.exists) return (bytes32(0), address(0), bytes32(0), 0, bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0), TrainingRightsMode.DENIED, address(0), VersionState.NONE, false);
        Model storage m = models[v.modelId];
        return (
            v.modelId,
            m.creator,
            d.architectureHash,
            v.version,
            v.artifactHash,
            v.licensePolicyId,
            v.artifactManifestHash,
            d.capabilitiesHash,
            d.aiDisclosureHash,
            d.trainingRightsDeclarationHash,
            d.trainingRightsMode,
            d.trainingRightsController,
            v.state,
            true
        );
    }

    /// @notice Transfer only the authority to issue/revoke training grants; creator and license ownership do not change.
    function transferTrainingRightsController(bytes32 modelVersionId, address newController) external {
        if (newController == address(0)) revert InvalidGrant();
        Model420Metadata storage d = _trainingController(modelVersionId);
        address previous = d.trainingRightsController;
        d.trainingRightsController = newController;
        emit TrainingRightsControllerTransferred(modelVersionId, previous, newController);
    }

    /// @notice Explicitly authorize one grantee for one committed training scope.
    function grantTraining(bytes32 modelVersionId, address grantee, bytes32 scopeHash, uint64 expiresAt)
        external
        returns (bytes32 grantId)
    {
        if (grantee == address(0) || scopeHash == bytes32(0)) revert InvalidGrant();
        Model420Metadata storage d = _trainingController(modelVersionId);
        if (d.trainingRightsMode != TrainingRightsMode.GRANT_ONLY) revert TrainingRightsDenied();
        ModelVersion storage v = _modelVersions[modelVersionId];
        if (v.state != VersionState.ACTIVE || models[v.modelId].state != ModelState.ACTIVE) {
            revert InvalidStateTransition();
        }
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidGrant();

        grantId = trainingGrantId(modelVersionId, grantee, scopeHash);
        if (trainingGrants[grantId].exists && !trainingGrants[grantId].revoked) revert AlreadyExists();
        trainingGrants[grantId] = TrainingGrant({
            modelVersionId: modelVersionId,
            grantee: grantee,
            scopeHash: scopeHash,
            grantedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false,
            exists: true
        });
        emit TrainingGrantCreated(grantId, modelVersionId, grantee, scopeHash, expiresAt);
    }

    function revokeTrainingGrant(bytes32 grantId) external {
        TrainingGrant storage g = trainingGrants[grantId];
        if (!g.exists) revert NotFound();
        Model420Metadata storage d = _trainingController(g.modelVersionId);
        if (g.revoked) revert InvalidStateTransition();
        g.revoked = true;
        emit TrainingGrantRevoked(grantId, g.modelVersionId, g.grantee);
        d;
    }

    function trainingGrantId(bytes32 modelVersionId, address grantee, bytes32 scopeHash) public pure returns (bytes32) {
        return keccak256(abi.encode("420AI_TRAINING_GRANT_V1", modelVersionId, grantee, scopeHash));
    }

    /// @notice Canonical fail-closed training authorization query for routers, marketplaces and model consumers.
    function isTrainingAuthorized(bytes32 modelVersionId, address grantee, bytes32 scopeHash) external view returns (bool) {
        if (grantee == address(0) || scopeHash == bytes32(0)) return false;
        ModelVersion storage v = _modelVersions[modelVersionId];
        if (!v.exists || v.state != VersionState.ACTIVE) return false;
        Model storage m = models[v.modelId];
        if (!m.exists || m.state != ModelState.ACTIVE) return false;
        Model420Metadata storage d = model420Metadata[modelVersionId];
        if (!d.exists || d.trainingRightsMode != TrainingRightsMode.GRANT_ONLY) return false;

        TrainingGrant storage g = trainingGrants[trainingGrantId(modelVersionId, grantee, scopeHash)];
        if (!g.exists || g.revoked) return false;
        return g.expiresAt == 0 || block.timestamp < g.expiresAt;
    }

    function deprecateVersion(bytes32 modelVersionId) external {
        ModelVersion storage v = _modelVersions[modelVersionId];
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
        ModelVersion storage v = _modelVersions[modelVersionId];
        if (!v.exists || v.state != VersionState.ACTIVE) return false;
        Model storage m = models[v.modelId];
        return m.exists && m.state == ModelState.ACTIVE;
    }

    function _storeVersion(
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
        ModelVersion storage v = _modelVersions[modelVersionId];
        v.modelId = modelId;
        v.version = version;
        v.artifactManifestHash = artifactManifestHash;
        v.artifactHash = artifactHash;
        v.runtimeProfileId = runtimeProfileId;
        v.computeRequirementId = computeRequirementId;
        v.schemaHash = schemaHash;
        v.verificationProfileId = verificationProfileId;
        v.licensePolicyId = licensePolicyId;
        v.createdAt = uint64(block.timestamp);
        v.state = VersionState.ACTIVE;
        v.exists = true;
        versionIdByNumber[modelId][version] = modelVersionId;
        emit ModelVersionRegistered(modelVersionId, modelId, version, artifactHash, artifactManifestHash);
    }

    function _declareModel420(
        bytes32 modelVersionId,
        bytes32 architectureHash,
        bytes32 capabilitiesHash,
        bytes32 aiDisclosureHash,
        bytes32 trainingRightsDeclarationHash,
        address trainingRightsController,
        TrainingRightsMode trainingRightsMode
    ) private {
        model420Metadata[modelVersionId] = Model420Metadata({
            architectureHash: architectureHash,
            capabilitiesHash: capabilitiesHash,
            aiDisclosureHash: aiDisclosureHash,
            trainingRightsDeclarationHash: trainingRightsDeclarationHash,
            trainingRightsController: trainingRightsController,
            trainingRightsMode: trainingRightsMode,
            exists: true
        });
        emit Model420Declared(
            modelVersionId,
            architectureHash,
            capabilitiesHash,
            aiDisclosureHash,
            trainingRightsDeclarationHash,
            trainingRightsController,
            trainingRightsMode
        );
    }

    function _validateNewVersion(
        bytes32 modelVersionId,
        bytes32 modelId,
        uint32 version,
        bytes32 artifactManifestHash,
        bytes32 artifactHash
    ) private view {
        if (modelVersionId == bytes32(0) || artifactHash == bytes32(0) || artifactManifestHash == bytes32(0)) {
            revert InvalidId();
        }
        if (version == 0) revert InvalidVersion();
        Model storage m = _getModel(modelId);
        if (m.creator != msg.sender) revert NotCreator();
        if (m.state != ModelState.ACTIVE) revert InvalidStateTransition();
        if (_modelVersions[modelVersionId].exists || versionIdByNumber[modelId][version] != bytes32(0)) {
            revert AlreadyExists();
        }
    }

    function _trainingController(bytes32 modelVersionId) private view returns (Model420Metadata storage d) {
        if (!_modelVersions[modelVersionId].exists) revert NotFound();
        d = model420Metadata[modelVersionId];
        if (!d.exists) revert NotFound();
        if (msg.sender != d.trainingRightsController) revert NotTrainingRightsController();
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
