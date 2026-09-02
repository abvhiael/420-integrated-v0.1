// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/BlackjackV1420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetBlackjack420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBlackjack420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure returns (bool) { return true; }
}

contract MockBlackjackRegistry420 {
    BetTypes420.Wager private _wager;
    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockBlackjackRandomness420 {
    BetAuthorization420 public authorization;
    RandomnessRouter420.RandomnessRequest private _request;
    RandomnessRouter420.RandomnessProfile private _profile;

    constructor(address authorization_, bytes32 profileId, address provider) {
        authorization = BetAuthorization420(authorization_);
        _profile = RandomnessRouter420.RandomnessProfile({
            profileId: profileId,
            method: RandomnessRouter420.Method.THRESHOLD_VRF,
            primaryProvider: provider,
            fallbackProvider: address(0),
            fallbackDelay: 100,
            securityLevelHash: keccak256("security"),
            domainSeparator: keccak256("blackjack-domain"),
            manifestHash: keccak256("manifest"),
            exists: true
        });
    }

    function setRequest(bytes32 wagerId, bytes32 profileId, bytes32 gameVersionId, bytes32 paramsHash) external {
        _request = RandomnessRouter420.RandomnessRequest({
            wagerId: wagerId,
            profileId: profileId,
            gameVersionId: gameVersionId,
            paramsHash: paramsHash,
            contextHash: keccak256("blackjack/draw-stream"),
            requestedAt: uint64(block.timestamp),
            fallbackAt: uint64(block.timestamp + 100),
            root: bytes32(0),
            proofHash: bytes32(0),
            entropyHash: bytes32(0),
            source: RandomnessRouter420.Source.NONE,
            fulfilled: false
        });
    }

    function fulfill(bytes32 root) external {
        _request.root = root;
        _request.proofHash = keccak256("proof");
        _request.entropyHash = keccak256("entropy");
        _request.source = RandomnessRouter420.Source.PRIMARY;
        _request.fulfilled = true;
    }

    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory) {
        require(_request.wagerId == wagerId, "request");
        return _request;
    }

    function getProfile(bytes32 profileId) external view returns (RandomnessRouter420.RandomnessProfile memory) {
        require(_profile.profileId == profileId, "profile");
        return _profile;
    }
}

