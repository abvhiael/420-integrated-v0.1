// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library BetTypes420 {
    uint256 internal constant BPS = 10_000;
    address internal constant NATIVE_ASSET = address(0);

    enum ProductClass {
        NONE,
        CASINO,
        SPORTSBOOK,
        FANTASY,
        POKER,
        PREDICTION
    }

    enum GameMode {
        NONE,
        INSTANT,
        SESSION,
        SHARED_ROUND,
        MARKET,
        TOURNAMENT
    }

    enum WagerStatus {
        NONE,
        ACCEPTED,
        OUTCOME_READY,
        SETTLED,
        VOID
    }

    enum TerminalOutcome {
        NONE,
        LOSS,
        PUSH,
        WIN,
        VOID
    }

    enum EmergencyDomain {
        NONE,
        NEW_WAGERS,
        GAME,
        GAME_VERSION,
        VAULT_NEW_RISK,
        RANDOMNESS_PROFILE,
        SPORTS_MARKET,
        ORACLE_PROFILE,
        FANTASY_NEW_ENTRIES,
        FANTASY_CONTEST_CREATION,
        POKER_NEW_TABLES,
        POKER_NEW_HANDS,
        POKER_TOURNAMENT_REGISTRATION,
        PREDICTION_NEW_MARKETS,
        PREDICTION_TRADING,
        PREDICTION_NEW_LIQUIDITY,
        PROMOTION,
        SETTLEMENT_HOLD
    }

    struct Wager {
        bytes32 wagerId;
        address player;
        bytes32 operatorId;
        bytes32 gameId;
        bytes32 gameVersionId;
        address asset;
        uint256 stake;
        uint256 maxGrossPayout;
        bytes32 paramsHash;
        bytes32 vaultId;
        bytes32 randomnessProfileId;
        bytes32 riskProfileId;
        bytes32 settlementProfileId;
        bytes32 accessPolicyId;
        bytes32 rulesetId;
        uint64 acceptedAt;
        uint64 deadline;
        WagerStatus status;
    }

    struct Settlement {
        bytes32 wagerId;
        TerminalOutcome outcome;
        uint256 grossPayout;
        uint64 settledAt;
    }
}
