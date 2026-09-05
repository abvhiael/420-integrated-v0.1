// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";

interface ICatalogMetadataCreatorProfiles420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

interface ICatalogMetadataCatalog420 {
    function creatorOf(uint256 releaseId) external view returns (CreatorId);
}

contract CatalogMetadataRegistry420 {
    struct CreatorPresentation420 {
        bytes32 profileManifestHash;
        bytes32 socialLinksHash;
        uint64 revision;
        uint64 updatedAt;
    }

    struct ReleasePresentation420 {
        bytes32 presentationHash;
        bytes32 discoverabilityHash;
        bytes32 externalIdsHash;
        uint64 revision;
        uint64 updatedAt;
    }

    ICatalogMetadataCreatorProfiles420 public immutable creatorProfiles;
    ICatalogMetadataCatalog420 public immutable catalog;

    mapping(uint256 => CreatorPresentation420) private _creatorPresentation;
    mapping(uint256 => ReleasePresentation420) private _releasePresentation;

    event CreatorPresentationUpdated(
        uint256 indexed creatorId,
        uint64 indexed revision,
        bytes32 profileManifestHash,
        bytes32 socialLinksHash
    );
    event ReleasePresentationUpdated(
        uint256 indexed releaseId,
        uint256 indexed creatorId,
        uint64 indexed revision,
        bytes32 presentationHash,
        bytes32 discoverabilityHash,
        bytes32 externalIdsHash
    );

    constructor(address creatorProfiles_, address catalog_) {
        if (creatorProfiles_ == address(0) || catalog_ == address(0)) revert CreativeErrors420.ZeroAddress();
        creatorProfiles = ICatalogMetadataCreatorProfiles420(creatorProfiles_);
        catalog = ICatalogMetadataCatalog420(catalog_);
    }

    function updateCreatorPresentation(
        CreatorId creatorId,
        bytes32 profileManifestHash,
        bytes32 socialLinksHash
    ) external {
        _requireAuthorized(creatorId);
        if (profileManifestHash == bytes32(0)) revert CreativeErrors420.InvalidId();

        uint256 rawCreatorId = CreatorId.unwrap(creatorId);
        CreatorPresentation420 storage current = _creatorPresentation[rawCreatorId];
        uint64 nextRevision = current.revision + 1;
        current.profileManifestHash = profileManifestHash;
        current.socialLinksHash = socialLinksHash;
        current.revision = nextRevision;
        current.updatedAt = uint64(block.timestamp);

        emit CreatorPresentationUpdated(rawCreatorId, nextRevision, profileManifestHash, socialLinksHash);
    }

    function updateReleasePresentation(
        uint256 releaseId,
        bytes32 presentationHash,
        bytes32 discoverabilityHash,
        bytes32 externalIdsHash
    ) external {
        CreatorId creatorId = catalog.creatorOf(releaseId);
        _requireAuthorized(creatorId);
        if (presentationHash == bytes32(0)) revert CreativeErrors420.InvalidId();

        ReleasePresentation420 storage current = _releasePresentation[releaseId];
        uint64 nextRevision = current.revision + 1;
        current.presentationHash = presentationHash;
        current.discoverabilityHash = discoverabilityHash;
        current.externalIdsHash = externalIdsHash;
        current.revision = nextRevision;
        current.updatedAt = uint64(block.timestamp);

        emit ReleasePresentationUpdated(
            releaseId,
            CreatorId.unwrap(creatorId),
            nextRevision,
            presentationHash,
            discoverabilityHash,
            externalIdsHash
        );
    }

    function creatorPresentation(CreatorId creatorId) external view returns (CreatorPresentation420 memory) {
        return _creatorPresentation[CreatorId.unwrap(creatorId)];
    }

    function releasePresentation(uint256 releaseId) external view returns (ReleasePresentation420 memory) {
        catalog.creatorOf(releaseId);
        return _releasePresentation[releaseId];
    }

    function _requireAuthorized(CreatorId creatorId) internal view {
        if (CreatorId.unwrap(creatorId) == 0) revert CreativeErrors420.InvalidId();
        if (!creatorProfiles.isAuthorized(creatorId, msg.sender)) revert CreativeErrors420.Unauthorized();
    }
}
