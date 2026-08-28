// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./CommonsAuthorization420.sol";
import "./CommonsSpaceRegistry420.sol";
import "./CommonsIds420.sol";

contract CommonsInviteRegistry420 is I420System {
    struct Invite {
        bytes32 spaceId;
        address intendedAccount;
        bytes32 membershipClass;
        bytes32 policyId;
        uint64 createdAt;
        uint64 expiresAt;
        uint32 maxUses;
        uint32 uses;
        bool revoked;
        bool exists;
    }

    CommonsAuthorization420 public immutable authorization;
    CommonsSpaceRegistry420 public immutable spaceRegistry;

    mapping(bytes32 => Invite) private _invites;
    mapping(bytes32 => mapping(address => bool)) public redeemedBy;

    error ZeroAddress();
    error InvalidInviteId();
    error InvalidMaxUses();
    error InvalidExpiry();
    error InviteAlreadyExists();
    error InviteNotFound();
    error InviteUnavailable();
    error WrongRecipient();
    error Unauthorized();

    event InviteCreated(
        bytes32 indexed inviteId,
        bytes32 indexed spaceId,
        address indexed intendedAccount,
        bytes32 membershipClass,
        bytes32 policyId,
        uint64 createdAt,
        uint64 expiresAt,
        uint32 maxUses
    );
    event InviteRedeemed(bytes32 indexed inviteId, address indexed account, uint32 uses, uint32 maxUses);
    event InviteRevoked(bytes32 indexed inviteId, bytes32 indexed spaceId);

    constructor(address authorization_, address spaceRegistry_) {
        if (authorization_ == address(0) || spaceRegistry_ == address(0)) revert ZeroAddress();
        authorization = CommonsAuthorization420(authorization_);
        spaceRegistry = CommonsSpaceRegistry420(spaceRegistry_);
    }

    function systemName() external pure returns (string memory) { return "CommonsInviteRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createInvite(
        bytes32 inviteId,
        bytes32 spaceId,
        address intendedAccount,
        bytes32 membershipClass,
        bytes32 policyId,
        uint64 expiresAt,
        uint32 maxUses
    ) external {
        if (!authorization.isAuthorized(spaceId, msg.sender, CommonsIds420.ACTION_CREATE_INVITE)) revert Unauthorized();
        if (!spaceRegistry.spaceActive(spaceId)) revert InviteUnavailable();
        if (inviteId == bytes32(0)) revert InvalidInviteId();
        if (_invites[inviteId].exists) revert InviteAlreadyExists();
        if (maxUses == 0) revert InvalidMaxUses();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();

        _invites[inviteId] = Invite({
            spaceId: spaceId,
            intendedAccount: intendedAccount,
            membershipClass: membershipClass,
            policyId: policyId,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            maxUses: maxUses,
            uses: 0,
            revoked: false,
            exists: true
        });
        emit InviteCreated(inviteId, spaceId, intendedAccount, membershipClass, policyId, uint64(block.timestamp), expiresAt, maxUses);
    }

    function redeemInvite(bytes32 inviteId) external {
        Invite storage invite = _invites[inviteId];
        if (!invite.exists) revert InviteNotFound();
        if (invite.revoked || invite.uses >= invite.maxUses) revert InviteUnavailable();
        if (invite.expiresAt != 0 && block.timestamp > invite.expiresAt) revert InviteUnavailable();
        if (invite.intendedAccount != address(0) && invite.intendedAccount != msg.sender) revert WrongRecipient();
        if (redeemedBy[inviteId][msg.sender]) revert InviteUnavailable();

        redeemedBy[inviteId][msg.sender] = true;
        invite.uses += 1;
        emit InviteRedeemed(inviteId, msg.sender, invite.uses, invite.maxUses);
    }

    function revokeInvite(bytes32 inviteId) external {
        Invite storage invite = _invites[inviteId];
        if (!invite.exists) revert InviteNotFound();
        if (!authorization.isAuthorized(invite.spaceId, msg.sender, CommonsIds420.ACTION_REVOKE_INVITE)) revert Unauthorized();
        if (invite.revoked) revert InviteUnavailable();
        invite.revoked = true;
        emit InviteRevoked(inviteId, invite.spaceId);
    }

    function getInvite(bytes32 inviteId) external view returns (Invite memory invite) {
        invite = _invites[inviteId];
        if (!invite.exists) revert InviteNotFound();
    }
}
