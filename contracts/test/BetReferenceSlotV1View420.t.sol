// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/RandomnessRouter420.sol";
import "../src/bet/ReferenceSlotV1420.sol";
import "../src/bet/ReferenceSlotV1View420.sol";

contract MockReferenceSlotV1ViewRegistry420 {
    BetTypes420.Wager private _wager;
    BetTypes420.Settlement private _settlement;
    bool private _settled;

    function setWager(BetTypes420.Wager memory wager) external { _wager = wager; }
    function setSettlement(BetTypes420.Settlement memory settlement) external {
        _settlement = settlement;
        _settled = true;
        _wager.status = settlement.outcome == BetTypes420.TerminalOutcome.VOID
            ? BetTypes420.WagerStatus.VOID
            : BetTypes420.WagerStatus.SETTLED;
    }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory) {
        require(_wager.wagerId == wagerId, "not found");
        return _wager;
    }
    function settlementExists(bytes32 wagerId) external view returns (bool) {
        return _settled && _settlement.wagerId == wagerId;
    }
    function getSettlement(bytes32 wagerId) external view returns (BetTypes420.Settlement memory) {
        require(_settled && _settlement.wagerId == wagerId, "not settled");
        return _settlement;
    }
}

contract MockReferenceSlotV1ViewRandomness420 {
    RandomnessRouter420.RandomnessRequest private _request;
    bool private _exists;

    function setRequest(RandomnessRouter420.RandomnessRequest memory request_) external {
        _request = request_;
        _exists = true;
    }
    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory) {
        require(_exists && _request.wagerId == wagerId, "not requested");
        return _request;
    }
    function rootOf(bytes32 wagerId) external view returns (bytes32) {
        require(_exists && _request.wagerId == wagerId && _request.fulfilled, "not fulfilled");
        return _request.root;
    }
}

contract BetReferenceSlotV1View420Test {
    bytes32 constant WAGER = keccak256("wager/slot/reference/client-view");
    bytes32 constant GAME = keccak256("420BET.GAME.SLOT");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.SLOT.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.SLOT.REFERENCE.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/slot/reference/v1");
    uint256 constant STAKE = 100 ether;

    struct Suite {
        MockReferenceSlotV1ViewRegistry420 registry;
        MockReferenceSlotV1ViewRandomness420 randomness;
        SlotRandomStream420 stream;
        ReferenceSlotV1420 slot;
        ReferenceSlotV1View420 view420;
        ReferenceSlotV1420.Params params;
    }

    function _params() private pure returns (ReferenceSlotV1420.Params memory p) {
        for (uint16 pos = 0; pos < 32; ++pos) {
            for (uint8 reel = 0; reel < 5; ++reel) {
                p.baseReels[pos][reel] = uint8((uint256(pos) + reel) % 7);
                p.featureReels[pos][reel] = uint8((uint256(pos) + reel + 2) % 7);
            }
        }
        p.payoutPerWay[0] = 10 ether;
        p.payoutPerWay[1] = 15 ether;
        p.payoutPerWay[2] = 20 ether;
        p.payoutPerWay[3] = 30 ether;
        p.payoutPerWay[4] = 50 ether;
        p.scatter3 = 100 ether;
        p.scatter4 = 250 ether;
        p.scatter5 = 500 ether;
        p.maxGrossPayout = 5_000 ether;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockReferenceSlotV1ViewRegistry420();
        s.randomness = new MockReferenceSlotV1ViewRandomness420();
        s.stream = new SlotRandomStream420();
        s.slot = new ReferenceSlotV1420(address(s.registry), address(s.randomness), address(s.stream), GAME, GAME_V1, RULESET);
        s.view420 = new ReferenceSlotV1View420(address(s.registry), address(s.randomness), address(s.slot));
        s.params = _params();

        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: address(0xC0FFEE),
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA),
            stake: STAKE,
            maxGrossPayout: 5_000 ether,
            paramsHash: s.slot.hashParams(s.params),
            vaultId: keccak256("vault"),
            randomnessProfileId: RANDOMNESS,
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: 100,
            deadline: 1000,
            status: BetTypes420.WagerStatus.ACCEPTED
        }));
    }

    function _fulfill(Suite memory s) private returns (bytes32 root) {
        root = keccak256("canonical-root/slot-reference-view");
        s.randomness.setRequest(RandomnessRouter420.RandomnessRequest({
            wagerId: WAGER,
            profileId: RANDOMNESS,
            gameVersionId: GAME_V1,
            paramsHash: s.slot.hashParams(s.params),
            contextHash: keccak256("slot/reference/base-and-feature/v1"),
            requestedAt: 110,
            fallbackAt: 210,
            root: root,
            proofHash: keccak256("proof"),
            entropyHash: keccak256("entropy"),
            source: RandomnessRouter420.Source.PRIMARY,
            fulfilled: true
        }));
    }

    function testSnapshotShowsAcceptedWagerBeforeRandomness() public {
        Suite memory s = _deploy();
        ReferenceSlotV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, s.params);
        require(snap.wager.wagerId == WAGER, "missing wager");
        require(snap.wager.status == BetTypes420.WagerStatus.ACCEPTED, "wrong status");
        require(snap.paramsMatch, "params should match");
        require(!snap.randomnessRequested, "unexpected randomness");
        require(!snap.settlementExists, "unexpected settlement");
        require(!snap.resultAvailable, "unexpected result");
    }

    function testSnapshotShowsFulfilledRandomnessAndReproducibleSettlement() public {
        Suite memory s = _deploy();
        bytes32 root = _fulfill(s);
        ReferenceSlotV1420.Result memory result = s.slot.resolve(WAGER, s.params);
        s.registry.setSettlement(BetTypes420.Settlement({
            wagerId: WAGER,
            outcome: result.outcome,
            grossPayout: result.grossPayout,
            settledAt: 120
        }));

        ReferenceSlotV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, s.params);
        require(snap.randomnessRequested && snap.randomness.fulfilled, "randomness missing");
        require(snap.randomness.root == root, "wrong root");
        require(snap.settlementExists, "settlement missing");
        require(snap.resultAvailable, "result unavailable");
        require(snap.result.randomnessRoot == root, "result root mismatch");
        require(snap.result.basePayout == result.basePayout, "base payout changed");
        require(snap.result.featurePayout == result.featurePayout, "feature payout changed");
        require(snap.result.freeSpinsPlayed == result.freeSpinsPlayed, "feature spins changed");
        require(snap.result.retriggers == result.retriggers, "retriggers changed");
        require(snap.result.grossPayout == snap.settlement.grossPayout, "payout mismatch");
        require(snap.result.outcome == snap.settlement.outcome, "outcome mismatch");
        for (uint8 i = 0; i < 5; ++i) require(snap.result.baseStops[i] == result.baseStops[i], "stop changed");
        for (uint8 i = 0; i < 20; ++i) require(snap.result.baseGrid[i] == result.baseGrid[i], "grid changed");
    }

    function testSnapshotFlagsTamperedParamsWithoutInventingResult() public {
        Suite memory s = _deploy();
        _fulfill(s);
        ReferenceSlotV1420.Params memory altered = s.params;
        altered.featureReels[7][2] = uint8((altered.featureReels[7][2] + 1) % 7);

        ReferenceSlotV1View420.Snapshot memory snap = s.view420.snapshot(WAGER, altered);
        require(snap.randomnessRequested && snap.randomness.fulfilled, "canonical randomness hidden");
        require(!snap.paramsMatch, "tampered params accepted");
        require(!snap.resultAvailable, "tampered result exposed");
    }
}
