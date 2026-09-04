// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/RouletteV1420.sol";

interface VmBetRoulette420 {
    function expectRevert(bytes4) external;
}

contract MockRouletteRegistry420 {
    BetTypes420.Wager private _wager;

    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockRouletteRandomness420 {
    mapping(bytes32 => bytes32) private _roots;

    function setRoot(bytes32 wagerId, bytes32 root) external { _roots[wagerId] = root; }

    function rootOf(bytes32 wagerId) external view returns (bytes32 root) {
        root = _roots[wagerId];
        require(root != bytes32(0), "root");
    }
}

contract BetRouletteV1420Test {
    VmBetRoulette420 constant vm = VmBetRoulette420(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 constant GAME = keccak256("420BET.GAME.ROULETTE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.ROULETTE.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.ROULETTE.V1");
    bytes32 constant WAGER = keccak256("420BET.WAGER.ROULETTE.VECTOR.1");
    bytes32 constant VAULT = keccak256("420BET.VAULT.CADC.1");
    address constant PLAYER = address(0xBEEF);
    uint256 constant STAKE = 10 ether;

    struct Suite {
        MockRouletteRegistry420 registry;
        MockRouletteRandomness420 randomness;
        RouletteV1420 roulette;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockRouletteRegistry420();
        s.randomness = new MockRouletteRandomness420();
        s.roulette = new RouletteV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
    }

    function _setWager(Suite memory s, RouletteV1420.Params memory params, uint256 maxGrossPayout, bytes32 root) private {
        bytes32 paramsHash = s.roulette.hashParams(params);
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA0C),
            stake: STAKE,
            maxGrossPayout: maxGrossPayout,
            paramsHash: paramsHash,
            vaultId: VAULT,
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            status: BetTypes420.WagerStatus.ACCEPTED
        }));
        s.randomness.setRoot(WAGER, root);
    }

    function _rootForPocket(uint8 target) private pure returns (bytes32 root) {
        for (uint256 i = 1; i < 10_000; ++i) {
            root = bytes32(i);
            uint8 pocket = uint8(uint256(keccak256(abi.encode(
                keccak256("420.BET.ROULETTE.V1.SPIN"), WAGER, GAME_V1, RULESET, root
            ))) % 37);
            if (pocket == target) return root;
        }
        revert("vector");
    }

    function testPayoutScheduleIsDerivedAndFinite() public {
        Suite memory s = _deploy();
        require(s.roulette.requiredMaxGrossPayout(STAKE, RouletteV1420.Params(RouletteV1420.BetKind.STRAIGHT, 17)) == 360 ether, "straight");
        require(s.roulette.requiredMaxGrossPayout(STAKE, RouletteV1420.Params(RouletteV1420.BetKind.DOZEN, 2)) == 30 ether, "dozen");
        require(s.roulette.requiredMaxGrossPayout(STAKE, RouletteV1420.Params(RouletteV1420.BetKind.COLUMN, 3)) == 30 ether, "column");
        require(s.roulette.requiredMaxGrossPayout(STAKE, RouletteV1420.Params(RouletteV1420.BetKind.RED, 0)) == 20 ether, "even money");
    }

    function testStraightZeroWinsAndPays36xGross() public {
        Suite memory s = _deploy();
        RouletteV1420.Params memory params = RouletteV1420.Params(RouletteV1420.BetKind.STRAIGHT, 0);
        bytes32 root = _rootForPocket(0);
        _setWager(s, params, 360 ether, root);

        RouletteV1420.Result memory result = s.roulette.resolve(WAGER, params);
        require(result.pocket == 0, "pocket");
        require(result.outcome == BetTypes420.TerminalOutcome.WIN, "outcome");
        require(result.grossPayout == 360 ether, "payout");
        require(result.randomnessRoot == root, "root");
    }

    function testZeroLosesAllEvenMoneyOutsideBets() public {
        Suite memory s = _deploy();
        bytes32 root = _rootForPocket(0);
        RouletteV1420.BetKind[6] memory kinds = [
            RouletteV1420.BetKind.RED,
            RouletteV1420.BetKind.BLACK,
            RouletteV1420.BetKind.EVEN,
            RouletteV1420.BetKind.ODD,
            RouletteV1420.BetKind.LOW,
            RouletteV1420.BetKind.HIGH
        ];
        for (uint256 i = 0; i < kinds.length; ++i) {
            RouletteV1420.Params memory params = RouletteV1420.Params(kinds[i], 0);
            _setWager(s, params, 20 ether, root);
            RouletteV1420.Result memory result = s.roulette.resolve(WAGER, params);
            require(result.pocket == 0, "zero");
            require(result.outcome == BetTypes420.TerminalOutcome.LOSS, "zero outside won");
            require(result.grossPayout == 0, "zero payout");
        }
    }

    function testCanonicalRedBlackSet() public {
        Suite memory s = _deploy();
        require(s.roulette.isRed(1), "1 red");
        require(s.roulette.isRed(18), "18 red");
        require(s.roulette.isRed(19), "19 red");
        require(s.roulette.isRed(36), "36 red");
        require(!s.roulette.isRed(0), "0 red");
        require(!s.roulette.isRed(2), "2 red");
        require(!s.roulette.isRed(35), "35 red");
    }

    function testDozenAndColumnResolution() public {
        Suite memory s = _deploy();
        bytes32 root = _rootForPocket(23);

        RouletteV1420.Params memory dozen = RouletteV1420.Params(RouletteV1420.BetKind.DOZEN, 2);
        _setWager(s, dozen, 30 ether, root);
        RouletteV1420.Result memory dozenResult = s.roulette.resolve(WAGER, dozen);
        require(dozenResult.pocket == 23, "pocket");
        require(dozenResult.outcome == BetTypes420.TerminalOutcome.WIN, "dozen");
        require(dozenResult.grossPayout == 30 ether, "dozen payout");

        RouletteV1420.Params memory column = RouletteV1420.Params(RouletteV1420.BetKind.COLUMN, 2);
        _setWager(s, column, 30 ether, root);
        RouletteV1420.Result memory columnResult = s.roulette.resolve(WAGER, column);
        require(columnResult.outcome == BetTypes420.TerminalOutcome.WIN, "column");
    }

    function testDeterministicPermanentTranscriptVector() public {
        Suite memory s = _deploy();
        RouletteV1420.Params memory params = RouletteV1420.Params(RouletteV1420.BetKind.STRAIGHT, 17);
        bytes32 root = bytes32(uint256(0x420));
        _setWager(s, params, 360 ether, root);

        RouletteV1420.Result memory first = s.roulette.resolve(WAGER, params);
        RouletteV1420.Result memory second = s.roulette.resolve(WAGER, params);
        require(first.pocket == second.pocket, "pocket changed");
        require(first.outcome == second.outcome, "outcome changed");
        require(first.grossPayout == second.grossPayout, "payout changed");
        require(first.paramsHash == second.paramsHash, "params changed");
        require(first.randomnessRoot == root, "root changed");
    }

    function testExactReservedMaximumIsRequired() public {
        Suite memory s = _deploy();
        RouletteV1420.Params memory params = RouletteV1420.Params(RouletteV1420.BetKind.RED, 0);
        _setWager(s, params, 21 ether, _rootForPocket(1));
        vm.expectRevert(RouletteV1420.InvalidPayout.selector);
        s.roulette.resolve(WAGER, params);
    }

    function testParamsAreDomainBoundAndCannotBeReinterpreted() public {
        Suite memory s = _deploy();
        RouletteV1420.Params memory red = RouletteV1420.Params(RouletteV1420.BetKind.RED, 0);
        _setWager(s, red, 20 ether, _rootForPocket(1));
        RouletteV1420.Params memory black = RouletteV1420.Params(RouletteV1420.BetKind.BLACK, 0);
        vm.expectRevert(RouletteV1420.ParamsMismatch.selector);
        s.roulette.resolve(WAGER, black);
    }

    function testInvalidSelectionsFailClosed() public {
        Suite memory s = _deploy();
        vm.expectRevert(RouletteV1420.InvalidParams.selector);
        s.roulette.hashParams(RouletteV1420.Params(RouletteV1420.BetKind.STRAIGHT, 37));
        vm.expectRevert(RouletteV1420.InvalidParams.selector);
        s.roulette.hashParams(RouletteV1420.Params(RouletteV1420.BetKind.DOZEN, 0));
        vm.expectRevert(RouletteV1420.InvalidParams.selector);
        s.roulette.hashParams(RouletteV1420.Params(RouletteV1420.BetKind.COLUMN, 4));
        vm.expectRevert(RouletteV1420.InvalidParams.selector);
        s.roulette.hashParams(RouletteV1420.Params(RouletteV1420.BetKind.RED, 1));
    }
}
