// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/RouletteV1420.sol";

interface VmBetRouletteHardening420 {
    function expectRevert(bytes4) external;
}

contract MockRouletteHardeningRegistry420 {
    BetTypes420.Wager private _wager;

    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }

    function setStatus(BetTypes420.WagerStatus status_) external { _wager.status = status_; }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockRouletteHardeningRandomness420 {
    mapping(bytes32 => bytes32) private _roots;

    function setRoot(bytes32 wagerId, bytes32 root) external { _roots[wagerId] = root; }

    function rootOf(bytes32 wagerId) external view returns (bytes32 root) {
        root = _roots[wagerId];
        require(root != bytes32(0), "root");
    }
}

contract BetRouletteHardening420Test {
    VmBetRouletteHardening420 constant vm = VmBetRouletteHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 constant GAME = keccak256("420BET.GAME.ROULETTE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.ROULETTE.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.ROULETTE.V1");
    bytes32 constant WAGER = keccak256("420BET.WAGER.ROULETTE.HARDENING");
    bytes32 constant VAULT = keccak256("420BET.VAULT.CADC.1");
    address constant PLAYER = address(0xBEEF);
    uint256 constant STAKE = 1 ether;

    struct Suite {
        MockRouletteHardeningRegistry420 registry;
        MockRouletteHardeningRandomness420 randomness;
        RouletteV1420 roulette;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockRouletteHardeningRegistry420();
        s.randomness = new MockRouletteHardeningRandomness420();
        s.roulette = new RouletteV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
    }

    function _install(
        Suite memory s,
        RouletteV1420.Params memory params,
        bytes32 root,
        BetTypes420.WagerStatus status
    ) private {
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA0C),
            stake: STAKE,
            maxGrossPayout: s.roulette.requiredMaxGrossPayout(STAKE, params),
            paramsHash: s.roulette.hashParams(params),
            vaultId: VAULT,
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            status: status
        }));
        s.randomness.setRoot(WAGER, root);
    }

    function _rootForPocket(uint8 target) private pure returns (bytes32 root) {
        for (uint256 i = 1; i < 20_000; ++i) {
            root = bytes32(i);
            uint8 pocket = uint8(uint256(keccak256(abi.encode(
                keccak256("420.BET.ROULETTE.V1.SPIN"), WAGER, GAME_V1, RULESET, root
            ))) % 37);
            if (pocket == target) return root;
        }
        revert("vector");
    }

    function _resolveAt(
        Suite memory s,
        RouletteV1420.Params memory params,
        uint8 pocket
    ) private returns (RouletteV1420.Result memory result) {
        _install(s, params, _rootForPocket(pocket), BetTypes420.WagerStatus.ACCEPTED);
        result = s.roulette.resolve(WAGER, params);
        require(result.pocket == pocket, "target pocket mismatch");
    }

    function testEveryNonZeroPocketIsExactlyOneColor() public {
        Suite memory s = _deploy();
        require(!s.roulette.isRed(0), "zero red");
        for (uint8 pocket = 1; pocket <= 36; ++pocket) {
            bool red = s.roulette.isRed(pocket);
            RouletteV1420.Params memory params = RouletteV1420.Params(
                red ? RouletteV1420.BetKind.RED : RouletteV1420.BetKind.BLACK,
                0
            );
            RouletteV1420.Result memory result = _resolveAt(s, params, pocket);
            require(result.outcome == BetTypes420.TerminalOutcome.WIN, "canonical color lost");

            RouletteV1420.Params memory opposite = RouletteV1420.Params(
                red ? RouletteV1420.BetKind.BLACK : RouletteV1420.BetKind.RED,
                0
            );
            RouletteV1420.Result memory oppositeResult = _resolveAt(s, opposite, pocket);
            require(oppositeResult.outcome == BetTypes420.TerminalOutcome.LOSS, "both colors won");
        }
    }

    function testParityAndRangePartitionAllNonZeroPockets() public {
        Suite memory s = _deploy();
        for (uint8 pocket = 1; pocket <= 36; ++pocket) {
            RouletteV1420.Params memory parity = RouletteV1420.Params(
                pocket % 2 == 0 ? RouletteV1420.BetKind.EVEN : RouletteV1420.BetKind.ODD,
                0
            );
            require(_resolveAt(s, parity, pocket).outcome == BetTypes420.TerminalOutcome.WIN, "parity");

            RouletteV1420.Params memory range = RouletteV1420.Params(
                pocket <= 18 ? RouletteV1420.BetKind.LOW : RouletteV1420.BetKind.HIGH,
                0
            );
            require(_resolveAt(s, range, pocket).outcome == BetTypes420.TerminalOutcome.WIN, "range");
        }
    }

    function testEveryPocketMapsToExactlyOneDozenAndColumn() public {
        Suite memory s = _deploy();
        for (uint8 pocket = 1; pocket <= 36; ++pocket) {
            uint8 dozen = uint8(((uint256(pocket) - 1) / 12) + 1);
            uint8 column = uint8(((uint256(pocket) - 1) % 3) + 1);

            RouletteV1420.Params memory dozenParams = RouletteV1420.Params(RouletteV1420.BetKind.DOZEN, dozen);
            RouletteV1420.Params memory columnParams = RouletteV1420.Params(RouletteV1420.BetKind.COLUMN, column);
            require(_resolveAt(s, dozenParams, pocket).outcome == BetTypes420.TerminalOutcome.WIN, "dozen map");
            require(_resolveAt(s, columnParams, pocket).outcome == BetTypes420.TerminalOutcome.WIN, "column map");

            uint8 wrongDozen = dozen == 3 ? 1 : dozen + 1;
            uint8 wrongColumn = column == 3 ? 1 : column + 1;
            require(
                _resolveAt(s, RouletteV1420.Params(RouletteV1420.BetKind.DOZEN, wrongDozen), pocket).outcome
                    == BetTypes420.TerminalOutcome.LOSS,
                "multiple dozens"
            );
            require(
                _resolveAt(s, RouletteV1420.Params(RouletteV1420.BetKind.COLUMN, wrongColumn), pocket).outcome
                    == BetTypes420.TerminalOutcome.LOSS,
                "multiple columns"
            );
        }
    }

    function testStraightBetExhaustivelyWinsOnlySelectedPocket() public {
        Suite memory s = _deploy();
        uint8 selection = 17;
        RouletteV1420.Params memory params = RouletteV1420.Params(RouletteV1420.BetKind.STRAIGHT, selection);
        for (uint8 pocket = 0; pocket <= 36; ++pocket) {
            RouletteV1420.Result memory result = _resolveAt(s, params, pocket);
            bool shouldWin = pocket == selection;
            require(
                result.outcome == (shouldWin ? BetTypes420.TerminalOutcome.WIN : BetTypes420.TerminalOutcome.LOSS),
                "straight outcome"
            );
            require(result.grossPayout == (shouldWin ? 36 ether : 0), "straight payout");
        }
    }

    function testSettledWagerRemainsReproducible() public {
        Suite memory s = _deploy();
        RouletteV1420.Params memory params = RouletteV1420.Params(RouletteV1420.BetKind.RED, 0);
        bytes32 root = _rootForPocket(19);
        _install(s, params, root, BetTypes420.WagerStatus.SETTLED);

        RouletteV1420.Result memory a = s.roulette.resolve(WAGER, params);
        RouletteV1420.Result memory b = s.roulette.resolve(WAGER, params);
        require(a.pocket == 19 && b.pocket == 19, "replay pocket");
        require(a.outcome == BetTypes420.TerminalOutcome.WIN, "replay outcome");
        require(a.grossPayout == 2 ether, "replay payout");
        require(a.randomnessRoot == root && b.randomnessRoot == root, "replay root");
    }

    function testVoidedWagerCannotBeReinterpretedAsGameOutcome() public {
        Suite memory s = _deploy();
        RouletteV1420.Params memory params = RouletteV1420.Params(RouletteV1420.BetKind.RED, 0);
        _install(s, params, _rootForPocket(19), BetTypes420.WagerStatus.VOID);
        vm.expectRevert(RouletteV1420.InvalidWagerStatus.selector);
        s.roulette.resolve(WAGER, params);
    }

    function testFuzzArbitraryRootAlwaysProducesCanonicalPocket(bytes32 seed) public {
        Suite memory s = _deploy();
        RouletteV1420.Params memory params = RouletteV1420.Params(RouletteV1420.BetKind.RED, 0);
        bytes32 root = keccak256(abi.encode("roulette-fuzz-root", seed));
        _install(s, params, root, BetTypes420.WagerStatus.ACCEPTED);

        RouletteV1420.Result memory first = s.roulette.resolve(WAGER, params);
        RouletteV1420.Result memory second = s.roulette.resolve(WAGER, params);
        require(first.pocket <= 36, "pocket range");
        require(first.pocket == second.pocket, "nondeterministic pocket");
        require(first.outcome == second.outcome, "nondeterministic outcome");
        require(first.grossPayout == second.grossPayout, "nondeterministic payout");
        require(first.randomnessRoot == root, "wrong root");
        if (first.pocket == 0) {
            require(first.outcome == BetTypes420.TerminalOutcome.LOSS, "zero red win");
            require(first.grossPayout == 0, "zero payout");
        } else if (s.roulette.isRed(first.pocket)) {
            require(first.outcome == BetTypes420.TerminalOutcome.WIN, "red lost");
            require(first.grossPayout == 2 ether, "red payout");
        } else {
            require(first.outcome == BetTypes420.TerminalOutcome.LOSS, "black won red");
            require(first.grossPayout == 0, "loss payout");
        }
    }

    function testFuzzPayoutScheduleCannotEscapeFiniteMultipliers(uint96 rawStake, uint8 rawKind) public {
        Suite memory s = _deploy();
        uint256 stake = uint256(rawStake) + 1;
        uint8 kindIndex = uint8((uint256(rawKind) % 9) + 1);
        RouletteV1420.BetKind kind = RouletteV1420.BetKind(kindIndex);
        uint8 selection = kind == RouletteV1420.BetKind.STRAIGHT ? 17
            : (kind == RouletteV1420.BetKind.DOZEN || kind == RouletteV1420.BetKind.COLUMN) ? 2
            : 0;
        RouletteV1420.Params memory params = RouletteV1420.Params(kind, selection);
        uint256 required = s.roulette.requiredMaxGrossPayout(stake, params);
        if (kind == RouletteV1420.BetKind.STRAIGHT) require(required == stake * 36, "straight multiplier");
        else if (kind == RouletteV1420.BetKind.DOZEN || kind == RouletteV1420.BetKind.COLUMN) {
            require(required == stake * 3, "3x multiplier");
        } else require(required == stake * 2, "2x multiplier");
    }
}
