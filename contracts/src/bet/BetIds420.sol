// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library BetIds420 {
    bytes32 internal constant COMPONENT_BET = keccak256("420.BET.CORE");

    // Player economic actions.
    bytes32 internal constant ACTION_PLACE = keccak256("BET_PLACE");
    bytes32 internal constant ACTION_GAME_ACTION = keccak256("BET_GAME_ACTION");
    bytes32 internal constant ACTION_GAME_ADD_STAKE = keccak256("BET_GAME_ADD_STAKE");
    bytes32 internal constant ACTION_ACCEPT_CASHOUT = keccak256("BET_ACCEPT_CASHOUT");
    bytes32 internal constant ACTION_CLAIM_REWARD = keccak256("BET_CLAIM_REWARD");
    bytes32 internal constant ACTION_CLAIM_PROMOTION = keccak256("BET_CLAIM_PROMOTION");
    bytes32 internal constant ACTION_CLAIM_FEE = keccak256("BET_CLAIM_FEE");
    bytes32 internal constant ACTION_CLAIM_JACKPOT = keccak256("BET_CLAIM_JACKPOT");

    // Poker actions.
    bytes32 internal constant ACTION_POKER_BUY_IN = keccak256("BET_POKER_BUY_IN");
    bytes32 internal constant ACTION_POKER_TOP_UP = keccak256("BET_POKER_TOP_UP");
    bytes32 internal constant ACTION_POKER_ACTION = keccak256("BET_POKER_ACTION");
    bytes32 internal constant ACTION_POKER_SIT_OUT = keccak256("BET_POKER_SIT_OUT");
    bytes32 internal constant ACTION_POKER_LEAVE = keccak256("BET_POKER_LEAVE");
    bytes32 internal constant ACTION_POKER_WITHDRAW = keccak256("BET_POKER_WITHDRAW");
    bytes32 internal constant ACTION_POKER_TOURNAMENT_ENTER = keccak256("BET_POKER_TOURNAMENT_ENTER");

    // Fantasy actions.
    bytes32 internal constant ACTION_FANTASY_ENTER = keccak256("BET_FANTASY_ENTER");

    // Prediction-market player actions.
    bytes32 internal constant ACTION_PREDICTION_SPLIT = keccak256("BET_PREDICTION_SPLIT");
    bytes32 internal constant ACTION_PREDICTION_MERGE = keccak256("BET_PREDICTION_MERGE");
    bytes32 internal constant ACTION_PREDICTION_TRADE = keccak256("BET_PREDICTION_TRADE");
    bytes32 internal constant ACTION_PREDICTION_ADD_LIQUIDITY = keccak256("BET_PREDICTION_ADD_LIQUIDITY");
    bytes32 internal constant ACTION_PREDICTION_REMOVE_LIQUIDITY = keccak256("BET_PREDICTION_REMOVE_LIQUIDITY");
    bytes32 internal constant ACTION_PREDICTION_REDEEM = keccak256("BET_PREDICTION_REDEEM");

    // LP / responsible-gaming actions.
    bytes32 internal constant ACTION_LP_DEPOSIT = keccak256("BET_LP_DEPOSIT");
    bytes32 internal constant ACTION_LP_REQUEST_WITHDRAWAL = keccak256("BET_LP_REQUEST_WITHDRAWAL");
    bytes32 internal constant ACTION_LP_CLAIM_WITHDRAWAL = keccak256("BET_LP_CLAIM_WITHDRAWAL");
    bytes32 internal constant ACTION_RG_SET_LIMIT = keccak256("BET_RG_SET_LIMIT");
    bytes32 internal constant ACTION_RG_SELF_EXCLUDE = keccak256("BET_RG_SELF_EXCLUDE");
    bytes32 internal constant ACTION_RG_COOL_OFF = keccak256("BET_RG_COOL_OFF");
    bytes32 internal constant ACTION_ACCESS_CONFIGURE = keccak256("BET_ACCESS_CONFIGURE");
    bytes32 internal constant ACTION_ACCESS_RECORD = keccak256("BET_ACCESS_RECORD");

    // Economics / fee / reward / promotion actions.
    bytes32 internal constant ACTION_ECONOMICS_CONFIGURE = keccak256("BET_ECONOMICS_CONFIGURE");
    bytes32 internal constant ACTION_ECONOMICS_BIND = keccak256("BET_ECONOMICS_BIND");
    bytes32 internal constant ACTION_ECONOMICS_FINALIZE = keccak256("BET_ECONOMICS_FINALIZE");
    bytes32 internal constant ACTION_ECONOMICS_FUND = keccak256("BET_ECONOMICS_FUND");
    bytes32 internal constant ACTION_REWARD_ACCRUE = keccak256("BET_REWARD_ACCRUE");
    bytes32 internal constant ACTION_PROMOTION_GRANT = keccak256("BET_PROMOTION_GRANT");

    // Bankroll-vault and risk-kernel actions. These are capability scoped; no super-admin exists.
    bytes32 internal constant ACTION_VAULT_REGISTER = keccak256("BET_VAULT_REGISTER");
    bytes32 internal constant ACTION_VAULT_RECORD_DEPOSIT = keccak256("BET_VAULT_RECORD_DEPOSIT");
    bytes32 internal constant ACTION_VAULT_QUEUE_WITHDRAWAL = keccak256("BET_VAULT_QUEUE_WITHDRAWAL");
    bytes32 internal constant ACTION_VAULT_CLAIM_WITHDRAWAL = keccak256("BET_VAULT_CLAIM_WITHDRAWAL");
    bytes32 internal constant ACTION_VAULT_SET_SAFETY_RESERVE = keccak256("BET_VAULT_SET_SAFETY_RESERVE");
    bytes32 internal constant ACTION_VAULT_RESERVE_LIABILITY = keccak256("BET_VAULT_RESERVE_LIABILITY");
    bytes32 internal constant ACTION_VAULT_RELEASE_LIABILITY = keccak256("BET_VAULT_RELEASE_LIABILITY");
    bytes32 internal constant ACTION_VAULT_RECORD_PNL = keccak256("BET_VAULT_RECORD_PNL");
    bytes32 internal constant ACTION_VAULT_ESCROW_STAKE = keccak256("BET_VAULT_ESCROW_STAKE");
    bytes32 internal constant ACTION_VAULT_SETTLE_WAGER = keccak256("BET_VAULT_SETTLE_WAGER");
    bytes32 internal constant ACTION_RISK_CONFIGURE = keccak256("BET_RISK_CONFIGURE");
    bytes32 internal constant ACTION_RISK_RESERVE = keccak256("BET_RISK_RESERVE");
    bytes32 internal constant ACTION_RISK_RELEASE = keccak256("BET_RISK_RELEASE");

    // Canonical wager actions. Acceptance, randomness, settlement initiation, and registry mutation are separated.
    bytes32 internal constant ACTION_WAGER_RECORD = keccak256("BET_WAGER_RECORD");
    bytes32 internal constant ACTION_RANDOMNESS_CONFIGURE = keccak256("BET_RANDOMNESS_CONFIGURE");
    bytes32 internal constant ACTION_RANDOMNESS_REQUEST = keccak256("BET_RANDOMNESS_REQUEST");
    bytes32 internal constant ACTION_RANDOMNESS_FULFILL = keccak256("BET_RANDOMNESS_FULFILL");
    bytes32 internal constant ACTION_SETTLE = keccak256("BET_SETTLE");
    bytes32 internal constant ACTION_WAGER_SETTLE_RECORD = keccak256("BET_WAGER_SETTLE_RECORD");

    // Administrative / lifecycle actions. These remain capability-scoped and prospective.
    bytes32 internal constant ACTION_MODULE_REGISTER = keccak256("BET_MODULE_REGISTER");
    bytes32 internal constant ACTION_MODULE_APPROVE = keccak256("BET_MODULE_APPROVE");
    bytes32 internal constant ACTION_MODULE_PAUSE = keccak256("BET_MODULE_PAUSE");
    bytes32 internal constant ACTION_MODULE_RESUME = keccak256("BET_MODULE_RESUME");
    bytes32 internal constant ACTION_MODULE_DEPRECATE = keccak256("BET_MODULE_DEPRECATE");

    bytes32 internal constant ACTION_GAME_REGISTER = keccak256("BET_GAME_REGISTER");
    bytes32 internal constant ACTION_GAME_ACTIVATE = keccak256("BET_GAME_ACTIVATE");
    bytes32 internal constant ACTION_GAME_PAUSE = keccak256("BET_GAME_PAUSE");
    bytes32 internal constant ACTION_GAME_RESUME = keccak256("BET_GAME_RESUME");
    bytes32 internal constant ACTION_GAME_DEPRECATE = keccak256("BET_GAME_DEPRECATE");

    bytes32 internal constant ACTION_PROFILE_REGISTER = keccak256("BET_PROFILE_REGISTER");
    bytes32 internal constant ACTION_PROFILE_DEPRECATE = keccak256("BET_PROFILE_DEPRECATE");

    bytes32 internal constant ACTION_OPERATOR_REGISTER = keccak256("BET_OPERATOR_REGISTER");
    bytes32 internal constant ACTION_OPERATOR_ACTIVATE = keccak256("BET_OPERATOR_ACTIVATE");
    bytes32 internal constant ACTION_OPERATOR_PAUSE = keccak256("BET_OPERATOR_PAUSE");
    bytes32 internal constant ACTION_OPERATOR_RESUME = keccak256("BET_OPERATOR_RESUME");
    bytes32 internal constant ACTION_OPERATOR_REVOKE = keccak256("BET_OPERATOR_REVOKE");

    bytes32 internal constant ACTION_EMERGENCY_SET = keccak256("BET_EMERGENCY_SET");

    // Prediction-market lifecycle / resolution actions. Deliberately no SET_WINNER action exists.
    bytes32 internal constant ACTION_PREDICTION_MARKET_REGISTER = keccak256("BET_PREDICTION_MARKET_REGISTER");
    bytes32 internal constant ACTION_PREDICTION_MARKET_APPROVE = keccak256("BET_PREDICTION_MARKET_APPROVE");
    bytes32 internal constant ACTION_PREDICTION_MARKET_OPEN = keccak256("BET_PREDICTION_MARKET_OPEN");
    bytes32 internal constant ACTION_PREDICTION_MARKET_SUSPEND = keccak256("BET_PREDICTION_MARKET_SUSPEND");
    bytes32 internal constant ACTION_PREDICTION_MARKET_CLOSE = keccak256("BET_PREDICTION_MARKET_CLOSE");
    bytes32 internal constant ACTION_PREDICTION_FACT_REPORT = keccak256("BET_PREDICTION_FACT_REPORT");
    bytes32 internal constant ACTION_PREDICTION_CHALLENGE = keccak256("BET_PREDICTION_CHALLENGE");
    bytes32 internal constant ACTION_PREDICTION_FINALIZE = keccak256("BET_PREDICTION_FINALIZE");
}
