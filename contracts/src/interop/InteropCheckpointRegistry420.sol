// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./InteropProviderRegistry420.sol";

contract InteropCheckpointRegistry420 {
    struct Checkpoint {
        uint64 sequence;
        bytes32 stateHash;
        bytes32 previousCheckpointHash;
        bytes32 checkpointHash;
        uint64 publishedAt;
    }

    InteropProviderRegistry420 public immutable providers;
    mapping(bytes32 => mapping(bytes32 => Checkpoint)) private _latest;

    error InvalidInput();
    error UnauthorizedAdapter();
    error InvalidSequence();
    error InvalidPreviousCheckpoint();

    event CheckpointPublished(bytes32 indexed providerId, bytes32 indexed domainId, uint64 indexed sequence, bytes32 stateHash, bytes32 checkpointHash);

    constructor(address providers_) {
        if (providers_ == address(0)) revert InvalidInput();
        providers = InteropProviderRegistry420(providers_);
    }

    function publishCheckpoint(bytes32 providerId, bytes32 domainId, uint64 sequence, bytes32 stateHash, bytes32 previousCheckpointHash) external returns (bytes32 checkpointHash) {
        if (!providers.isActiveAdapter(providerId, msg.sender)) revert UnauthorizedAdapter();
        if (domainId == bytes32(0) || stateHash == bytes32(0)) revert InvalidInput();
        Checkpoint storage prior = _latest[providerId][domainId];
        if (sequence != prior.sequence + 1) revert InvalidSequence();
        if (prior.sequence == 0) {
            if (previousCheckpointHash != bytes32(0)) revert InvalidPreviousCheckpoint();
        } else if (previousCheckpointHash != prior.checkpointHash) {
            revert InvalidPreviousCheckpoint();
        }
        checkpointHash = keccak256(abi.encode("420/IS/CHECKPOINT/V1", block.chainid, providerId, domainId, sequence, stateHash, previousCheckpointHash));
        _latest[providerId][domainId] = Checkpoint(sequence, stateHash, previousCheckpointHash, checkpointHash, uint64(block.timestamp));
        emit CheckpointPublished(providerId, domainId, sequence, stateHash, checkpointHash);
    }

    function latest(bytes32 providerId, bytes32 domainId) external view returns (Checkpoint memory) { return _latest[providerId][domainId]; }

    function latestCheckpoint(bytes32 providerId, bytes32 domainId) external view returns (uint64 sequence, bytes32 stateHash, bytes32 checkpointHash) {
        Checkpoint storage c = _latest[providerId][domainId];
        return (c.sequence, c.stateHash, c.checkpointHash);
    }
}
