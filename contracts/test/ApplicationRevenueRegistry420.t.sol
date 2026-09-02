// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/revenue/ApplicationRevenueRegistry420.sol";
import "../src/revenue/ApplicationRevenueIds420.sol";

contract MockCapabilityRegistryApplicationRevenue420 is ICapabilityRegistry420 {
    address public allowedPrincipal;
    bytes32 public allowedApplicationId;
    bool public enabled = true;

    function setGrant(address principal, bytes32 applicationId) external {
        allowedPrincipal = principal;
        allowedApplicationId = applicationId;
    }

    function setEnabled(bool enabled_) external { enabled = enabled_; }

    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256
    ) external view override returns (bool) {
        bool validAction = capabilityId == ApplicationRevenueIds420.ACTION_SET_PROFILE
            || capabilityId == ApplicationRevenueIds420.ACTION_DEACTIVATE_PROFILE;
        return enabled && principal == allowedPrincipal
            && componentId == ApplicationRevenueIds420.COMPONENT_APPLICATION_REVENUE
            && validAction
            && scopeHash == ApplicationRevenueIds420.scopeApplication(allowedApplicationId);
    }
}

contract ApplicationRevenueRegistry420Test {
    bytes32 private constant APP_ID = keccak256("420/app/third-party/example/v1");
    bytes32 private constant OTHER_APP_ID = keccak256("420/app/other/v1");
    bytes32 private constant POLICY_ID = keccak256("420/revenue/policy/example/v1");

    MockCapabilityRegistryApplicationRevenue420 private caps;
    ApplicationRevenueRegistry420 private registry;
    address private treasury = address(0xBEEF420);

    constructor() {
        caps = new MockCapabilityRegistryApplicationRevenue420();
        registry = new ApplicationRevenueRegistry420(address(caps));
        caps.setGrant(address(this), APP_ID);
    }

    function testRegistersCreatorTreasury() public {
        registry.setRevenueProfile(
            APP_ID,
            treasury,
            address(this),
            POLICY_ID,
            ApplicationRevenueIds420.TREASURY_VAULT,
            7_500,
            keccak256("metadata-v1")
        );
        ApplicationRevenueRegistry420.RevenueProfile memory profile = registry.getRevenueProfile(APP_ID);
        require(profile.creatorTreasury == treasury, "treasury");
        require(profile.creatorAccount == address(this), "creator");
        require(profile.creatorShareBps == 7_500, "share");
        require(profile.active && profile.exists, "status");
        require(profile.revision == 1, "revision");

        (address resolved, uint16 bps, bytes32 policy) = registry.resolveCreatorTreasury(APP_ID);
        require(resolved == treasury && bps == 7_500 && policy == POLICY_ID, "resolve");
    }

    function testAllowsFullCreatorShareForThirdPartyEconomics() public {
        registry.setRevenueProfile(
            APP_ID,
            treasury,
            address(this),
            POLICY_ID,
            ApplicationRevenueIds420.TREASURY_SMART_ACCOUNT,
            10_000,
            bytes32(0)
        );
        require(registry.getRevenueProfile(APP_ID).creatorShareBps == 10_000, "100 percent creator share");
    }

    function testRejectsShareAboveOneHundredPercent() public {
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.setRevenueProfile.selector,
                APP_ID,
                treasury,
                address(this),
                POLICY_ID,
                ApplicationRevenueIds420.TREASURY_CONTRACT,
                uint16(10_001),
                bytes32(0)
            )
        );
        require(!ok, "invalid share accepted");
    }

    function testCannotEditAnotherApplicationWithoutScopedCapability() public {
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.setRevenueProfile.selector,
                OTHER_APP_ID,
                treasury,
                address(this),
                POLICY_ID,
                ApplicationRevenueIds420.TREASURY_VAULT,
                uint16(1_000),
                bytes32(0)
            )
        );
        require(!ok, "cross-app edit accepted");
    }

    function testCanUpdateAndDeactivateOwnProfile() public {
        registry.setRevenueProfile(
            APP_ID,
            treasury,
            address(this),
            POLICY_ID,
            ApplicationRevenueIds420.TREASURY_VAULT,
            5_000,
            bytes32(0)
        );
        address nextTreasury = address(0xCAFE420);
        registry.setRevenueProfile(
            APP_ID,
            nextTreasury,
            address(this),
            POLICY_ID,
            ApplicationRevenueIds420.TREASURY_SMART_ACCOUNT,
            6_000,
            keccak256("metadata-v2")
        );
        ApplicationRevenueRegistry420.RevenueProfile memory updated = registry.getRevenueProfile(APP_ID);
        require(updated.creatorTreasury == nextTreasury && updated.revision == 2, "update");

        registry.deactivateRevenueProfile(APP_ID);
        ApplicationRevenueRegistry420.RevenueProfile memory stopped = registry.getRevenueProfile(APP_ID);
        require(!stopped.active && stopped.revision == 3, "deactivate");
        (bool ok,) = address(registry).call(abi.encodeWithSelector(registry.resolveCreatorTreasury.selector, APP_ID));
        require(!ok, "inactive profile resolved");
    }

    function testCapabilityRevocationFailsClosed() public {
        caps.setEnabled(false);
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.setRevenueProfile.selector,
                APP_ID,
                treasury,
                address(this),
                POLICY_ID,
                ApplicationRevenueIds420.TREASURY_VAULT,
                uint16(1_000),
                bytes32(0)
            )
        );
        require(!ok, "revoked capability accepted");
    }
}
