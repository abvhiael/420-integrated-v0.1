// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract PulseTopicRegistry420 is SystemAccess, I420System {
    struct Topic {
        bytes32 normalizedNameHash;
        bytes32 metadataHash;
        uint64 createdAt;
        uint32 revision;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Topic) private _topics;

    error InvalidTopicId();
    error InvalidNameHash();
    error TopicAlreadyExists();
    error TopicNotFound();

    event TopicCreated(bytes32 indexed topicId, bytes32 indexed normalizedNameHash, bytes32 metadataHash, uint64 createdAt);
    event TopicUpdated(bytes32 indexed topicId, bytes32 metadataHash, uint32 revision, bool active);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "PulseTopicRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createTopic(bytes32 topicId, bytes32 normalizedNameHash, bytes32 metadataHash) external onlyGovernance {
        if (topicId == bytes32(0)) revert InvalidTopicId();
        if (normalizedNameHash == bytes32(0)) revert InvalidNameHash();
        if (_topics[topicId].exists) revert TopicAlreadyExists();
        _topics[topicId] = Topic(normalizedNameHash, metadataHash, uint64(block.timestamp), 1, true, true);
        emit TopicCreated(topicId, normalizedNameHash, metadataHash, uint64(block.timestamp));
    }

    function updateTopic(bytes32 topicId, bytes32 metadataHash, bool active) external onlyGovernance {
        Topic storage topic = _topics[topicId];
        if (!topic.exists) revert TopicNotFound();
        topic.metadataHash = metadataHash;
        topic.revision += 1;
        topic.active = active;
        emit TopicUpdated(topicId, metadataHash, topic.revision, active);
    }

    function getTopic(bytes32 topicId) external view returns (Topic memory topic) {
        topic = _topics[topicId];
        if (!topic.exists) revert TopicNotFound();
    }

    function topicActive(bytes32 topicId) external view returns (bool) {
        Topic storage topic = _topics[topicId];
        return topic.exists && topic.active;
    }
}
