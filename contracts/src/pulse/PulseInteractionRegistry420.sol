// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./PulseProfileRegistry420.sol";
import "./PulsePublicationRegistry420.sol";
import "./PulseGraph420.sol";

contract PulseInteractionRegistry420 is I420System {
    PulseProfileRegistry420 public immutable profiles;
    PulsePublicationRegistry420 public immutable publications;
    PulseGraph420 public immutable graph;

    mapping(bytes32 => mapping(bytes32 => bool)) public liked;

    error ZeroAddress();
    error Unauthorized();
    error ProfileInactive();
    error PublicationInactive();
    error InteractionBlocked();
    error NoChange();

    event LikeSet(bytes32 indexed profileId, bytes32 indexed publicationId, bool active);

    constructor(address profiles_, address publications_, address graph_) {
        if (profiles_ == address(0) || publications_ == address(0) || graph_ == address(0)) revert ZeroAddress();
        profiles = PulseProfileRegistry420(profiles_);
        publications = PulsePublicationRegistry420(publications_);
        graph = PulseGraph420(graph_);
    }

    function systemName() external pure returns (string memory) { return "PulseInteractionRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setLike(bytes32 profileId, bytes32 publicationId, bool active) external {
        if (!profiles.profileActive(profileId)) revert ProfileInactive();
        if (profiles.controllerOf(profileId) != msg.sender) revert Unauthorized();
        if (liked[profileId][publicationId] == active) revert NoChange();

        if (active) {
            if (!publications.publicationActive(publicationId)) revert PublicationInactive();
            PulsePublicationRegistry420.Publication memory publication = publications.getPublication(publicationId);
            if (!graph.canInteract(profileId, publication.authorProfileId)) revert InteractionBlocked();
        } else {
            publications.getPublication(publicationId);
        }

        liked[profileId][publicationId] = active;
        emit LikeSet(profileId, publicationId, active);
    }
}
