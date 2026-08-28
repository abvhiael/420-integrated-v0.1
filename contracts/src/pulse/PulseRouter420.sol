// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IPulse420.sol";
import "./PulseProfileRegistry420.sol";
import "./PulsePublicationRegistry420.sol";
import "./PulseGraph420.sol";

contract PulseRouter420 is I420System, IPulse420 {
    PulseProfileRegistry420 public immutable profiles;
    PulsePublicationRegistry420 public immutable publications;
    PulseGraph420 public immutable graph;

    error ZeroAddress();

    constructor(address profiles_, address publications_, address graph_) {
        if (profiles_ == address(0) || publications_ == address(0) || graph_ == address(0)) revert ZeroAddress();
        profiles = PulseProfileRegistry420(profiles_);
        publications = PulsePublicationRegistry420(publications_);
        graph = PulseGraph420(graph_);
    }

    function systemName() external pure returns (string memory) { return "PulseRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function readProfile(bytes32 profileId) external view returns (ProfileRead memory out) {
        PulseProfileRegistry420.Profile memory profile = profiles.getProfile(profileId);
        out = ProfileRead(
            profile.controller,
            profile.profileType,
            profile.identityRef,
            profile.nameRef,
            profile.metadataHash,
            profile.avatarContentRef,
            profile.headerContentRef,
            profile.createdAt,
            profile.revision,
            profile.active
        );
    }

    function readPublication(bytes32 publicationId) external view returns (PublicationRead memory out) {
        PulsePublicationRegistry420.Publication memory publication = publications.getPublication(publicationId);
        out = PublicationRead(
            publication.authorProfileId,
            publication.publicationType,
            publication.parentPublicationId,
            publication.rootPublicationId,
            publication.externalReferenceId,
            publication.visibilityPolicyId,
            publication.monetizationPolicyId,
            publication.createdAt,
            publication.currentRevision,
            publication.active
        );
    }

    function isFollowing(bytes32 followerProfileId, bytes32 followedProfileId) external view returns (bool) {
        return graph.following(followerProfileId, followedProfileId);
    }

    function isBlocked(bytes32 blockerProfileId, bytes32 blockedProfileId) external view returns (bool) {
        return graph.blocked(blockerProfileId, blockedProfileId);
    }
}
