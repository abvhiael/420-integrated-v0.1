// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/VideoPokerResolverV1420.sol";

interface VmBetDrawV1420 {
    function expectRevert(bytes4 selector) external;
    function prank(address actor) external;
    function warp(uint256 newTime) external;
}

contract MockVideoPokerSecureRegistry {
    mapping(bytes32 => BetTypes420.Wager) internal wagers;
    function setWager(BetTypes420.Wager calldata wager) external { wagers[wager.wagerId] = wager; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory) {
        require(wagers[wagerId].wagerId != bytes32(0), "unknown");
        return wagers[wagerId];
    }
}

contract MockVideoPokerSecureRandomness {
    mapping(bytes32 => RandomnessRouter420.RandomnessRequest) internal requests;
    RandomnessRouter420.RandomnessProfile internal profile;
    constructor() {
        profile.profileId = keccak256("profile");
        profile.primaryProvider = address(0xAA1);
        profile.fallbackProvider = address(0xAA2);
        profile.exists = true;
    }
    function setRequest(bytes32 id, RandomnessRouter420.RandomnessRequest calldata request) external { requests[id] = request; }
    function getRequest(bytes32 id) external view returns (RandomnessRouter420.RandomnessRequest memory) { return requests[id]; }
    function getProfile(bytes32) external view returns (RandomnessRouter420.RandomnessProfile memory) { return profile; }
}

