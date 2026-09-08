// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCInvalidRegion, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { IHighCountryGamingAccess420 } from "../player/IHighCountryGamingAccess420.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract BonusRegionAccess420 {
    struct BonusRegion {
        uint16 regionId;
        bytes32 entitlementId;
        bytes32 contentId;
        bool active;
        bool exists;
    }

    uint16 public constant FOUNDING_REGION_COUNT = 3;

    IHighCountryAuthorization public immutable authorization;
    IHighCountryGamingAccess420 public immutable gamingAccess;

    mapping(uint16 => BonusRegion) private _bonusRegions;

    error BonusRegionInactive(uint16 regionId);
    error BonusRegionEntitlementRequired(uint16 regionId, uint64 growerProfileId);

    event BonusRegionRegistered(uint16 indexed regionId, bytes32 indexed entitlementId, bytes32 indexed contentId);
    event BonusRegionStatusChanged(uint16 indexed regionId, bool active);

    constructor(address authorization_, address gamingAccess_) {
        if (authorization_ == address(0) || gamingAccess_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        gamingAccess = IHighCountryGamingAccess420(gamingAccess_);
    }

    function registerBonusRegion(uint16 regionId, bytes32 entitlementId, bytes32 contentId) external {
        if (regionId <= FOUNDING_REGION_COUNT) revert HCInvalidRegion(regionId);
        if (entitlementId == bytes32(0) || contentId == bytes32(0)) revert HCInvalidRegion(regionId);
        if (_bonusRegions[regionId].exists) revert HCAlreadyExists();

        _requireAuthorized(ActionIds.BONUS_REGION_REGISTER, regionId);

        _bonusRegions[regionId] = BonusRegion({
            regionId: regionId,
            entitlementId: entitlementId,
            contentId: contentId,
            active: true,
            exists: true
        });
        emit BonusRegionRegistered(regionId, entitlementId, contentId);
    }

    function setBonusRegionStatus(uint16 regionId, bool active) external {
        BonusRegion storage region = _bonusRegions[regionId];
        if (!region.exists) revert HCNotFound();
        _requireAuthorized(ActionIds.BONUS_REGION_SET_STATUS, regionId);
        region.active = active;
        emit BonusRegionStatusChanged(regionId, active);
    }

    function getBonusRegion(uint16 regionId) external view returns (BonusRegion memory) {
        BonusRegion memory region = _bonusRegions[regionId];
        if (!region.exists) revert HCNotFound();
        return region;
    }

    function hasAccess(uint64 growerProfileId, uint16 regionId) public view returns (bool) {
        BonusRegion memory region = _bonusRegions[regionId];
        if (!region.exists || !region.active) return false;
        return gamingAccess.hasBonusRegion(growerProfileId, region.entitlementId, region.contentId);
    }

    function requireAccess(uint64 growerProfileId, uint16 regionId) external view {
        BonusRegion memory region = _bonusRegions[regionId];
        if (!region.exists) revert HCNotFound();
        if (!region.active) revert BonusRegionInactive(regionId);
        if (!gamingAccess.hasBonusRegion(growerProfileId, region.entitlementId, region.contentId)) {
            revert BonusRegionEntitlementRequired(regionId, growerProfileId);
        }
    }

    function _requireAuthorized(bytes32 actionId, uint16 regionId) private view {
        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.REGION_REGISTRY,
                actionId: actionId,
                scopeHash: bytes32(uint256(regionId)),
                amount: 0
            })
        );
    }
}
