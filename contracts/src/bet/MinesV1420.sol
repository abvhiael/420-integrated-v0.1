// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";

/// @notice First-party Mines V1 session, hidden-board verifier, and progressive cash-out engine for 420Bet.
/// @dev The wager reserves its maximum possible gross payout before play. Safe reveals only increase
///      the player's currently claimable gross payout inside that pre-reserved ceiling. This module
///      never moves funds, changes vault reservations, or records canonical settlement.
contract MinesV1420 is I420System {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.MINES.V1.PARAMS");
    bytes32 public constant SEED_COMMIT_DOMAIN = keccak256("420.BET.MINES.V1.SEED.COMMIT");
    bytes32 public constant LEAF_DOMAIN = keccak256("420.BET.MINES.V1.LEAF");
    uint8 public constant BOARD_CELLS = 25;
    uint8 public constant MERKLE_DEPTH = 5; // 32-leaf canonical tree; leaves 25-31 are padding.
    uint8 public constant MIN_MINES = 1;
    uint8 public constant MAX_MINES = 24;
    uint16 public constant BPS = 10_000;
    uint16 public constant RETURN_BPS = 9_900; // V1 99.00% theoretical return before integer truncation.

    enum Phase { NONE, ACTIVE, TERMINAL }

    struct Params {
        uint8 mineCount;
    }

    struct BoardCommitment {
        RandomnessRouter420.Source source;
        bytes32 seedCommitment;
        bytes32 boardRoot;
        bytes32 randomnessRoot;
        bool seedCommitted;
        bool boardBound;
    }

    struct SessionState {
        Phase phase;
        address player;
        uint8 mineCount;
        uint8 safeReveals;
        uint32 revealedMask;
        uint256 currentGrossPayout;
        uint256 cashoutGrossPayout;
        bool mineHit;
        bool cashedOut;
        bool exists;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
    bytes32 public immutable gameId;
    bytes32 public immutable gameVersionId;
    bytes32 public immutable rulesetId;

    mapping(bytes32 => mapping(uint8 => BoardCommitment)) private _boards;
    mapping(bytes32 => SessionState) private _sessions;

    error ZeroAddress();
    error InvalidId();
    error InvalidParams();
    error WrongGame();
    error WrongRuleset();
    error InvalidWagerStatus();
    error ParamsMismatch();
    error InvalidPayout();
    error PayoutExceedsReservedMaximum();
    error NothingToCashOut();
    error SessionAlreadyStarted();
    error SessionMissing();
    error InvalidPhase();
    error NotPlayer();
    error InvalidCell();
    error CellAlreadyRevealed();
    error InvalidSource();
    error WrongProvider();
    error SeedAlreadyCommitted();
    error SeedCommitmentMissing();
    error BoardAlreadyBound();
    error BoardNotReady();
    error RandomnessAlreadyReady();
    error RandomnessNotReady();
    error InvalidCommitment();
    error InvalidProof();

    event SeedCommitted(bytes32 indexed wagerId, RandomnessRouter420.Source indexed source, bytes32 indexed seedCommitment);
    event BoardBound(bytes32 indexed wagerId, RandomnessRouter420.Source indexed source, bytes32 indexed boardRoot, bytes32 randomnessRoot);
    event SessionStarted(bytes32 indexed wagerId, address indexed player, uint8 mineCount, uint256 reservedMaximumGrossPayout);
    event CellRevealed(bytes32 indexed wagerId, uint8 indexed cell, bool mine, uint8 safeReveals, uint32 revealedMask);
    event CashoutValueAdvanced(bytes32 indexed wagerId, uint8 safeReveals, uint256 grossPayout, uint256 reservedMaximumGrossPayout);
    event SessionTerminal(bytes32 indexed wagerId, bool mineHit, bool cashedOut, uint8 safeReveals, uint256 grossPayout);

    constructor(address wagerRegistry_, address randomnessRouter_, bytes32 gameId_, bytes32 gameVersionId_, bytes32 rulesetId_) {
        if (wagerRegistry_ == address(0) || randomnessRouter_ == address(0)) revert ZeroAddress();
        if (gameId_ == bytes32(0) || gameVersionId_ == bytes32(0) || rulesetId_ == bytes32(0)) revert InvalidId();
        wagerRegistry = BetRegistry420(wagerRegistry_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
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

    /// @notice Maximum V1 gross payout reached by revealing every non-mine cell.
    /// @dev Wager acceptance must reserve at least this amount. The progressive claim never exceeds it.
    function requiredMaxGrossPayout(uint256 stake, uint8 mineCount) public pure returns (uint256) {
        if (stake == 0 || mineCount < MIN_MINES || mineCount > MAX_MINES) revert InvalidPayout();
        return quoteGrossPayout(stake, mineCount, BOARD_CELLS - mineCount);
    }

    /// @notice Deterministic V1 gross cash-out quote after `safeReveals` verified safe cells.
    /// @dev Uses inverse survival probability: product((25-i)/(25-mineCount-i)), then RETURN_BPS.
    function quoteGrossPayout(uint256 stake, uint8 mineCount, uint8 safeReveals) public pure returns (uint256 grossPayout) {
        if (stake == 0 || mineCount < MIN_MINES || mineCount > MAX_MINES) revert InvalidPayout();
        uint8 safeCells = BOARD_CELLS - mineCount;
        if (safeReveals == 0 || safeReveals > safeCells) revert InvalidPayout();

        uint256 numerator = 1;
        uint256 denominator = 1;
        for (uint8 i = 0; i < safeReveals; ++i) {
            numerator *= uint256(BOARD_CELLS - i);
            denominator *= uint256(safeCells - i);
        }
        grossPayout = (stake * numerator * RETURN_BPS) / (denominator * BPS);
        if (grossPayout < stake) grossPayout = stake;
    }

    function seedCommitmentFor(bytes32 wagerId, RandomnessRouter420.Source source, bytes32 seed) public view returns (bytes32) {
        if (source != RandomnessRouter420.Source.PRIMARY && source != RandomnessRouter420.Source.FALLBACK) revert InvalidSource();
        if (seed == bytes32(0)) revert InvalidCommitment();
        return keccak256(abi.encode(SEED_COMMIT_DOMAIN, wagerId, gameVersionId, rulesetId, source, seed));
    }

    function commitSeed(bytes32 wagerId, RandomnessRouter420.Source source, bytes32 seedCommitment) external {
        if (source != RandomnessRouter420.Source.PRIMARY && source != RandomnessRouter420.Source.FALLBACK) revert InvalidSource();
        if (seedCommitment == bytes32(0)) revert InvalidCommitment();
        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (request.fulfilled) revert RandomnessAlreadyReady();
        _requireProvider(request.profileId, source);
        BoardCommitment storage board = _boards[wagerId][uint8(source)];
        if (board.seedCommitted) revert SeedAlreadyCommitted();
        board.source = source;
        board.seedCommitment = seedCommitment;
        board.seedCommitted = true;
        emit SeedCommitted(wagerId, source, seedCommitment);
    }

    function bindBoard(bytes32 wagerId, bytes32 boardRoot) external {
        if (boardRoot == bytes32(0)) revert InvalidCommitment();
        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (!request.fulfilled) revert RandomnessNotReady();
        if (request.source != RandomnessRouter420.Source.PRIMARY && request.source != RandomnessRouter420.Source.FALLBACK) revert InvalidSource();
        _requireProvider(request.profileId, request.source);
        BoardCommitment storage board = _boards[wagerId][uint8(request.source)];
        if (!board.seedCommitted) revert SeedCommitmentMissing();
        if (board.boardBound) revert BoardAlreadyBound();
        board.boardRoot = boardRoot;
        board.randomnessRoot = request.root;
        board.boardBound = true;
        emit BoardBound(wagerId, request.source, boardRoot, request.root);
    }

    function startSession(bytes32 wagerId, Params calldata params) external {
        SessionState storage session = _sessions[wagerId];
        if (session.exists) revert SessionAlreadyStarted();
        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        _validateWager(wager, params);
        if (msg.sender != wager.player) revert NotPlayer();
        uint256 requiredMaximum = requiredMaxGrossPayout(wager.stake, params.mineCount);
        if (wager.maxGrossPayout < requiredMaximum) revert PayoutExceedsReservedMaximum();
        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (!request.fulfilled) revert RandomnessNotReady();
        BoardCommitment storage board = _boards[wagerId][uint8(request.source)];
        if (!board.boardBound || board.randomnessRoot != request.root) revert BoardNotReady();
        session.phase = Phase.ACTIVE;
        session.player = wager.player;
        session.mineCount = params.mineCount;
        session.exists = true;
        emit SessionStarted(wagerId, wager.player, params.mineCount, wager.maxGrossPayout);
    }

    function revealCell(bytes32 wagerId, uint8 cell, bool mine, bytes32 salt, bytes32[] calldata proof) external {
        SessionState storage session = _getActiveSession(wagerId);
        if (msg.sender != session.player) revert NotPlayer();
        if (cell >= BOARD_CELLS) revert InvalidCell();
        if (salt == bytes32(0) || proof.length != MERKLE_DEPTH) revert InvalidProof();
        uint32 bit = uint32(1) << cell;
        if (session.revealedMask & bit != 0) revert CellAlreadyRevealed();
        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        BoardCommitment storage board = _boards[wagerId][uint8(request.source)];
        if (!request.fulfilled || !board.boardBound || board.randomnessRoot != request.root) revert BoardNotReady();
        bytes32 leaf = cellLeaf(wagerId, request.root, cell, mine, salt);
        if (!_verifyMerkle(leaf, proof, board.boardRoot)) revert InvalidProof();
        session.revealedMask |= bit;
        if (mine) {
            session.phase = Phase.TERMINAL;
            session.mineHit = true;
            session.currentGrossPayout = 0;
        } else {
            session.safeReveals += 1;
            BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
            uint256 quote = quoteGrossPayout(wager.stake, session.mineCount, session.safeReveals);
            if (quote > wager.maxGrossPayout) revert PayoutExceedsReservedMaximum();
            session.currentGrossPayout = quote;
            emit CashoutValueAdvanced(wagerId, session.safeReveals, quote, wager.maxGrossPayout);
        }
        emit CellRevealed(wagerId, cell, mine, session.safeReveals, session.revealedMask);
        if (mine) emit SessionTerminal(wagerId, true, false, session.safeReveals, 0);
    }

    /// @notice Lock the current verified progressive claim for later canonical settlement.
    /// @dev E1.3 records no payout and moves no funds; E1.4 will route this terminal claim to SettlementEngine420.
    function cashOut(bytes32 wagerId) external returns (uint256 grossPayout) {
        SessionState storage session = _getActiveSession(wagerId);
        if (msg.sender != session.player) revert NotPlayer();
        if (session.safeReveals == 0 || session.currentGrossPayout == 0) revert NothingToCashOut();
        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        grossPayout = session.currentGrossPayout;
        if (grossPayout > wager.maxGrossPayout) revert PayoutExceedsReservedMaximum();
        session.phase = Phase.TERMINAL;
        session.cashedOut = true;
        session.cashoutGrossPayout = grossPayout;
        emit SessionTerminal(wagerId, false, true, session.safeReveals, grossPayout);
    }

    function cellLeaf(bytes32 wagerId, bytes32 randomnessRoot, uint8 cell, bool mine, bytes32 salt) public view returns (bytes32) {
        if (cell >= BOARD_CELLS) revert InvalidCell();
        if (salt == bytes32(0)) revert InvalidProof();
        return keccak256(abi.encode(LEAF_DOMAIN, wagerId, gameVersionId, rulesetId, randomnessRoot, cell, mine, salt));
    }

    function getSession(bytes32 wagerId) external view returns (SessionState memory session) {
        session = _sessions[wagerId];
        if (!session.exists) revert SessionMissing();
    }

    function getBoard(bytes32 wagerId, RandomnessRouter420.Source source) external view returns (BoardCommitment memory board) {
        board = _boards[wagerId][uint8(source)];
        if (!board.seedCommitted) revert SeedCommitmentMissing();
    }

    function isCellRevealed(bytes32 wagerId, uint8 cell) external view returns (bool) {
        if (cell >= BOARD_CELLS) revert InvalidCell();
        SessionState storage session = _sessions[wagerId];
        if (!session.exists) revert SessionMissing();
        return session.revealedMask & (uint32(1) << cell) != 0;
    }

    function _requireProvider(bytes32 profileId, RandomnessRouter420.Source source) private view {
        RandomnessRouter420.RandomnessProfile memory profile = randomnessRouter.getProfile(profileId);
        address expected = source == RandomnessRouter420.Source.PRIMARY ? profile.primaryProvider : profile.fallbackProvider;
        if (expected == address(0) || msg.sender != expected) revert WrongProvider();
    }

    function _validateWager(BetTypes420.Wager memory wager, Params memory params) private view {
        if (wager.gameId != gameId || wager.gameVersionId != gameVersionId) revert WrongGame();
        if (wager.rulesetId != rulesetId) revert WrongRuleset();
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED && wager.status != BetTypes420.WagerStatus.OUTCOME_READY) revert InvalidWagerStatus();
        if (hashParams(params) != wager.paramsHash) revert ParamsMismatch();
    }

    function _getActiveSession(bytes32 wagerId) private view returns (SessionState storage session) {
        session = _sessions[wagerId];
        if (!session.exists) revert SessionMissing();
        if (session.phase != Phase.ACTIVE) revert InvalidPhase();
    }

    function _verifyMerkle(bytes32 leaf, bytes32[] calldata proof, bytes32 root) private pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; ++i) {
            bytes32 sibling = proof[i];
            computed = computed <= sibling ? keccak256(abi.encodePacked(computed, sibling)) : keccak256(abi.encodePacked(sibling, computed));
        }
        return computed == root;
    }
}
