// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";

/// @notice First-party Mines V1 session foundation for 420Bet.
/// @dev E1.1 establishes immutable wager binding and player-owned session progression only.
///      Mine placement/reveal randomness, progressive cash-out economics, and settlement wiring
///      are added in later E1 increments. This module never moves funds or settles wagers.
contract MinesV1420 is I420System {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.MINES.V1.PARAMS");
    uint8 public constant BOARD_CELLS = 25;
    uint8 public constant MIN_MINES = 1;
    uint8 public constant MAX_MINES = 24;

    enum Phase { NONE, ACTIVE, TERMINAL }

    struct Params {
        uint8 mineCount;
    }

    struct SessionState {
        Phase phase;
        address player;
        uint8 mineCount;
        uint8 safeReveals;
        uint32 revealedMask;
        bool mineHit;
        bool cashedOut;
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
    error SessionAlreadyStarted();
    error SessionMissing();
    error InvalidPhase();
    error NotPlayer();
    error InvalidCell();
    error CellAlreadyRevealed();

    event SessionStarted(bytes32 indexed wagerId, address indexed player, uint8 mineCount);
    event SafeCellRecorded(bytes32 indexed wagerId, uint8 indexed cell, uint8 safeReveals, uint32 revealedMask);
    event SessionTerminal(bytes32 indexed wagerId, bool mineHit, bool cashedOut, uint8 safeReveals);

    constructor(address wagerRegistry_, bytes32 gameId_, bytes32 gameVersionId_, bytes32 rulesetId_) {
        if (wagerRegistry_ == address(0)) revert ZeroAddress();
        if (gameId_ == bytes32(0) || gameVersionId_ == bytes32(0) || rulesetId_ == bytes32(0)) revert InvalidId();
        wagerRegistry = BetRegistry420(wagerRegistry_);
        gameId = gameId_;
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
    }

    function systemName() external pure returns (string memory) { return "MinesV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        if (params.mineCount < MIN_MINES || params.mineCount > MAX_MINES) revert InvalidParams();
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, BOARD_CELLS, params.mineCount));
    }

    function startSession(bytes32 wagerId, Params calldata params) external {
        SessionState storage session = _sessions[wagerId];
        if (session.exists) revert SessionAlreadyStarted();

        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        _validateWager(wager, params);
        if (msg.sender != wager.player) revert NotPlayer();

        session.phase = Phase.ACTIVE;
        session.player = wager.player;
        session.mineCount = params.mineCount;
        session.exists = true;

        emit SessionStarted(wagerId, wager.player, params.mineCount);
    }

    /// @notice E1.1 internal-session primitive used by later reveal/randomness integration.
    /// @dev This cannot prove a cell safe; E1.2 will restrict calls through deterministic reveal logic.
    function recordSafeCell(bytes32 wagerId, uint8 cell) external {
        SessionState storage session = _getActiveSession(wagerId);
        if (msg.sender != session.player) revert NotPlayer();
        if (cell >= BOARD_CELLS) revert InvalidCell();

        uint32 bit = uint32(1) << cell;
        if (session.revealedMask & bit != 0) revert CellAlreadyRevealed();
        session.revealedMask |= bit;
        session.safeReveals += 1;

        emit SafeCellRecorded(wagerId, cell, session.safeReveals, session.revealedMask);
    }

    /// @notice E1.1 terminal state primitive. Economic cash-out/settlement is deliberately absent.
    function markTerminal(bytes32 wagerId, bool mineHit, bool cashedOut) external {
        SessionState storage session = _getActiveSession(wagerId);
        if (msg.sender != session.player) revert NotPlayer();
        if (mineHit == cashedOut) revert InvalidPhase();
        session.phase = Phase.TERMINAL;
        session.mineHit = mineHit;
        session.cashedOut = cashedOut;
        emit SessionTerminal(wagerId, mineHit, cashedOut, session.safeReveals);
    }

    function getSession(bytes32 wagerId) external view returns (SessionState memory session) {
        session = _sessions[wagerId];
        if (!session.exists) revert SessionMissing();
    }

    function isCellRevealed(bytes32 wagerId, uint8 cell) external view returns (bool) {
        if (cell >= BOARD_CELLS) revert InvalidCell();
        SessionState storage session = _sessions[wagerId];
        if (!session.exists) revert SessionMissing();
        return session.revealedMask & (uint32(1) << cell) != 0;
    }

    function _validateWager(BetTypes420.Wager memory wager, Params memory params) private view {
        if (wager.gameId != gameId || wager.gameVersionId != gameVersionId) revert WrongGame();
        if (wager.rulesetId != rulesetId) revert WrongRuleset();
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED && wager.status != BetTypes420.WagerStatus.OUTCOME_READY) {
            revert InvalidWagerStatus();
        }
        if (hashParams(params) != wager.paramsHash) revert ParamsMismatch();
    }

    function _getActiveSession(bytes32 wagerId) private view returns (SessionState storage session) {
        session = _sessions[wagerId];
        if (!session.exists) revert SessionMissing();
        if (session.phase != Phase.ACTIVE) revert InvalidPhase();
    }
}
