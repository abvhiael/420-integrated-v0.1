// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetRegistry420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/PlinkoV1420.sol";

interface VmBetPlinkoV1420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetPlinkoV1420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) { return _grants[grantId]; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external view returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract MockRandomnessRouterBetPlinkoV1420 {
    mapping(bytes32 => bytes32) private _roots;
    error NotReady();

    function setRoot(bytes32 wagerId, bytes32 root) external { _roots[wagerId] = root; }
    function rootOf(bytes32 wagerId) external view returns (bytes32 root) {
        root = _roots[wagerId];
        if (root == bytes32(0)) revert NotReady();
    }
}

contract BetPlinkoV1420Test {
    VmBetPlinkoV1420 constant vm = VmBetPlinkoV1420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant RECORDER = address(0xBEEF);
    address constant PLAYER = address(0xCAFE);
    bytes32 constant GAME = keccak256("420BET.GAME.PLINKO");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.PLINKO.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.PLINKO.V1");
    bytes32 constant VAULT = keccak256("420BET.VAULT.PLINKO.1");
    bytes32 constant WAGER = keccak256("420BET.WAGER.PLINKO.1");
    uint256 constant STAKE = 100 ether;

    struct Suite {
        MockCapabilityRegistryBetPlinkoV1420 caps;
        BetAuthorization420 auth;
        BetRegistry420 registry;
        MockRandomnessRouterBetPlinkoV1420 randomness;
        PlinkoV1420 plinko;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetPlinkoV1420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.registry = new BetRegistry420(address(s.auth));
        s.randomness = new MockRandomnessRouterBetPlinkoV1420();
        s.plinko = new PlinkoV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.caps.setAllowed(RECORDER, BetIds420.COMPONENT_BET, BetIds420.ACTION_WAGER_RECORD, s.auth.scopeForVault(VAULT), true);
    }

    function _params() private pure returns (PlinkoV1420.Params memory p) {
        p.grossPayoutByBucket[0] = 1_000 ether;
        p.grossPayoutByBucket[1] = 500 ether;
        p.grossPayoutByBucket[2] = 200 ether;
        p.grossPayoutByBucket[3] = STAKE;
        p.grossPayoutByBucket[9] = STAKE;
        p.grossPayoutByBucket[10] = 200 ether;
        p.grossPayoutByBucket[11] = 500 ether;
        p.grossPayoutByBucket[12] = 1_000 ether;
    }

    function _record(Suite memory s, PlinkoV1420.Params memory params, uint256 maxGross) private {
        BetTypes420.Wager memory wager = BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator/1"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0x4444),
            stake: STAKE,
            maxGrossPayout: maxGross,
            paramsHash: s.plinko.hashParams(params),
            vaultId: VAULT,
            randomnessProfileId: keccak256("randomness/1"),
            riskProfileId: keccak256("risk/1"),
            settlementProfileId: keccak256("settlement/1"),
            accessPolicyId: keccak256("access/1"),
            rulesetId: RULESET,
            acceptedAt: 0,
            deadline: uint64(block.timestamp + 1 hours),
            status: BetTypes420.WagerStatus.NONE
        });
        vm.prank(RECORDER);
        s.registry.recordAccepted(wager);
    }

    function testResolveIsDeterministicAndBucketEqualsRightMoveCount() public {
        Suite memory s = _deploy();
        PlinkoV1420.Params memory params = _params();
        _record(s, params, 1_000 ether);
        bytes32 root = keccak256("canonical-plinko-root");
        s.randomness.setRoot(WAGER, root);

        PlinkoV1420.Result memory a = s.plinko.resolve(WAGER, params);
        PlinkoV1420.Result memory b = s.plinko.resolve(WAGER, params);
        require(a.randomnessRoot == root, "wrong root");
        require(a.paramsHash == s.plinko.hashParams(params), "wrong params hash");
        require(a.pathBits == b.pathBits, "path changed");
        require(a.rightMoves == b.rightMoves, "right count changed");
        require(a.bucket == b.bucket, "bucket changed");
        require(a.bucket == a.rightMoves && a.bucket <= 12, "bad bucket");

        uint8 counted;
        for (uint8 row = 0; row < 12; ++row) {
            if (((a.pathBits >> row) & 1) == 1) counted += 1;
        }
        require(counted == a.rightMoves, "path count mismatch");
        require(a.grossPayout == params.grossPayoutByBucket[a.bucket], "payout mismatch");
        if (a.grossPayout == 0) require(a.outcome == BetTypes420.TerminalOutcome.LOSS, "loss mismatch");
        else if (a.grossPayout == STAKE) require(a.outcome == BetTypes420.TerminalOutcome.PUSH, "push mismatch");
        else require(a.outcome == BetTypes420.TerminalOutcome.WIN, "win mismatch");
    }

    function testChangedPayoutTableCannotRewriteAcceptedTerms() public {
        Suite memory s = _deploy();
        PlinkoV1420.Params memory accepted = _params();
        _record(s, accepted, 1_000 ether);
        s.randomness.setRoot(WAGER, keccak256("root"));
        PlinkoV1420.Params memory changed = accepted;
        changed.grossPayoutByBucket[6] = STAKE;
        vm.expectRevert(PlinkoV1420.ParamsMismatch.selector);
        s.plinko.resolve(WAGER, changed);
    }

    function testAcceptedMaxGrossMustEqualFullBucketMaximum() public {
        Suite memory s = _deploy();
        PlinkoV1420.Params memory params = _params();
        _record(s, params, 999 ether);
        s.randomness.setRoot(WAGER, keccak256("root"));
        vm.expectRevert(PlinkoV1420.InvalidPayout.selector);
        s.plinko.resolve(WAGER, params);
    }

    function testRandomnessMustExistBeforeResolution() public {
        Suite memory s = _deploy();
        PlinkoV1420.Params memory params = _params();
        _record(s, params, 1_000 ether);
        vm.expectRevert(MockRandomnessRouterBetPlinkoV1420.NotReady.selector);
        s.plinko.resolve(WAGER, params);
    }

    function testPayoutScheduleRejectsEmptyAndPartialReturn() public {
        Suite memory s = _deploy();
        PlinkoV1420.Params memory empty;
        vm.expectRevert(PlinkoV1420.InvalidParams.selector);
        s.plinko.hashParams(empty);

        PlinkoV1420.Params memory params = _params();
        params.grossPayoutByBucket[6] = STAKE - 1;
        vm.expectRevert(PlinkoV1420.InvalidPayout.selector);
        s.plinko.requiredMaxGrossPayout(STAKE, params);
    }

    function testChangedCanonicalRootChangesPath() public {
        Suite memory s = _deploy();
        PlinkoV1420.Params memory params = _params();
        _record(s, params, 1_000 ether);
        s.randomness.setRoot(WAGER, keccak256("plinko-root-a"));
        PlinkoV1420.Result memory a = s.plinko.resolve(WAGER, params);
        s.randomness.setRoot(WAGER, keccak256("plinko-root-b"));
        PlinkoV1420.Result memory b = s.plinko.resolve(WAGER, params);
        require(a.randomnessRoot != b.randomnessRoot, "root unchanged");
        require(a.pathBits != b.pathBits, "unexpected identical path");
    }
}
