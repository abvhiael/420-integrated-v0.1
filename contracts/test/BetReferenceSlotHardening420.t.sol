// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/ReferenceSlotV1420.sol";

interface VmBetReferenceSlotHardening420 { function expectRevert(bytes4) external; }

contract MockReferenceSlotHardeningRegistry420 {
    BetTypes420.Wager private _wager;
    function setWager(BetTypes420.Wager memory wager_) external { _wager = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockReferenceSlotHardeningRandomness420 {
    mapping(bytes32 => bytes32) private _roots;
    function setRoot(bytes32 wagerId, bytes32 root) external { _roots[wagerId] = root; }
    function rootOf(bytes32 wagerId) external view returns (bytes32 root) {
        root = _roots[wagerId];
        require(root != bytes32(0), "not fulfilled");
    }
}

contract BetReferenceSlotHardening420Test {
    VmBetReferenceSlotHardening420 constant vm = VmBetReferenceSlotHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xBEEF);
    bytes32 constant WAGER = keccak256("420BET.SLOT.REFERENCE.WAGER.HARDENING");
    bytes32 constant GAME = keccak256("420BET.GAME.SLOT");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.SLOT.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.SLOT.REFERENCE.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/slot/hardening/v1");
    uint256 constant STAKE = 100 ether;
    uint256 constant MAX_GROSS = 5_000 ether;

    struct Suite {
        MockReferenceSlotHardeningRegistry420 registry;
        MockReferenceSlotHardeningRandomness420 randomness;
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
        p.maxGrossPayout = MAX_GROSS;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockReferenceSlotHardeningRegistry420();
        s.randomness = new MockReferenceSlotHardeningRandomness420();
        s.stream = new SlotRandomStream420();
        s.slot = new ReferenceSlotV1420(address(s.registry), address(s.randomness), address(s.stream), GAME, GAME_V1, RULESET);
        s.params = _params();
        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, s.slot.hashParams(s.params), MAX_GROSS);
    }

    function _installWager(Suite memory s, BetTypes420.WagerStatus status, bytes32 paramsHash, uint256 maxGross) private {
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA),
            stake: STAKE,
            maxGrossPayout: maxGross,
            paramsHash: paramsHash,
            vaultId: keccak256("vault"),
            randomnessProfileId: RANDOMNESS,
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            status: status
        }));
    }

    function _assertBounded(ReferenceSlotV1420.Result memory r) private pure {
        require(r.freeSpinsPlayed <= 12, "feature unbounded");
        require(r.retriggers <= 2, "retrigger unbounded");
        require(r.grossPayout <= MAX_GROSS, "max win escaped");
        for (uint8 i = 0; i < 5; ++i) require(r.baseStops[i] < 32, "stop escaped strip");
        for (uint8 i = 0; i < 20; ++i) require(r.baseGrid[i] < 7, "symbol escaped domain");
        if (r.capped) require(r.grossPayout == MAX_GROSS, "cap flag mismatch");
    }

    function testEveryBaseReelCellIsCommitted() public {
        Suite memory s = _deploy();
        bytes32 canonical = s.slot.hashParams(s.params);
        for (uint16 pos = 0; pos < 32; ++pos) {
            for (uint8 reel = 0; reel < 5; ++reel) {
                ReferenceSlotV1420.Params memory changed = s.params;
                changed.baseReels[pos][reel] = uint8((changed.baseReels[pos][reel] + 1) % 7);
                require(s.slot.hashParams(changed) != canonical, "base cell not committed");
            }
        }
    }

    function testEveryFeatureReelCellIsCommitted() public {
        Suite memory s = _deploy();
        bytes32 canonical = s.slot.hashParams(s.params);
        for (uint16 pos = 0; pos < 32; ++pos) {
            for (uint8 reel = 0; reel < 5; ++reel) {
                ReferenceSlotV1420.Params memory changed = s.params;
                changed.featureReels[pos][reel] = uint8((changed.featureReels[pos][reel] + 1) % 7);
                require(s.slot.hashParams(changed) != canonical, "feature cell not committed");
            }
        }
    }

    function testEveryPaytableAndScatterTermIsCommitted() public {
        Suite memory s = _deploy();
        bytes32 canonical = s.slot.hashParams(s.params);
        for (uint8 symbol = 0; symbol < 7; ++symbol) {
            ReferenceSlotV1420.Params memory changed = s.params;
            changed.payoutPerWay[symbol] += 1;
            require(s.slot.hashParams(changed) != canonical, "paytable term not committed");
        }
        ReferenceSlotV1420.Params memory changed = s.params;
        changed.scatter3 += 1;
        require(s.slot.hashParams(changed) != canonical, "scatter3 not committed");
        changed = s.params; changed.scatter4 += 1;
        require(s.slot.hashParams(changed) != canonical, "scatter4 not committed");
        changed = s.params; changed.scatter5 += 1;
        require(s.slot.hashParams(changed) != canonical, "scatter5 not committed");
        changed = s.params; changed.maxGrossPayout += 1;
        require(s.slot.hashParams(changed) != canonical, "max gross not committed");
    }

    function testAcceptedMaxGrossMustExactlyMatchCommittedCap() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(WAGER, keccak256("slot/hardening/max-gross"));
        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, s.slot.hashParams(s.params), MAX_GROSS - 1);
        vm.expectRevert(ReferenceSlotV1420.InvalidPayout.selector);
        s.slot.resolve(WAGER, s.params);
        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, s.slot.hashParams(s.params), MAX_GROSS + 1);
        vm.expectRevert(ReferenceSlotV1420.InvalidPayout.selector);
        s.slot.resolve(WAGER, s.params);
    }

    function testRandomnessRequiredAndCannotBeInvented() public {
        Suite memory s = _deploy();
        (bool ok,) = address(s.slot).staticcall(abi.encodeWithSelector(ReferenceSlotV1420.resolve.selector, WAGER, s.params));
        require(!ok, "resolved without randomness");
    }

    function testRejectsNonReconstructableStatuses() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(WAGER, keccak256("slot/hardening/status"));
        _installWager(s, BetTypes420.WagerStatus.NONE, s.slot.hashParams(s.params), MAX_GROSS);
        vm.expectRevert(ReferenceSlotV1420.InvalidWagerStatus.selector);
        s.slot.resolve(WAGER, s.params);
        _installWager(s, BetTypes420.WagerStatus.VOID, s.slot.hashParams(s.params), MAX_GROSS);
        vm.expectRevert(ReferenceSlotV1420.InvalidWagerStatus.selector);
        s.slot.resolve(WAGER, s.params);
    }

    function testAcceptedOutcomeReadySettledReconstructIdentically() public {
        Suite memory s = _deploy();
        bytes32 root = keccak256("slot/hardening/reconstruct");
        s.randomness.setRoot(WAGER, root);
        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, s.slot.hashParams(s.params), MAX_GROSS);
        ReferenceSlotV1420.Result memory a = s.slot.resolve(WAGER, s.params);
        _installWager(s, BetTypes420.WagerStatus.OUTCOME_READY, s.slot.hashParams(s.params), MAX_GROSS);
        ReferenceSlotV1420.Result memory b = s.slot.resolve(WAGER, s.params);
        _installWager(s, BetTypes420.WagerStatus.SETTLED, s.slot.hashParams(s.params), MAX_GROSS);
        ReferenceSlotV1420.Result memory c = s.slot.resolve(WAGER, s.params);
        require(a.randomnessRoot == root && b.randomnessRoot == root && c.randomnessRoot == root, "root changed");
        require(a.basePayout == b.basePayout && b.basePayout == c.basePayout, "base payout changed");
        require(a.featurePayout == b.featurePayout && b.featurePayout == c.featurePayout, "feature payout changed");
        require(a.freeSpinsPlayed == b.freeSpinsPlayed && b.freeSpinsPlayed == c.freeSpinsPlayed, "free spins changed");
        require(a.retriggers == b.retriggers && b.retriggers == c.retriggers, "retriggers changed");
        require(a.grossPayout == b.grossPayout && b.grossPayout == c.grossPayout, "gross changed");
        require(a.capped == b.capped && b.capped == c.capped, "cap state changed");
        require(a.outcome == b.outcome && b.outcome == c.outcome, "outcome changed");
        for (uint8 i = 0; i < 5; ++i) require(a.baseStops[i] == b.baseStops[i] && b.baseStops[i] == c.baseStops[i], "stops changed");
        for (uint8 i = 0; i < 20; ++i) require(a.baseGrid[i] == b.baseGrid[i] && b.baseGrid[i] == c.baseGrid[i], "grid changed");
    }

    function testTamperedParamsCannotRewriteAcceptedTerms() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(WAGER, keccak256("slot/hardening/params"));
        ReferenceSlotV1420.Params memory changed = s.params;
        changed.featureReels[17][4] = uint8((changed.featureReels[17][4] + 1) % 7);
        vm.expectRevert(ReferenceSlotV1420.ParamsMismatch.selector);
        s.slot.resolve(WAGER, changed);
    }

    function testInvalidSymbolsAndScatterSchedulesFailClosed() public {
        Suite memory s = _deploy();
        ReferenceSlotV1420.Params memory bad = s.params;
        bad.baseReels[0][0] = 7;
        vm.expectRevert(ReferenceSlotV1420.InvalidParams.selector);
        s.slot.hashParams(bad);
        bad = s.params;
        bad.featureReels[31][4] = 7;
        vm.expectRevert(ReferenceSlotV1420.InvalidParams.selector);
        s.slot.hashParams(bad);
        bad = s.params;
        bad.scatter3 = 300 ether;
        bad.scatter4 = 200 ether;
        vm.expectRevert(ReferenceSlotV1420.InvalidParams.selector);
        s.slot.hashParams(bad);
        bad = s.params;
        bad.scatter5 = MAX_GROSS + 1;
        vm.expectRevert(ReferenceSlotV1420.InvalidParams.selector);
        s.slot.hashParams(bad);
    }

    function testFuzzCanonicalRootAlwaysProducesBoundedTranscript(uint256 seed) public {
        Suite memory s = _deploy();
        bytes32 root = keccak256(abi.encode("slot/hardening/fuzz", seed));
        if (root == bytes32(0)) root = bytes32(uint256(1));
        s.randomness.setRoot(WAGER, root);
        ReferenceSlotV1420.Result memory r = s.slot.resolve(WAGER, s.params);
        _assertBounded(r);
        require(r.randomnessRoot == root, "wrong root");
        if (r.outcome == BetTypes420.TerminalOutcome.LOSS) require(r.grossPayout == 0, "loss payout");
        else if (r.outcome == BetTypes420.TerminalOutcome.PUSH) require(r.grossPayout == STAKE, "push payout");
        else if (r.outcome == BetTypes420.TerminalOutcome.WIN) require(r.grossPayout > STAKE, "win payout");
        else revert("invalid outcome");
    }

    function testChangingRootChangesCanonicalTranscript() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(WAGER, keccak256("slot/hardening/root/a"));
        ReferenceSlotV1420.Result memory a = s.slot.resolve(WAGER, s.params);
        s.randomness.setRoot(WAGER, keccak256("slot/hardening/root/b"));
        ReferenceSlotV1420.Result memory b = s.slot.resolve(WAGER, s.params);
        bool changed;
        for (uint8 i = 0; i < 5; ++i) if (a.baseStops[i] != b.baseStops[i]) changed = true;
        require(changed, "unexpected identical transcript");
    }

    function testOutcomeEconomicsRemainReserveSafeAcrossKnownRoots() public {
        Suite memory s = _deploy();
        for (uint256 i = 1; i <= 64; ++i) {
            s.randomness.setRoot(WAGER, keccak256(abi.encode("slot/hardening/economics", i)));
            ReferenceSlotV1420.Result memory r = s.slot.resolve(WAGER, s.params);
            _assertBounded(r);
            if (r.outcome == BetTypes420.TerminalOutcome.LOSS) require(r.grossPayout == 0, "loss payout");
            else if (r.outcome == BetTypes420.TerminalOutcome.PUSH) require(r.grossPayout == STAKE, "push payout");
            else if (r.outcome == BetTypes420.TerminalOutcome.WIN) require(r.grossPayout > STAKE, "win payout");
            else revert("invalid outcome");
        }
    }
}
