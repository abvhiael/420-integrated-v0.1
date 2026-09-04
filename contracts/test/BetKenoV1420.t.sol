// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetRegistry420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/KenoV1420.sol";

interface VmBetKenoV1420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetKenoV1420 is ICapabilityRegistry420 {
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

contract MockRandomnessRouterBetKenoV1420 {
    mapping(bytes32 => bytes32) private _roots;
    error NotReady();

    function setRoot(bytes32 wagerId, bytes32 root) external { _roots[wagerId] = root; }
    function rootOf(bytes32 wagerId) external view returns (bytes32 root) {
        root = _roots[wagerId];
        if (root == bytes32(0)) revert NotReady();
    }
}

contract BetKenoV1420Test {
    VmBetKenoV1420 constant vm = VmBetKenoV1420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant RECORDER = address(0xBEEF);
    address constant PLAYER = address(0xCAFE);
    bytes32 constant GAME = keccak256("420BET.GAME.KENO");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.KENO.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.KENO.V1");
    bytes32 constant VAULT = keccak256("420BET.VAULT.KENO.1");
    bytes32 constant WAGER = keccak256("420BET.WAGER.KENO.1");

    struct Suite {
        MockCapabilityRegistryBetKenoV1420 caps;
        BetAuthorization420 auth;
        BetRegistry420 registry;
        MockRandomnessRouterBetKenoV1420 randomness;
        KenoV1420 keno;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetKenoV1420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.registry = new BetRegistry420(address(s.auth));
        s.randomness = new MockRandomnessRouterBetKenoV1420();
        s.keno = new KenoV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.caps.setAllowed(RECORDER, BetIds420.COMPONENT_BET, BetIds420.ACTION_WAGER_RECORD, s.auth.scopeForVault(VAULT), true);
    }

    function _params() private pure returns (KenoV1420.Params memory params) {
        params.pickCount = 5;
        params.picks[0] = 3;
        params.picks[1] = 17;
        params.picks[2] = 29;
        params.picks[3] = 44;
        params.picks[4] = 80;
        params.grossPayoutByHits[2] = 100 ether;
        params.grossPayoutByHits[3] = 200 ether;
        params.grossPayoutByHits[4] = 1_000 ether;
        params.grossPayoutByHits[5] = 5_000 ether;
    }

    function _record(Suite memory s, bytes32 wagerId, KenoV1420.Params memory params, uint256 stake, uint256 maxGross) private {
        BetTypes420.Wager memory wager = BetTypes420.Wager({
            wagerId: wagerId,
            player: PLAYER,
            operatorId: keccak256("operator/1"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0x4444),
            stake: stake,
            maxGrossPayout: maxGross,
            paramsHash: s.keno.hashParams(params),
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

    function testResolveIsDeterministicUniqueAndBoundToCanonicalRoot() public {
        Suite memory s = _deploy();
        KenoV1420.Params memory params = _params();
        _record(s, WAGER, params, 100 ether, 5_000 ether);
        bytes32 root = keccak256("canonical-keno-root");
        s.randomness.setRoot(WAGER, root);

        KenoV1420.Result memory a = s.keno.resolve(WAGER, params);
        KenoV1420.Result memory b = s.keno.resolve(WAGER, params);
        require(a.randomnessRoot == root, "wrong root");
        require(a.paramsHash == s.keno.hashParams(params), "wrong params hash");
        require(a.hits == b.hits && a.grossPayout == b.grossPayout && a.outcome == b.outcome, "result changed");

        uint8 countedHits;
        for (uint8 i = 0; i < 20; ++i) {
            require(a.draw[i] >= 1 && a.draw[i] <= 80, "draw out of range");
            require(a.draw[i] == b.draw[i], "draw changed");
            for (uint8 j = 0; j < i; ++j) require(a.draw[i] != a.draw[j], "duplicate draw");
            for (uint8 p = 0; p < params.pickCount; ++p) {
                if (a.draw[i] == params.picks[p]) countedHits += 1;
            }
        }
        require(a.hits == countedHits, "hit count wrong");
        require(a.grossPayout == params.grossPayoutByHits[a.hits], "payout schedule ignored");
        if (a.grossPayout == 0) require(a.outcome == BetTypes420.TerminalOutcome.LOSS, "loss outcome wrong");
        else if (a.grossPayout == 100 ether) require(a.outcome == BetTypes420.TerminalOutcome.PUSH, "push outcome wrong");
        else require(a.outcome == BetTypes420.TerminalOutcome.WIN, "win outcome wrong");
    }

    function testChangedPicksCannotRewriteAcceptedTerms() public {
        Suite memory s = _deploy();
        KenoV1420.Params memory accepted = _params();
        _record(s, WAGER, accepted, 100 ether, 5_000 ether);
        s.randomness.setRoot(WAGER, keccak256("root"));
        KenoV1420.Params memory changed = accepted;
        changed.picks[0] = 4;
        vm.expectRevert(KenoV1420.ParamsMismatch.selector);
        s.keno.resolve(WAGER, changed);
    }

    function testAcceptedMaxGrossMustEqualFullScheduleMaximum() public {
        Suite memory s = _deploy();
        KenoV1420.Params memory params = _params();
        _record(s, WAGER, params, 100 ether, 4_999 ether);
        s.randomness.setRoot(WAGER, keccak256("root"));
        vm.expectRevert(KenoV1420.InvalidPayout.selector);
        s.keno.resolve(WAGER, params);
    }

    function testRandomnessMustExistBeforeResolution() public {
        Suite memory s = _deploy();
        KenoV1420.Params memory params = _params();
        _record(s, WAGER, params, 100 ether, 5_000 ether);
        vm.expectRevert(MockRandomnessRouterBetKenoV1420.NotReady.selector);
        s.keno.resolve(WAGER, params);
    }

    function testParamsRejectDuplicateOutOfRangeAndNonCanonicalTail() public {
        Suite memory s = _deploy();
        KenoV1420.Params memory params = _params();
        params.picks[1] = params.picks[0];
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(params);

        params = _params();
        params.picks[0] = 81;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(params);

        params = _params();
        params.picks[7] = 12;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(params);

        params = _params();
        params.grossPayoutByHits[8] = 100 ether;
        vm.expectRevert(KenoV1420.InvalidParams.selector);
        s.keno.hashParams(params);
    }

    function testPayoutScheduleCannotEncodePartialReturnBelowStake() public {
        Suite memory s = _deploy();
        KenoV1420.Params memory params = _params();
        params.grossPayoutByHits[2] = 99 ether;
        vm.expectRevert(KenoV1420.InvalidPayout.selector);
        s.keno.requiredMaxGrossPayout(100 ether, params);
    }
}
