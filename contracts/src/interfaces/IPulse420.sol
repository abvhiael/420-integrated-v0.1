// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IPulse420 {
    struct ProfileRead {
        address controller;
        bytes32 profileType;
        bytes32 identityRef;
        bytes32 nameRef;
        bytes32 metadataHash;
        bytes32 avatarContentRef;
        bytes32 headerContentRef;
        uint64 createdAt;
        uint32 revision;
        bool active;
    }

    struct PublicationRead {
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
    }

    function readProfile(bytes32 profileId) external view returns (ProfileRead memory);
    function readPublication(bytes32 publicationId) external view returns (PublicationRead memory);
    function isFollowing(bytes32 followerProfileId, bytes32 followedProfileId) external view returns (bool);
    function isBlocked(bytes32 blockerProfileId, bytes32 blockedProfileId) external view returns (bool);
}
