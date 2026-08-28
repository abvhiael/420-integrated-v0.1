// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/commons/CommonsIds420.sol";
import "../src/commons/CommonsAuthorization420.sol";
import "../src/commons/CommonsPolicyRegistry420.sol";
import "../src/commons/CommonsSpaceRegistry420.sol";
import "../src/commons/CommonsMembershipRegistry420.sol";
import "../src/commons/CommonsRoleRegistry420.sol";
import "../src/commons/CommonsChannelRegistry420.sol";
import "../src/commons/CommonsInviteRegistry420.sol";
import "../src/commons/CommonsRouter420.sol";

interface VmCommons420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistry420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _authorized;

    function setAuthorized(address principal, bytes32 capabilityId, bytes32 scopeHash, bool allowed) external {
        _authorized[keccak256(abi.encode(principal, CommonsIds420.COMPONENT_COMMONS, capabilityId, scopeHash, uint256(0)))] = allowed;
    }

    function grant(bytes32) external pure returns (CapabilityGrant memory out) { return out; }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount
    ) external view returns (bool) {
        return _authorized[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract Commons420Test {
    VmCommons420 internal constant vm = VmCommons420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant CREATOR = address(0xC001);
    address internal constant ADMIN = address(0xAD01);
    address internal constant MEMBER = address(0xBEEF);
    address internal constant OTHER = address(0xCAFE);

    bytes32 internal constant SPACE = keccak256("commons-space-a");
    bytes32 internal constant SPACE_B = keccak256("commons-space-b");
    bytes32 internal constant OPEN_POLICY = keccak256("commons-open-policy");
    bytes32 internal constant APPROVAL_POLICY = keccak256("commons-approval-policy");
    bytes32 internal constant ROLE_MOD = keccak256("moderator-role");

    struct Suite {
        MockCapabilityRegistry420 capabilities;
        CommonsAuthorization420 authorization;
        CommonsPolicyRegistry420 policy;
        CommonsSpaceRegistry420 spaces;
        CommonsMembershipRegistry420 memberships;
        CommonsRoleRegistry420 roles;
        CommonsChannelRegistry420 channels;
        CommonsInviteRegistry420 invites;
        CommonsRouter420 router;
    }

    function _deploy() private returns (Suite memory suite) {
        suite.capabilities = new MockCapabilityRegistry420();
        suite.authorization = new CommonsAuthorization420(address(suite.capabilities));
        suite.policy = new CommonsPolicyRegistry420(address(this));
        suite.spaces = new CommonsSpaceRegistry420(address(suite.authorization), address(suite.policy));
        suite.memberships = new CommonsMembershipRegistry420(address(suite.authorization), address(suite.policy), address(suite.spaces));
        suite.roles = new CommonsRoleRegistry420(address(suite.authorization), address(suite.spaces));
        suite.channels = new CommonsChannelRegistry420(address(suite.authorization), address(suite.policy), address(suite.spaces));
        suite.invites = new CommonsInviteRegistry420(address(suite.authorization), address(suite.spaces));
        suite.router = new CommonsRouter420(address(suite.authorization), address(suite.spaces), address(suite.memberships));

        suite.policy.setPolicy(OPEN_POLICY, CommonsIds420.ADMISSION_OPEN, keccak256("open-v1"), bytes32(0), true);
        suite.policy.setPolicy(APPROVAL_POLICY, CommonsIds420.ADMISSION_APPROVAL_REQUIRED, keccak256("approval-v1"), bytes32(0), true);
        vm.warp(1_000);
    }

    function _createSpace(Suite memory suite, bytes32 spaceId, bytes32 policyId) private {
        vm.prank(CREATOR);
        suite.spaces.createSpace(
            spaceId,
            CommonsIds420.SPACE_COMMUNITY,
            CommonsIds420.VISIBILITY_PUBLIC,
            policyId,
            address(0x420),
            keccak256("meta"),
            keccak256("manifest")
        );
    }

    function _grant(Suite memory suite, bytes32 spaceId, address principal, bytes32 actionId) private {
        suite.capabilities.setAuthorized(principal, actionId, suite.authorization.scopeForSpace(spaceId), true);
    }

    function testSpaceIdCannotBeReassigned() public {
        Suite memory suite = _deploy();
        _createSpace(suite, SPACE, OPEN_POLICY);
        vm.prank(OTHER);
        vm.expectRevert(CommonsSpaceRegistry420.SpaceAlreadyExists.selector);
        suite.spaces.createSpace(SPACE, CommonsIds420.SPACE_PROJECT, CommonsIds420.VISIBILITY_HIDDEN, OPEN_POLICY, address(0), bytes32(0), bytes32(0));
    }

    function testCreatorHasNoImplicitAdminAuthority() public {
        Suite memory suite = _deploy();
        _createSpace(suite, SPACE, OPEN_POLICY);
        vm.prank(CREATOR);
        vm.expectRevert(CommonsSpaceRegistry420.Unauthorized.selector);
        suite.spaces.updateSpace(SPACE, CommonsIds420.VISIBILITY_HIDDEN, OPEN_POLICY, address(0), bytes32(0), bytes32(0), true);
    }

    function testCapabilityIsSpaceScoped() public {
        Suite memory suite = _deploy();
        _createSpace(suite, SPACE, OPEN_POLICY);
        _createSpace(suite, SPACE_B, OPEN_POLICY);
        _grant(suite, SPACE, ADMIN, CommonsIds420.ACTION_UPDATE_SPACE);

        vm.prank(ADMIN);
        suite.spaces.updateSpace(SPACE, CommonsIds420.VISIBILITY_HIDDEN, OPEN_POLICY, address(0x421), keccak256("a"), keccak256("b"), true);

        vm.prank(ADMIN);
        vm.expectRevert(CommonsSpaceRegistry420.Unauthorized.selector);
        suite.spaces.updateSpace(SPACE_B, CommonsIds420.VISIBILITY_HIDDEN, OPEN_POLICY, address(0), bytes32(0), bytes32(0), true);
    }

    function testOpenMembershipActivatesWithoutAdmin() public {
        Suite memory suite = _deploy();
        _createSpace(suite, SPACE, OPEN_POLICY);
        vm.prank(MEMBER);
        suite.memberships.requestMembership(SPACE, keccak256("member"));
        require(suite.memberships.isActiveMember(SPACE, MEMBER), "open member inactive");
    }

    function testApprovalMembershipDefaultsPending() public {
        Suite memory suite = _deploy();
        _createSpace(suite, SPACE, APPROVAL_POLICY);
        vm.prank(MEMBER);
        suite.memberships.requestMembership(SPACE, keccak256("member"));
        require(!suite.memberships.isActiveMember(SPACE, MEMBER), "pending member active");

        vm.prank(ADMIN);
        vm.expectRevert(CommonsMembershipRegistry420.Unauthorized.selector);
        suite.memberships.approveMember(SPACE, MEMBER, 0);

        _grant(suite, SPACE, ADMIN, CommonsIds420.ACTION_APPROVE_MEMBER);
        vm.prank(ADMIN);
        suite.memberships.approveMember(SPACE, MEMBER, 0);
        require(suite.memberships.isActiveMember(SPACE, MEMBER), "approved member inactive");
    }

    function testRoleLabelDoesNotCreateAuthority() public {
        Suite memory suite = _deploy();
        _createSpace(suite, SPACE, OPEN_POLICY);
        _grant(suite, SPACE, ADMIN, CommonsIds420.ACTION_ASSIGN_ROLE);
        bytes32[] memory caps = new bytes32[](1);
        caps[0] = CommonsIds420.ACTION_UPDATE_SPACE;
        vm.prank(ADMIN);
        suite.roles.configureRole(SPACE, ROLE_MOD, keccak256("moderator"), caps, true);
        vm.prank(ADMIN);
        suite.roles.setMemberRole(SPACE, MEMBER, ROLE_MOD, true);

        vm.prank(MEMBER);
        vm.expectRevert(CommonsSpaceRegistry420.Unauthorized.selector);
        suite.spaces.updateSpace(SPACE, CommonsIds420.VISIBILITY_HIDDEN, OPEN_POLICY, address(0), bytes32(0), bytes32(0), true);
    }

    function testInviteUseAndRecipientAreBounded() public {
        Suite memory suite = _deploy();
        _createSpace(suite, SPACE, OPEN_POLICY);
        _grant(suite, SPACE, ADMIN, CommonsIds420.ACTION_CREATE_INVITE);
        bytes32 inviteId = keccak256("invite-1");
        vm.prank(ADMIN);
        suite.invites.createInvite(inviteId, SPACE, MEMBER, keccak256("member"), OPEN_POLICY, 1_100, 1);

        vm.prank(OTHER);
        vm.expectRevert(CommonsInviteRegistry420.WrongRecipient.selector);
        suite.invites.redeemInvite(inviteId);

        vm.prank(MEMBER);
        suite.invites.redeemInvite(inviteId);
        vm.prank(MEMBER);
        vm.expectRevert(CommonsInviteRegistry420.InviteUnavailable.selector);
        suite.invites.redeemInvite(inviteId);
    }

    function testCanonicalRouterReadsSpaceAndMembership() public {
        Suite memory suite = _deploy();
        _createSpace(suite, SPACE, OPEN_POLICY);
        vm.prank(MEMBER);
        suite.memberships.requestMembership(SPACE, keccak256("member"));

        ICommons420.SpaceRead memory space = suite.router.readSpace(SPACE);
        ICommons420.MembershipRead memory membership = suite.router.readMembership(SPACE, MEMBER);
        require(space.creatorAccount == CREATOR && space.active, "space read");
        require(membership.activeNow, "membership read");
    }
}
