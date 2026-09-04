// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesIds420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesRelationshipGraph420.sol";
import "./BongGogglesSocialPolicy420.sol";
import "../messenger/MessengerConversationRegistry420.sol";

/// @notice Bong Goggles private-messaging metadata layer.
/// @dev Stores only commitments/opaque identifiers. Message plaintext and ciphertext stay off-chain / in 420Messenger transport.
contract BongGogglesPrivateMessaging420 {
    struct DeviceKeyRecord {
        bytes32 keyCommitment;
        uint64 revision;
        bool active;
    }

    struct DirectContext {
        bytes32 contextId;
        bytes32 messengerConversationId;
        address a;
        address b;
        uint64 epoch;
        bytes32 epochCommitment;
        uint64 createdAt;
        bool closed;
        bool exists;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;
    BongGogglesRelationshipGraph420 public immutable relationships;
    BongGogglesSocialPolicy420 public immutable policy;
    MessengerConversationRegistry420 public immutable conversations;

    mapping(address => mapping(bytes32 => DeviceKeyRecord)) private _deviceKeys;
    mapping(bytes32 => DirectContext) private _contexts;

    error ZeroAddress();
    error Unauthorized();
    error ProfileInactive();
    error InvalidDevice();
    error DeviceMissing();
    error MessagePolicyDenied();
    error RelationshipBlocked();
    error ConversationUnavailable();
    error NotParticipant();
    error ContextExists();
    error ContextMissing();
    error ContextClosed();
    error InvalidCommitment();

    event DeviceKeySet(address indexed account, bytes32 indexed deviceId, bytes32 keyCommitment, uint64 revision, address operator);
    event DeviceKeyRevoked(address indexed account, bytes32 indexed deviceId, uint64 revision, address operator);
    event DirectContextBound(
        bytes32 indexed contextId,
        bytes32 indexed messengerConversationId,
        address indexed accountA,
        address accountB,
        bytes32 epochCommitment,
        address operator
    );
    event PrivateEpochRotated(bytes32 indexed contextId, uint64 indexed epoch, bytes32 epochCommitment, address indexed actor, address operator);
    event PrivateContextClosed(bytes32 indexed contextId, address indexed actor, address operator);

    constructor(
        address authorization_,
        address profiles_,
        address relationships_,
        address policy_,
        address conversations_
    ) {
        if (
            authorization_ == address(0) || profiles_ == address(0) || relationships_ == address(0)
                || policy_ == address(0) || conversations_ == address(0)
        ) revert ZeroAddress();
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
        relationships = BongGogglesRelationshipGraph420(relationships_);
        policy = BongGogglesSocialPolicy420(policy_);
        conversations = MessengerConversationRegistry420(conversations_);
    }

    function deviceKey(address account, bytes32 deviceId) external view returns (DeviceKeyRecord memory) {
        return _deviceKeys[account][deviceId];
    }

    function privateContext(bytes32 contextId) external view returns (DirectContext memory) {
        return _contexts[contextId];
    }

    function setDeviceKey(address account, bytes32 deviceId, bytes32 keyCommitment) external {
        if (account == address(0)) revert ZeroAddress();
        if (deviceId == bytes32(0) || keyCommitment == bytes32(0)) revert InvalidDevice();
        if (!profiles.isActive(account)) revert ProfileInactive();
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_PRIVATE_DEVICE_SET)) revert Unauthorized();

        DeviceKeyRecord storage current = _deviceKeys[account][deviceId];
        uint64 revision = current.revision + 1;
        current.keyCommitment = keyCommitment;
        current.revision = revision;
        current.active = true;
        emit DeviceKeySet(account, deviceId, keyCommitment, revision, msg.sender);
    }

    function revokeDeviceKey(address account, bytes32 deviceId) external {
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_PRIVATE_DEVICE_REVOKE)) revert Unauthorized();
        DeviceKeyRecord storage current = _deviceKeys[account][deviceId];
        if (!current.active) revert DeviceMissing();
        current.active = false;
        current.revision += 1;
        emit DeviceKeyRevoked(account, deviceId, current.revision, msg.sender);
    }

    function canonicalDirectContextId(address x, address y, bytes32 messengerConversationId) public pure returns (bytes32) {
        (address a, address b) = x < y ? (x, y) : (y, x);
        return keccak256(abi.encode("420/BONG_GOGGLES/PRIVATE_DIRECT/V1", a, b, messengerConversationId));
    }

    function bindDirectContext(
        address account,
        address peer,
        bytes32 messengerConversationId,
        bytes32 epochCommitment
    ) external returns (bytes32 contextId) {
        if (account == address(0) || peer == address(0) || account == peer) revert ZeroAddress();
        if (epochCommitment == bytes32(0)) revert InvalidCommitment();
        if (!authorization.canActFor(msg.sender, account, BongGogglesIds420.ACTION_PRIVATE_CONTEXT_BIND)) revert Unauthorized();
        if (!profiles.isActive(account) || !profiles.isActive(peer)) revert ProfileInactive();
        if (relationships.isBlockedEither(account, peer)) revert RelationshipBlocked();
        if (!policy.canMessage(account, peer)) revert MessagePolicyDenied();
        if (!conversations.isActive(messengerConversationId)) revert ConversationUnavailable();
        if (!conversations.isParticipant(messengerConversationId, account) || !conversations.isParticipant(messengerConversationId, peer)) {
            revert NotParticipant();
        }

        contextId = canonicalDirectContextId(account, peer, messengerConversationId);
        if (_contexts[contextId].exists) revert ContextExists();
        (address a, address b) = account < peer ? (account, peer) : (peer, account);
        _contexts[contextId] = DirectContext(
            contextId,
            messengerConversationId,
            a,
            b,
            1,
            epochCommitment,
            uint64(block.timestamp),
            false,
            true
        );
        emit DirectContextBound(contextId, messengerConversationId, a, b, epochCommitment, msg.sender);
    }

    function canSend(bytes32 contextId, address sender) public view returns (bool) {
        DirectContext storage c = _contexts[contextId];
        if (!c.exists || c.closed || !conversations.isActive(c.messengerConversationId)) return false;
        if (sender != c.a && sender != c.b) return false;
        address peer = sender == c.a ? c.b : c.a;
        if (!profiles.isActive(sender) || !profiles.isActive(peer)) return false;
        if (relationships.isBlockedEither(sender, peer)) return false;
        return policy.canMessage(sender, peer);
    }

    function rotateEpoch(address actor, bytes32 contextId, bytes32 newEpochCommitment) external {
        if (newEpochCommitment == bytes32(0)) revert InvalidCommitment();
        DirectContext storage c = _context(contextId);
        if (c.closed) revert ContextClosed();
        if (actor != c.a && actor != c.b) revert NotParticipant();
        if (!authorization.canActFor(msg.sender, actor, BongGogglesIds420.ACTION_PRIVATE_EPOCH_ROTATE)) revert Unauthorized();
        if (!canSend(contextId, actor)) revert ConversationUnavailable();
        c.epoch += 1;
        c.epochCommitment = newEpochCommitment;
        emit PrivateEpochRotated(contextId, c.epoch, newEpochCommitment, actor, msg.sender);
    }

    function closeContext(address actor, bytes32 contextId) external {
        DirectContext storage c = _context(contextId);
        if (c.closed) revert ContextClosed();
        if (actor != c.a && actor != c.b) revert NotParticipant();
        if (!authorization.canActFor(msg.sender, actor, BongGogglesIds420.ACTION_PRIVATE_CONTEXT_CLOSE)) revert Unauthorized();
        c.closed = true;
        emit PrivateContextClosed(contextId, actor, msg.sender);
    }

    function _context(bytes32 contextId) internal view returns (DirectContext storage c) {
        c = _contexts[contextId];
        if (!c.exists) revert ContextMissing();
    }
}
