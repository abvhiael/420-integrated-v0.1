// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/VideoPokerDealV1420.sol";

interface VmVideoPokerDeal420 {
    function expectRevert(bytes4 selector) external;
    function prank(address actor) external;
    function warp(uint256 when_) external;
}

contract MockVideoPokerDealRegistry {
    mapping(bytes32 => BetTypes420.Wager) internal wagers;
    function setWager(BetTypes420.Wager calldata w) external { wagers[w.wagerId] = w; }
    function getWager(bytes32 id) external view returns (BetTypes420.Wager memory) {
        require(wagers[id].wagerId != bytes32(0), "missing wager"); return wagers[id];
    }
}

contract MockVideoPokerDealRouter {
    mapping(bytes32 => RandomnessRouter420.RandomnessRequest) internal requests;
    function setRequest(bytes32 id, RandomnessRouter420.RandomnessRequest calldata r) external { requests[id] = r; }
    function getRequest(bytes32 id) external view returns (RandomnessRouter420.RandomnessRequest memory) {
        return requests[id];
    }
}

contract BetVideoPokerDeck420Test {
    VmVideoPokerDeal420 constant vm = VmVideoPokerDeal420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PLAYER = address(0xBEEF);
    bytes32 constant GAME = keccak256("game");
    bytes32 constant VERSION = keccak256("version");
    bytes32 constant RULES = keccak256("rules");
    bytes32 constant PROFILE = keccak256("profile");
    bytes32 constant ROOT = keccak256("randomness root");
    bytes32 constant WAGER = keccak256("wager");

    MockVideoPokerDealRegistry registry;
    MockVideoPokerDealRouter router;
    VideoPokerV1420 poker;
    VideoPokerDealV1420 dealer;

    constructor() {
        registry = new MockVideoPokerDealRegistry();
        router = new MockVideoPokerDealRouter();
        poker = new VideoPokerV1420(address(registry), GAME, VERSION, RULES);
        dealer = new VideoPokerDealV1420(address(poker), address(router));
        _seed(WAGER, ROOT, RandomnessRouter420.Source.PRIMARY);
    }

    function _params() private pure returns (VideoPokerV1420.Params memory) {
        return VideoPokerV1420.Params({paytableId: keccak256("paytable"), credits: 5});
    }
    function _seed(bytes32 id, bytes32 root, RandomnessRouter420.Source source) private {
        VideoPokerV1420.Params memory params = _params();
        registry.setWager(BetTypes420.Wager({
            wagerId: id, player: PLAYER, operatorId: keccak256("operator"), gameId: GAME,
            gameVersionId: VERSION, asset: address(0x1234), stake: 100,
            maxGrossPayout: 1000, paramsHash: poker.hashParams(params), vaultId: keccak256("vault"),
            randomnessProfileId: PROFILE, riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"), accessPolicyId: keccak256("access"),
            rulesetId: RULES, acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 3600), status: BetTypes420.WagerStatus.ACCEPTED
        }));
        router.setRequest(id, RandomnessRouter420.RandomnessRequest({
            wagerId: id, profileId: PROFILE, gameVersionId: VERSION, paramsHash: poker.hashParams(params),
            contextHash: keccak256("context"), requestedAt: uint64(block.timestamp),
            fallbackAt: uint64(block.timestamp + 120), root: root, proofHash: keccak256("proof"),
            entropyHash: keccak256("entropy"), source: source, fulfilled: true
        }));
    }

    function testFullDeckUniqueAndBounded() public view {
        uint8[52] memory cards = dealer.deriveDeck(WAGER, ROOT, RandomnessRouter420.Source.PRIMARY);
        uint256 seen;
        for (uint256 i = 0; i < 52; ++i) {
            require(cards[i] < 52, "range");
            uint256 mask = uint256(1) << cards[i];
            require(seen & mask == 0, "duplicate");
            seen |= mask;
        }
        require(seen == (uint256(1) << 52) - 1, "incomplete");
    }

    function testSameInputSameDeck() public view {
        uint8[52] memory a = dealer.deriveDeck(WAGER, ROOT, RandomnessRouter420.Source.PRIMARY);
        uint8[52] memory b = dealer.deriveDeck(WAGER, ROOT, RandomnessRouter420.Source.PRIMARY);
        require(keccak256(abi.encode(a)) == keccak256(abi.encode(b)), "nondeterministic");
    }

    function testDomainSeparationByWagerRootAndSource() public view {
        uint8[52] memory original = dealer.deriveDeck(WAGER, ROOT, RandomnessRouter420.Source.PRIMARY);
        bytes32 hash = keccak256(abi.encode(original));
        require(hash != keccak256(abi.encode(dealer.deriveDeck(keccak256("other"), ROOT, RandomnessRouter420.Source.PRIMARY))), "wager");
        require(hash != keccak256(abi.encode(dealer.deriveDeck(WAGER, keccak256("other root"), RandomnessRouter420.Source.PRIMARY))), "root");
        require(hash != keccak256(abi.encode(dealer.deriveDeck(WAGER, ROOT, RandomnessRouter420.Source.FALLBACK))), "source");
    }

    function testPlayerInitialDealExactlyOnceAndMatchesDeck() public {
        vm.prank(PLAYER);
        uint8[5] memory hand = dealer.startInitialDeal(WAGER, _params());
        uint8[52] memory full = dealer.deriveDeck(WAGER, ROOT, RandomnessRouter420.Source.PRIMARY);
        for (uint256 i=0;i<5;++i) require(hand[i] == full[i], "deal order");
        VideoPokerDealV1420.InitialDeal memory stored = dealer.initialDeal(WAGER);
        require(stored.exists && stored.player == PLAYER && stored.randomnessRoot == ROOT, "state");
        require(keccak256(abi.encode(hand)) == keccak256(abi.encode(stored.cards)), "cards");
        vm.expectRevert(VideoPokerDealV1420.AlreadyDealt.selector);
        vm.prank(PLAYER);
        dealer.startInitialDeal(WAGER, _params());
    }

    function testUnauthorizedCallerFails() public {
        vm.expectRevert(VideoPokerDealV1420.NotPlayer.selector);
        dealer.startInitialDeal(WAGER, _params());
    }
    function testUnfulfilledRandomnessFails() public {
        RandomnessRouter420.RandomnessRequest memory r = router.getRequest(WAGER);
        r.fulfilled = false;
        router.setRequest(WAGER, r);
        vm.expectRevert(VideoPokerDealV1420.RandomnessNotReady.selector);
        vm.prank(PLAYER);
        dealer.startInitialDeal(WAGER, _params());
    }
    function testWrongRandomnessBindingFails() public {
        RandomnessRouter420.RandomnessRequest memory r = router.getRequest(WAGER);
        r.paramsHash = keccak256("substituted");
        router.setRequest(WAGER, r);
        vm.expectRevert(VideoPokerDealV1420.RandomnessMismatch.selector);
        vm.prank(PLAYER);
        dealer.startInitialDeal(WAGER, _params());
    }
    function testExpirationFails() public {
        vm.warp(block.timestamp + 3600);
        vm.expectRevert(VideoPokerDealV1420.Expired.selector);
        vm.prank(PLAYER);
        dealer.startInitialDeal(WAGER, _params());
    }
    function testUncommittedParamsFail() public {
        VideoPokerV1420.Params memory p = _params(); p.credits = 4;
        vm.expectRevert(VideoPokerV1420.ParamsMismatch.selector);
        vm.prank(PLAYER);
        dealer.startInitialDeal(WAGER, p);
    }
}
