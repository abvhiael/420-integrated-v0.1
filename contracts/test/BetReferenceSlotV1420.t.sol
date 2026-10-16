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
    /// @notice Independent integer evaluator of a base-screen award. The test
    ///         constructs its own 5x4 grid from canonical reel stops.
    function _independentBaseAward(Suite memory suite, bytes32 root)
        private view returns (uint256 expected, uint8 visibleScatters)
    {
        uint8[20] memory grid;
        uint8[5] memory scatterReels;
        for (uint8 reel = 0; reel < 5; ++reel) {
            uint16 stop = suite.stream.reelStop(root, WAGER, GAME_V1, RULESET,
                suite.stream.BASE_PHASE(), 0, reel, 32);
            for (uint8 row = 0; row < 4; ++row) {
                uint8 symbol = suite.params.baseReels[(uint256(stop) + row) % 32][reel];
                grid[uint256(reel) * 4 + row] = symbol;
                if (symbol == 6) {
                    visibleScatters++;
                    scatterReels[reel] = 1;
                }
            }
        }
        uint8 scatterReelCount;
        for (uint8 r = 0; r < 5; ++r) scatterReelCount += scatterReels[r];
        if (scatterReelCount == 3) expected += suite.params.scatter3;
        else if (scatterReelCount == 4) expected += suite.params.scatter4;
        else if (scatterReelCount == 5) expected += suite.params.scatter5;
        for (uint8 symbol = 0; symbol < 5; ++symbol) {
            uint256 ways = 1;
            uint8 consecutive;
            for (uint8 reel = 0; reel < 5; ++reel) {
                uint8 matching;
                for (uint8 row = 0; row < 4; ++row) {
                    uint8 found = grid[uint256(reel) * 4 + row];
                    if (found == symbol || found == 5) matching++;
                }
                if (matching == 0) break;
                ways *= matching;
                consecutive++;
            }
            if (consecutive >= 3) expected += ways * suite.params.payoutPerWay[symbol];
        }
    }

    function _independentFeatureAward(Suite memory suite, bytes32 root)
        private view returns (uint256 amount, uint8 spinsPlayed, uint8 retriggers)
    {
        uint8 remaining = 6;
        while (remaining > 0) {
            uint8[20] memory grid;
            uint8[5] memory scatterReels;
            uint8 scatters;
            for (uint8 reel = 0; reel < 5; ++reel) {
                uint16 stop = suite.stream.reelStop(root, WAGER, GAME_V1, RULESET,
                    suite.stream.FEATURE_PHASE(), spinsPlayed, reel, 32);
                for (uint8 row = 0; row < 4; ++row) {
                    uint8 symbol = suite.params.featureReels[(uint256(stop) + row) % 32][reel];
                    grid[uint256(reel) * 4 + row] = symbol;
                    if (symbol == 6) { scatters++; scatterReels[reel] = 1; }
                }
            }
            uint8 scatterReelCount;
            for (uint8 reel = 0; reel < 5; ++reel) scatterReelCount += scatterReels[reel];
            uint256 spinPayout;
            if (scatterReelCount == 3) spinPayout = suite.params.scatter3;
            else if (scatterReelCount == 4) spinPayout = suite.params.scatter4;
            else if (scatterReelCount == 5) spinPayout = suite.params.scatter5;
            for (uint8 symbol = 0; symbol < 5; ++symbol) {
                uint256 ways = 1;
                uint8 matched;
                for (uint8 reel = 0; reel < 5; ++reel) {
                    uint8 count;
                    for (uint8 row = 0; row < 4; ++row) {
                        uint8 cell = grid[uint256(reel) * 4 + row];
                        if (cell == symbol || cell == 5) count++;
                    }
                    if (count == 0) break;
                    ways *= count;
                    matched++;
                }
                if (matched >= 3) spinPayout += ways * suite.params.payoutPerWay[symbol];
            }
            amount += spinPayout * 2;
            spinsPlayed++;
            remaining--;
            if (scatters >= 3 && retriggers < 2) {
                retriggers++;
                remaining += 3;
            }
        }
    }

    function testIndependentIntegerBaseEvaluatorMatchesCanonicalEngine() public {
        Suite memory suite = _deploy();
        uint256 noFeatureCount;
        uint256 featureCount;
        for (uint256 seed = 0; seed < 48; ++seed) {
            bytes32 root = keccak256(abi.encode("reference-slot/equivalence", seed));
            suite.randomness.setRoot(root);
            ReferenceSlotV1420.Result memory result = suite.slot.resolve(WAGER, suite.params);
            (uint256 independent, uint8 scatters) = _independentBaseAward(suite, root);
            require(result.basePayout == independent, "base payout differs");
            if (scatters < 3) {
                noFeatureCount++;
                require(result.featurePayout == 0, "unexpected feature");
                require(result.freeSpinsPlayed == 0, "unexpected free spins");
                uint256 expectedGross = independent > suite.params.maxGrossPayout
                    ? suite.params.maxGrossPayout : independent;
                require(result.grossPayout == expectedGross, "gross cap differs");
                BetTypes420.TerminalOutcome expectedOutcome = expectedGross < STAKE
                    ? BetTypes420.TerminalOutcome.LOSS
                    : expectedGross == STAKE
                        ? BetTypes420.TerminalOutcome.PUSH
                        : BetTypes420.TerminalOutcome.WIN;
                require(result.outcome == expectedOutcome, "terminal classification differs");
            } else {
                featureCount++;
                (uint256 featurePay, uint8 freeSpins, uint8 retriggers) =
                    _independentFeatureAward(suite, root);
                require(result.featurePayout == featurePay, "feature payout differs");
                require(result.freeSpinsPlayed == freeSpins, "feature spins differ");
                require(result.retriggers == retriggers, "feature retriggers differ");
                uint256 gross = independent + featurePay;
                if (gross > suite.params.maxGrossPayout) gross = suite.params.maxGrossPayout;
                require(result.grossPayout == gross, "feature gross cap differs");
                require(result.freeSpinsPlayed >= 6 && result.freeSpinsPlayed <= 12, "feature bounds");
                require(result.grossPayout <= suite.params.maxGrossPayout, "gross cap escaped");
            }
        }
        require(noFeatureCount > 0, "no base-only paths exercised");
        require(featureCount > 0, "no feature paths exercised");
    }

}
