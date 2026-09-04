// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract MediaStreamRegistry420 is SystemAccess, I420System {
    enum StreamState { NONE, REGISTERED, LIVE, OFFLINE, RETIRED }

    struct Stream {
        address controller;
        address creatorTreasury;
        bytes32 metadataHash;
        bytes32 provenanceRef;
        uint64 createdAt;
        uint32 revision;
        StreamState state;
        bool exists;
    }

    mapping(bytes32 => Stream) public streams;

    error InvalidStreamId();
    error StreamExists();
    error StreamNotFound();
    error NotController();
    error InvalidStateTransition();

    event StreamRegistered(bytes32 indexed streamId, address indexed controller, address indexed creatorTreasury, bytes32 metadataHash);
    event StreamControllerTransferred(bytes32 indexed streamId, address indexed previousController, address indexed newController, uint32 revision);
    event StreamMetadataUpdated(bytes32 indexed streamId, bytes32 metadataHash, uint32 revision);
    event StreamTreasuryUpdated(bytes32 indexed streamId, address indexed creatorTreasury, uint32 revision);
    event StreamProvenanceUpdated(bytes32 indexed streamId, bytes32 provenanceRef, uint32 revision);
    event StreamStateChanged(bytes32 indexed streamId, StreamState previousState, StreamState newState, uint32 revision);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "MediaStreamRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerStream(bytes32 streamId, address controller, address creatorTreasury, bytes32 metadataHash) external {
        if (streamId == bytes32(0)) revert InvalidStreamId();
        if (controller == address(0) || creatorTreasury == address(0)) revert ZeroAddress();
        if (streams[streamId].exists) revert StreamExists();
        if (msg.sender != controller) revert NotController();
        streams[streamId] = Stream({
            controller: controller,
            creatorTreasury: creatorTreasury,
            metadataHash: metadataHash,
            provenanceRef: bytes32(0),
            createdAt: uint64(block.timestamp),
            revision: 1,
            state: StreamState.REGISTERED,
            exists: true
        });
        emit StreamRegistered(streamId, controller, creatorTreasury, metadataHash);
    }

    function transferController(bytes32 streamId, address newController) external {
        if (newController == address(0)) revert ZeroAddress();
        Stream storage s = _controller(streamId);
        if (s.state == StreamState.RETIRED) revert InvalidStateTransition();
        address old = s.controller;
        s.controller = newController;
        s.revision += 1;
        emit StreamControllerTransferred(streamId, old, newController, s.revision);
    }

    function updateMetadata(bytes32 streamId, bytes32 metadataHash) external {
        Stream storage s = _controller(streamId);
        if (s.state == StreamState.RETIRED) revert InvalidStateTransition();
        s.metadataHash = metadataHash;
        s.revision += 1;
        emit StreamMetadataUpdated(streamId, metadataHash, s.revision);
    }

    function updateCreatorTreasury(bytes32 streamId, address creatorTreasury) external {
        if (creatorTreasury == address(0)) revert ZeroAddress();
        Stream storage s = _controller(streamId);
        if (s.state == StreamState.RETIRED) revert InvalidStateTransition();
        s.creatorTreasury = creatorTreasury;
        s.revision += 1;
        emit StreamTreasuryUpdated(streamId, creatorTreasury, s.revision);
    }

    function updateProvenance(bytes32 streamId, bytes32 provenanceRef) external {
        Stream storage s = _controller(streamId);
        if (s.state == StreamState.RETIRED) revert InvalidStateTransition();
        s.provenanceRef = provenanceRef;
        s.revision += 1;
        emit StreamProvenanceUpdated(streamId, provenanceRef, s.revision);
    }

    function setLive(bytes32 streamId, bool live) external {
        Stream storage s = _controller(streamId);
        if (s.state == StreamState.RETIRED) revert InvalidStateTransition();
        StreamState next = live ? StreamState.LIVE : StreamState.OFFLINE;
        if (s.state == next) revert InvalidStateTransition();
        _setState(streamId, s, next);
    }

    function retire(bytes32 streamId) external {
        Stream storage s = _controller(streamId);
        if (s.state == StreamState.RETIRED) revert InvalidStateTransition();
        _setState(streamId, s, StreamState.RETIRED);
    }

    function _controller(bytes32 streamId) private view returns (Stream storage s) {
        s = streams[streamId];
        if (!s.exists) revert StreamNotFound();
        if (msg.sender != s.controller) revert NotController();
    }

    function _setState(bytes32 streamId, Stream storage s, StreamState next) private {
        StreamState previous = s.state;
        s.state = next;
        s.revision += 1;
        emit StreamStateChanged(streamId, previous, next, s.revision);
    }
}
