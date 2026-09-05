// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./ICasinoGame420.sol";
import "./RandomnessRouter420.sol";

/// @notice First-party Crash V1 wager-scoped session and deterministic crash-point engine for 420Bet.
/// @dev E2.2 consumes fulfilled canonical randomness and derives a replayable crash point. This module
///      still owns no bankroll funds, randomness fulfillment authority, multiplier clock, or settlement authority.
contract CrashV1420 is ICasinoGame420 {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.CRASH.V1.PARAMS");
    bytes32 public constant CRASH_POINT_DOMAIN = keccak256("420.BET.CRASH.V1.CRASH.POINT");
    uint64 public constant BPS = 10_000;
    uint64 public constant RETURN_BPS = 9_900;
    uint64 public constant MAX_CRASH_BPS = 1_000_000_000; // 100,000x hard safety ceiling.
    uint256 private constant ENTROPY_SPACE = uint256(1) << 52;

    enum Phase { NONE, ACTIVE, TERMINAL }

    struct Params {
        /// @notice Optional automatic cash-out multiplier in basis points. Zero means manual-only.
        uint64 autoCashoutBps;
    }

    struct SessionState {
        Phase phase;
        address player;
        uint64 autoCashoutBps;
        uint64 crashPointBps;
        bytes32 randomnessRoot;
        RandomnessRouter420.Source randomnessSource;
        bool exists;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
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
    error RandomnessNotReady();
    error RandomnessMismatch();

    event SessionStarted(
        bytes32 indexed wagerId,
        address indexed player,
        uint64 autoCashoutBps,
        uint64 crashPointBps,
        bytes32 randomnessRoot,
        RandomnessRouter420.Source randomnessSource
    );

    constructor(
        address wagerRegistry_,
        address randomnessRouter_,
        bytes32 gameId_,
        bytes32 gameVersionId_,
        bytes32 rulesetId_
    ) {
        if (wagerRegistry_ == address(0) || randomnessRouter_ == address(0)) revert ZeroAddress();
        if (gameId_ == bytes32(0) || gameVersionId_ == bytes32(0) || rulesetId_ == bytes32(0)) revert InvalidId();
        wagerRegistry = BetRegistry420(wagerRegistry_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
        gameId = gameId_;
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
    }

    function systemName() external pure returns (string memory) { return "CrashV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        if (params.autoCashoutBps != 0 && params.autoCashoutBps <= BPS) revert InvalidParams();
        if (params.autoCashoutBps > MAX_CRASH_BPS) revert InvalidParams();
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, params.autoCashoutBps));
    }

    /// @notice Pure, reproducible Crash V1 crash-point derivation from canonical randomness.
    /// @dev Uses 52 bits of entropy and a 99% return factor. The result is clamped to [1x, 100,000x].
    function deriveCrashPoint(bytes32 wagerId, bytes32 randomnessRoot) public view returns (uint64 crashPointBps) {
        if (wagerId == bytes32(0) || randomnessRoot == bytes32(0)) revert RandomnessNotReady();
        uint256 entropy = uint256(keccak256(abi.encode(
            CRASH_POINT_DOMAIN,
            wagerId,
            gameVersionId,
            rulesetId,
            randomnessRoot
        ))) >> 204;

        uint256 denominator = ENTROPY_SPACE - entropy;
        uint256 quoted = (uint256(RETURN_BPS) * ENTROPY_SPACE) / denominator;
        if (quoted < BPS) quoted = BPS;
        if (quoted > MAX_CRASH_BPS) quoted = MAX_CRASH_BPS;
        crashPointBps = uint64(quoted);
    }

    /// @notice Read the canonical fulfilled request and derive the exact V1 crash point without mutating state.
    function resolveCrashPoint(bytes32 wagerId) public view returns (
        uint64 crashPointBps,
        bytes32 randomnessRoot,
        RandomnessRouter420.Source randomnessSource
    ) {
        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (!request.fulfilled || request.root == bytes32(0) || request.source == RandomnessRouter420.Source.NONE) {
            revert RandomnessNotReady();
        }
        if (
            request.wagerId != wagerId ||
            request.gameVersionId != wager.gameVersionId ||
            request.gameVersionId != gameVersionId ||
            request.paramsHash != wager.paramsHash
        ) revert RandomnessMismatch();

        crashPointBps = deriveCrashPoint(wagerId, request.root);
        randomnessRoot = request.root;
        randomnessSource = request.source;
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

        (uint64 crashPointBps, bytes32 randomnessRoot, RandomnessRouter420.Source randomnessSource) = resolveCrashPoint(wagerId);

        session.phase = Phase.ACTIVE;
        session.player = wager.player;
        session.autoCashoutBps = params.autoCashoutBps;
        session.crashPointBps = crashPointBps;
        session.randomnessRoot = randomnessRoot;
        session.randomnessSource = randomnessSource;
        session.exists = true;

        emit SessionStarted(wagerId, wager.player, params.autoCashoutBps, crashPointBps, randomnessRoot, randomnessSource);
    }

    function getSession(bytes32 wagerId) external view returns (SessionState memory session) {
        session = _sessions[wagerId];
        if (!session.exists) revert SessionMissing();
    }
}
