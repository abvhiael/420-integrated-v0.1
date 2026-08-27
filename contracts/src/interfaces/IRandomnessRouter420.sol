// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical interface boundary for generalized randomness.
/// @dev Randomness is deliberately separate from ordinary 420Oracle data feeds.
interface IRandomnessRouter420 {
    enum Status { NONE, REQUESTED, FULFILLED, EXPIRED, CANCELLED }

    struct Request {
        address requester;
        bytes32 purpose;
        bytes32 providerRoute;
        uint64 requestedAt;
        uint64 deadline;
        Status status;
    }

    function requestRandomness(bytes32 purpose, bytes32 providerRoute, uint64 deadline)
        external returns (bytes32 requestId);

    function status(bytes32 requestId) external view returns (Status);

    function result(bytes32 requestId) external view returns (bytes32 randomness, bytes32 proofHash);
}
