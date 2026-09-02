// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/BlackjackV1420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetBlackjackHardening420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetBlackjackHardening420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure returns (bool) { return true; }
}

contract MockBlackjackHardeningRegistry420 {
    BetTypes420.Wager private _wager;

    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockBlackjackHardeningRandomness420 {
    BetAuthorization420 public authorization;
    RandomnessRouter420.RandomnessRequest private _request;
    RandomnessRouter420.RandomnessProfile private _profile;

    constructor(address authorization_, bytes32 profileId, address primary, address fallback_) {
        authorization = BetAuthorization420(authorization_);
        _profile = RandomnessRouter420.RandomnessProfile({
            profileId: profileId,
            method: RandomnessRouter420.Method.THRESHOLD_VRF,
            primaryProvider: primary,
            fallbackProvider: fallback_,
            fallbackDelay: 100,
            securityLevelHash: keccak256("blackjack-hardening-security"),
            domainSeparator: keccak256("blackjack-hardening-domain"),
            manifestHash: keccak256("blackjack-hardening-manifest"),
            exists: true
        });
    }

    function setRequest(bytes32 wagerId, bytes32 profileId, bytes32 gameVersionId, bytes32 paramsHash) external {
        _request = RandomnessRouter420.RandomnessRequest({
            wagerId: wagerId,
            profileId: profileId,
            gameVersionId: gameVersionId,
            paramsHash: paramsHash,
            contextHash: keccak256("blackjack/hardening/draw-stream"),
            requestedAt: uint64(block.timestamp),
            fallbackAt: uint64(block.timestamp + 100),
            root: bytes32(0),
            proofHash: bytes32(0),
            entropyHash: bytes32(0),
            source: RandomnessRouter420.Source.NONE,
            fulfilled: false
        });
    }

    function fulfill(RandomnessRouter420.Source source, bytes32 root) external {
        require(source == RandomnessRouter420.Source.PRIMARY || source == RandomnessRouter420.Source.FALLBACK, "source");
        _request.root = root;
        _request.proofHash = keccak256(abi.encode("proof", source, root));
        _request.entropyHash = keccak256(abi.encode("entropy", source, root));
        _request.source = source;
        _request.fulfilled = true;
    }

    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory request) {
        require(_request.wagerId == wagerId, "request");
        return _request;
    }

    function getProfile(bytes32 profileId) external view returns (RandomnessRouter420.RandomnessProfile memory profile) {
        require(_profile.profileId == profileId, "profile");
        return _profile;
    }
}

