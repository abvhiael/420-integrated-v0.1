// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./ICasinoGame420.sol";

/// @notice First-party Crash V1 wager-scoped session foundation for 420Bet.
/// @dev E2.1 deliberately owns no bankroll funds, randomness fulfillment, multiplier progression,
///      crash-point derivation, or canonical settlement authority. Those arrive in later E2 increments.
contract CrashV1420 is ICasinoGame420 {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.CRASH.V1.PARAMS");
    uint64 public constant BPS = 10_000;

    enum Phase { NONE, ACTIVE, TERMINAL }

    struct Params {
        /// @notice Optional automatic cash-out multiplier in basis points. Zero means manual-only.
        uint64 autoCashoutBps;
    }

    struct SessionState {
        Phase phase;
        address player;
        uint64 autoCashoutBps;
        bool exists;
    }

    BetRegistry420 public immutable wagerRegistry;
    bytes32 public immutable gameId;
    bytes32 public immutable gameVersionId;
    bytes32 public immutable rulesetId;

    mapping(bytes32 => SessionState) private _sessions;

    error ZeroAddress();
    error InvalidId();
    error InvalidParams();
    error WrongGame();
    error WrongRuleset();
    error InvalidWagerStatus();
    error ParamsMismatch();
    error NotPlayer();
    error SessionAlreadyStarted();
    error SessionMissing();

    event SessionStarted(bytes32 indexed wagerId, address indexed player, uint64 autoCashoutBps);

    constructor(address wagerRegistry_, bytes32 gameId_, bytes32 gameVersionId_, bytes32 rulesetId_) {
        if (wagerRegistry_ == address(0)) revert ZeroAddress();
        if (gameId_ == bytes32(0) || gameVersionId_ == bytes32(0) || rulesetId_ == bytes32(0)) revert InvalidId();
        wagerRegistry = BetRegistry420(wagerRegistry_);
        gameId = gameId_;
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
    }

    function systemName() external pure returns (string memory) { return "CrashV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        if (params.autoCashoutBps != 0 && params.autoCashoutBps <= BPS) revert InvalidParams();
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, params.autoCashoutBps));
    }

    function startSession(bytes32 wagerId, Params calldata params) external {
        SessionState storage session = _sessions[wagerId];
        if (session.exists) revert SessionAlreadyStarted();

        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        if (wager.gameId != gameId || wager.gameVersionId != gameVersionId) revert WrongGame();
        if (wager.rulesetId != rulesetId) revert WrongRuleset();
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED && wager.status != BetTypes420.WagerStatus.OUTCOME_READY) {
            revert InvalidWagerStatus();
        }
        if (hashParams(params) != wager.paramsHash) revert ParamsMismatch();
        if (msg.sender != wager.player) revert NotPlayer();

        session.phase = Phase.ACTIVE;
        session.player = wager.player;
        session.autoCashoutBps = params.autoCashoutBps;
        session.exists = true;

        emit SessionStarted(wagerId, wager.player, params.autoCashoutBps);
    }

    function getSession(bytes32 wagerId) external view returns (SessionState memory session) {
        session = _sessions[wagerId];
        if (!session.exists) revert SessionMissing();
    }
}
