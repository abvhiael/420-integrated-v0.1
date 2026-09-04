// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";

/// @notice First-party Mines V1 session and hidden-board verifier for 420Bet.
/// @dev A randomness provider commits a secret seed before canonical randomness is fulfilled.
///      After fulfillment, that same source binds a Merkle root for the hidden 25-cell board.
///      Each player reveal proves one cell against the bound root without exposing the master seed.
///      The module never moves funds or settles wagers.
contract MinesV1420 is I420System {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.MINES.V1.PARAMS");
    bytes32 public constant SEED_COMMIT_DOMAIN = keccak256("420.BET.MINES.V1.SEED.COMMIT");
    bytes32 public constant BOARD_DOMAIN = keccak256("420.BET.MINES.V1.BOARD");
    bytes32 public constant LEAF_DOMAIN = keccak256("420.BET.MINES.V1.LEAF");
    uint8 public constant BOARD_CELLS = 25;
    uint8 public constant MIN_MINES = 1;
    uint8 public constant MAX_MINES = 24;

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

    event SeedCommitted(
        bytes32 indexed wagerId,
        RandomnessRouter420.Source indexed source,
        bytes32 indexed seedCommitment
    );
    event BoardBound(
        bytes32 indexed wagerId,
        RandomnessRouter420.Source indexed source,
        bytes32 indexed boardRoot,
        bytes32 randomnessRoot
    );
    event SessionStarted(bytes32 indexed wagerId, address indexed player, uint8 mineCount);
    event CellRevealed(bytes32 indexed wagerId, uint8 indexed cell, bool mine, uint8 safeReveals, uint32 revealedMask);
    event SessionTerminal(bytes32 indexed wagerId, bool mineHit, bool cashedOut, uint8 safeReveals);

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

    function systemName() external pure returns (string memory) { return "MinesV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        if (params.mineCount < MIN_MINES || params.mineCount > MAX_MINES) revert InvalidParams();
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, BOARD_CELLS, params.mineCount));
    }

    function seedCommitmentFor(bytes32 wagerId, RandomnessRouter420.Source source, bytes32 seed)
        public
        view
        returns (bytes32)
    {
        if (source != RandomnessRouter420.Source.PRIMARY && source != RandomnessRouter420.Source.FALLBACK) {
            revert InvalidSource();
        }
        if (seed == bytes32(0)) revert InvalidCommitment();
        return keccak256(abi.encode(SEED_COMMIT_DOMAIN, wagerId, gameVersionId, rulesetId, source, seed));
    }

    /// @notice Provider commits a master board seed before canonical randomness is known.
    function commitSeed(bytes32 wagerId, RandomnessRouter420.Source source, bytes32 seedCommitment) external {
        if (source != RandomnessRouter420.Source.PRIMARY && source != RandomnessRouter420.Source.FALLBACK) {
            revert InvalidSource();
        }
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

    /// @notice Bind the hidden Merkle board after canonical randomness fulfillment.
    /// @dev The selected randomness source must have precommitted its master seed.
    function bindBoard(bytes32 wagerId, bytes32 boardRoot) external {
        if (boardRoot == bytes32(0)) revert InvalidCommitment();
        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (!request.fulfilled) revert RandomnessNotReady();
        if (request.source != RandomnessRouter420.Source.PRIMARY && request.source != RandomnessRouter420.Source.FALLBACK) {
            revert InvalidSource();
        }
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

        RandomnessRouter420.RandomnessRequest memory request = randomnessRouter.getRequest(wagerId);
        if (!request.fulfilled) revert RandomnessNotReady();
        BoardCommitment storage board = _boards[wagerId][uint8(request.source)];
        if (!board.boardBound || board.randomnessRoot != request.root) revert BoardNotReady();

        session.phase = Phase.ACTIVE;
        session.player = wager.player;
        session.mineCount = params.mineCount;
        session.exists = true;

        emit SessionStarted(wagerId, wager.player, params.mineCount);
    }

    /// @notice Reveal one hidden cell with a Merkle proof against the committed board.
    /// @dev Cell salt is independent per cell, so one reveal does not expose unrevealed cells.
    function revealCell(bytes32 wagerId, uint8 cell, bool mine, bytes32 salt, bytes32[] calldata proof) external {
        SessionState storage session = _getActiveSession(wagerId);
        if (msg.sender != session.player) revert NotPlayer();
        if (cell >= BOARD_CELLS) revert InvalidCell();
        if (salt == bytes32(0)) revert InvalidProof();

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
        } else {
            session.safeReveals += 1;
        }
        emit CellRevealed(wagerId, cell, mine, session.safeReveals, session.revealedMask);
        if (mine) emit SessionTerminal(wagerId, true, false, session.safeReveals);
    }

    function cellLeaf(bytes32 wagerId, bytes32 randomnessRoot, uint8 cell, bool mine, bytes32 salt)
        public
        view
        returns (bytes32)
    {
        if (cell >= BOARD_CELLS || salt == bytes32(0)) revert InvalidCell();
        return keccak256(abi.encode(LEAF_DOMAIN, wagerId, gameVersionId, rulesetId, randomnessRoot, cell, mine, salt));
    }

    /// @notice E1.1 terminal primitive retained for later economic cash-out integration.
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

    function getBoard(bytes32 wagerId, RandomnessRouter420.Source source)
        external
        view
        returns (BoardCommitment memory board)
    {
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

    function _verifyMerkle(bytes32 leaf, bytes32[] calldata proof, bytes32 root) private pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; ++i) {
            bytes32 sibling = proof[i];
            computed = computed <= sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
        }
        return computed == root;
    }
}
