// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/MinesV1420.sol";
import "../src/bet/MinesSettlementAdapter420.sol";

interface VmBetMinesSettlement420 {
    function expectRevert(bytes4) external;
}

contract MockMinesSettlementRegistry420 {
    BetTypes420.Wager private _wager;

    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockMinesSettlementSource420 {
    address public wagerRegistry;
    bytes32 public gameVersionId;
    MinesV1420.SessionState private _session;

    constructor(address registry_, bytes32 gameVersionId_) {
        wagerRegistry = registry_;
        gameVersionId = gameVersionId_;
    }

    function setSession(MinesV1420.SessionState calldata session_) external { _session = session_; }
    function getSession(bytes32) external view returns (MinesV1420.SessionState memory) { return _session; }
}

contract MockMinesSettlementEngine420 {
    bytes32 public lastWagerId;
    BetTypes420.TerminalOutcome public lastOutcome;
    uint256 public lastGrossPayout;
    address public lastCaller;

    function settle(bytes32 wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout)
        external
        returns (BetTypes420.Settlement memory settlement)
    {
        lastWagerId = wagerId;
        lastOutcome = outcome;
        lastGrossPayout = grossPayout;
        lastCaller = msg.sender;
        settlement = BetTypes420.Settlement({
            wagerId: wagerId,
            outcome: outcome,
            grossPayout: grossPayout,
            settledAt: uint64(block.timestamp)
        });
    }
}

contract BetMinesSettlementAdapter420Test {
    VmBetMinesSettlement420 constant vm = VmBetMinesSettlement420(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 constant WAGER = keccak256("mines/settlement/wager");
    bytes32 constant GAME = keccak256("420BET.GAME.MINES");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.MINES.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.MINES.V1");
    address constant PLAYER = address(0xC0FFEE);
    uint256 constant STAKE = 100 ether;
    uint256 constant MAX_GROSS = 1000 ether;

    struct Suite {
        MockMinesSettlementRegistry420 registry;
        MockMinesSettlementSource420 mines;
        MockMinesSettlementEngine420 engine;
        MinesSettlementAdapter420 adapter;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockMinesSettlementRegistry420();
        s.mines = new MockMinesSettlementSource420(address(s.registry), GAME_V1);
        s.engine = new MockMinesSettlementEngine420();
        s.adapter = new MinesSettlementAdapter420(address(s.mines), address(s.engine));
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0),
            stake: STAKE,
            maxGrossPayout: MAX_GROSS,
            paramsHash: keccak256("params"),
            vaultId: keccak256("vault"),
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            status: BetTypes420.WagerStatus.ACCEPTED
        }));
    }

    function _session(
        MinesV1420.Phase phase,
        uint256 currentGross,
        uint256 cashoutGross,
        bool mineHit,
        bool cashedOut
    ) private pure returns (MinesV1420.SessionState memory session) {
        session = MinesV1420.SessionState({
            phase: phase,
            player: PLAYER,
            mineCount: 5,
            safeReveals: cashoutGross == 0 ? 0 : 1,
            revealedMask: cashoutGross == 0 ? 0 : uint32(1 << 7),
            currentGrossPayout: currentGross,
            cashoutGrossPayout: cashoutGross,
            mineHit: mineHit,
            cashedOut: cashedOut,
            exists: true
        });
    }

    function testActiveSessionCannotSettle() public {
        Suite memory s = _deploy();
        s.mines.setSession(_session(MinesV1420.Phase.ACTIVE, STAKE, 0, false, false));
        vm.expectRevert(MinesSettlementAdapter420.SessionNotTerminal.selector);
        s.adapter.settle(WAGER);
    }

    function testMineHitMapsToCanonicalLossZeroPayout() public {
        Suite memory s = _deploy();
        s.mines.setSession(_session(MinesV1420.Phase.TERMINAL, 0, 0, true, false));

        (BetTypes420.TerminalOutcome outcome, uint256 gross) = s.adapter.terminalResult(WAGER);
        require(outcome == BetTypes420.TerminalOutcome.LOSS, "outcome");
        require(gross == 0, "gross");

        BetTypes420.Settlement memory settlement = s.adapter.settle(WAGER);
        require(settlement.outcome == BetTypes420.TerminalOutcome.LOSS, "settled outcome");
        require(settlement.grossPayout == 0, "settled gross");
        require(s.engine.lastCaller() == address(s.adapter), "authority boundary");
    }

    function testExactStakeCashoutMapsToPush() public {
        Suite memory s = _deploy();
        s.mines.setSession(_session(MinesV1420.Phase.TERMINAL, STAKE, STAKE, false, true));
        (BetTypes420.TerminalOutcome outcome, uint256 gross) = s.adapter.terminalResult(WAGER);
        require(outcome == BetTypes420.TerminalOutcome.PUSH, "outcome");
        require(gross == STAKE, "gross");
    }

    function testProfitableCashoutMapsToWinAndForwardsLockedPayout() public {
        Suite memory s = _deploy();
        uint256 payout = 150 ether;
        s.mines.setSession(_session(MinesV1420.Phase.TERMINAL, payout, payout, false, true));
        s.adapter.settle(WAGER);
        require(s.engine.lastWagerId() == WAGER, "wager");
        require(s.engine.lastOutcome() == BetTypes420.TerminalOutcome.WIN, "outcome");
        require(s.engine.lastGrossPayout() == payout, "payout");
    }

    function testImpossibleTerminalCombinationsFailClosed() public {
        Suite memory s = _deploy();
        s.mines.setSession(_session(MinesV1420.Phase.TERMINAL, 1, 0, true, false));
        vm.expectRevert(MinesSettlementAdapter420.InvalidTerminalState.selector);
        s.adapter.terminalResult(WAGER);

        s.mines.setSession(_session(MinesV1420.Phase.TERMINAL, 0, 0, false, true));
        vm.expectRevert(MinesSettlementAdapter420.InvalidTerminalState.selector);
        s.adapter.terminalResult(WAGER);
    }

    function testCashoutCannotExceedAcceptedReservedMaximum() public {
        Suite memory s = _deploy();
        s.mines.setSession(_session(MinesV1420.Phase.TERMINAL, MAX_GROSS + 1, MAX_GROSS + 1, false, true));
        vm.expectRevert(MinesSettlementAdapter420.InvalidPayout.selector);
        s.adapter.terminalResult(WAGER);
    }
}
