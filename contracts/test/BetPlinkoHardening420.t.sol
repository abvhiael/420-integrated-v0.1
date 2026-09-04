// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/PlinkoV1420.sol";

interface VmBetPlinkoHardening420 {
    function expectRevert(bytes4) external;
}

contract MockPlinkoHardeningRegistry420 {
    BetTypes420.Wager private _wager;

    function setWager(BetTypes420.Wager memory wager_) external { _wager = wager_; }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
}

contract MockPlinkoHardeningRandomness420 {
    mapping(bytes32 => bytes32) private _roots;

    function setRoot(bytes32 wagerId, bytes32 root) external { _roots[wagerId] = root; }

    function rootOf(bytes32 wagerId) external view returns (bytes32 root) {
        root = _roots[wagerId];
        require(root != bytes32(0), "not fulfilled");
    }
}

contract BetPlinkoHardening420Test {
    VmBetPlinkoHardening420 constant vm = VmBetPlinkoHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xBEEF);
    bytes32 constant WAGER = keccak256("420BET.PLINKO.WAGER.HARDENING");
    bytes32 constant GAME = keccak256("420BET.GAME.PLINKO");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.PLINKO.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.PLINKO.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/plinko/hardening/v1");
    uint256 constant STAKE = 100 ether;
    uint256 constant MAX_GROSS = 1_000 ether;

    struct Suite {
        MockPlinkoHardeningRegistry420 registry;
        MockPlinkoHardeningRandomness420 randomness;
        PlinkoV1420 plinko;
        PlinkoV1420.Params params;
    }

    function _params() private pure returns (PlinkoV1420.Params memory p) {
        p.grossPayoutByBucket[0] = MAX_GROSS;
        p.grossPayoutByBucket[1] = 500 ether;
        p.grossPayoutByBucket[2] = 200 ether;
        p.grossPayoutByBucket[3] = STAKE;
        p.grossPayoutByBucket[9] = STAKE;
        p.grossPayoutByBucket[10] = 200 ether;
        p.grossPayoutByBucket[11] = 500 ether;
        p.grossPayoutByBucket[12] = MAX_GROSS;
    }

    function _deploy() private returns (Suite memory s) {
        s.registry = new MockPlinkoHardeningRegistry420();
        s.randomness = new MockPlinkoHardeningRandomness420();
        s.plinko = new PlinkoV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.params = _params();
        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, MAX_GROSS);
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
            paramsHash: s.plinko.hashParams(s.params),
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

    function _assertPath(PlinkoV1420.Result memory r) private pure {
        require(r.bucket == r.rightMoves, "bucket/right mismatch");
        require(r.bucket <= 12, "bucket range");
        require((r.pathBits >> 12) == 0, "path escaped 12 rows");
        uint8 counted;
        for (uint8 row = 0; row < 12; ++row) {
            if (((r.pathBits >> row) & 1) == 1) counted += 1;
        }
        require(counted == r.rightMoves, "right count mismatch");
    }

    function testPayoutEnvelopeIsExactAndFinite() public {
        Suite memory s = _deploy();
        require(s.plinko.requiredMaxGrossPayout(STAKE, s.params) == MAX_GROSS, "wrong max gross");

        PlinkoV1420.Params memory belowStake = s.params;
        belowStake.grossPayoutByBucket[6] = STAKE - 1;
        vm.expectRevert(PlinkoV1420.InvalidPayout.selector);
        s.plinko.requiredMaxGrossPayout(STAKE, belowStake);

        PlinkoV1420.Params memory zero;
        vm.expectRevert(PlinkoV1420.InvalidParams.selector);
        s.plinko.hashParams(zero);
    }

    function testEveryBucketEntryIsCommitted() public {
        Suite memory s = _deploy();
        bytes32 canonical = s.plinko.hashParams(s.params);
        for (uint8 bucket = 0; bucket < 13; ++bucket) {
            PlinkoV1420.Params memory altered = s.params;
            altered.grossPayoutByBucket[bucket] = altered.grossPayoutByBucket[bucket] == 0 ? STAKE : altered.grossPayoutByBucket[bucket] + STAKE;
            require(s.plinko.hashParams(altered) != canonical, "bucket not committed");
        }
    }

    function testAcceptedMaxGrossMustExactlyMatchCommittedSchedule() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(WAGER, keccak256("plinko/hardening/max-gross"));

        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, MAX_GROSS - 1);
        vm.expectRevert(PlinkoV1420.InvalidPayout.selector);
        s.plinko.resolve(WAGER, s.params);

        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, MAX_GROSS + 1);
        vm.expectRevert(PlinkoV1420.InvalidPayout.selector);
        s.plinko.resolve(WAGER, s.params);
    }

    function testRandomnessIsRequiredAndCannotBeInvented() public {
        Suite memory s = _deploy();
        (bool ok,) = address(s.plinko).staticcall(abi.encodeWithSelector(PlinkoV1420.resolve.selector, WAGER, s.params));
        require(!ok, "resolved without randomness");
    }

    function testResolveRejectsNonReconstructableStatuses() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(WAGER, keccak256("plinko/hardening/status"));

        _installWager(s, BetTypes420.WagerStatus.NONE, MAX_GROSS);
        vm.expectRevert(PlinkoV1420.InvalidWagerStatus.selector);
        s.plinko.resolve(WAGER, s.params);

        _installWager(s, BetTypes420.WagerStatus.VOID, MAX_GROSS);
        vm.expectRevert(PlinkoV1420.InvalidWagerStatus.selector);
        s.plinko.resolve(WAGER, s.params);
    }

    function testAcceptedOutcomeReadyAndSettledReconstructIdentically() public {
        Suite memory s = _deploy();
        bytes32 root = keccak256("plinko/hardening/reconstructability");
        s.randomness.setRoot(WAGER, root);

        _installWager(s, BetTypes420.WagerStatus.ACCEPTED, MAX_GROSS);
        PlinkoV1420.Result memory accepted = s.plinko.resolve(WAGER, s.params);
        _installWager(s, BetTypes420.WagerStatus.OUTCOME_READY, MAX_GROSS);
        PlinkoV1420.Result memory ready = s.plinko.resolve(WAGER, s.params);
        _installWager(s, BetTypes420.WagerStatus.SETTLED, MAX_GROSS);
        PlinkoV1420.Result memory settled = s.plinko.resolve(WAGER, s.params);

        require(accepted.randomnessRoot == root && ready.randomnessRoot == root && settled.randomnessRoot == root, "root changed");
        require(accepted.pathBits == ready.pathBits && ready.pathBits == settled.pathBits, "path changed");
        require(accepted.bucket == ready.bucket && ready.bucket == settled.bucket, "bucket changed");
        require(accepted.grossPayout == ready.grossPayout && ready.grossPayout == settled.grossPayout, "payout changed");
        require(accepted.outcome == ready.outcome && ready.outcome == settled.outcome, "outcome changed");
    }

    function testTamperedPayoutTableCannotRewriteAcceptedTerms() public {
        Suite memory s = _deploy();
        s.randomness.setRoot(WAGER, keccak256("plinko/hardening/params"));
        PlinkoV1420.Params memory altered = s.params;
        altered.grossPayoutByBucket[6] = STAKE;
        vm.expectRevert(PlinkoV1420.ParamsMismatch.selector);
        s.plinko.resolve(WAGER, altered);
    }

    function testFuzzCanonicalRootAlwaysProducesBoundedTwelveRowPath(uint256 seed) public {
        Suite memory s = _deploy();
        bytes32 root = keccak256(abi.encode("plinko/fuzz/root", seed));
        if (root == bytes32(0)) root = bytes32(uint256(1));
        s.randomness.setRoot(WAGER, root);

        PlinkoV1420.Result memory r = s.plinko.resolve(WAGER, s.params);
        _assertPath(r);
        require(r.randomnessRoot == root, "wrong root");
        require(r.grossPayout == s.params.grossPayoutByBucket[r.bucket], "schedule mismatch");
        require(r.grossPayout <= MAX_GROSS, "reserve escape");

        if (r.grossPayout == 0) require(r.outcome == BetTypes420.TerminalOutcome.LOSS, "loss mismatch");
        else if (r.grossPayout == STAKE) require(r.outcome == BetTypes420.TerminalOutcome.PUSH, "push mismatch");
        else require(r.outcome == BetTypes420.TerminalOutcome.WIN, "win mismatch");
    }

    function testChangingCanonicalRootChangesPathExceptCryptographicCollision() public {
        Suite memory s = _deploy();
        bytes32 rootA = keccak256("plinko/hardening/root/a");
        bytes32 rootB = keccak256("plinko/hardening/root/b");
        s.randomness.setRoot(WAGER, rootA);
        PlinkoV1420.Result memory a = s.plinko.resolve(WAGER, s.params);
        s.randomness.setRoot(WAGER, rootB);
        PlinkoV1420.Result memory b = s.plinko.resolve(WAGER, s.params);

        require(a.randomnessRoot != b.randomnessRoot, "root unchanged");
        require(a.pathBits != b.pathBits, "unexpected identical path");
    }

    function testOutcomeEconomicsAreClosedToLossPushOrWin() public {
        Suite memory s = _deploy();
        for (uint256 i = 1; i <= 64; ++i) {
            s.randomness.setRoot(WAGER, keccak256(abi.encode("plinko/hardening/economics", i)));
            PlinkoV1420.Result memory r = s.plinko.resolve(WAGER, s.params);
            _assertPath(r);
            require(r.grossPayout <= MAX_GROSS, "reserve escape");
            if (r.outcome == BetTypes420.TerminalOutcome.LOSS) require(r.grossPayout == 0, "loss payout");
            else if (r.outcome == BetTypes420.TerminalOutcome.PUSH) require(r.grossPayout == STAKE, "push payout");
            else if (r.outcome == BetTypes420.TerminalOutcome.WIN) require(r.grossPayout > STAKE, "win payout");
            else revert("invalid outcome");
        }
    }
}
