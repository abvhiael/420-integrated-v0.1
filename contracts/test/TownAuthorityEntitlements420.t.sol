// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/town/TownAuthority420.sol";

interface VmTownAuthorityEntitlements420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract TownAuthorityEntitlements420Test {
    VmTownAuthorityEntitlements420 constant vm =
        VmTownAuthorityEntitlements420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OWNER = address(0x4221);
    address constant USER = address(0x4222);
    address constant OUTSIDER = address(0x4223);
    bytes32 constant COMMUNITY = keccak256("town-community-entitlements");
    bytes32 constant PLAN = keccak256("supporter");
    bytes32 constant ENTITLEMENT = keccak256("private-room");

    TownAuthority420 town;

    function setUp() public {
        town = new TownAuthority420();
        vm.prank(OWNER);
        town.createCommunity(COMMUNITY, keccak256("meta"), bytes32(0), address(0));
        vm.prank(USER);
        town.joinCommunity(COMMUNITY);
    }

    function testOnlyAuthorizedActorCanActivateSubscription() public {
        vm.prank(OUTSIDER);
        vm.expectRevert(TownAuthority420.Unauthorized.selector);
        town.activateSubscription(COMMUNITY, USER, PLAN, 0);

        vm.prank(OWNER);
        town.activateSubscription(COMMUNITY, USER, PLAN, 0);
        require(town.subscriptionActive(COMMUNITY, USER), "active subscription");
        TownAuthority420.Subscription memory s = town.subscription(COMMUNITY, USER);
        require(s.revision == 1, "revision one");
    }

    function testSubscriptionLifecycleIsExplicitAndReplayResistantByState() public {
        vm.prank(OWNER);
        town.activateSubscription(COMMUNITY, USER, PLAN, 0);

        vm.prank(OWNER);
        vm.expectRevert(TownAuthority420.InvalidTransition.selector);
        town.activateSubscription(COMMUNITY, USER, PLAN, 0);

        vm.prank(USER);
        town.cancelSubscription(COMMUNITY, USER);
        require(!town.subscriptionActive(COMMUNITY, USER), "cancelled");
        TownAuthority420.Subscription memory cancelled = town.subscription(COMMUNITY, USER);
        require(cancelled.revision == 2, "cancel revision");

        vm.prank(OWNER);
        town.activateSubscription(COMMUNITY, USER, PLAN, 0);
        TownAuthority420.Subscription memory reactivated = town.subscription(COMMUNITY, USER);
        require(reactivated.revision == 3, "reactivation revision");
    }

    function testSubscriptionExpiryCanBeMaterializedAfterDeadline() public {
        uint64 expiry = uint64(block.timestamp + 100);
        vm.prank(OWNER);
        town.activateSubscription(COMMUNITY, USER, PLAN, expiry);
        vm.warp(expiry);
        require(!town.subscriptionActive(COMMUNITY, USER), "effective expiry");

        town.expireSubscription(COMMUNITY, USER);
        TownAuthority420.Subscription memory s = town.subscription(COMMUNITY, USER);
        require(s.state == TownAuthority420.SubscriptionState.EXPIRED, "materialized");
    }

    function testEntitlementGrantRevokeAndExpiry() public {
        vm.prank(OWNER);
        town.grantEntitlement(COMMUNITY, USER, ENTITLEMENT, 0);
        require(town.entitlementActive(COMMUNITY, USER, ENTITLEMENT), "entitlement active");

        vm.prank(OWNER);
        town.revokeEntitlement(COMMUNITY, USER, ENTITLEMENT);
        require(!town.entitlementActive(COMMUNITY, USER, ENTITLEMENT), "revoked");
        TownAuthority420.Entitlement memory revoked = town.entitlement(COMMUNITY, USER, ENTITLEMENT);
        require(revoked.revision == 2, "revision");

        uint64 expiry = uint64(block.timestamp + 50);
        vm.prank(OWNER);
        town.grantEntitlement(COMMUNITY, USER, ENTITLEMENT, expiry);
        vm.warp(expiry);
        require(!town.entitlementActive(COMMUNITY, USER, ENTITLEMENT), "effective entitlement expiry");
        town.expireEntitlement(COMMUNITY, USER, ENTITLEMENT);
        TownAuthority420.Entitlement memory expired = town.entitlement(COMMUNITY, USER, ENTITLEMENT);
        require(expired.state == TownAuthority420.EntitlementState.EXPIRED, "expired");
    }

    function testNonMemberCannotReceiveSubscriptionOrEntitlement() public {
        vm.prank(OWNER);
        vm.expectRevert(TownAuthority420.InvalidTransition.selector);
        town.activateSubscription(COMMUNITY, OUTSIDER, PLAN, 0);

        vm.prank(OWNER);
        vm.expectRevert(TownAuthority420.InvalidTransition.selector);
        town.grantEntitlement(COMMUNITY, OUTSIDER, ENTITLEMENT, 0);
    }
}
