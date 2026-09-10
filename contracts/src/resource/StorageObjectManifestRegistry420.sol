// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./StorageAgreementRegistry420.sol";
import "./StorageCommitmentRegistry420.sol";

/// @notice Canonical SR-3.3 object manifests and immutable shard-placement commitments.
/// @dev Encrypted payloads and shard bytes remain off-chain. This registry anchors the
///      manifest envelope and binds each erasure-coded shard to a qualified storage agreement.
contract StorageObjectManifestRegistry420 is I420System {
    struct Manifest {
        address controller;
        bytes32 objectId;
        bytes32 objectContentRoot;
        bytes32 manifestHash;
        bytes32 encryptionCommitment;
        bytes32 erasureRoot;
        uint128 objectSizeBytes;
        uint32 segmentCount;
        uint32 dataShards;
        uint32 totalShards;
        uint32 placedShards;
        bool isSealed;
        bool exists;
    }

    struct Placement {
        bytes32 manifestId;
        bytes32 agreementId;
        bytes32 commitmentId;
        bytes32 nodeId;
        bytes32 shardRoot;
        uint128 shardSizeBytes;
        uint32 shardIndex;
        bool exists;
    }

    StorageAgreementRegistry420 public immutable agreements;
    StorageCommitmentRegistry420 public immutable commitments;

    mapping(bytes32 => Manifest) private _manifests;
    mapping(bytes32 => Placement) private _placements;
    mapping(bytes32 => mapping(uint32 => bytes32)) private _placementByIndex;

    error ZeroAddress();
    error InvalidManifest();
    error ManifestExists();
    error ManifestNotFound();
    error InvalidPlacement();
    error PlacementExists();
    error PlacementNotFound();
    error Unauthorized();
    error ManifestSealed();
    error IncompleteManifest();

    event ObjectManifestRegistered(
        bytes32 indexed manifestId,
        address indexed controller,
        bytes32 indexed objectId,
        bytes32 objectContentRoot,
        bytes32 manifestHash,
        uint128 objectSizeBytes,
        uint32 dataShards,
        uint32 totalShards
    );
    event ShardPlacementRegistered(
        bytes32 indexed manifestId,
        uint32 indexed shardIndex,
        bytes32 indexed placementId,
        bytes32 agreementId,
        bytes32 commitmentId,
        bytes32 nodeId,
        bytes32 shardRoot,
        uint128 shardSizeBytes
    );
    event ObjectManifestSealed(bytes32 indexed manifestId, uint32 placedShards);

    constructor(address agreements_, address commitments_) {
        if (agreements_ == address(0) || commitments_ == address(0)) revert ZeroAddress();
        agreements = StorageAgreementRegistry420(agreements_);
        commitments = StorageCommitmentRegistry420(commitments_);
    }

    function systemName() external pure returns (string memory) { return "StorageObjectManifestRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalManifestId(address controller, bytes32 objectId, bytes32 manifestHash) public view returns (bytes32) {
        return keccak256(abi.encode("420/STORAGE/OBJECT_MANIFEST/V1", block.chainid, address(this), controller, objectId, manifestHash));
    }

    function canonicalPlacementId(bytes32 manifestId, uint32 shardIndex) public pure returns (bytes32) {
        return keccak256(abi.encode("420/STORAGE/SHARD_PLACEMENT/V1", manifestId, shardIndex));
    }

    function registerManifest(
        bytes32 objectId,
        bytes32 objectContentRoot,
        bytes32 manifestHash,
        bytes32 encryptionCommitment,
        bytes32 erasureRoot,
        uint128 objectSizeBytes,
        uint32 segmentCount,
        uint32 dataShards,
        uint32 totalShards
    ) external returns (bytes32 manifestId) {
        if (
            objectId == bytes32(0) || objectContentRoot == bytes32(0) || manifestHash == bytes32(0)
                || encryptionCommitment == bytes32(0) || erasureRoot == bytes32(0) || objectSizeBytes == 0
                || segmentCount == 0 || dataShards == 0 || totalShards < dataShards
                || totalShards > agreements.MAX_TOTAL_SHARDS()
        ) revert InvalidManifest();

        manifestId = canonicalManifestId(msg.sender, objectId, manifestHash);
        if (_manifests[manifestId].exists) revert ManifestExists();
        _manifests[manifestId] = Manifest({
            controller: msg.sender,
            objectId: objectId,
            objectContentRoot: objectContentRoot,
            manifestHash: manifestHash,
            encryptionCommitment: encryptionCommitment,
            erasureRoot: erasureRoot,
            objectSizeBytes: objectSizeBytes,
            segmentCount: segmentCount,
            dataShards: dataShards,
            totalShards: totalShards,
            placedShards: 0,
            isSealed: false,
            exists: true
        });
        emit ObjectManifestRegistered(manifestId, msg.sender, objectId, objectContentRoot, manifestHash, objectSizeBytes, dataShards, totalShards);
    }

    function registerPlacement(
        bytes32 manifestId,
        uint32 shardIndex,
        bytes32 agreementId,
        bytes32 shardRoot,
        uint128 shardSizeBytes
    ) external returns (bytes32 placementId) {
        Manifest storage manifest = _manifest(manifestId);
        if (manifest.isSealed) revert ManifestSealed();
        if (msg.sender != manifest.controller) revert Unauthorized();
        if (shardIndex >= manifest.totalShards || agreementId == bytes32(0) || shardRoot == bytes32(0) || shardSizeBytes == 0) {
            revert InvalidPlacement();
        }
        if (_placementByIndex[manifestId][shardIndex] != bytes32(0)) revert PlacementExists();

        StorageAgreementRegistry420.Agreement memory agreement = agreements.getAgreement(agreementId);
        if (
            agreement.consumer != manifest.controller || agreement.objectId != manifest.objectId
                || agreement.manifestHash != manifest.manifestHash
                || agreement.dataShards != manifest.dataShards || agreement.totalShards != manifest.totalShards
                || agreement.state != StorageAgreementRegistry420.State.ACTIVE || agreement.commitmentId == bytes32(0)
                || shardSizeBytes > agreement.sizeBytes
        ) revert InvalidPlacement();

        StorageCommitmentRegistry420.Commitment memory commitment = commitments.getCommitment(agreement.commitmentId);
        if (
            commitment.nodeId == bytes32(0) || commitment.contentRoot != agreement.contentRoot
                || commitment.sizeBytes != agreement.sizeBytes || commitment.startTime != agreement.startTime
                || commitment.endTime != agreement.endTime
        ) revert InvalidPlacement();

        placementId = canonicalPlacementId(manifestId, shardIndex);
        if (_placements[placementId].exists) revert PlacementExists();
        _placements[placementId] = Placement({
            manifestId: manifestId,
            agreementId: agreementId,
            commitmentId: agreement.commitmentId,
            nodeId: commitment.nodeId,
            shardRoot: shardRoot,
            shardSizeBytes: shardSizeBytes,
            shardIndex: shardIndex,
            exists: true
        });
        _placementByIndex[manifestId][shardIndex] = placementId;
        manifest.placedShards += 1;

        emit ShardPlacementRegistered(
            manifestId, shardIndex, placementId, agreementId, agreement.commitmentId, commitment.nodeId, shardRoot, shardSizeBytes
        );
    }

    function sealManifest(bytes32 manifestId) external {
        Manifest storage manifest = _manifest(manifestId);
        if (msg.sender != manifest.controller) revert Unauthorized();
        if (manifest.isSealed) revert ManifestSealed();
        if (manifest.placedShards != manifest.totalShards) revert IncompleteManifest();
        manifest.isSealed = true;
        emit ObjectManifestSealed(manifestId, manifest.placedShards);
    }

    function getManifest(bytes32 manifestId) external view returns (Manifest memory) { return _manifest(manifestId); }

    function getPlacement(bytes32 placementId) external view returns (Placement memory placement) {
        placement = _placements[placementId];
        if (!placement.exists) revert PlacementNotFound();
    }

    function placementAt(bytes32 manifestId, uint32 shardIndex) external view returns (Placement memory placement) {
        bytes32 placementId = _placementByIndex[manifestId][shardIndex];
        if (placementId == bytes32(0)) revert PlacementNotFound();
        placement = _placements[placementId];
    }

    function isRetrievable(bytes32 manifestId) external view returns (bool) {
        Manifest memory manifest = _manifests[manifestId];
        if (!manifest.exists || !manifest.isSealed) return false;
        uint32 live;
        for (uint32 i = 0; i < manifest.totalShards; ++i) {
            bytes32 placementId = _placementByIndex[manifestId][i];
            if (placementId == bytes32(0)) continue;
            Placement memory placement = _placements[placementId];
            if (agreements.isEffective(placement.agreementId) && commitments.isLive(placement.commitmentId)) {
                live += 1;
                if (live >= manifest.dataShards) return true;
            }
        }
        return false;
    }

    function _manifest(bytes32 manifestId) private view returns (Manifest storage manifest) {
        manifest = _manifests[manifestId];
        if (!manifest.exists) revert ManifestNotFound();
    }
}
