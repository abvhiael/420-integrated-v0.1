// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetRegistry420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/DiceV1420.sol";

interface VmBetDiceV1420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetDiceV1420 is ICapabilityRegistry420 {
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

contract MockRandomnessRouterBetDiceV1420 {
    mapping(bytes32 => bytes32) private _roots;
    error NotReady();

    function setRoot(bytes32 wagerId, bytes32 root) external { _roots[wagerId] = root; }
    function rootOf(bytes32 wagerId) external view returns (bytes32 root) {
        root = _roots[wagerId];
        if (root == bytes32(0)) revert NotReady();
    }
}

contract BetDiceV1420Test {
    VmBetDiceV1420 constant vm = VmBetDiceV1420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant RECORDER = address(0xBEEF);
    address constant PLAYER = address(0xCAFE);
    bytes32 constant GAME = keccak256("420BET.GAME.DICE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.DICE.V1");
    bytes32 constant VAULT = keccak256("420BET.VAULT.1");
    bytes32 constant WAGER = keccak256("420BET.WAGER.DICE.1");

    struct Suite {
        MockCapabilityRegistryBetDiceV1420 caps;
        BetAuthorization420 auth;
        BetRegistry420 registry;
        MockRandomnessRouterBetDiceV1420 randomness;
        DiceV1420 dice;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetDiceV1420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.registry = new BetRegistry420(address(s.auth));
        s.randomness = new MockRandomnessRouterBetDiceV1420();
        s.dice = new DiceV1420(address(s.registry), address(s.randomness), GAME, GAME_V1, RULESET);
        s.caps.setAllowed(RECORDER, BetIds420.COMPONENT_BET, BetIds420.ACTION_WAGER_RECORD, s.auth.scopeForVault(VAULT), true);
    }

    function _record(Suite memory s, bytes32 wagerId, DiceV1420.Params memory params, uint256 stake, uint256 maxGross) private {
        BetTypes420.Wager memory wager = BetTypes420.Wager({
            wagerId: wagerId,
            player: PLAYER,
            operatorId: keccak256("operator/1"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: address(0x4444),
            stake: stake,
            maxGrossPayout: maxGross,
            paramsHash: s.dice.hashParams(params),
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

    function testResolveIsDeterministicAndBoundToCanonicalRoot() public {
        Suite memory s = _deploy();
        DiceV1420.Params memory params = DiceV1420.Params({rollUnder: true, threshold: 5000, winGrossPayout: 190 ether});
        _record(s, WAGER, params, 100 ether, 200 ether);
        bytes32 root = keccak256("canonical-root");
        s.randomness.setRoot(WAGER, root);

        DiceV1420.Result memory a = s.dice.resolve(WAGER, params);
        DiceV1420.Result memory b = s.dice.resolve(WAGER, params);
        require(a.roll >= 1 && a.roll <= 10_000, "roll out of range");
        require(a.roll == b.roll, "roll changed");
        require(a.outcome == b.outcome && a.grossPayout == b.grossPayout, "result changed");
        require(a.randomnessRoot == root, "wrong root");
        require(a.paramsHash == s.dice.hashParams(params), "wrong params hash");
        if (a.outcome == BetTypes420.TerminalOutcome.WIN) {
            require(a.grossPayout == 190 ether, "wrong win payout");
            require(a.roll <= params.threshold, "win predicate wrong");
        } else {
            require(a.outcome == BetTypes420.TerminalOutcome.LOSS, "unexpected terminal outcome");
            require(a.grossPayout == 0, "loss payout nonzero");
            require(a.roll > params.threshold, "loss predicate wrong");
        }
    }

    function testChangedRevealCannotRewriteAcceptedTerms() public {
        Suite memory s = _deploy();
        DiceV1420.Params memory accepted = DiceV1420.Params({rollUnder: true, threshold: 5000, winGrossPayout: 190 ether});
        _record(s, WAGER, accepted, 100 ether, 200 ether);
        s.randomness.setRoot(WAGER, keccak256("root"));
        DiceV1420.Params memory changed = DiceV1420.Params({rollUnder: true, threshold: 6000, winGrossPayout: 190 ether});
        vm.expectRevert(DiceV1420.ParamsMismatch.selector);
        s.dice.resolve(WAGER, changed);
    }

    function testWinPayoutMustFitAcceptedEconomicEnvelope() public {
        Suite memory s = _deploy();
        DiceV1420.Params memory params = DiceV1420.Params({rollUnder: false, threshold: 5000, winGrossPayout: 201 ether});
        _record(s, WAGER, params, 100 ether, 200 ether);
        s.randomness.setRoot(WAGER, keccak256("root"));
        vm.expectRevert(DiceV1420.InvalidPayout.selector);
        s.dice.resolve(WAGER, params);
    }

    function testRandomnessMustExistBeforeResolution() public {
        Suite memory s = _deploy();
        DiceV1420.Params memory params = DiceV1420.Params({rollUnder: true, threshold: 5000, winGrossPayout: 190 ether});
        _record(s, WAGER, params, 100 ether, 200 ether);
        vm.expectRevert(MockRandomnessRouterBetDiceV1420.NotReady.selector);
        s.dice.resolve(WAGER, params);
    }

    function testParamsValidationRejectsDegenerateOdds() public {
        Suite memory s = _deploy();
        DiceV1420.Params memory zero = DiceV1420.Params({rollUnder: true, threshold: 0, winGrossPayout: 190 ether});
        vm.expectRevert(DiceV1420.InvalidParams.selector);
        s.dice.hashParams(zero);
        DiceV1420.Params memory full = DiceV1420.Params({rollUnder: false, threshold: 10_000, winGrossPayout: 190 ether});
        vm.expectRevert(DiceV1420.InvalidParams.selector);
        s.dice.hashParams(full);
    }
}
