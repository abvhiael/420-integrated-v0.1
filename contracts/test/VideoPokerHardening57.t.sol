// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BetVideoPokerViews56.t.sol";

/// @notice Retained Video Poker adversarial and shared-casino boundary qualification.
/// @dev Inherits 5.6 lifecycle and 5.3 protected draw regressions.
contract VideoPokerHardening57Test is BetVideoPokerViews56Test {
    VideoPokerViewsV1420 private immutable inspector;

    constructor() {
        inspector = new VideoPokerViewsV1420(address(resolver));
    }

    function _params57() private pure returns (VideoPokerV1420.Params memory) {
        return VideoPokerV1420.Params({
            paytableId: keccak256("420BET.PAYTABLE.VIDEO_POKER.JACKS_OR_BETTER.V1"),
            credits: 5
        });
    }

    function _draw57(uint8 holdMask) private {
        bytes32 commitment = draw.seedCommitmentFor(WAGER, SEED);
        vm.prank(PROVIDER);
        draw.commitReplacement(WAGER, commitment, _params57());
        router.setFulfilled(WAGER, true);
        vm.prank(PLAYER);
        dealer.startInitialDeal(WAGER, _params57());
        vm.prank(PLAYER);
        draw.commitHold(WAGER, holdMask);
        vm.prank(PROVIDER);
        draw.revealAndDraw(WAGER, SEED);
    }

    function testTamperedFinalSettlementFailsBothReadSurfaces() public {
        _draw57(31);
        (, BetTypes420.TerminalOutcome result, uint256 gross,) =
            inspector.verifyResult(WAGER, _params57());
        BetTypes420.Wager memory wager = registry.getWager(WAGER);
        wager.status = BetTypes420.WagerStatus.SETTLED;
        registry.setWager(wager);
        registry.setSettlement(WAGER, result, gross);
        require(inspector.inspect(WAGER, _params57()).recordedGross == gross, "valid settlement unseen");
        // A forged payout must not be surfaced as if it were a valid settlement.
        registry.setSettlement(WAGER, result, gross + 1);
        vm.expectRevert(VideoPokerViewsV1420.ResultMismatch.selector);
        inspector.inspect(WAGER, _params57());
        vm.expectRevert(VideoPokerViewsV1420.ResultMismatch.selector);
        inspector.verifyResult(WAGER, _params57());
    }

    function testForgedTerminalOutcomeRejectedEvenWithExactGross() public {
        _draw57(31);
        (, BetTypes420.TerminalOutcome result, uint256 gross,) =
            inspector.verifyResult(WAGER, _params57());
        BetTypes420.Wager memory wager = registry.getWager(WAGER);
        wager.status = BetTypes420.WagerStatus.SETTLED;
        registry.setWager(wager);
        BetTypes420.TerminalOutcome forged = result == BetTypes420.TerminalOutcome.WIN
            ? BetTypes420.TerminalOutcome.LOSS : BetTypes420.TerminalOutcome.WIN;
        registry.setSettlement(WAGER, forged, gross);
        vm.expectRevert(VideoPokerViewsV1420.ResultMismatch.selector);
        inspector.inspect(WAGER, _params57());
    }

    function testVoidRefundMustExactlyEqualAcceptedStake() public {
        BetTypes420.Wager memory wager = registry.getWager(WAGER);
        wager.status = BetTypes420.WagerStatus.VOID;
        registry.setWager(wager);
        registry.setSettlement(WAGER, BetTypes420.TerminalOutcome.VOID, wager.stake + 1);
        vm.expectRevert(VideoPokerViewsV1420.ResultMismatch.selector);
        inspector.inspect(WAGER, _params57());
        registry.setSettlement(WAGER, BetTypes420.TerminalOutcome.VOID, wager.stake);
        VideoPokerViewsV1420.View memory viewData = inspector.inspect(WAGER, _params57());
        require(uint8(viewData.stage) == uint8(VideoPokerViewsV1420.Stage.VOID), "refund not void");
        require(!viewData.hasFinalHand, "fabricated terminal draw");
    }

    function testCrossGameVersionAndRulesetCannotReadVideoPokerWager() public {
        bytes32 wrongGame = keccak256("420BET.GAME.DICE");
        bytes32 wrongVersion = keccak256("420BET.GAME.DICE.V1");
        bytes32 wrongRules = keccak256("420BET.RULESET.DICE.V1");
        VideoPokerV1420 foreignGame = new VideoPokerV1420(address(registry), wrongGame, wrongVersion, wrongRules);
        vm.expectRevert(VideoPokerV1420.WrongGame.selector);
        foreignGame.validateWager(WAGER, _params57());
        VideoPokerV1420 foreignRules =
            new VideoPokerV1420(address(registry), GAME, VERSION, wrongRules);
        vm.expectRevert(VideoPokerV1420.WrongRuleset.selector);
        foreignRules.validateWager(WAGER, _params57());

        bytes32[9] memory versions = [
            VERSION, wrongVersion, keccak256("420BET.GAME.KENO.V1"),
            keccak256("420BET.GAME.PLINKO.V1"), keccak256("420BET.GAME.SLOT.REFERENCE.V1"),
            keccak256("420BET.GAME.ROULETTE.V1"), keccak256("420BET.GAME.BLACKJACK.V1"),
            keccak256("420BET.GAME.MINES.V1"), keccak256("420BET.GAME.CRASH.V1")
        ];
        for (uint256 i; i < 9; ++i) for (uint256 j = i + 1; j < 9; ++j)
            require(versions[i] != versions[j], "cross-game version collision");
    }

    function testVoidReadPreservesBindingsAndActiveGameplayRejection() public {
        BetTypes420.Wager memory wager = registry.getWager(WAGER);
        wager.status = BetTypes420.WagerStatus.VOID;
        registry.setWager(wager);
        registry.setSettlement(WAGER, BetTypes420.TerminalOutcome.VOID, wager.stake);
        require(uint8(inspector.inspect(WAGER, _params57()).stage)
            == uint8(VideoPokerViewsV1420.Stage.VOID), "canonical refund unreadable");

        // The active gameplay validator remains closed to terminal VOID wagers.
        vm.expectRevert(VideoPokerV1420.InvalidWagerStatus.selector);
        poker.validateWager(WAGER, _params57());

        VideoPokerV1420.Params memory incorrect = _params57();
        incorrect.credits = 4;
        vm.expectRevert(VideoPokerV1420.ParamsMismatch.selector);
        inspector.inspect(WAGER, incorrect);

        wager.gameVersionId = keccak256("foreign video poker version");
        registry.setWager(wager);
        vm.expectRevert(VideoPokerV1420.WrongGame.selector);
        inspector.inspect(WAGER, _params57());
        wager.gameVersionId = VERSION;
        wager.rulesetId = keccak256("foreign video poker ruleset");
        registry.setWager(wager);
        vm.expectRevert(VideoPokerV1420.WrongRuleset.selector);
        inspector.inspect(WAGER, _params57());
    }

    function testUnrevealedResultCannotBeAuthenticatedAsSettled() public {
        BetTypes420.Wager memory wager = registry.getWager(WAGER);
        wager.status = BetTypes420.WagerStatus.SETTLED;
        registry.setWager(wager);
        registry.setSettlement(WAGER, BetTypes420.TerminalOutcome.WIN, wager.maxGrossPayout);
        vm.expectRevert(VideoPokerViewsV1420.InconsistentState.selector);
        inspector.inspect(WAGER, _params57());
        vm.expectRevert(VideoPokerViewsV1420.NotDrawn.selector);
        inspector.verifyResult(WAGER, _params57());
    }
}
