// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./PulseIds420.sol";
import "./PulsePolicyRegistry420.sol";
import "./PulseProfileRegistry420.sol";

contract PulsePublicationRegistry420 is I420System {
    struct Publication {
        bytes32 authorProfileId;
        bytes32 publicationType;
        bytes32 parentPublicationId;
        bytes32 rootPublicationId;
        bytes32 externalReferenceId;
        bytes32 visibilityPolicyId;
        bytes32 monetizationPolicyId;
        uint64 createdAt;
        uint32 currentRevision;
        bool active;
        bool exists;
    }

    struct Revision {
        bytes32 contentManifestHash;
        bytes32 contentRef;
        uint64 recordedAt;
        bool exists;
    }

    PulseProfileRegistry420 public immutable profiles;
    PulsePolicyRegistry420 public immutable policies;

    mapping(bytes32 => Publication) private _publications;
    mapping(bytes32 => mapping(uint32 => Revision)) private _revisions;

    error ZeroAddress();
    error InvalidPublicationId();
    error InvalidPublicationType();
    error PublicationAlreadyExists();
    error PublicationNotFound();
    error ParentNotFound();
    error AuthorInactive();
    error Unauthorized();
    error InactivePolicy();
    error InvalidContentManifest();
    error PublicationInactive();

    event PublicationCreated(
        bytes32 indexed publicationId,
        bytes32 indexed authorProfileId,
        bytes32 indexed publicationType,
        bytes32 parentPublicationId,
        bytes32 rootPublicationId,
        bytes32 externalReferenceId,
        bytes32 visibilityPolicyId,
        bytes32 monetizationPolicyId,
        uint64 createdAt
    );
    event PublicationRevisionRecorded(bytes32 indexed publicationId, uint32 indexed revision, bytes32 contentManifestHash, bytes32 contentRef, uint64 recordedAt);
    event PublicationActiveSet(bytes32 indexed publicationId, bool active, uint32 currentRevision);

    constructor(address profiles_, address policies_) {
        if (profiles_ == address(0) || policies_ == address(0)) revert ZeroAddress();
        profiles = PulseProfileRegistry420(profiles_);
        policies = PulsePolicyRegistry420(policies_);
    }

    function systemName() external pure returns (string memory) { return "PulsePublicationRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createPublication(
        bytes32 publicationId,
        bytes32 authorProfileId,
        bytes32 publicationType,
        bytes32 contentManifestHash,
        bytes32 contentRef,
        bytes32 parentPublicationId,
        bytes32 externalReferenceId,
        bytes32 visibilityPolicyId,
        bytes32 monetizationPolicyId
    ) external {
        if (publicationId == bytes32(0)) revert InvalidPublicationId();
        if (_publications[publicationId].exists) revert PublicationAlreadyExists();
        if (!profiles.profileActive(authorProfileId)) revert AuthorInactive();
        if (profiles.controllerOf(authorProfileId) != msg.sender) revert Unauthorized();
        if (!_validPublicationType(publicationType)) revert InvalidPublicationType();
        if (contentManifestHash == bytes32(0)) revert InvalidContentManifest();
        _requirePolicy(visibilityPolicyId);
        _requirePolicy(monetizationPolicyId);

        bytes32 rootPublicationId;
        if (parentPublicationId != bytes32(0)) {
            Publication storage parent = _publications[parentPublicationId];
            if (!parent.exists) revert ParentNotFound();
            rootPublicationId = parent.rootPublicationId == bytes32(0) ? parentPublicationId : parent.rootPublicationId;
        }

        _publications[publicationId] = Publication({
            authorProfileId: authorProfileId,
            publicationType: publicationType,
            parentPublicationId: parentPublicationId,
            rootPublicationId: rootPublicationId,
            externalReferenceId: externalReferenceId,
            visibilityPolicyId: visibilityPolicyId,
            monetizationPolicyId: monetizationPolicyId,
            createdAt: uint64(block.timestamp),
            currentRevision: 1,
            active: true,
            exists: true
        });
        _revisions[publicationId][1] = Revision(contentManifestHash, contentRef, uint64(block.timestamp), true);
        emit PublicationCreated(publicationId, authorProfileId, publicationType, parentPublicationId, rootPublicationId, externalReferenceId, visibilityPolicyId, monetizationPolicyId, uint64(block.timestamp));
        emit PublicationRevisionRecorded(publicationId, 1, contentManifestHash, contentRef, uint64(block.timestamp));
    }

    function revisePublication(bytes32 publicationId, bytes32 contentManifestHash, bytes32 contentRef) external {
        Publication storage publication = _publications[publicationId];
        if (!publication.exists) revert PublicationNotFound();
        if (!publication.active) revert PublicationInactive();
        if (profiles.controllerOf(publication.authorProfileId) != msg.sender) revert Unauthorized();
        if (contentManifestHash == bytes32(0)) revert InvalidContentManifest();
        uint32 revision = publication.currentRevision + 1;
        publication.currentRevision = revision;
        _revisions[publicationId][revision] = Revision(contentManifestHash, contentRef, uint64(block.timestamp), true);
        emit PublicationRevisionRecorded(publicationId, revision, contentManifestHash, contentRef, uint64(block.timestamp));
    }

    function setPublicationActive(bytes32 publicationId, bool active) external {
        Publication storage publication = _publications[publicationId];
        if (!publication.exists) revert PublicationNotFound();
        if (profiles.controllerOf(publication.authorProfileId) != msg.sender) revert Unauthorized();
        publication.active = active;
        emit PublicationActiveSet(publicationId, active, publication.currentRevision);
    }

    function getPublication(bytes32 publicationId) external view returns (Publication memory publication) {
        publication = _publications[publicationId];
        if (!publication.exists) revert PublicationNotFound();
    }

    function getRevision(bytes32 publicationId, uint32 revision) external view returns (Revision memory out) {
        if (!_publications[publicationId].exists) revert PublicationNotFound();
        out = _revisions[publicationId][revision];
        if (!out.exists) revert PublicationNotFound();
    }

    function publicationActive(bytes32 publicationId) external view returns (bool) {
        Publication storage publication = _publications[publicationId];
        return publication.exists && publication.active;
    }

    function _requirePolicy(bytes32 policyId) private view {
        if (policyId != bytes32(0) && !policies.isActive(policyId)) revert InactivePolicy();
    }

    function _validPublicationType(bytes32 x) private pure returns (bool) {
        return x == PulseIds420.PUBLICATION_POST || x == PulseIds420.PUBLICATION_ARTICLE
            || x == PulseIds420.PUBLICATION_IMAGE || x == PulseIds420.PUBLICATION_VIDEO
            || x == PulseIds420.PUBLICATION_AUDIO || x == PulseIds420.PUBLICATION_LINK
            || x == PulseIds420.PUBLICATION_POLL || x == PulseIds420.PUBLICATION_PRODUCT_REFERENCE
            || x == PulseIds420.PUBLICATION_RELEASE_REFERENCE || x == PulseIds420.PUBLICATION_EVENT_REFERENCE
            || x == PulseIds420.PUBLICATION_COMMONS_REFERENCE;
    }
}
