// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./CommonsAuthorization420.sol";
import "./CommonsPolicyRegistry420.sol";
import "./CommonsSpaceRegistry420.sol";
import "./CommonsIds420.sol";

contract CommonsMembershipRegistry420 is I420System {
    enum MembershipState { NONE, PENDING, ACTIVE, SUSPENDED, LEFT, REMOVED, BANNED, EXPIRED }

    struct Membership {
        bytes32 spaceId;
        address memberAccount;
        bytes32 membershipClass;
        bytes32 policyId;
        uint64 joinedAt;
        uint64 expiresAt;
        uint32 revision;
        MembershipState state;
        bool exists;
    }

    CommonsAuthorization420 public immutable authorization;
    CommonsPolicyRegistry420 public immutable policyRegistry;
    CommonsSpaceRegistry420 public immutable spaceRegistry;

    mapping(bytes32 => mapping(address => Membership)) private _memberships;

    error ZeroAddress();
    error SpaceInactive();
    error MembershipExists();
    error MembershipNotFound();
    error InvalidMembershipState();
    error InvalidExpiry();
    error Unauthorized();
    error AdmissionRequiresExternalProof();

    event MembershipTransition(
        bytes32 indexed spaceId,
        address indexed memberAccount,
        MembershipState fromState,
        MembershipState toState,
        bytes32 membershipClass,
        bytes32 policyId,
        uint64 expiresAt,
        uint32 revision
    );

    constructor(address authorization_, address policyRegistry_, address spaceRegistry_) {
        if (authorization_ == address(0) || policyRegistry_ == address(0) || spaceRegistry_ == address(0)) {
            revert ZeroAddress();
        }
        authorization = CommonsAuthorization420(authorization_);
        policyRegistry = CommonsPolicyRegistry420(policyRegistry_);
        spaceRegistry = CommonsSpaceRegistry420(spaceRegistry_);
    }

    function systemName() external pure returns (string memory) { return "CommonsMembershipRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function requestMembership(bytes32 spaceId, bytes32 membershipClass) external {
        if (!spaceRegistry.spaceActive(spaceId)) revert SpaceInactive();
        Membership storage membership = _memberships[spaceId][msg.sender];
        if (membership.exists && membership.state != MembershipState.LEFT && membership.state != MembershipState.EXPIRED) {
            revert MembershipExists();
        }

        CommonsSpaceRegistry420.Space memory space = spaceRegistry.getSpace(spaceId);
        MembershipState nextState = MembershipState.PENDING;
        if (space.membershipPolicyId != bytes32(0)) {
            CommonsPolicyRegistry420.Policy memory policy = policyRegistry.getPolicy(space.membershipPolicyId);
            if (policy.policyType == CommonsIds420.ADMISSION_OPEN) nextState = MembershipState.ACTIVE;
            else if (policy.policyType == CommonsIds420.ADMISSION_APPROVAL_REQUIRED) nextState = MembershipState.PENDING;
            else revert AdmissionRequiresExternalProof();
        }

        MembershipState previous = membership.exists ? membership.state : MembershipState.NONE;
        uint32 revision = membership.exists ? membership.revision + 1 : 1;
        uint64 joinedAt = nextState == MembershipState.ACTIVE ? uint64(block.timestamp) : 0;
        _memberships[spaceId][msg.sender] = Membership({
            spaceId: spaceId,
            memberAccount: msg.sender,
            membershipClass: membershipClass,
            policyId: space.membershipPolicyId,
            joinedAt: joinedAt,
            expiresAt: 0,
            revision: revision,
            state: nextState,
            exists: true
        });
        emit MembershipTransition(
            spaceId, msg.sender, previous, nextState, membershipClass,
            space.membershipPolicyId, 0, revision
        );
    }

    function approveMember(bytes32 spaceId, address memberAccount, uint64 expiresAt) external {
        if (!spaceRegistry.spaceActive(spaceId)) revert SpaceInactive();
        if (!authorization.isAuthorized(spaceId, msg.sender, CommonsIds420.ACTION_APPROVE_MEMBER)) revert Unauthorized();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();
        Membership storage membership = _memberships[spaceId][memberAccount];
        if (!membership.exists) revert MembershipNotFound();
        if (membership.state != MembershipState.PENDING && membership.state != MembershipState.SUSPENDED) {
            revert InvalidMembershipState();
        }
        _transition(membership, MembershipState.ACTIVE, expiresAt);
        if (membership.joinedAt == 0) membership.joinedAt = uint64(block.timestamp);
    }

    function suspendMember(bytes32 spaceId, address memberAccount) external {
        if (!spaceRegistry.spaceActive(spaceId)) revert SpaceInactive();
        if (!authorization.isAuthorized(spaceId, msg.sender, CommonsIds420.ACTION_SUSPEND_MEMBER)) revert Unauthorized();
        Membership storage membership = _memberships[spaceId][memberAccount];
        if (!membership.exists) revert MembershipNotFound();
        if (membership.state != MembershipState.ACTIVE) revert InvalidMembershipState();
        _transition(membership, MembershipState.SUSPENDED, membership.expiresAt);
    }

    function banMember(bytes32 spaceId, address memberAccount) external {
        if (!spaceRegistry.spaceActive(spaceId)) revert SpaceInactive();
        if (!authorization.isAuthorized(spaceId, msg.sender, CommonsIds420.ACTION_BAN_MEMBER)) revert Unauthorized();
        Membership storage membership = _memberships[spaceId][memberAccount];
        if (!membership.exists) revert MembershipNotFound();
        if (membership.state == MembershipState.BANNED) revert InvalidMembershipState();
        _transition(membership, MembershipState.BANNED, 0);
    }

    function leaveSpace(bytes32 spaceId) external {
        Membership storage membership = _memberships[spaceId][msg.sender];
        if (!membership.exists) revert MembershipNotFound();
        if (membership.state != MembershipState.ACTIVE && membership.state != MembershipState.SUSPENDED) {
            revert InvalidMembershipState();
        }
        _transition(membership, MembershipState.LEFT, 0);
    }

    function expireMembership(bytes32 spaceId, address memberAccount) external {
        Membership storage membership = _memberships[spaceId][memberAccount];
        if (!membership.exists) revert MembershipNotFound();
        if (membership.state != MembershipState.ACTIVE || membership.expiresAt == 0 || block.timestamp <= membership.expiresAt) {
            revert InvalidMembershipState();
        }
        _transition(membership, MembershipState.EXPIRED, membership.expiresAt);
    }

    function getMembership(bytes32 spaceId, address memberAccount) external view returns (Membership memory membership) {
        membership = _memberships[spaceId][memberAccount];
        if (!membership.exists) revert MembershipNotFound();
    }

    function isActiveMember(bytes32 spaceId, address memberAccount) external view returns (bool) {
        Membership storage membership = _memberships[spaceId][memberAccount];
        if (!membership.exists || membership.state != MembershipState.ACTIVE) return false;
        return membership.expiresAt == 0 || block.timestamp <= membership.expiresAt;
    }

    function _transition(Membership storage membership, MembershipState nextState, uint64 expiresAt) private {
        MembershipState previous = membership.state;
        membership.state = nextState;
        membership.expiresAt = expiresAt;
        membership.revision += 1;
        emit MembershipTransition(
            membership.spaceId, membership.memberAccount, previous, nextState,
            membership.membershipClass, membership.policyId, expiresAt, membership.revision
        );
    }
}
