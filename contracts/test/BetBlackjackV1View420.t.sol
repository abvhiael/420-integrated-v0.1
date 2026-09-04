// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/BlackjackV1420.sol";
import "../src/bet/BlackjackV1View420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetBlackjackView420 {
    function prank(address) external;
}

contract MockCapabilityRegistryBlackjackView420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure returns (bool) { return true; }
}

contract MockBlackjackViewRegistry420 {
    BetTypes420.Wager private _wager;
    BetTypes420.Settlement private _settlement;
    bool private _settled;

    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
    function settlementExists(bytes32 wagerId) external view returns (bool) {
        return _settled && _settlement.wagerId == wagerId;
    }
    function getSettlement(bytes32 wagerId) external view returns (BetTypes420.Settlement memory) {
        require(_settled && _settlement.wagerId == wagerId, "settlement");
        return _settlement;
    }
}

contract MockBlackjackViewRandomness420 {
    BetAuthorization420 public authorization;
    RandomnessRouter420.RandomnessRequest private _request;
    RandomnessRouter420.RandomnessProfile private _profile;
    bool private _requested;

    constructor(address authorization_, bytes32 profileId, address provider) {
        authorization = BetAuthorization420(authorization_);
        _profile = RandomnessRouter420.RandomnessProfile({
            profileId: profileId,
            method: RandomnessRouter420.Method.THRESHOLD_VRF,
            primaryProvider: provider,
            fallbackProvider: address(0),
            fallbackDelay: 100,
            securityLevelHash: keccak256("security"),
            domainSeparator: keccak256("blackjack-view-domain"),
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
            contextHash: keccak256("blackjack/view/draw-stream"),
            requestedAt: uint64(block.timestamp),
            fallbackAt: uint64(block.timestamp + 100),
            root: bytes32(0),
            proofHash: bytes32(0),
            entropyHash: bytes32(0),
            source: RandomnessRouter420.Source.NONE,
            fulfilled: false
        });
        _requested = true;
    }

    function fulfill(bytes32 root) external {
        require(_requested, "request");
        _request.root = root;
        _request.proofHash = keccak256("proof");
        _request.entropyHash = keccak256("entropy");
        _request.source = RandomnessRouter420.Source.PRIMARY;
        _request.fulfilled = true;
    }

    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory) {
        require(_requested && _request.wagerId == wagerId, "request");
        return _request;
    }

    function getProfile(bytes32 profileId) external view returns (RandomnessRouter420.RandomnessProfile memory) {
        require(_profile.profileId == profileId, "profile");
        return _profile;
    }
}

contract BetBlackjackV1View420Test {
    VmBetBlackjackView420 constant vm = VmBetBlackjackView420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xBEEF);
    address constant PROVIDER = address(0x1111);
    bytes32 constant WAGER = keccak256("420BET.BLACKJACK.VIEW.WAGER.1");
    bytes32 constant GAME = keccak256("420BET.GAME.BLACKJACK");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.BLACKJACK.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.BLACKJACK.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/blackjack/v1");
    uint256 constant STAKE = 10 ether;

    struct Suite {
        MockCapabilityRegistryBlackjackView420 caps;
        BetAuthorization420 auth;
        MockBlackjackViewRegistry420 registry;
        MockBlackjackViewRandomness420 randomness;
        BlackjackV1420 blackjack;
        BlackjackV1View420 view420;
        BlackjackV1420.Params params;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBlackjackView420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.registry = new MockBlackjackViewRegistry420();
        s.randomness = new MockBlackjackViewRandomness420(address(s.auth), RANDOMNESS, PROVIDER);
        s.blackjack = new BlackjackV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.view420 = new BlackjackV1View420(address(s.registry), address(s.randomness), address(s.blackjack));
        s.params = BlackjackV1420.Params({rulesVersion: 1});

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

    function testSnapshotShowsAcceptedWagerBeforeRandomnessOrCommitment() public {
        Suite memory s = _deploy();
        BlackjackV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, s.params);
        require(snap.wager.wagerId == WAGER, "missing wager");
        require(snap.wager.status == BetTypes420.WagerStatus.ACCEPTED, "wrong status");
        require(snap.paramsMatch, "params should match");
        require(!snap.randomnessRequested, "unexpected randomness");
        require(!snap.primaryStreamCommitted, "unexpected primary stream");
        require(!snap.fallbackStreamCommitted, "unexpected fallback stream");
        require(!snap.handStarted, "unexpected hand");
        require(!snap.terminal, "unexpected terminal");
    }

    function testSnapshotExposesPreFulfillmentPrimaryCommitment() public {
        Suite memory s = _deploy();
        s.randomness.setRequest(WAGER, RANDOMNESS, GAME_V1, s.blackjack.hashParams(s.params));
        (bytes32 head,) = _chain(12, 420);

        vm.prank(PROVIDER);
        s.blackjack.commitDrawStream(WAGER, RandomnessRouter420.Source.PRIMARY, head, 12);

        BlackjackV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, s.params);
        require(snap.randomnessRequested, "request hidden");
        require(!snap.randomness.fulfilled, "unexpected fulfillment");
        require(snap.primaryStreamCommitted, "commitment hidden");
        require(snap.primaryStream.head == head, "wrong head");
        require(snap.primaryStream.current == head, "wrong current");
        require(snap.primaryStream.maxDraws == 12, "wrong bound");
        require(snap.primaryStream.revealed == 0, "unexpected reveal");
        require(!snap.handStarted, "hand started early");
    }

    function testSnapshotExposesCanonicalLiveHandState() public {
        Suite memory s = _deploy();
        s.randomness.setRequest(WAGER, RANDOMNESS, GAME_V1, s.blackjack.hashParams(s.params));
        (bytes32 head, bytes32[24] memory secrets) = _chain(12, 421);

        vm.prank(PROVIDER);
        s.blackjack.commitDrawStream(WAGER, RandomnessRouter420.Source.PRIMARY, head, 12);
        bytes32 root = keccak256("blackjack/view/canonical-root");
        s.randomness.fulfill(root);
        s.blackjack.startHand(WAGER, s.params);

        vm.prank(PROVIDER);
        s.blackjack.revealNext(WAGER, secrets[0]);

        BlackjackV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, s.params);
        require(snap.randomnessRequested && snap.randomness.fulfilled, "fulfilled randomness hidden");
        require(snap.randomness.root == root, "wrong root");
        require(snap.primaryStreamCommitted, "stream hidden");
        require(snap.primaryStream.revealed == 1, "reveal count wrong");
        require(snap.handStarted, "hand hidden");
        require(snap.hand.phase == BlackjackV1420.Phase.AWAITING_INITIAL, "wrong phase");
        require(snap.hand.playerCount == 1, "player card hidden");
        require(snap.hand.dealerCount == 0, "dealer count wrong");
        require(snap.hand.pendingPurpose == BlackjackV1420.DrawPurpose.DEALER, "next purpose wrong");
        require(!snap.terminal, "terminal too early");
    }
}
