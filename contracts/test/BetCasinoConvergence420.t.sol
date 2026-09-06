// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BlackjackV1420.sol";
import "../src/bet/DiceV1420.sol";
import "../src/bet/ICasinoGame420.sol";
import "../src/bet/KenoV1420.sol";
import "../src/bet/MinesV1420.sol";
import "../src/bet/PlinkoV1420.sol";
import "../src/bet/ReferenceSlotV1420.sol";
import "../src/bet/RouletteV1420.sol";

contract MockCasinoConvergenceRandomness420 {
    function authorization() external pure returns (BetAuthorization420) {
        return BetAuthorization420(address(0xA11CE));
    }
}

contract BetCasinoConvergence420Test {
    address constant REGISTRY = address(0xBEEF);
    address constant STREAM = address(0x5151);

    bytes32 constant DICE = keccak256("420BET.GAME.DICE");
    bytes32 constant DICE_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant DICE_RULESET = keccak256("420BET.RULESET.DICE.V1");
    bytes32 constant KENO = keccak256("420BET.GAME.KENO");
    bytes32 constant KENO_V1 = keccak256("420BET.GAME.KENO.V1");
    bytes32 constant KENO_RULESET = keccak256("420BET.RULESET.KENO.V1");
    bytes32 constant PLINKO = keccak256("420BET.GAME.PLINKO");
    bytes32 constant PLINKO_V1 = keccak256("420BET.GAME.PLINKO.V1");
    bytes32 constant PLINKO_RULESET = keccak256("420BET.RULESET.PLINKO.V1");
    bytes32 constant SLOT = keccak256("420BET.GAME.SLOT.REFERENCE");
    bytes32 constant SLOT_V1 = keccak256("420BET.GAME.SLOT.REFERENCE.V1");
    bytes32 constant SLOT_RULESET = keccak256("420BET.RULESET.SLOT.REFERENCE.V1");
    bytes32 constant ROULETTE = keccak256("420BET.GAME.ROULETTE");
    bytes32 constant ROULETTE_V1 = keccak256("420BET.GAME.ROULETTE.V1");
    bytes32 constant ROULETTE_RULESET = keccak256("420BET.RULESET.ROULETTE.V1");
    bytes32 constant BLACKJACK = keccak256("420BET.GAME.BLACKJACK");
    bytes32 constant BLACKJACK_V1 = keccak256("420BET.GAME.BLACKJACK.V1");
    bytes32 constant BLACKJACK_RULESET = keccak256("420BET.RULESET.BLACKJACK.V1");
    bytes32 constant MINES = keccak256("420BET.GAME.MINES");
    bytes32 constant MINES_V1 = keccak256("420BET.GAME.MINES.V1");
    bytes32 constant MINES_RULESET = keccak256("420BET.RULESET.MINES.V1");

    function _assertBinding(ICasinoGame420 game, string memory expectedName, bytes32 expectedGame, bytes32 expectedVersion, bytes32 expectedRuleset) private view {
        require(keccak256(bytes(game.systemName())) == keccak256(bytes(expectedName)), "system name");
        require(game.protocolVersion() == 1, "protocol version");
        require(game.gameId() == expectedGame, "game id");
        require(game.gameVersionId() == expectedVersion, "game version");
        require(game.rulesetId() == expectedRuleset, "ruleset");
        require(expectedGame != bytes32(0) && expectedVersion != bytes32(0) && expectedRuleset != bytes32(0), "zero binding");
    }

    function testFirstPartyCasinoModulesShareCanonicalBindingSurface() public {
        MockCasinoConvergenceRandomness420 randomness = new MockCasinoConvergenceRandomness420();
        DiceV1420 dice = new DiceV1420(REGISTRY, address(randomness), DICE, DICE_V1, DICE_RULESET);
        KenoV1420 keno = new KenoV1420(REGISTRY, address(randomness), KENO, KENO_V1, KENO_RULESET);
        PlinkoV1420 plinko = new PlinkoV1420(REGISTRY, address(randomness), PLINKO, PLINKO_V1, PLINKO_RULESET);
        ReferenceSlotV1420 slot = new ReferenceSlotV1420(REGISTRY, address(randomness), STREAM, SLOT, SLOT_V1, SLOT_RULESET);
        RouletteV1420 roulette = new RouletteV1420(REGISTRY, address(randomness), ROULETTE, ROULETTE_V1, ROULETTE_RULESET);
        BlackjackV1420 blackjack = new BlackjackV1420(REGISTRY, address(randomness), BLACKJACK, BLACKJACK_V1, BLACKJACK_RULESET);
        MinesV1420 mines = new MinesV1420(REGISTRY, address(randomness), MINES, MINES_V1, MINES_RULESET);

        _assertBinding(ICasinoGame420(address(dice)), "DiceV1420", DICE, DICE_V1, DICE_RULESET);
        _assertBinding(ICasinoGame420(address(keno)), "KenoV1420", KENO, KENO_V1, KENO_RULESET);
        _assertBinding(ICasinoGame420(address(plinko)), "PlinkoV1420", PLINKO, PLINKO_V1, PLINKO_RULESET);
        _assertBinding(ICasinoGame420(address(slot)), "ReferenceSlotV1420", SLOT, SLOT_V1, SLOT_RULESET);
        _assertBinding(ICasinoGame420(address(roulette)), "RouletteV1420", ROULETTE, ROULETTE_V1, ROULETTE_RULESET);
        _assertBinding(ICasinoGame420(address(blackjack)), "BlackjackV1420", BLACKJACK, BLACKJACK_V1, BLACKJACK_RULESET);
        _assertBinding(ICasinoGame420(address(mines)), "MinesV1420", MINES, MINES_V1, MINES_RULESET);
    }

    function testGameVersionBindingsAreDomainSeparatedAcrossCasinoModules() public pure {
        bytes32[7] memory versions = [DICE_V1, KENO_V1, PLINKO_V1, SLOT_V1, ROULETTE_V1, BLACKJACK_V1, MINES_V1];
        bytes32[7] memory rulesets = [DICE_RULESET, KENO_RULESET, PLINKO_RULESET, SLOT_RULESET, ROULETTE_RULESET, BLACKJACK_RULESET, MINES_RULESET];
        for (uint256 i = 0; i < versions.length; ++i) {
            for (uint256 j = i + 1; j < versions.length; ++j) {
                require(versions[i] != versions[j], "game version collision");
                require(rulesets[i] != rulesets[j], "ruleset collision");
            }
        }
    }
}
