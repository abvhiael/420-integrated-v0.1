// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./CommonsAuthorization420.sol";
import "./CommonsPolicyRegistry420.sol";
import "./CommonsIds420.sol";

contract CommonsSpaceRegistry420 is I420System {
    struct Space {
        address creatorAccount;
        address treasuryAccount;
        bytes32 spaceType;
        bytes32 visibility;
        bytes32 membershipPolicyId;
        bytes32 metadataHash;
        bytes32 manifestHash;
        uint64 createdAt;
        uint32 revision;
        bool active;
        bool exists;
    }

    CommonsAuthorization420 public immutable authorization;
    CommonsPolicyRegistry420 public immutable policyRegistry;
    mapping(bytes32 => Space) private _spaces;

    error ZeroAddress();
    error InvalidSpaceId();
    error SpaceAlreadyExists();
    error SpaceNotFound();
    error InvalidSpaceType();
    error InvalidVisibility();
    error InactivePolicy();
    error Unauthorized();

    event SpaceCreated(
        bytes32 indexed spaceId,
        address indexed creatorAccount,
        bytes32 spaceType,
        bytes32 visibility,
        bytes32 membershipPolicyId,
        address treasuryAccount,
        bytes32 metadataHash,
        bytes32 manifestHash,
        uint64 createdAt
    );
    event SpaceUpdated(
        bytes32 indexed spaceId,
        bytes32 visibility,
        bytes32 membershipPolicyId,
        address treasuryAccount,
        bytes32 metadataHash,
        bytes32 manifestHash,
        uint32 revision,
        bool active
    );

    constructor(address authorization_, address policyRegistry_) {
        if (authorization_ == address(0) || policyRegistry_ == address(0)) revert ZeroAddress();
        authorization = CommonsAuthorization420(authorization_);
        policyRegistry = CommonsPolicyRegistry420(policyRegistry_);
    }

    function systemName() external pure returns (string memory) { return "CommonsSpaceRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createSpace(
        bytes32 spaceId,
        bytes32 spaceType,
        bytes32 visibility,
        bytes32 membershipPolicyId,
        address treasuryAccount,
        bytes32 metadataHash,
        bytes32 manifestHash
    ) external {
        if (spaceId == bytes32(0)) revert InvalidSpaceId();
        if (_spaces[spaceId].exists) revert SpaceAlreadyExists();
        if (!_validSpaceType(spaceType)) revert InvalidSpaceType();
        if (!_validVisibility(visibility)) revert InvalidVisibility();
        if (membershipPolicyId != bytes32(0) && !policyRegistry.isActive(membershipPolicyId)) revert InactivePolicy();

        _spaces[spaceId] = Space({
            creatorAccount: msg.sender,
            treasuryAccount: treasuryAccount,
            spaceType: spaceType,
            visibility: visibility,
            membershipPolicyId: membershipPolicyId,
            metadataHash: metadataHash,
            manifestHash: manifestHash,
            createdAt: uint64(block.timestamp),
            revision: 1,
            active: true,
            exists: true
        });
        emit SpaceCreated(
            spaceId, msg.sender, spaceType, visibility, membershipPolicyId, treasuryAccount,
            metadataHash, manifestHash, uint64(block.timestamp)
        );
    }

    function updateSpace(
        bytes32 spaceId,
        bytes32 visibility,
        bytes32 membershipPolicyId,
        address treasuryAccount,
        bytes32 metadataHash,
        bytes32 manifestHash,
        bool active
    ) external {
        Space storage space = _spaces[spaceId];
        if (!space.exists) revert SpaceNotFound();
        if (!authorization.isAuthorized(spaceId, msg.sender, CommonsIds420.ACTION_UPDATE_SPACE)) revert Unauthorized();
        if (!_validVisibility(visibility)) revert InvalidVisibility();
        if (membershipPolicyId != bytes32(0) && !policyRegistry.isActive(membershipPolicyId)) revert InactivePolicy();

        space.visibility = visibility;
        space.membershipPolicyId = membershipPolicyId;
        space.treasuryAccount = treasuryAccount;
        space.metadataHash = metadataHash;
        space.manifestHash = manifestHash;
        space.revision += 1;
        space.active = active;
        emit SpaceUpdated(
            spaceId, visibility, membershipPolicyId, treasuryAccount,
            metadataHash, manifestHash, space.revision, active
        );
    }

    function getSpace(bytes32 spaceId) external view returns (Space memory space) {
        space = _spaces[spaceId];
        if (!space.exists) revert SpaceNotFound();
    }

    function spaceExists(bytes32 spaceId) external view returns (bool) { return _spaces[spaceId].exists; }
    function spaceActive(bytes32 spaceId) external view returns (bool) { return _spaces[spaceId].exists && _spaces[spaceId].active; }

    function _validSpaceType(bytes32 x) private pure returns (bool) {
        return x == CommonsIds420.SPACE_COMMUNITY || x == CommonsIds420.SPACE_ORGANIZATION
            || x == CommonsIds420.SPACE_COOPERATIVE || x == CommonsIds420.SPACE_CREATOR_COMMUNITY
            || x == CommonsIds420.SPACE_MERCHANT_GROUP || x == CommonsIds420.SPACE_PROJECT
            || x == CommonsIds420.SPACE_GUILD || x == CommonsIds420.SPACE_PRIVATE_GROUP;
    }

    function _validVisibility(bytes32 x) private pure returns (bool) {
        return x == CommonsIds420.VISIBILITY_PUBLIC || x == CommonsIds420.VISIBILITY_DISCOVERABLE_PRIVATE
            || x == CommonsIds420.VISIBILITY_INVITE_ONLY || x == CommonsIds420.VISIBILITY_HIDDEN;
    }
}