contract BetBlackjackV1420Test {
    VmBetBlackjack420 constant vm = VmBetBlackjack420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xBEEF);
    address constant PROVIDER = address(0x1111);
    address constant OTHER = address(0x2222);
    bytes32 constant WAGER = keccak256("420BET.BLACKJACK.WAGER.1");
    bytes32 constant GAME = keccak256("420BET.GAME.BLACKJACK");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.BLACKJACK.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.BLACKJACK.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/blackjack/v1");
    uint256 constant STAKE = 10 ether;

    struct Suite {
        MockCapabilityRegistryBlackjack420 caps;
        BetAuthorization420 auth;
        MockBlackjackRegistry420 registry;
        MockBlackjackRandomness420 randomness;
        BlackjackV1420 blackjack;
        BlackjackV1420.Params params;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBlackjack420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.registry = new MockBlackjackRegistry420();
        s.randomness = new MockBlackjackRandomness420(address(s.auth), RANDOMNESS, PROVIDER);
        s.blackjack = new BlackjackV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.params = BlackjackV1420.Params({rulesVersion: 1});
        s.randomness.setRequest(WAGER, RANDOMNESS, GAME_V1, s.blackjack.hashParams(s.params));
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA),
            stake: STAKE,
            maxGrossPayout: 25 ether,
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

    function _commitAndFulfill(Suite memory s, uint8 draws, uint256 seed)
        private returns (bytes32[24] memory secrets)
    {
        (bytes32 head, bytes32[24] memory generated) = _chain(draws, seed);
        vm.prank(PROVIDER);
        s.blackjack.commitDrawStream(WAGER, RandomnessRouter420.Source.PRIMARY, head, draws);
        s.randomness.fulfill(keccak256(abi.encode("canonical-root", seed)));
        return generated;
    }

    function testFixedRulesAndMaxLiability() public {
        Suite memory s = _deploy();
        require(s.blackjack.requiredMaxGrossPayout(STAKE) == 25 ether, "3:2 max");
        require(s.blackjack.hashParams(s.params) != bytes32(0), "params");
        vm.expectRevert(BlackjackV1420.InvalidParams.selector);
        s.blackjack.hashParams(BlackjackV1420.Params({rulesVersion: 2}));
    }

    function testStreamMustBeCommittedBeforeRandomnessFulfillment() public {
        Suite memory s = _deploy();
        s.randomness.fulfill(keccak256("root"));
        (bytes32 head,) = _chain(8, 420);
        vm.prank(PROVIDER);
        vm.expectRevert(BlackjackV1420.RandomnessAlreadyReady.selector);
        s.blackjack.commitDrawStream(WAGER, RandomnessRouter420.Source.PRIMARY, head, 8);
    }

    function testOnlyConfiguredProviderCanCommitAndReveal() public {
        Suite memory s = _deploy();
        (bytes32 head, bytes32[24] memory secrets) = _chain(8, 421);
        vm.prank(OTHER);
        vm.expectRevert(BlackjackV1420.WrongProvider.selector);
        s.blackjack.commitDrawStream(WAGER, RandomnessRouter420.Source.PRIMARY, head, 8);

        vm.prank(PROVIDER);
        s.blackjack.commitDrawStream(WAGER, RandomnessRouter420.Source.PRIMARY, head, 8);
        s.randomness.fulfill(keccak256("root/provider"));
        s.blackjack.startHand(WAGER, s.params);

        vm.prank(OTHER);
        vm.expectRevert(BlackjackV1420.WrongProvider.selector);
        s.blackjack.revealNext(WAGER, secrets[0]);
    }

    function testRevealChainIsOneWayAndCannotSkipOrReroll() public {
        Suite memory s = _deploy();
        bytes32[24] memory secrets = _commitAndFulfill(s, 8, 422);
        s.blackjack.startHand(WAGER, s.params);

        vm.prank(PROVIDER);
        vm.expectRevert(BlackjackV1420.InvalidReveal.selector);
        s.blackjack.revealNext(WAGER, secrets[1]);

        vm.prank(PROVIDER);
        s.blackjack.revealNext(WAGER, secrets[0]);

        vm.prank(PROVIDER);
        vm.expectRevert(BlackjackV1420.InvalidReveal.selector);
        s.blackjack.revealNext(WAGER, secrets[0]);
    }

    function testPlayerDecisionGatesFutureCardReveal() public {
        Suite memory s = _deploy();
        bytes32[24] memory secrets = _commitAndFulfill(s, 12, 423);
        s.blackjack.startHand(WAGER, s.params);

        for (uint8 i = 0; i < 3; ++i) {
            vm.prank(PROVIDER);
            s.blackjack.revealNext(WAGER, secrets[i]);
        }

        BlackjackV1420.HandState memory hand = s.blackjack.getHand(WAGER);
        if (hand.phase == BlackjackV1420.Phase.PLAYER_TURN) {
            vm.prank(PROVIDER);
            vm.expectRevert(BlackjackV1420.InvalidPhase.selector);
            s.blackjack.revealNext(WAGER, secrets[3]);

            vm.prank(PLAYER);
            s.blackjack.hit(WAGER);
            vm.prank(PROVIDER);
            s.blackjack.revealNext(WAGER, secrets[3]);
        }
    }

    function testBoundedHandReachesCanonicalTerminalPayout() public {
        Suite memory s = _deploy();
        bytes32[24] memory secrets = _commitAndFulfill(s, 24, 424);
        s.blackjack.startHand(WAGER, s.params);
        uint8 next;

        for (; next < 3; ++next) {
            vm.prank(PROVIDER);
            s.blackjack.revealNext(WAGER, secrets[next]);
        }

        BlackjackV1420.HandState memory hand = s.blackjack.getHand(WAGER);
        if (hand.phase == BlackjackV1420.Phase.PLAYER_TURN) {
            vm.prank(PLAYER);
            s.blackjack.stand(WAGER);
        }

        while (next < 24) {
            hand = s.blackjack.getHand(WAGER);
            if (hand.phase == BlackjackV1420.Phase.TERMINAL) break;
            if (hand.pendingPurpose == BlackjackV1420.DrawPurpose.NONE) break;
            vm.prank(PROVIDER);
            s.blackjack.revealNext(WAGER, secrets[next]);
            next += 1;
        }

        hand = s.blackjack.getHand(WAGER);
        require(hand.phase == BlackjackV1420.Phase.TERMINAL, "not terminal");
        if (hand.outcome == BetTypes420.TerminalOutcome.LOSS) require(hand.grossPayout == 0, "loss payout");
        else if (hand.outcome == BetTypes420.TerminalOutcome.PUSH) require(hand.grossPayout == STAKE, "push payout");
        else if (hand.outcome == BetTypes420.TerminalOutcome.WIN) {
            require(hand.grossPayout == 20 ether || hand.grossPayout == 25 ether, "win payout");
        } else revert("bad terminal");

        BlackjackV1420.StreamCommitment memory stream = s.blackjack.getStream(WAGER, RandomnessRouter420.Source.PRIMARY);
        require(stream.revealed <= stream.maxDraws, "stream bound");
    }
}
