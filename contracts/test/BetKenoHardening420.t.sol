// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/KenoV1420.sol";

interface VmBetKenoHardening420 {
    function expectRevert(bytes4) external;
}

contract MockKenoHardeningRegistry420 {
    BetTypes420.Wager private _wager;

    function setWager(BetTypes420.Wager memory wager_) external { _wager = wager_; }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockKenoHardeningRandomness420 {
    mapping(bytes32 => bytes32) private _roots;

    function setRoot(bytes32 wagerId, bytes32 root) external { _roots[wagerId] = root; }

    function rootOf(bytes32 wagerId) external view returns (bytes32 root) {
        root = _roots[wagerId];
        require(root != bytes32(0), "not fulfilled");
    }
}

contract BetKenoHardening420Test {
    VmBetKenoHardening420 constant vm = VmBetKenoHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xBEEF);
    bytes32 constant WAGER = keccak256("420BET.KENO.WAGER.HARDENING");
    bytes32 constant GAME = keccak256("420BET.GAME.KENO");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.KENO.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.KENO.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/keno/hardening/v1");
    uint256 constant STAKE = 100 ether;

    struct Suite {
        MockKenoHardeningRegistry420 registry;
        MockKenoHardeningRandomness420 randomness;
        KenoV1420 keno;
        KenoV1420.Params params;
    }

    function _params() private pure returns (KenoV1420.Params memory p) {
        p.pickCount = 5;
        p.picks[0] = 3;
        p.picks[1] = 17;
        p.picks[2] = 29;
        p.picks[3] = 44;
        p.picks[4] = 80;
        p.grossPayoutByHits[2] = STAKE;
        p.grossPayoutByHits[3] = 200 ether;
        p.grossPayoutByHits[4] = 1_000 ether;
        p.grossPayoutByHits[5] = 5_000 ether;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockKenoHardeningRegistry420();
        s.randomness = new MockKenoHardeningRandomness420();
        s.keno = new KenoV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.params = _params();
        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, s.keno.requiredMaxGrossPayout(STAKE, s.params));
    }

    function _installWager(Suite memory s, BetTypes420.WagerStatus status, uint256 maxGrossPayout) private {
        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0xCA),
            stake: STAKE,
            maxGrossPayout: maxGrossPayout,
            paramsHash: s.keno.hashParams(s.params),
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

    function _assertValidDraw(KenoV1420.Result memory result) private pure {
        for (uint8 i = 0; i < 20; ++i) {
            require(result.draw[i] >= 1 && result.draw[i] <= 80, "draw range");
            for (uint8 j = 0; j < i; ++j) require(result.draw[i] != result.draw[j], "duplicate draw");
        }
        require(result.hits <= 5, "hits exceed picks");
    }

    function testPayoutEnvelopeIsExactAndFinite() public {
        Suite memory s = _deploy();
        require(s.keno.requiredMaxGrossPayout(STAKE, s.params) == 5_000 ether, "wrong max gross");

        KenoV1420.Params memory belowStake = s.params;
        belowStake.grossPayoutByHits[1] = STAKE - 1;
        vm.expectRevert(KenoV1420.InvalidPayout.selector);
        s.keno.requiredMaxGrossPayout(STAKE, belowStake);

        KenoV1420.Params memory zero = s.params;
        for (uint8 i = 0; i <= 5; ++i) zero.grossPayoutByHits[i] = 0;
        vm.expectRevert(KenoV1420.InvalidPayout.selector);
        s.keno.requiredMaxGrossPayout(STAKE, zero);
    }

    function testAllPickCountBoundsAndCanonicalTailsAreClosed() public {
        Suite memory s = _deploy();

        KenoV1420.Params memory p = s.params;
        p.pickCount = 0;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(p);

        p = s.params;
        p.pickCount = 11;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(p);

        p = s.params;
        p.picks[0] = 0;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(p);

        p = s.params;
        p.picks[0] = 81;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(p);

        p = s.params;
        p.picks[4] = p.picks[0];
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(p);

        p = s.params;
        p.picks[5] = 12;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(p);

        p = s.params;
        p.grossPayoutByHits[0] = STAKE;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(p);

        p = s.params;
        p.grossPayoutByHits[6] = STAKE;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(p);
    }

    function testAcceptedMaxGrossMustExactlyMatchCommittedSchedule() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(WAGER, keccak256("keno/hardening/max-gross"));

        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, 4_999 ether);
        vm.expectRevert(KenoV1420.InvalidPayout.selector);
        s.keno.resolve(WAGER, s.params);

        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, 5_001 ether);
        vm.expectRevert(KenoV1420.InvalidPayout.selector);
        s.keno.resolve(WAGER, s.params);
    }

    function testRandomnessIsRequiredAndCannotBeInvented() public {
        Suite memory s = _deploy();
        (bool ok,) = address(s.keno).staticcall(abi.encodeCall(s.keno.resolve, (WAGER, s.params)));
        require(!ok, "resolved without randomness");
    }

    function testResolveRejectsNonTerminallyReconstructableStatuses() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(WAGER, keccak256("keno/hardening/status"));

        _installWager(s, BetTypes420.WagerStatus.NONE, 5_000 ether);
        vm.expectRevert(KenoV1420.InvalidWagerStatus.selector);
        s.keno.resolve(WAGER, s.params);

        _installWager(s, BetTypes420.WagerStatus.VOID, 5_000 ether);
        vm.expectRevert(KenoV1420.InvalidWagerStatus.selector);
        s.keno.resolve(WAGER, s.params);
    }

    function testAcceptedOutcomeReadyAndSettledAllReconstructIdentically() public {
        Suite memory s = _deploy();
        bytes32 root = keccak256("keno/hardening/reconstructability");
        s.randomness.setRoot(WAGER, root);

        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, 5_000 ether);
        KenoV1420.Result memory accepted = s.keno.resolve(WAGER, s.params);

        _installWager(s, BetTypes420.WagerStatus.OUTCOME_READY, 5_000 ether);
        KenoV1420.Result memory ready = s.keno.resolve(WAGER, s.params);

        _installWager(s, BetTypes420.WagerStatus.SETTLED, 5_000 ether);
        KenoV1420.Result memory settled = s.keno.resolve(WAGER, s.params);

        require(accepted.randomnessRoot == root && ready.randomnessRoot == root && settled.randomnessRoot == root, "root changed");
        require(accepted.hits == ready.hits && ready.hits == settled.hits, "hits changed");
        require(accepted.grossPayout == ready.grossPayout && ready.grossPayout == settled.grossPayout, "payout changed");
        require(accepted.outcome == ready.outcome && ready.outcome == settled.outcome, "outcome changed");
        for (uint8 i = 0; i < 20; ++i) {
            require(accepted.draw[i] == ready.draw[i], "ready draw changed");
            require(ready.draw[i] == settled.draw[i], "settled draw changed");
        }
    }

    function testParamsCommitmentBindsPicksAndEveryPayoutEntry() public {
        Suite memory s = _deploy();
        bytes32 canonical = s.keno.hashParams(s.params);

        KenoV1420.Params memory changedPick = s.params;
        changedPick.picks[0] = 4;
        require(s.keno.hashParams(changedPick) != canonical, "pick not bound");

        KenoV1420.Params memory changedPayout = s.params;
        changedPayout.grossPayoutByHits[4] += 1 ether;
        require(s.keno.hashParams(changedPayout) != canonical, "payout not bound");

        s.randomness.setRoot(WAGER, keccak256("keno/hardening/params"));
        vm.expectRevert(KenoV1420.ParamsMismatch.selector);
        s.keno.resolve(WAGER, changedPick);
        vm.expectRevert(KenoV1420.ParamsMismatch.selector);
        s.keno.resolve(WAGER, changedPayout);
    }

    function testFuzzEveryCanonicalRootProducesTwentyUniqueBoundedDraws(uint256 seed) public {
        Suite memory s = _deploy();
        bytes32 root = keccak256(abi.encode("keno/fuzz/root", seed));
        if (root == bytes32(0)) root = bytes32(uint256(1));
        s.randomness.setRoot(WAGER, root);

        KenoV1420.Result memory result = s.keno.resolve(WAGER, s.params);
        _assertValidDraw(result);
        require(result.randomnessRoot == root, "wrong root");
        require(result.grossPayout <= 5_000 ether, "payout escaped reserve");

        if (result.grossPayout == 0) require(result.outcome == BetTypes420.TerminalOutcome.LOSS, "loss mismatch");
        else if (result.grossPayout == STAKE) require(result.outcome == BetTypes420.TerminalOutcome.PUSH, "push mismatch");
        else require(result.outcome == BetTypes420.TerminalOutcome.WIN, "win mismatch");
    }

    function testChangingCanonicalRootChangesTranscriptOrPreservesOnlyByCollision() public {
        Suite memory s = _deploy();
        bytes32 rootA = keccak256("keno/hardening/root/a");
        bytes32 rootB = keccak256("keno/hardening/root/b");
        s.randomness.setRoot(WAGER, rootA);
        KenoV1420.Result memory a = s.keno.resolve(WAGER, s.params);
        s.randomness.setRoot(WAGER, rootB);
        KenoV1420.Result memory b = s.keno.resolve(WAGER, s.params);

        require(a.randomnessRoot != b.randomnessRoot, "root not changed");
        bool differs;
        for (uint8 i = 0; i < 20; ++i) if (a.draw[i] != b.draw[i]) differs = true;
        require(differs, "unexpected identical transcript");
    }

    function testOutcomeEconomicsAreClosedToLossPushOrWin() public {
        Suite memory s = _deploy();
        for (uint256 i = 1; i <= 32; ++i) {
            s.randomness.setRoot(WAGER, keccak256(abi.encode("keno/hardening/economics", i)));
            KenoV1420.Result memory r = s.keno.resolve(WAGER, s.params);
            require(r.grossPayout <= 5_000 ether, "reserve escape");
            if (r.outcome == BetTypes420.TerminalOutcome.LOSS) require(r.grossPayout == 0, "loss payout");
            else if (r.outcome == BetTypes420.TerminalOutcome.PUSH) require(r.grossPayout == STAKE, "push payout");
            else if (r.outcome == BetTypes420.TerminalOutcome.WIN) require(r.grossPayout > STAKE, "win payout");
            else revert("invalid outcome");
        }
    }
}
