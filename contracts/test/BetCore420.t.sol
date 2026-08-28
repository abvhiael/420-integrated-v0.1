// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetTypes420.sol";

interface VmBetCore420 {
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBet420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;
    mapping(bytes32 => uint256) private _maxAmount;

    function setAllowed(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 maxAmount,
        bool value
    ) external {
        bytes32 key = keccak256(abi.encode(principal, componentId, capabilityId, scopeHash));
        _allowed[key] = value;
        _maxAmount[key] = maxAmount;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) {
        return _grants[grantId];
    }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount
    ) external view returns (bool) {
        bytes32 key = keccak256(abi.encode(principal, componentId, capabilityId, scopeHash));
        return _allowed[key] && amount <= _maxAmount[key];
    }
}

contract BetCore420Test {
    VmBetCore420 constant vm = VmBetCore420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    bytes32 constant GAME = keccak256("420BET.GAME.DICE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant GAME_V2 = keccak256("420BET.GAME.DICE.V2");

    function _deploy() private returns (MockCapabilityRegistryBet420 caps, BetAuthorization420 auth) {
        caps = new MockCapabilityRegistryBet420();
        auth = new BetAuthorization420(address(caps));
    }

    function testConstructorRejectsZeroRegistry() public {
        vm.expectRevert(BetAuthorization420.ZeroAddress.selector);
        new BetAuthorization420(address(0));
    }

    function testDefaultDeny() public {
        (, BetAuthorization420 auth) = _deploy();
        bool ok = auth.isGameAuthorized(ALICE, BetIds420.ACTION_PLACE, GAME, GAME_V1, 1 ether);
        require(!ok, "implicit authorization");
    }

    function testExactCapabilityApproves() public {
        (MockCapabilityRegistryBet420 caps, BetAuthorization420 auth) = _deploy();
        bytes32 scope = auth.scopeForGame(GAME, GAME_V1);
        caps.setAllowed(ALICE, BetIds420.COMPONENT_BET, BetIds420.ACTION_PLACE, scope, 2 ether, true);
        require(auth.isGameAuthorized(ALICE, BetIds420.ACTION_PLACE, GAME, GAME_V1, 2 ether), "exact grant denied");
    }

    function testPrincipalIsolation() public {
        (MockCapabilityRegistryBet420 caps, BetAuthorization420 auth) = _deploy();
        bytes32 scope = auth.scopeForGame(GAME, GAME_V1);
        caps.setAllowed(ALICE, BetIds420.COMPONENT_BET, BetIds420.ACTION_PLACE, scope, 2 ether, true);
        require(!auth.isGameAuthorized(BOB, BetIds420.ACTION_PLACE, GAME, GAME_V1, 1 ether), "principal leaked");
    }

    function testActionIsolation() public {
        (MockCapabilityRegistryBet420 caps, BetAuthorization420 auth) = _deploy();
        bytes32 scope = auth.scopeForGame(GAME, GAME_V1);
        caps.setAllowed(ALICE, BetIds420.COMPONENT_BET, BetIds420.ACTION_PLACE, scope, 2 ether, true);
        require(!auth.isGameAuthorized(ALICE, BetIds420.ACTION_GAME_ADD_STAKE, GAME, GAME_V1, 1 ether), "action leaked");
    }

    function testGameVersionIsolation() public {
        (MockCapabilityRegistryBet420 caps, BetAuthorization420 auth) = _deploy();
        bytes32 scopeV1 = auth.scopeForGame(GAME, GAME_V1);
        caps.setAllowed(ALICE, BetIds420.COMPONENT_BET, BetIds420.ACTION_PLACE, scopeV1, 2 ether, true);
        require(!auth.isGameAuthorized(ALICE, BetIds420.ACTION_PLACE, GAME, GAME_V2, 1 ether), "version leaked");
    }

    function testAmountForwardingEnforcesLimit() public {
        (MockCapabilityRegistryBet420 caps, BetAuthorization420 auth) = _deploy();
        bytes32 scope = auth.scopeForGame(GAME, GAME_V1);
        caps.setAllowed(ALICE, BetIds420.COMPONENT_BET, BetIds420.ACTION_PLACE, scope, 1 ether, true);
        require(auth.isGameAuthorized(ALICE, BetIds420.ACTION_PLACE, GAME, GAME_V1, 1 ether), "limit exact denied");
        require(!auth.isGameAuthorized(ALICE, BetIds420.ACTION_PLACE, GAME, GAME_V1, 1 ether + 1), "limit bypassed");
    }

    function testScopeHelpersAreDomainSeparated() public {
        (, BetAuthorization420 auth) = _deploy();
        bytes32 value = keccak256("same-id");
        require(auth.scopeForGame(value, GAME_V1) != auth.scopeForVault(value), "game/vault scope collision");
        require(auth.scopeForVault(value) != auth.scopeForMarket(value), "vault/market scope collision");
        require(auth.scopeForMarket(value) != auth.scopeForContest(value), "market/contest scope collision");
        require(auth.scopeForContest(value) != auth.scopeForTable(value), "contest/table scope collision");
    }

    function testCoreConstants() public pure {
        require(BetTypes420.BPS == 10_000, "bps");
        require(BetTypes420.NATIVE_ASSET == address(0), "native");
        require(BetIds420.ACTION_PLACE != BetIds420.ACTION_POKER_WITHDRAW, "action collision");
        require(BetIds420.ACTION_PREDICTION_TRADE != BetIds420.ACTION_PREDICTION_FINALIZE, "prediction authority collision");
    }
}
