// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ProgressiveGamingTypes } from "../../gaming/access/ProgressiveGamingTypes.sol";

contract HighCountryAccessPolicy {
    enum StateObject {
        ROUTINE_EQUIPMENT_LEVEL,
        ORDINARY_FARM_PROGRESSION,
        COMMON_INVENTORY,
        IRRIGATION_UPGRADE,
        LOCAL_MISSION_PROGRESS,
        REGISTERED_ACCOUNT_SAVE,
        REGISTERED_CLOUD_PROGRESS,
        REGISTERED_CULTIVAR,
        SIGNIFICANT_GENETIC_LINEAGE,
        CHAMPIONSHIP_RESULT,
        MARKETPLACE_ASSET,
        TRANSFERABLE_SEED_OR_CLONE,
        CROSS_GAME_ASSET,
        ECOSYSTEM_REWARD,
        SIGNIFICANT_ACHIEVEMENT,
        LICENSING_RIGHT
    }

    function canUse(ProgressiveGamingTypes.AccessState state, ProgressiveGamingTypes.Capability capability)
        external pure returns (bool)
    {
        if (capability == ProgressiveGamingTypes.Capability.CORE_GAMEPLAY || capability == ProgressiveGamingTypes.Capability.LOCAL_SAVE) return true;
        if (capability == ProgressiveGamingTypes.Capability.CLOUD_SAVE || capability == ProgressiveGamingTypes.Capability.CROSS_DEVICE_RECOVERY || capability == ProgressiveGamingTypes.Capability.STANDARD_LEADERBOARD) {
            return uint8(state) >= uint8(ProgressiveGamingTypes.AccessState.REGISTERED);
        }
        if (capability == ProgressiveGamingTypes.Capability.WALLET_EXCLUSIVE_CONTENT || capability == ProgressiveGamingTypes.Capability.ECOSYSTEM_REWARDS || capability == ProgressiveGamingTypes.Capability.VERIFIED_OWNERSHIP || capability == ProgressiveGamingTypes.Capability.CROSS_GAME_INTEROPERABILITY) {
            return uint8(state) >= uint8(ProgressiveGamingTypes.AccessState.WALLET_CONNECTED);
        }
        return state == ProgressiveGamingTypes.AccessState.ECOSYSTEM_PARTICIPANT;
    }

    function authorityFor(StateObject objectType) external pure returns (ProgressiveGamingTypes.StateAuthority) {
        if (objectType == StateObject.ROUTINE_EQUIPMENT_LEVEL || objectType == StateObject.ORDINARY_FARM_PROGRESSION || objectType == StateObject.COMMON_INVENTORY || objectType == StateObject.IRRIGATION_UPGRADE || objectType == StateObject.LOCAL_MISSION_PROGRESS) {
            return ProgressiveGamingTypes.StateAuthority.LOCAL_GAME_STATE;
        }
        if (objectType == StateObject.REGISTERED_ACCOUNT_SAVE || objectType == StateObject.REGISTERED_CLOUD_PROGRESS) {
            return ProgressiveGamingTypes.StateAuthority.REGISTERED_GAME_STATE;
        }
        return ProgressiveGamingTypes.StateAuthority.CANONICAL_ECOSYSTEM_STATE;
    }

    function walletRequiredForCoreGameplay() external pure returns (bool) { return false; }
    function walletMayGrantStatAdvantage() external pure returns (bool) { return false; }
}
