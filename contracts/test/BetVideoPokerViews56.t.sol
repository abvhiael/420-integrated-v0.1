// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetVideoPokerSecureDraw.t.sol";
import "../src/bet/VideoPokerViewsV1420.sol";

contract BetVideoPokerViews56Test is BetVideoPokerSecureDrawTest {
    VideoPokerViewsV1420 private immutable views;
    constructor() {
        views = new VideoPokerViewsV1420(address(resolver));
    }
    function _parameters() private pure returns (VideoPokerV1420.Params memory) {
        return VideoPokerV1420.Params({
            paytableId: keccak256("420BET.PAYTABLE.VIDEO_POKER.JACKS_OR_BETTER.V1"), credits: 5
        });
    }
    function _prepareView() private {
        vm.prank(PROVIDER);
        draw.commitReplacement(WAGER, draw.seedCommitmentFor(WAGER, SEED), _parameters());
        router.setFulfilled(WAGER, true);
        vm.prank(PLAYER);
        dealer.startInitialDeal(WAGER, _parameters());
    }
    function testViewLifecycleAndNoPrematureFinalCards() public {
        VideoPokerViewsV1420.View memory v = views.inspect(WAGER, _parameters());
        require(uint8(v.stage) == uint8(VideoPokerViewsV1420.Stage.UNCOMMITTED), "initial stage");
        require(!v.hasInitialDeal && !v.hasFinalHand && !v.hasSettlement, "premature hand");
        vm.prank(PROVIDER);
        draw.commitReplacement(WAGER, draw.seedCommitmentFor(WAGER, SEED), _parameters());
        v = views.inspect(WAGER, _parameters());
        require(uint8(v.stage) == uint8(VideoPokerViewsV1420.Stage.COMMITTED), "commit stage");
        require(!v.hasInitialDeal && !v.hasFinalHand, "leaked unrevealed cards");
        router.setFulfilled(WAGER,true);
        vm.prank(PLAYER);
        dealer.startInitialDeal(WAGER,_parameters());
        v = views.inspect(WAGER,_parameters());
        require(uint8(v.stage) == uint8(VideoPokerViewsV1420.Stage.DEALT), "deal stage");
        require(v.hasInitialDeal && !v.hasFinalHand, "draw revealed early");
        vm.prank(PLAYER);
        draw.commitHold(WAGER,5);
        v = views.inspect(WAGER,_parameters());
        require(uint8(v.stage) == uint8(VideoPokerViewsV1420.Stage.HELD), "hold stage");
        require(v.hasHold && v.heldMask == 5 && !v.hasFinalHand, "hold visibility");
        vm.expectRevert(VideoPokerViewsV1420.NotDrawn.selector);
        views.verifyResult(WAGER,_parameters());
        vm.prank(PROVIDER);
        draw.revealAndDraw(WAGER,SEED);
        v = views.inspect(WAGER,_parameters());
        require(uint8(v.stage) == uint8(VideoPokerViewsV1420.Stage.DRAWN), "draw stage");
        require(v.hasFinalHand && v.seedRevealHash == keccak256(abi.encode(SEED)), "draw proof");
        (VideoPokerJacksOrBetter420.Category category,BetTypes420.TerminalOutcome outcome,uint256 gross,bool settled)
            = views.verifyResult(WAGER,_parameters());
        require(!settled && outcome != BetTypes420.TerminalOutcome.NONE, "unsettled quote");
        (,uint256 independentGross) = VideoPokerJacksOrBetter420.grossPayout(v.finalCards,1000,5);
        require(gross == independentGross, "payout mismatch");
        require(uint8(category) <= 9, "invalid category");
        require(v.paytableCommitment == VideoPokerJacksOrBetter420.paytableCommitment(), "paytable mismatch");
    }
    function testWithheldEntropyHasNoResult() public {
        _prepareView();
        vm.prank(PLAYER);
        draw.commitHold(WAGER,0);
        vm.warp(block.timestamp + 3600);
        draw.recordWithheldEntropy(WAGER);
        VideoPokerViewsV1420.View memory v = views.inspect(WAGER,_parameters());
        require(uint8(v.stage) == uint8(VideoPokerViewsV1420.Stage.WITHHELD), "not withheld");
        require(!v.hasFinalHand && !v.hasSettlement, "fabricated result");
        vm.expectRevert(VideoPokerViewsV1420.NotDrawn.selector);
        views.verifyResult(WAGER,_parameters());
    }
    function testWrongParamsAndUnknownWagersFailClosed() public {
        VideoPokerV1420.Params memory p = _parameters();
        p.paytableId = keccak256("fake paytable");
        vm.expectRevert(VideoPokerViewsV1420.WrongPaytable.selector);
        views.inspect(WAGER,p);
        vm.expectRevert(VideoPokerViewsV1420.WrongPaytable.selector);
        views.verifyResult(WAGER,p);
        p = _parameters();
        p.credits=4;
        vm.expectRevert(VideoPokerV1420.ParamsMismatch.selector);
        views.inspect(WAGER,p);
        p = _parameters();
        (bool ok,) = address(views).staticcall(abi.encodeWithSelector(
            VideoPokerViewsV1420.inspect.selector, bytes32(uint256(0xBABE)), p));
        require(!ok, "unknown wager accepted");
    }
    function testReadOnlyCallsDoNotChangeGameState() public {
        _prepareView();
        vm.prank(PLAYER);
        draw.commitHold(WAGER,31);
        vm.prank(PROVIDER);
        draw.revealAndDraw(WAGER,SEED);
        VideoPokerDrawV1420.Session memory prior = draw.getSession(WAGER);
        views.inspect(WAGER,_parameters());
        views.verifyResult(WAGER,_parameters());
        VideoPokerDrawV1420.Session memory afterCall = draw.getSession(WAGER);
        require(keccak256(abi.encode(prior))==keccak256(abi.encode(afterCall)), "mutated session");
    }
}
