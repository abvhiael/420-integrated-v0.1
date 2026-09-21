// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HighCountryGamingBridge420 } from "../../../src/highcountry/player/HighCountryGamingBridge420.sol";
import { HighCountryGamingIds } from "../../../src/highcountry/player/HighCountryGamingIds.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";

/// @notice Probe entitlement isolation without having the fuzzer invoke unrelated
/// migration or identity-mutating bridge entrypoints with invalid arbitrary inputs.
contract ContentEntitlementInvariantHandler {
    HighCountryGamingBridge420 private immutable bridge;

    constructor(HighCountryGamingBridge420 bridge_) { bridge = bridge_; }

    // Foundry only selects non-view/non-pure functions as invariant fuzz targets.
    function stepProbeUngatedCore(uint64 playerId) external {
        require(!bridge.entitlementMayModifyCoreBalance(), "core balance affected");
        require(!bridge.coreGameplayRequiresEntitlement(), "core gameplay gated");
        require(
            !bridge.hasScopedEntitlement(
                playerId,
                keccak256("missing-entitlement"),
                HighCountryGamingIds.ENTITLEMENT_PRESTIGE_AREA,
                keccak256("breeders-district")
            ),
            "missing entitlement granted"
        );
    }
}

contract ContentEntitlementInvariantTest is InvariantTarget420 {
    HighCountryGamingBridge420 private bridge;

    function setUp() public {
        bridge = new HighCountryGamingBridge420(address(1), address(2), address(3), address(4));
        targetContract(address(new ContentEntitlementInvariantHandler(bridge)));
    }

    function invariant_HC_INV_ACCESS_026_EntitlementsCannotAlterProtectedCoreBalance() public view {
        require(!bridge.entitlementMayModifyCoreBalance(), "HC-INV-ACCESS-026: entitlement may alter core balance");
    }

    function invariant_HC_INV_ACCESS_027_GatedContentFailsClosedWithoutBlockingCorePlay() public view {
        require(!bridge.coreGameplayRequiresEntitlement(), "HC-INV-ACCESS-027: entitlement gates core gameplay");
        require(
            !bridge.hasScopedEntitlement(
                1,
                keccak256("missing-entitlement"),
                HighCountryGamingIds.ENTITLEMENT_PRESTIGE_AREA,
                keccak256("breeders-district")
            ),
            "HC-INV-ACCESS-027: missing entitlement failed open"
        );
    }

    function invariant_HC_INV_ACCESS_028_EntitlementIdentityIsStableAndDomainSeparated() public pure {
        require(
            HighCountryGamingIds.ENTITLEMENT_BONUS_REGION == keccak256("420/HC/ENTITLEMENT/BONUS_REGION/V1"),
            "HC-INV-ACCESS-028: bonus region id drift"
        );
        require(
            HighCountryGamingIds.ENTITLEMENT_SPECIAL_FACILITY == keccak256("420/HC/ENTITLEMENT/SPECIAL_FACILITY/V1"),
            "HC-INV-ACCESS-028: facility id drift"
        );
        require(
            HighCountryGamingIds.ENTITLEMENT_CROSS_GAME == keccak256("420/HC/ENTITLEMENT/CROSS_GAME/V1"),
            "HC-INV-ACCESS-028: cross-game id drift"
        );
    }
}
