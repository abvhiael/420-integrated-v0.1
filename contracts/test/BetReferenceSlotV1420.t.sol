// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/ReferenceSlotV1420.sol";

contract MockReferenceSlotRegistry420 {
    BetTypes420.Wager private _wager;
    function setWager(BetTypes420.Wager memory w) external { _wager = w; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockReferenceSlotRandomness420 {
    bytes32 private _root;
    function setRoot(bytes32 root_) external { _root = root_; }
    function rootOf(bytes32) external view returns (bytes32) { require(_root != bytes32(0), "not fulfilled"); return _root; }
}

interface VmBetReferenceSlot420 { function expectRevert(bytes4) external; }

contract BetReferenceSlotV1420Test {
    VmBetReferenceSlot420 constant vm = VmBetReferenceSlot420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant WAGER = keccak256("420BET.SLOT.REFERENCE.WAGER.1");
    bytes32 constant GAME = keccak256("420BET.GAME.SLOT");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.SLOT.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.SLOT.REFERENCE.V1");
    uint256 constant STAKE = 100 ether;

    struct Suite {
        MockReferenceSlotRegistry420 registry;
        MockReferenceSlotRandomness420 randomness;
        SlotRandomStream420 stream;
        ReferenceSlotV1420 slot;
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
        s.registry = new MockReferenceSlotRegistry420();
        s.randomness = new MockReferenceSlotRandomness420();
        s.stream = new SlotRandomStream420();
        s.slot = new ReferenceSlotV1420(address(s.registry), address(s.randomness), address(s.stream), GAME, GAME_V1, RULESET);
        s.params = _params();
        _install(s, BetTypes420.WagerStatus.ACCEPTED, s.slot.hashParams(s.params), 5_000 ether);
    }

    function _install(Suite memory s, BetTypes420.WagerStatus status, bytes32 paramsHash, uint256 maxGross) private {
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: address(0xBEEF),
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA),
            stake: STAKE,
            maxGrossPayout: maxGross,
            paramsHash: paramsHash,
            vaultId: keccak256("vault"),
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: 1,
            deadline: 1000,
            status: status
        }));
    }

    function testResolveIsDeterministicAndBounded() public {
        Suite memory s = _deploy();
        bytes32 root = keccak256("slot/reference/root");
        s.randomness.setRoot(root);
        ReferenceSlotV1420.Result memory a = s.slot.resolve(WAGER, s.params);
        ReferenceSlotV1420.Result memory b = s.slot.resolve(WAGER, s.params);
        require(a.randomnessRoot == root && b.randomnessRoot == root, "root");
        require(a.grossPayout == b.grossPayout, "payout changed");
        require(a.basePayout == b.basePayout && a.featurePayout == b.featurePayout, "components changed");
        require(a.freeSpinsPlayed <= 12, "feature unbounded");
        require(a.retriggers <= 2, "retrigger unbounded");
        require(a.grossPayout <= 5_000 ether, "cap escaped");
        for (uint8 i = 0; i < 5; ++i) require(a.baseStops[i] == b.baseStops[i] && a.baseStops[i] < 32, "stop");
        for (uint8 i = 0; i < 20; ++i) require(a.baseGrid[i] == b.baseGrid[i] && a.baseGrid[i] < 7, "grid");
    }

    function testParamsCommitEntireReelAndPayConfiguration() public {
        Suite memory s = _deploy();
        bytes32 canonical = s.slot.hashParams(s.params);
        ReferenceSlotV1420.Params memory changed = s.params;
        changed.baseReels[7][3] = uint8((changed.baseReels[7][3] + 1) % 7);
        require(s.slot.hashParams(changed) != canonical, "base reel not bound");
        changed = s.params;
        changed.featureReels[9][2] = uint8((changed.featureReels[9][2] + 1) % 7);
        require(s.slot.hashParams(changed) != canonical, "feature reel not bound");
        changed = s.params;
        changed.payoutPerWay[2] += 1 ether;
        require(s.slot.hashParams(changed) != canonical, "paytable not bound");
    }

    function testTamperedParamsAndWrongMaxGrossFailClosed() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(keccak256("slot/root/failclosed"));
        ReferenceSlotV1420.Params memory changed = s.params;
        changed.scatter3 += 1 ether;
        vm.expectRevert(ReferenceSlotV1420.ParamsMismatch.selector);
        s.slot.resolve(WAGER, changed);
        _install(s, BetTypes420.WagerStatus.ACCEPTED, s.slot.hashParams(s.params), 4_999 ether);
        vm.expectRevert(ReferenceSlotV1420.InvalidPayout.selector);
        s.slot.resolve(WAGER, s.params);
    }

    function testAcceptedOutcomeReadySettledReconstructIdentically() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(keccak256("slot/root/status"));
        ReferenceSlotV1420.Result memory a = s.slot.resolve(WAGER, s.params);
        _install(s, BetTypes420.WagerStatus.OUTCOME_READY, s.slot.hashParams(s.params), 5_000 ether);
        ReferenceSlotV1420.Result memory b = s.slot.resolve(WAGER, s.params);
        _install(s, BetTypes420.WagerStatus.SETTLED, s.slot.hashParams(s.params), 5_000 ether);
        ReferenceSlotV1420.Result memory c = s.slot.resolve(WAGER, s.params);
        require(a.grossPayout == b.grossPayout && b.grossPayout == c.grossPayout, "payout");
        require(a.freeSpinsPlayed == b.freeSpinsPlayed && b.freeSpinsPlayed == c.freeSpinsPlayed, "feature");
        for (uint8 i = 0; i < 20; ++i) require(a.baseGrid[i] == b.baseGrid[i] && b.baseGrid[i] == c.baseGrid[i], "grid");
    }

    function testInvalidSymbolsAndNonMonotonicScatterScheduleRejected() public {
        Suite memory s = _deploy();
        ReferenceSlotV1420.Params memory bad = s.params;
        bad.baseReels[0][0] = 7;
        vm.expectRevert(ReferenceSlotV1420.InvalidParams.selector);
        s.slot.hashParams(bad);
        bad = s.params;
        bad.scatter3 = 300 ether;
        bad.scatter4 = 200 ether;
        vm.expectRevert(ReferenceSlotV1420.InvalidParams.selector);
        s.slot.hashParams(bad);
    }
}
