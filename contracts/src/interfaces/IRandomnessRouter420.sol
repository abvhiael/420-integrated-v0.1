// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical application-facing interface for generalized 420Random.
/// @dev Randomness is deliberately separate from ordinary 420Oracle data feeds.
interface IRandomnessRouter420 {
    enum Status { NONE, REQUESTED, FALLBACK_ACTIVE, FULFILLED, VOIDED }

    struct Request {
        address requester;
        bytes32 profileId;
        uint32 profileRevision;
        bytes32 domain;
        bytes32 purpose;
        bytes32 primaryRoute;
        bytes32 fallbackRoute;
        uint32 primaryRouteRevision;
        uint32 fallbackRouteRevision;
        address primaryOperator;
        address fallbackOperator;
        address primaryVerifier;
        address fallbackVerifier;
        bytes32 primaryMethod;
        bytes32 fallbackMethod;
        uint64 requestedAt;
        uint64 primaryDeadline;
        uint64 deadline;
        uint8 securityTier;
        uint8 fallbackPolicy;
        Status status;
    }

    function requestRandomness(bytes32 profileId, bytes32 domain, bytes32 purpose, uint64 deadline)
        external returns (bytes32 requestId);

    function fulfillRandomness(bytes32 requestId, bytes32 providerRandomness, bytes calldata proof) external;
    function activateFallback(bytes32 requestId) external;
    function voidExpired(bytes32 requestId) external;
    function status(bytes32 requestId) external view returns (Status);
    function request(bytes32 requestId) external view returns (Request memory);
    function result(bytes32 requestId) external view returns (bytes32 randomness, bytes32 proofHash);
}