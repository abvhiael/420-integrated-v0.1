// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { BonusRegionAccess420 } from "../../../../src/highcountry/world/BonusRegionAccess420.sol";
import { IHighCountryAuthorization } from "../../../../src/highcountry/interfaces/IHighCountryAuthorization.sol";
import { IHighCountryGamingAccess420 } from "../../../../src/highcountry/player/IHighCountryGamingAccess420.sol";
import { AuthorizationRequest } from "../../../../src/highcountry/types/HighCountryTypes.sol";

contract MockHCAuthorizationBonusRegion is IHighCountryAuthorization {
    bool public allowed = true;

    function setAllowed(bool allowed_) external { allowed = allowed_; }
    function capabilityRegistry() external pure returns (address) { return address(1); }
    function isAuthorized(AuthorizationRequest calldata) external view returns (bool) { return allowed; }
    function requireAuthorized(AuthorizationRequest calldata) external view { require(allowed, "unauthorized"); }
}

contract MockHCGamingAccessBonusRegion is IHighCountryGamingAccess420 {
    mapping(bytes32 => bool) internal bonusAccess;

    function setBonusRegion(uint64 growerProfileId, bytes32 entitlementId, bytes32 contentId, bool allowed) external {
        bonusAccess[keccak256(abi.encode(growerProfileId, entitlementId, contentId))] = allowed;
    }

    function hasScopedEntitlement(uint64, bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function requireScopedEntitlement(uint64, bytes32, bytes32, bytes32) external pure { revert("unused"); }

    function hasBonusRegion(uint64 growerProfileId, bytes32 entitlementId, bytes32 regionContentId)
        external
        view
        returns (bool)
    {
        return bonusAccess[keccak256(abi.encode(growerProfileId, entitlementId, regionContentId))];
    }

    function hasCosmetic(uint64, bytes32, bytes32) external pure returns (bool) { return false; }
    function hasCompetitionAccess(uint64, bytes32, bytes32) external pure returns (bool) { return false; }
    function hasGeneticsAccess(uint64, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract BonusRegionAccess420Test {
    MockHCAuthorizationBonusRegion internal authorization;
    MockHCGamingAccessBonusRegion internal gamingAccess;
    BonusRegionAccess420 internal bonusRegions;

    bytes32 internal constant ENTITLEMENT_ID = keccak256("breeders-district-entitlement");
    bytes32 internal constant CONTENT_ID = keccak256("breeders-district-content");
    uint64 internal constant GROWER_PROFILE_ID = 7;
    uint16 internal constant BONUS_REGION_ID = 4;

    function setUp() public {
        authorization = new MockHCAuthorizationBonusRegion();
        gamingAccess = new MockHCGamingAccessBonusRegion();
        bonusRegions = new BonusRegionAccess420(address(authorization), address(gamingAccess));
    }

    function _registerBonusRegion() internal {
        bonusRegions.registerBonusRegion(BONUS_REGION_ID, ENTITLEMENT_ID, CONTENT_ID);
    }

    function testFoundingRegionsCannotBecomeWalletGatedBonusRegions() public {
        (bool ok,) = address(bonusRegions).call(
            abi.encodeWithSelector(bonusRegions.registerBonusRegion.selector, uint16(3), ENTITLEMENT_ID, CONTENT_ID)
        );
        require(!ok, "founding region was wallet gated");
    }

    function testBonusRegionAccessUsesGamingEntitlement() public {
        _registerBonusRegion();
        require(!bonusRegions.hasAccess(GROWER_PROFILE_ID, BONUS_REGION_ID), "missing entitlement accepted");

        gamingAccess.setBonusRegion(GROWER_PROFILE_ID, ENTITLEMENT_ID, CONTENT_ID, true);
        require(bonusRegions.hasAccess(GROWER_PROFILE_ID, BONUS_REGION_ID), "valid entitlement rejected");
        bonusRegions.requireAccess(GROWER_PROFILE_ID, BONUS_REGION_ID);
    }

    function testRequireAccessFailsClosedWithoutEntitlement() public {
        _registerBonusRegion();
        (bool ok,) = address(bonusRegions).call(
            abi.encodeWithSelector(bonusRegions.requireAccess.selector, GROWER_PROFILE_ID, BONUS_REGION_ID)
        );
        require(!ok, "bonus region opened without entitlement");
    }

    function testInactiveBonusRegionFailsClosedEvenWithEntitlement() public {
        _registerBonusRegion();
        gamingAccess.setBonusRegion(GROWER_PROFILE_ID, ENTITLEMENT_ID, CONTENT_ID, true);
        bonusRegions.setBonusRegionStatus(BONUS_REGION_ID, false);

        require(!bonusRegions.hasAccess(GROWER_PROFILE_ID, BONUS_REGION_ID), "inactive region reported accessible");
        (bool ok,) = address(bonusRegions).call(
            abi.encodeWithSelector(bonusRegions.requireAccess.selector, GROWER_PROFILE_ID, BONUS_REGION_ID)
        );
        require(!ok, "inactive region opened");
    }

    function testBonusRegionAdministrationIsCapabilityAuthorized() public {
        authorization.setAllowed(false);
        (bool ok,) = address(bonusRegions).call(
            abi.encodeWithSelector(bonusRegions.registerBonusRegion.selector, BONUS_REGION_ID, ENTITLEMENT_ID, CONTENT_ID)
        );
        require(!ok, "unauthorized bonus region registered");
    }
}
