// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/DiceV1420.sol";

interface VmBetDicePostSettlement420 {
    function expectRevert(bytes4) external;
}

contract MockDicePostSettlementRegistry420 {
    BetTypes420.Wager private _wager;

    function setWager(BetTypes420.Wager memory wager) external { _wager = wager; }
    function setStatus(BetTypes420.WagerStatus status) external { _wager.status = status; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "not found");
        return _wager;
    }
}

contract MockDicePostSettlementRandomness420 {
    bytes32 private _root;
    function setRoot(bytes32 root_) external { _root = root_; }
    function rootOf(bytes32) external view returns (bytes32) { return _root; }
}

contract BetDicePostSettlementVerification420Test {
    VmBetDicePostSettlement420 constant vm =
        VmBetDicePostSettlement420(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 constant WAGER = keccak256("wager/dice/post-settlement");
    bytes32 constant GAME = keccak256("420BET.GAME.DICE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant RULESET = keccak256("ruleset/dice/v1");

    function _suite()
        private
        returns (
            MockDicePostSettlementRegistry420 registry,
            MockDicePostSettlementRandomness420 randomness,
            DiceV1420 dice,
            DiceV1420.Params memory params
        )
    {
        registry = new MockDicePostSettlementRegistry420();
        randomness = new MockDicePostSettlementRandomness420();
        dice = new DiceV1420(address(registry), address(randomness), GAME, GAME_V1, RULESET);
        params = DiceV1420.Params({rollUnder: true, threshold: 5000, winGrossPayout: 190 ether});

        BetTypes420.Wager memory wager = BetTypes420.Wager({
            wagerId: WAGER,
            player: address(0xC0FFEE),
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA),
            stake: 100 ether,
            maxGrossPayout: 190 ether,
            paramsHash: dice.hashParams(params),
            vaultId: keccak256("vault"),
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: 1,
            deadline: type(uint64).max,
            status: BetTypes420.WagerStatus.SETTLED
        });
        registry.setWager(wager);
        randomness.setRoot(keccak256("canonical-dice-root"));
    }

    function testSettledDiceWagerRemainsIndependentlyReproducible() public {
        (
            MockDicePostSettlementRegistry420 registry,
            MockDicePostSettlementRandomness420 randomness,
            DiceV1420 dice,
            DiceV1420.Params memory params
        ) = _suite();
        registry;
        randomness;

        DiceV1420.Result memory first = dice.resolve(WAGER, params);
        DiceV1420.Result memory second = dice.resolve(WAGER, params);

        require(first.wagerId == WAGER, "wrong wager");
        require(first.roll >= 1 && first.roll <= 10_000, "roll out of range");
        require(first.roll == second.roll, "roll not reproducible");
        require(first.outcome == second.outcome, "outcome not reproducible");
        require(first.grossPayout == second.grossPayout, "payout not reproducible");
        require(first.randomnessRoot == keccak256("canonical-dice-root"), "wrong root");
        require(first.paramsHash == dice.hashParams(params), "wrong params hash");
    }

    function testVoidedWagerDoesNotMasqueradeAsNormalDiceResult() public {
        (
            MockDicePostSettlementRegistry420 registry,
            MockDicePostSettlementRandomness420 randomness,
            DiceV1420 dice,
            DiceV1420.Params memory params
        ) = _suite();
        randomness;
        registry.setStatus(BetTypes420.WagerStatus.VOID);

        vm.expectRevert(DiceV1420.InvalidWagerStatus.selector);
        dice.resolve(WAGER, params);
    }
}