contract BetBlackjackHardening420Test {
    VmBetBlackjackHardening420 constant vm = VmBetBlackjackHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xBEEF);
    address constant PRIMARY = address(0x1111);
    address constant FALLBACK = address(0x2222);
    bytes32 constant WAGER = keccak256("420BET.BLACKJACK.WAGER.HARDENING");
    bytes32 constant GAME = keccak256("420BET.GAME.BLACKJACK");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.BLACKJACK.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.BLACKJACK.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/blackjack/hardening/v1");
    uint256 constant STAKE = 10 ether;

    struct Suite {
        MockCapabilityRegistryBetBlackjackHardening420 caps;
        BetAuthorization420 auth;
        MockBlackjackHardeningRegistry420 registry;
        MockBlackjackHardeningRandomness420 randomness;
        BlackjackV1420 blackjack;
        BlackjackV1420.Params params;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetBlackjackHardening420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.registry = new MockBlackjackHardeningRegistry420();
        s.randomness = new MockBlackjackHardeningRandomness420(address(s.auth), RANDOMNESS, PRIMARY, FALLBACK);
        s.blackjack = new BlackjackV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.params = BlackjackV1420.Params({rulesVersion: 1});
        s.randomness.setRequest(WAGER, RANDOMNESS, GAME_V1, s.blackjack.hashParams(s.params));
        _installWager(s, STAKE, s.blackjack.requiredMaxGrossPayout(STAKE));
    }

    function _installWager(Suite memory s, uint256 stake, uint256 maxGrossPayout) private {
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA),
            stake: stake,
            maxGrossPayout: maxGrossPayout,
            paramsHash: s.blackjack.hashParams(s.params),
            vaultId: keccak256("vault"),
            randomnessProfileId: RANDOMNESS,
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            status: BetTypes420.WagerStatus.ACCEPTED
        }));
    }

    function _chain(uint8 n, uint256 seed) private pure returns (bytes32 head, bytes32[24] memory secrets) {
        require(n > 0 && n <= 24, "n");
        secrets[n - 1] = bytes32(seed);
        for (uint8 i = n - 1; i > 0; --i) {
            secrets[i - 1] = keccak256(abi.encode(secrets[i]));
        }
        head = keccak256(abi.encode(secrets[0]));
    }

    function _commit(
        Suite memory s,
        RandomnessRouter420.Source source,
        address provider,
        uint8 draws,
        uint256 seed
    ) private returns (bytes32[24] memory secrets) {
        (bytes32 head, bytes32[24] memory generated) = _chain(draws, seed);
        vm.prank(provider);
        s.blackjack.commitDrawStream(WAGER, source, head, draws);
        return generated;
    }

    function _reveal(Suite memory s, address provider, bytes32 secret) private {
        vm.prank(provider);
        s.blackjack.revealNext(WAGER, secret);
    }

    function testNaturalPayoutRequiresExactBaseUnitGranularity() public {
        Suite memory s = _deploy();
        require(s.blackjack.requiredMaxGrossPayout(2) == 5, "2 -> 5");
        require(s.blackjack.requiredMaxGrossPayout(STAKE) == 25 ether, "3:2 gross");

        vm.expectRevert(BlackjackV1420.InvalidPayout.selector);
        s.blackjack.requiredMaxGrossPayout(1);
        vm.expectRevert(BlackjackV1420.InvalidPayout.selector);
        s.blackjack.requiredMaxGrossPayout(3);
    }

    function testFuzzExactThreeToTwoLiability(uint96 rawStake) public {
        Suite memory s = _deploy();
        uint256 stake = (uint256(rawStake) + 1) * 2;
        uint256 required = s.blackjack.requiredMaxGrossPayout(stake);
        require(required == stake + (stake * 3) / 2, "exact natural gross");
        require(required == (stake * 5) / 2, "finite liability");
    }

    function testDrawStreamBoundsAreClosed() public {
        Suite memory s = _deploy();
        (bytes32 head,) = _chain(4, 7001);

        vm.prank(PRIMARY);
        vm.expectRevert(BlackjackV1420.InvalidParams.selector);
        s.blackjack.commitDrawStream(WAGER, RandomnessRouter420.Source.PRIMARY, head, 3);

        vm.prank(PRIMARY);
        vm.expectRevert(BlackjackV1420.InvalidParams.selector);
        s.blackjack.commitDrawStream(WAGER, RandomnessRouter420.Source.PRIMARY, head, 25);

        vm.prank(PRIMARY);
        s.blackjack.commitDrawStream(WAGER, RandomnessRouter420.Source.PRIMARY, head, 4);
        BlackjackV1420.StreamCommitment memory stream = s.blackjack.getStream(WAGER, RandomnessRouter420.Source.PRIMARY);
        require(stream.maxDraws == 4 && stream.revealed == 0, "minimum bound");
    }

    function testSelectedRandomnessSourceMustHaveItsOwnPrecommitment() public {
        Suite memory s = _deploy();
        _commit(s, RandomnessRouter420.Source.PRIMARY, PRIMARY, 8, 7002);
        s.randomness.fulfill(RandomnessRouter420.Source.FALLBACK, keccak256("fallback-root-without-stream"));

        vm.expectRevert(BlackjackV1420.StreamMissing.selector);
        s.blackjack.startHand(WAGER, s.params);
    }

    function testFallbackPrecommitmentCanDriveCanonicalHand() public {
        Suite memory s = _deploy();
        bytes32[24] memory secrets = _commit(s, RandomnessRouter420.Source.FALLBACK, FALLBACK, 8, 7003);
        bytes32 root = keccak256("blackjack-fallback-root");
        s.randomness.fulfill(RandomnessRouter420.Source.FALLBACK, root);
        s.blackjack.startHand(WAGER, s.params);

        BlackjackV1420.HandState memory hand = s.blackjack.getHand(WAGER);
        require(hand.source == RandomnessRouter420.Source.FALLBACK, "source binding");
        require(hand.pendingPurpose == BlackjackV1420.DrawPurpose.PLAYER, "initial player draw");

        _reveal(s, FALLBACK, secrets[0]);
        hand = s.blackjack.getHand(WAGER);
        require(hand.playerCount == 1 && hand.dealerCount == 0, "fallback reveal");

        vm.prank(PRIMARY);
        vm.expectRevert(BlackjackV1420.WrongProvider.selector);
        s.blackjack.revealNext(WAGER, secrets[1]);
    }

    function testInitialDealIsStrictEuropeanNoHoleCardSequence() public {
        Suite memory s = _deploy();
        bytes32[24] memory secrets = _commit(s, RandomnessRouter420.Source.PRIMARY, PRIMARY, 12, 7004);
        s.randomness.fulfill(RandomnessRouter420.Source.PRIMARY, keccak256("enhc-root"));
        s.blackjack.startHand(WAGER, s.params);

        _reveal(s, PRIMARY, secrets[0]);
        BlackjackV1420.HandState memory hand = s.blackjack.getHand(WAGER);
        require(hand.playerCount == 1 && hand.dealerCount == 0, "player first");
        require(hand.pendingPurpose == BlackjackV1420.DrawPurpose.DEALER, "dealer upcard next");

        _reveal(s, PRIMARY, secrets[1]);
        hand = s.blackjack.getHand(WAGER);
        require(hand.playerCount == 1 && hand.dealerCount == 1, "dealer upcard only");
        require(hand.pendingPurpose == BlackjackV1420.DrawPurpose.PLAYER, "player second next");

        _reveal(s, PRIMARY, secrets[2]);
        hand = s.blackjack.getHand(WAGER);
        require(hand.playerCount == 2 && hand.dealerCount == 1, "no dealer hole card");
        require(
            hand.phase == BlackjackV1420.Phase.PLAYER_TURN || hand.phase == BlackjackV1420.Phase.DEALER_TURN,
            "post-initial phase"
        );
        if (hand.phase == BlackjackV1420.Phase.DEALER_TURN) {
            require(hand.pendingPurpose == BlackjackV1420.DrawPurpose.DEALER, "natural waits for dealer second card");
        }
    }

    function testPlayerCannotActUntilInitialDealIsComplete() public {
        Suite memory s = _deploy();
        bytes32[24] memory secrets = _commit(s, RandomnessRouter420.Source.PRIMARY, PRIMARY, 8, 7005);
        s.randomness.fulfill(RandomnessRouter420.Source.PRIMARY, keccak256("turn-gating-root"));
        s.blackjack.startHand(WAGER, s.params);
        _reveal(s, PRIMARY, secrets[0]);

        vm.prank(PLAYER);
        vm.expectRevert(BlackjackV1420.InvalidPhase.selector);
        s.blackjack.hit(WAGER);
        vm.prank(PLAYER);
        vm.expectRevert(BlackjackV1420.InvalidPhase.selector);
        s.blackjack.stand(WAGER);
    }

    function testBoundedStandPathTerminatesAndTerminalStateIsImmutable() public {
        Suite memory s = _deploy();
        bytes32[24] memory secrets = _commit(s, RandomnessRouter420.Source.PRIMARY, PRIMARY, 24, 7006);
        s.randomness.fulfill(RandomnessRouter420.Source.PRIMARY, keccak256("terminal-lock-root"));
        s.blackjack.startHand(WAGER, s.params);

        uint8 next;
        for (; next < 3; ++next) _reveal(s, PRIMARY, secrets[next]);

        BlackjackV1420.HandState memory hand = s.blackjack.getHand(WAGER);
        if (hand.phase == BlackjackV1420.Phase.PLAYER_TURN) {
            vm.prank(PLAYER);
            s.blackjack.stand(WAGER);
        }

        while (next < 24) {
            hand = s.blackjack.getHand(WAGER);
            if (hand.phase == BlackjackV1420.Phase.TERMINAL) break;
            require(hand.pendingPurpose == BlackjackV1420.DrawPurpose.DEALER, "unexpected pending draw");
            _reveal(s, PRIMARY, secrets[next]);
            next += 1;
        }

        hand = s.blackjack.getHand(WAGER);
        require(hand.phase == BlackjackV1420.Phase.TERMINAL, "stand path not terminal");
        require(hand.pendingPurpose == BlackjackV1420.DrawPurpose.NONE, "terminal pending draw");
        require(hand.grossPayout <= s.blackjack.requiredMaxGrossPayout(STAKE), "payout escaped reserve");
        if (hand.outcome == BetTypes420.TerminalOutcome.LOSS) require(hand.grossPayout == 0, "loss economics");
        else if (hand.outcome == BetTypes420.TerminalOutcome.PUSH) require(hand.grossPayout == STAKE, "push economics");
        else if (hand.outcome == BetTypes420.TerminalOutcome.WIN) {
            require(hand.grossPayout == STAKE * 2 || hand.grossPayout == 25 ether, "win economics");
        } else revert("bad terminal outcome");

        vm.prank(PLAYER);
        vm.expectRevert(BlackjackV1420.InvalidPhase.selector);
        s.blackjack.hit(WAGER);
        vm.prank(PLAYER);
        vm.expectRevert(BlackjackV1420.InvalidPhase.selector);
        s.blackjack.stand(WAGER);
        vm.prank(PRIMARY);
        vm.expectRevert(BlackjackV1420.InvalidPhase.selector);
        s.blackjack.revealNext(WAGER, secrets[next < 24 ? next : 23]);
    }
}
