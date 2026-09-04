// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/MinesV1420.sol";

interface VmBetMinesV1420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockMinesRegistry420 {
    BetTypes420.Wager private _wager;

    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract BetMinesV1420Test {
    VmBetMinesV1420 constant vm = VmBetMinesV1420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xC0FFEE);
    address constant OTHER = address(0xBAD);
    bytes32 constant WAGER = keccak256("mines/wager");
    bytes32 constant GAME = keccak256("420BET.GAME.MINES");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.MINES.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.MINES.V1");

    struct Suite {
        MockMinesRegistry420 registry;
        MinesV1420 mines;
        MinesV1420.Params params;
    }

    function _deploy(uint8 mineCount) private returns (Suite memory s) {
        s.registry = new MockMinesRegistry420();
        s.mines = new MinesV1420(address(s.registry), GAME, GAME_V1, RULESET);
        s.params = MinesV1420.Params({mineCount: mineCount});
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0),
            stake: 100 ether,
            maxGrossPayout: 1000 ether,
            paramsHash: s.mines.hashParams(s.params),
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

    function testCanonicalBindingSurface() public {
        Suite memory s = _deploy(5);
        require(keccak256(bytes(s.mines.systemName())) == keccak256(bytes("MinesV1420")), "system");
        require(s.mines.protocolVersion() == 1, "protocol");
        require(s.mines.gameId() == GAME, "game");
        require(s.mines.gameVersionId() == GAME_V1, "version");
        require(s.mines.rulesetId() == RULESET, "ruleset");
        require(s.mines.BOARD_CELLS() == 25, "board");
    }

    function testPlayerCanStartBoundSession() public {
        Suite memory s = _deploy(5);
        vm.prank(PLAYER);
        s.mines.startSession(WAGER, s.params);

        MinesV1420.SessionState memory session = s.mines.getSession(WAGER);
        require(session.phase == MinesV1420.Phase.ACTIVE, "phase");
        require(session.player == PLAYER, "player");
        require(session.mineCount == 5, "mines");
        require(session.safeReveals == 0, "reveals");
        require(session.revealedMask == 0, "mask");
    }

    function testOnlyPlayerCanStartSession() public {
        Suite memory s = _deploy(5);
        vm.prank(OTHER);
        vm.expectRevert(MinesV1420.NotPlayer.selector);
        s.mines.startSession(WAGER, s.params);
    }

    function testParamsAreDomainBoundToAcceptedWager() public {
        Suite memory s = _deploy(5);
        MinesV1420.Params memory wrong = MinesV1420.Params({mineCount: 6});
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.ParamsMismatch.selector);
        s.mines.startSession(WAGER, wrong);
    }

    function testSessionCannotBeStartedTwice() public {
        Suite memory s = _deploy(5);
        vm.prank(PLAYER);
        s.mines.startSession(WAGER, s.params);
        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.SessionAlreadyStarted.selector);
        s.mines.startSession(WAGER, s.params);
    }

    function testSafeCellStateIsUniqueAndBounded() public {
        Suite memory s = _deploy(5);
        vm.prank(PLAYER);
        s.mines.startSession(WAGER, s.params);

        vm.prank(PLAYER);
        s.mines.recordSafeCell(WAGER, 7);
        MinesV1420.SessionState memory session = s.mines.getSession(WAGER);
        require(session.safeReveals == 1, "count");
        require(s.mines.isCellRevealed(WAGER, 7), "not revealed");

        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.CellAlreadyRevealed.selector);
        s.mines.recordSafeCell(WAGER, 7);

        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.InvalidCell.selector);
        s.mines.recordSafeCell(WAGER, 25);
    }

    function testTerminalStateClosesFurtherProgression() public {
        Suite memory s = _deploy(5);
        vm.prank(PLAYER);
        s.mines.startSession(WAGER, s.params);
        vm.prank(PLAYER);
        s.mines.recordSafeCell(WAGER, 3);
        vm.prank(PLAYER);
        s.mines.markTerminal(WAGER, false, true);

        MinesV1420.SessionState memory session = s.mines.getSession(WAGER);
        require(session.phase == MinesV1420.Phase.TERMINAL, "not terminal");
        require(session.cashedOut && !session.mineHit, "terminal flags");

        vm.prank(PLAYER);
        vm.expectRevert(MinesV1420.InvalidPhase.selector);
        s.mines.recordSafeCell(WAGER, 4);
    }

    function testMineCountBoundsFailClosed() public {
        MockMinesRegistry420 registry = new MockMinesRegistry420();
        MinesV1420 mines = new MinesV1420(address(registry), GAME, GAME_V1, RULESET);
        vm.expectRevert(MinesV1420.InvalidParams.selector);
        mines.hashParams(MinesV1420.Params({mineCount: 0}));
        vm.expectRevert(MinesV1420.InvalidParams.selector);
        mines.hashParams(MinesV1420.Params({mineCount: 25}));
    }
}
