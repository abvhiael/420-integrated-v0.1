// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { GameIdentity420 } from "../../gaming/GameIdentity420.sol";
import { GrowerProfileRegistry } from "../player/GrowerProfileRegistry.sol";
import { OptionalCompetitionAccess420 } from "../player/OptionalCompetitionAccess420.sol";
import { HighCountryGamingBridge420 } from "../player/HighCountryGamingBridge420.sol";
import { ICompetitionEntitlementR0412 } from "./CompetitionEngine.sol";

contract CanonicalCompetitionEntitlement is ICompetitionEntitlementR0412 {
    GrowerProfileRegistry public immutable profiles;
    OptionalCompetitionAccess420 public immutable access;
    error InvalidBinding();

    constructor(
        address profiles_,
        address access_
    ) {
        if (profiles_.code.length == 0 || access_.code.length == 0) revert InvalidBinding();
        profiles = GrowerProfileRegistry(profiles_);
        access = OptionalCompetitionAccess420(access_);
        HighCountryGamingBridge420 bridge = HighCountryGamingBridge420(address(access.gamingAccess()));
        if (address(bridge.growerProfiles()) != profiles_) revert InvalidBinding();
    }

    function eligible(
        address player,
        bytes32 scope
    ) external view returns (bool) {
        HighCountryGamingBridge420 bridge = HighCountryGamingBridge420(address(access.gamingAccess()));
        if (!GameIdentity420(address(bridge.gameIdentity())).gameRegistry().isActive(bridge.gameId())) return false;
        uint64 profile = profiles.profileIdOf(player);
        if (profile == 0 || scope == bytes32(0)) return false;
        try access.hasAccess(profile, scope) returns (bool allowed) {
            return allowed;
        } catch {
            return false;
        }
    }
}
