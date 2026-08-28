// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./CommonsAuthorization420.sol";
import "./CommonsPolicyRegistry420.sol";
import "./CommonsSpaceRegistry420.sol";
import "./CommonsIds420.sol";

contract CommonsChannelRegistry420 is I420System {
    struct Channel {
        bytes32 spaceId;
        bytes32 channelType;
        bytes32 readPolicyId;
        bytes32 publishPolicyId;
        bytes32 encryptionPolicyId;
        bytes32 metadataHash;
        bytes32 contentManifestRef;
        uint32 revision;
        bool active;
        bool exists;
    }

    CommonsAuthorization420 public immutable authorization;
    CommonsPolicyRegistry420 public immutable policyRegistry;
    CommonsSpaceRegistry420 public immutable spaceRegistry;
    mapping(bytes32 => Channel) private _channels;

    error ZeroAddress();
    error InvalidChannelId();
    error InvalidChannelType();
    error ChannelAlreadyExists();
    error ChannelNotFound();
    error SpaceNotFound();
    error InactivePolicy();
    error Unauthorized();

    event ChannelCreated(bytes32 indexed channelId, bytes32 indexed spaceId, bytes32 channelType, bytes32 metadataHash, uint32 revision);
    event ChannelUpdated(bytes32 indexed channelId, bytes32 readPolicyId, bytes32 publishPolicyId, bytes32 encryptionPolicyId, bytes32 metadataHash, bytes32 contentManifestRef, uint32 revision, bool active);

    constructor(address authorization_, address policyRegistry_, address spaceRegistry_) {
        if (authorization_ == address(0) || policyRegistry_ == address(0) || spaceRegistry_ == address(0)) revert ZeroAddress();
        authorization = CommonsAuthorization420(authorization_);
        policyRegistry = CommonsPolicyRegistry420(policyRegistry_);
        spaceRegistry = CommonsSpaceRegistry420(spaceRegistry_);
    }

    function systemName() external pure returns (string memory) { return "CommonsChannelRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createChannel(
        bytes32 channelId,
        bytes32 spaceId,
        bytes32 channelType,
        bytes32 readPolicyId,
        bytes32 publishPolicyId,
        bytes32 encryptionPolicyId,
        bytes32 metadataHash,
        bytes32 contentManifestRef
    ) external {
        if (!authorization.isAuthorized(spaceId, msg.sender, CommonsIds420.ACTION_CREATE_CHANNEL)) revert Unauthorized();
        if (!spaceRegistry.spaceExists(spaceId)) revert SpaceNotFound();
        if (channelId == bytes32(0)) revert InvalidChannelId();
        if (_channels[channelId].exists) revert ChannelAlreadyExists();
        if (!_validChannelType(channelType)) revert InvalidChannelType();
        _requirePolicy(readPolicyId);
        _requirePolicy(publishPolicyId);
        _requirePolicy(encryptionPolicyId);

        _channels[channelId] = Channel({
            spaceId: spaceId,
            channelType: channelType,
            readPolicyId: readPolicyId,
            publishPolicyId: publishPolicyId,
            encryptionPolicyId: encryptionPolicyId,
            metadataHash: metadataHash,
            contentManifestRef: contentManifestRef,
            revision: 1,
            active: true,
            exists: true
        });
        emit ChannelCreated(channelId, spaceId, channelType, metadataHash, 1);
    }

    function updateChannel(
        bytes32 channelId,
        bytes32 readPolicyId,
        bytes32 publishPolicyId,
        bytes32 encryptionPolicyId,
        bytes32 metadataHash,
        bytes32 contentManifestRef,
        bool active
    ) external {
        Channel storage channel = _channels[channelId];
        if (!channel.exists) revert ChannelNotFound();
        if (!authorization.isAuthorized(channel.spaceId, msg.sender, CommonsIds420.ACTION_MODIFY_CHANNEL)) revert Unauthorized();
        _requirePolicy(readPolicyId);
        _requirePolicy(publishPolicyId);
        _requirePolicy(encryptionPolicyId);

        channel.readPolicyId = readPolicyId;
        channel.publishPolicyId = publishPolicyId;
        channel.encryptionPolicyId = encryptionPolicyId;
        channel.metadataHash = metadataHash;
        channel.contentManifestRef = contentManifestRef;
        channel.revision += 1;
        channel.active = active;
        emit ChannelUpdated(channelId, readPolicyId, publishPolicyId, encryptionPolicyId, metadataHash, contentManifestRef, channel.revision, active);
    }

    function getChannel(bytes32 channelId) external view returns (Channel memory channel) {
        channel = _channels[channelId];
        if (!channel.exists) revert ChannelNotFound();
    }

    function _requirePolicy(bytes32 policyId) private view {
        if (policyId != bytes32(0) && !policyRegistry.isActive(policyId)) revert InactivePolicy();
    }

    function _validChannelType(bytes32 x) private pure returns (bool) {
        return x == CommonsIds420.CHANNEL_CHAT || x == CommonsIds420.CHANNEL_ANNOUNCEMENTS
            || x == CommonsIds420.CHANNEL_FORUM || x == CommonsIds420.CHANNEL_FILES
            || x == CommonsIds420.CHANNEL_VOICE || x == CommonsIds420.CHANNEL_VIDEO
            || x == CommonsIds420.CHANNEL_EVENT || x == CommonsIds420.CHANNEL_GOVERNANCE_DISCUSSION;
    }
}