contract BetVideoPokerSecureDrawTest {
    VmBetDrawV1420 constant vm = VmBetDrawV1420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PLAYER = address(0xBEEF);
    address constant PROVIDER = address(0xBABA);
    bytes32 constant WAGER = keccak256("video poker wager");
    bytes32 constant GAME = keccak256("420BET.GAME.VIDEO_POKER");
    bytes32 constant VERSION = keccak256("420BET.GAME.VIDEO_POKER.V1");
    bytes32 constant RULES = keccak256("420BET.RULESET.VIDEO_POKER.V1");
    bytes32 constant SEED = keccak256("sealed replacement draw entropy");
    bytes32 constant PROFILE = keccak256("profile");

    MockVideoPokerSecureRegistry registry;
    MockVideoPokerSecureRandomness router;
    VideoPokerV1420 poker;
    VideoPokerDealV1420 dealer;
    VideoPokerDrawV1420 draw;
    VideoPokerResolverV1420 resolver;

    constructor() {
        registry = new MockVideoPokerSecureRegistry();
        router = new MockVideoPokerSecureRandomness();
        poker = new VideoPokerV1420(address(registry), GAME, VERSION, RULES);
        dealer = new VideoPokerDealV1420(address(poker), address(router));
        draw = new VideoPokerDrawV1420(address(dealer), PROVIDER);
        resolver = new VideoPokerResolverV1420(address(draw));
        VideoPokerV1420.Params memory params = _params();
        registry.setWager(BetTypes420.Wager({
            wagerId: WAGER, player: PLAYER, operatorId: keccak256("operator"), gameId: GAME,
            gameVersionId: VERSION, asset: address(0xC0DE), stake: 1000,
            maxGrossPayout: 800000, paramsHash: poker.hashParams(params), vaultId: keccak256("vault"),
            randomnessProfileId: PROFILE, riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"), accessPolicyId: keccak256("access"),
            rulesetId: RULES, acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 3600), status: BetTypes420.WagerStatus.ACCEPTED
        }));
        router.setRequest(WAGER, RandomnessRouter420.RandomnessRequest({
            wagerId: WAGER, profileId: PROFILE, gameVersionId: VERSION, paramsHash: poker.hashParams(params),
            contextHash: keccak256("context"), requestedAt: uint64(block.timestamp),
            fallbackAt: uint64(block.timestamp + 120), root: keccak256("original public root"),
            proofHash: keccak256("proof"), entropyHash: keccak256("entropy"),
            source: RandomnessRouter420.Source.PRIMARY, fulfilled: true
        }));
    }

    function _params() private pure returns (VideoPokerV1420.Params memory) {
        return VideoPokerV1420.Params({
            paytableId: keccak256("420BET.PAYTABLE.VIDEO_POKER.JACKS_OR_BETTER.V1"), credits: 5
        });
    }
    function _prepare() private {
        vm.prank(PROVIDER);
        draw.commitReplacement(WAGER, draw.seedCommitmentFor(WAGER, SEED));
        vm.prank(PLAYER);
        dealer.startInitialDeal(WAGER, _params());
    }
    function _hold(uint8 mask) private {
        vm.prank(PLAYER);
        draw.commitHold(WAGER, mask);
    }
    function _reveal() private returns (uint8[5] memory) {
        vm.prank(PROVIDER);
        return draw.revealAndDraw(WAGER, SEED);
    }

    function testPlayerHoldBeforeRevealAndNoDuplicateCards() public {
        _prepare();
        _hold(0);
        uint8[5] memory finalHand = _reveal();
        VideoPokerDealV1420.InitialDeal memory initial = dealer.initialDeal(WAGER);
        uint256 seen;
        for (uint256 i; i < 5; ++i) {
            require(finalHand[i] < 52, "out of range");
            uint256 bit = uint256(1) << finalHand[i];
            require((seen & bit) == 0, "repeated replacement");
            seen |= bit;
            for (uint256 j; j < 5; ++j) require(finalHand[i] != initial.cards[j], "reused initial card");
        }
        require(draw.getSession(WAGER).revealed, "not revealed");
    }

    function testAllHeldCardsRemainIdentical() public {
        _prepare();
        _hold(31);
        uint8[5] memory cards = _reveal();
        VideoPokerDealV1420.InitialDeal memory initial = dealer.initialDeal(WAGER);
        for (uint256 i; i < 5; ++i) require(cards[i] == initial.cards[i], "held card changed");
    }

    function testMixedHoldsPreserveOnlyHeldCards() public {
        _prepare();
        _hold(5);
        uint8[5] memory cards = _reveal();
        VideoPokerDealV1420.InitialDeal memory initial = dealer.initialDeal(WAGER);
        require(cards[0] == initial.cards[0] && cards[2] == initial.cards[2], "held mismatch");
        uint256 mask;
        for (uint256 i; i < 5; ++i) {
            uint256 bit = uint256(1) << cards[i];
            require(mask & bit == 0, "duplicate");
            mask |= bit;
        }
    }

    function testRevealBeforeHoldRejected() public {
        _prepare();
        vm.expectRevert(VideoPokerDrawV1420.NotHeld.selector);
        vm.prank(PROVIDER);
        draw.revealAndDraw(WAGER, SEED);
    }

    function testDifferentSeedRejectedAfterHold() public {
        _prepare();
        _hold(0);
        vm.expectRevert(VideoPokerDrawV1420.InvalidReveal.selector);
        vm.prank(PROVIDER);
        draw.revealAndDraw(WAGER, keccak256("different"));
    }

    function testHoldCannotBeReplaced() public {
        _prepare();
        _hold(1);
        vm.expectRevert(VideoPokerDrawV1420.AlreadyHeld.selector);
        vm.prank(PLAYER);
        draw.commitHold(WAGER, 31);
    }

    function testSeedCannotBeRecommittedAfterDealOrHold() public {
        _prepare();
        vm.expectRevert(VideoPokerDrawV1420.AlreadyCommitted.selector);
        vm.prank(PROVIDER);
        draw.commitReplacement(WAGER, draw.seedCommitmentFor(WAGER, keccak256("other")));
    }

    function testProviderCannotFrontRunHold() public {
        _prepare();
        vm.expectRevert(VideoPokerDrawV1420.Unauthorized.selector);
        vm.prank(PROVIDER);
        draw.commitHold(WAGER, 0);
    }

    function testUnauthorizedRevealRejected() public {
        _prepare();
        _hold(0);
        vm.expectRevert(VideoPokerDrawV1420.Unauthorized.selector);
        vm.prank(PLAYER);
        draw.revealAndDraw(WAGER, SEED);
    }

    function testReplayRejected() public {
        _prepare();
        _hold(0);
        _reveal();
        vm.expectRevert(VideoPokerDrawV1420.AlreadyResolved.selector);
        vm.prank(PROVIDER);
        draw.revealAndDraw(WAGER, SEED);
    }

    function testDeadlineWithheldSeedAuditAndRefundHandoff() public {
        _prepare();
        _hold(1);
        vm.expectRevert(VideoPokerDrawV1420.SessionNotExpired.selector);
        draw.recordWithheldEntropy(WAGER);
        vm.warp(block.timestamp + 3600);
        draw.recordWithheldEntropy(WAGER);
        require(draw.getSession(WAGER).timedOut, "timeout not recorded");
        vm.expectRevert(VideoPokerDrawV1420.AlreadyResolved.selector);
        vm.prank(PROVIDER);
        draw.revealAndDraw(WAGER, SEED);
    }

    function testOversizedHoldMaskRejected() public {
        _prepare();
        vm.expectRevert(VideoPokerDrawV1420.InvalidMask.selector);
        vm.prank(PLAYER);
        draw.commitHold(WAGER, 32);
    }

    function testResolverRequiresCompletedDraw() public {
        _prepare();
        vm.expectRevert(VideoPokerResolverV1420.DrawNotComplete.selector);
        resolver.resolve(WAGER, _params());
    }

    function testResolvedHandIsBoundedByReservedLiability() public {
        _prepare();
        _hold(0);
        _reveal();
        (BetTypes420.TerminalOutcome outcome, uint256 gross) = resolver.resolve(WAGER, _params());
        require(gross <= 800000, "unreserved payout");
        require(outcome != BetTypes420.TerminalOutcome.NONE, "no outcome");
    }

    function testPaytableSubstitutionCannotResolve() public {
        _prepare();
        _hold(0);
        _reveal();
        VideoPokerV1420.Params memory p = _params();
        p.paytableId = keccak256("unauthorized paytable");
        vm.expectRevert(VideoPokerResolverV1420.InvalidPaytable.selector);
        resolver.resolve(WAGER, p);
    }
}

