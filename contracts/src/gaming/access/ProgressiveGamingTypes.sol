// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Shared vocabulary for games that are fully playable without a wallet
/// while optionally exposing canonical ecosystem ownership and interoperability.
library ProgressiveGamingTypes {
    enum AccessState {
        GUEST,
        REGISTERED,
        WALLET_CONNECTED,
        ECOSYSTEM_PARTICIPANT
    }

    enum StateAuthority {
        LOCAL_GAME_STATE,
        REGISTERED_GAME_STATE,
        CANONICAL_ECOSYSTEM_STATE
    }

    enum Capability {
        CORE_GAMEPLAY,
        LOCAL_SAVE,
        CLOUD_SAVE,
        CROSS_DEVICE_RECOVERY,
        STANDARD_LEADERBOARD,
        WALLET_EXCLUSIVE_CONTENT,
        ECOSYSTEM_REWARDS,
        VERIFIED_OWNERSHIP,
        CROSS_GAME_INTEROPERABILITY,
        MAJOR_TOURNAMENTS,
        MARKETPLACE,
        GENETICS_LICENSING,
        TRANSFERABLE_ASSETS
    }
}
