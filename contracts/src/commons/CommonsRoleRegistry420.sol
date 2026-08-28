// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./CommonsAuthorization420.sol";
import "./CommonsSpaceRegistry420.sol";
import "./CommonsIds420.sol";

contract CommonsRoleRegistry420 is I420System {
    uint8 public constant MAX_CAPABILITIES_PER_ROLE = 16;

    struct Role {
        bytes32 metadataHash;
        uint32 revision;
        bool active;
        bool exists;
    }

    CommonsAuthorization420 public immutable authorization;
    CommonsSpaceRegistry420 public immutable spaceRegistry;

    mapping(bytes32 => mapping(bytes32 => Role)) private _roles;
    mapping(bytes32 => mapping(bytes32 => bytes32[])) private _roleCapabilities;
    mapping(bytes32 => mapping(address => mapping(bytes32 => bool))) public memberRole;

    error ZeroAddress();
    error SpaceNotFound();
    error InvalidRoleId();
    error RoleNotFound();
    error TooManyCapabilities();
    error InvalidCapabilityId();
    error Unauthorized();

    event RoleConfigured(bytes32 indexed spaceId, bytes32 indexed roleId, bytes32 metadataHash, uint32 revision, bool active);
    event RoleCapabilitiesConfigured(bytes32 indexed spaceId, bytes32 indexed roleId, bytes32 capabilitiesHash, uint32 revision);
    event MemberRoleSet(bytes32 indexed spaceId, address indexed memberAccount, bytes32 indexed roleId, bool assigned);

    constructor(address authorization_, address spaceRegistry_) {
        if (authorization_ == address(0) || spaceRegistry_ == address(0)) revert ZeroAddress();
        authorization = CommonsAuthorization420(authorization_);
        spaceRegistry = CommonsSpaceRegistry420(spaceRegistry_);
    }

    function systemName() external pure returns (string memory) { return "CommonsRoleRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function configureRole(bytes32 spaceId, bytes32 roleId, bytes32 metadataHash, bytes32[] calldata capabilities, bool active) external {
        if (!spaceRegistry.spaceExists(spaceId)) revert SpaceNotFound();
        if (!authorization.isAuthorized(spaceId, msg.sender, CommonsIds420.ACTION_ASSIGN_ROLE)) revert Unauthorized();
        if (roleId == bytes32(0)) revert InvalidRoleId();
        if (capabilities.length > MAX_CAPABILITIES_PER_ROLE) revert TooManyCapabilities();
        for (uint256 i = 0; i < capabilities.length; ++i) {
            if (capabilities[i] == bytes32(0)) revert InvalidCapabilityId();
        }

        Role storage role = _roles[spaceId][roleId];
        role.metadataHash = metadataHash;
        role.revision = role.exists ? role.revision + 1 : 1;
        role.active = active;
        role.exists = true;
        delete _roleCapabilities[spaceId][roleId];
        for (uint256 i = 0; i < capabilities.length; ++i) _roleCapabilities[spaceId][roleId].push(capabilities[i]);

        emit RoleConfigured(spaceId, roleId, metadataHash, role.revision, active);
        emit RoleCapabilitiesConfigured(spaceId, roleId, keccak256(abi.encode(capabilities)), role.revision);
    }

    function setMemberRole(bytes32 spaceId, address memberAccount, bytes32 roleId, bool assigned) external {
        if (!authorization.isAuthorized(spaceId, msg.sender, CommonsIds420.ACTION_ASSIGN_ROLE)) revert Unauthorized();
        Role storage role = _roles[spaceId][roleId];
        if (!role.exists || !role.active) revert RoleNotFound();
        memberRole[spaceId][memberAccount][roleId] = assigned;
        emit MemberRoleSet(spaceId, memberAccount, roleId, assigned);
    }

    function getRole(bytes32 spaceId, bytes32 roleId) external view returns (Role memory role) {
        role = _roles[spaceId][roleId];
        if (!role.exists) revert RoleNotFound();
    }

    function roleCapabilities(bytes32 spaceId, bytes32 roleId) external view returns (bytes32[] memory) {
        if (!_roles[spaceId][roleId].exists) revert RoleNotFound();
        return _roleCapabilities[spaceId][roleId];
    }
}