contract BetVideoPokerEconomicsTest {
    VideoPokerEconomics420 private immutable economics = new VideoPokerEconomics420();
    function _category(uint8[5] memory cards) private view returns (VideoPokerJacksOrBetter420.Category) {
        return economics.evaluate(cards);
    }
    function testRoyalFlushAndFiveCreditBonus() public view {
        uint8[5] memory hand = [uint8(0), 9, 10, 11, 12];
        require(_category(hand) == VideoPokerJacksOrBetter420.Category.ROYAL_FLUSH, "royal");
        require(economics.payoutCredits(VideoPokerJacksOrBetter420.Category.ROYAL_FLUSH, 5) == 4000, "royal 5");
        require(economics.payoutCredits(VideoPokerJacksOrBetter420.Category.ROYAL_FLUSH, 4) == 1000, "royal 4");
    }
    function testWheelStraightAndRegularStraightFlush() public view {
        uint8[5] memory wheel = [uint8(0), 1, 2, 3, 4];
        uint8[5] memory straight = [uint8(1), 2, 3, 4, 5];
        require(_category(wheel) == VideoPokerJacksOrBetter420.Category.STRAIGHT_FLUSH, "wheel");
        require(_category(straight) == VideoPokerJacksOrBetter420.Category.STRAIGHT_FLUSH, "straight flush");
    }
    function testQuadsFullHouseFlushAndTrips() public view {
        require(_category([uint8(0), 13, 26, 39, 1]) == VideoPokerJacksOrBetter420.Category.FOUR_OF_A_KIND, "quads");
        require(_category([uint8(1), 14, 27, 3, 16]) == VideoPokerJacksOrBetter420.Category.FULL_HOUSE, "house");
        require(_category([uint8(0), 2, 5, 8, 12]) == VideoPokerJacksOrBetter420.Category.FLUSH, "flush");
        require(_category([uint8(1), 14, 27, 5, 8]) == VideoPokerJacksOrBetter420.Category.THREE_OF_A_KIND, "trips");
    }
    function testTwoPairsAndHighPair() public view {
        require(_category([uint8(0), 13, 1, 14, 5]) == VideoPokerJacksOrBetter420.Category.TWO_PAIR, "two pair");
        require(_category([uint8(10), 23, 0, 2, 4]) == VideoPokerJacksOrBetter420.Category.JACKS_OR_BETTER, "jacks");
        require(_category([uint8(1), 14, 0, 3, 6]) == VideoPokerJacksOrBetter420.Category.NOTHING, "low pair");
    }
    function testCapAndPayoutScaling() public view {
        require(economics.maximumGross(1000, 5) == 800000, "max reserve");
        require(economics.maximumGross(800, 4) == 200000, "four credit reserve");
        (, uint256 payout) = economics.quote([uint8(0), 9, 10, 11, 12], 1000, 5);
        require(payout == 800000, "royal payout");
    }
}
