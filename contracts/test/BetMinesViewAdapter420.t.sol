// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/MinesV1420.sol";
import "../src/bet/MinesViewAdapter420.sol";
import "../src/bet/RandomnessRouter420.sol";

contract MockMinesViewRegistry420 {
    BetTypes420.Wager private _wager;
    BetTypes420.Settlement private _settlement;
    bool private _settled;

    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }
    function setSettlement(BetTypes420.Settlement calldata settlement_) external { _settlement = settlement_; _settled = true; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
    function settlementExists(bytes32 wagerId) external view returns (bool) { return _settled && _settlement.wagerId == wagerId; }
    function getSettlement(bytes32 wagerId) external view returns (BetTypes420.Settlement memory) {
        require(_settled && _settlement.wagerId == wagerId, "settlement");
        return _settlement;
    }
}

contract MockMinesViewRandomness420 {
    RandomnessRouter420.RandomnessRequest private _request;
    bool private _exists;

    function setRequest(RandomnessRouter420.RandomnessRequest calldata request_) external { _request = request_; _exists = true; }
    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory) {
        require(_exists && _request.wagerId == wagerId, "request");
        return _request;
    }
}

contract MockMinesViewGame420 {
    address public wagerRegistry;
    address public randomnessRouter;
    bytes32 public gameVersionId;
    uint8 public constant MIN_MINES = 1;
    uint8 public constant MAX_MINES = 24;

    MinesV1420.SessionState private _session;
    MinesV1420.BoardCommitment private _board;
    bool private _sessionExists;
    bool private _boardExists;

    constructor(address registry_, address randomness_, bytes32 version_) {
        wagerRegistry = registry_;
        randomnessRouter = randomness_;
        gameVersionId = version_;
    }

    function setSession(MinesV1420.SessionState calldata session_) external { _session = session_; _sessionExists = true; }
    function clearSession() external { _sessionExists = false; }
    function setBoard(MinesV1420.BoardCommitment calldata board_) external { _board = board_; _boardExists = true; }

    function getSession(bytes32) external view returns (MinesV1420.SessionState memory) {
        require(_sessionExists, "session");
        return _session;
    }

    function getBoard(bytes32, RandomnessRouter420.Source) external view returns (MinesV1420.BoardCommitment memory) {
        require(_boardExists, "board");
        return _board;
    }

    function requiredMaxGrossPayout(uint256 stake, uint8 mineCount) external pure returns (uint256) {
        return stake * (uint256(mineCount) + 1);
    }
}

contract BetMinesViewAdapter420Test {
    bytes32 constant WAGER = keccak256("mines/view/wager");
    bytes32 constant GAME = keccak256("420BET.GAME.MINES");
    bytes32 constant VERSION = keccak256("420BET.GAME.MINES.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.MINES.V1");
    address constant PLAYER = address(0x420);

    struct Suite {
        MockMinesViewRegistry420 registry;
        MockMinesViewRandomness420 randomness;
        MockMinesViewGame420 game;
        MinesViewAdapter420 viewAdapter;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockMinesViewRegistry420();
        s.randomness = new MockMinesViewRandomness420();
        s.game = new MockMinesViewGame420(address(s.registry), address(s.randomness), VERSION);
        s.viewAdapter = new MinesViewAdapter420(address(s.game));

        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: VERSION,
            asset: address(0),
            stake: 100,
            maxGrossPayout: 1000,
            paramsHash: keccak256("params"),
            vaultId: keccak256("vault"),
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: 10,
            deadline: 1000,
            status: BetTypes420.WagerStatus.ACCEPTED
        }));
    }

    function testPreRandomnessSnapshotDoesNotRevert() public {
        Suite memory s = _deploy();
        MinesViewAdapter420.Snapshot memory snap = s.viewAdapter.snapshot(WAGER);
        require(snap.wagerId == WAGER && snap.player == PLAYER, "identity");
        require(!snap.randomnessRequested && !snap.sessionExists && !snap.settlementAvailable, "early flags");
    }

    function testActiveSnapshotIncludesBoardAndCashoutState() public {
        Suite memory s = _deploy();
        s.randomness.setRequest(RandomnessRouter420.RandomnessRequest({
            wagerId: WAGER,
            profileId: keccak256("randomness"),
            gameVersionId: VERSION,
            paramsHash: keccak256("params"),
            contextHash: keccak256("context"),
            requestedAt: 11,
            fallbackAt: 20,
            root: keccak256("root"),
            proofHash: keccak256("proof"),
            entropyHash: keccak256("entropy"),
            source: RandomnessRouter420.Source.PRIMARY,
            fulfilled: true
        }));
        s.game.setBoard(MinesV1420.BoardCommitment({
            source: RandomnessRouter420.Source.PRIMARY,
            seedCommitment: keccak256("seed"),
            boardRoot: keccak256("board"),
            randomnessRoot: keccak256("root"),
            seedCommitted: true,
            boardBound: true
        }));
        s.game.setSession(MinesV1420.SessionState({
            phase: MinesV1420.Phase.ACTIVE,
            player: PLAYER,
            mineCount: 5,
            safeReveals: 2,
            revealedMask: 0x60,
            currentGrossPayout: 150,
            cashoutGrossPayout: 0,
            mineHit: false,
            cashedOut: false,
            exists: true
        }));

        MinesViewAdapter420.Snapshot memory snap = s.viewAdapter.snapshot(WAGER);
        require(snap.randomnessRequested && snap.randomnessFulfilled, "randomness");
        require(snap.seedCommitted && snap.boardBound && snap.boardRoot == keccak256("board"), "board");
        require(snap.sessionExists && snap.phase == MinesV1420.Phase.ACTIVE, "session");
        require(snap.safeReveals == 2 && snap.currentGrossPayout == 150, "progress");
        require(snap.canCashOut, "cashout");
        require(snap.requiredMaxGrossPayout == 600, "required max");
    }

    function testTerminalSettledSnapshotIsStable() public {
        Suite memory s = _deploy();
        s.game.setSession(MinesV1420.SessionState({
            phase: MinesV1420.Phase.TERMINAL,
            player: PLAYER,
            mineCount: 5,
            safeReveals: 3,
            revealedMask: 0xE0,
            currentGrossPayout: 200,
            cashoutGrossPayout: 200,
            mineHit: false,
            cashedOut: true,
            exists: true
        }));
        s.registry.setSettlement(BetTypes420.Settlement({
            wagerId: WAGER,
            outcome: BetTypes420.TerminalOutcome.WIN,
            grossPayout: 200,
            settledAt: 50
        }));

        MinesViewAdapter420.Snapshot memory snap = s.viewAdapter.snapshot(WAGER);
        require(snap.phase == MinesV1420.Phase.TERMINAL && snap.cashedOut, "terminal");
        require(!snap.canCashOut, "closed");
        require(snap.settlementAvailable, "settled");
        require(snap.outcome == BetTypes420.TerminalOutcome.WIN && snap.settledGrossPayout == 200, "result");
    }
}
