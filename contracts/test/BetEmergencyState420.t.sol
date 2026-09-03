// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetEmergencyState420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetTypes420.sol";

interface VmBetEmergency420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetEmergency420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32) external pure returns (CapabilityGrant memory grant_) { return grant_; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external view returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract BetEmergencyState420Test {
    VmBetEmergency420 constant vm = VmBetEmergency420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant GUARDIAN = address(0xE420);
    address constant OTHER = address(0xBAD);
    bytes32 constant GAME = keccak256("420BET.GAME.DICE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant VAULT = keccak256("420BET.VAULT.CADC.1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness/v1");
    bytes32 constant SETTLEMENT = keccak256("profile/settlement/v1");

    MockCapabilityRegistryBetEmergency420 caps;
    BetAuthorization420 auth;
    BetEmergencyState420 emergency;

    function setUp() public {
        caps = new MockCapabilityRegistryBetEmergency420();
        auth = new BetAuthorization420(address(caps));
        emergency = new BetEmergencyState420(address(auth));
    }

    function _allow(BetTypes420.EmergencyDomain domain, bytes32 subject) private {
        caps.setAllowed(
            GUARDIAN,
            BetIds420.COMPONENT_BET,
            BetIds420.ACTION_EMERGENCY_SET,
            auth.scopeForEmergency(domain, subject),
            true
        );
    }

    function testDefaultOpenAndExactCapabilityRequired() public {
        bool halted = emergency.isHalted(BetTypes420.EmergencyDomain.GAME_VERSION, GAME_V1);
        require(!halted, "default must be open");

        vm.prank(GUARDIAN);
        vm.expectRevert(BetEmergencyState420.Unauthorized.selector);
        emergency.setEmergency(BetTypes420.EmergencyDomain.GAME_VERSION, GAME_V1, true);

        _allow(BetTypes420.EmergencyDomain.GAME_VERSION, GAME_V1);
        vm.prank(GUARDIAN);
        emergency.setEmergency(BetTypes420.EmergencyDomain.GAME_VERSION, GAME_V1, true);
        require(emergency.isHalted(BetTypes420.EmergencyDomain.GAME_VERSION, GAME_V1), "halt missing");
    }

    function testEmergencyCapabilityIsDomainAndSubjectIsolated() public {
        _allow(BetTypes420.EmergencyDomain.GAME, GAME);

        vm.prank(GUARDIAN);
        emergency.setEmergency(BetTypes420.EmergencyDomain.GAME, GAME, true);

        vm.prank(GUARDIAN);
        vm.expectRevert(BetEmergencyState420.Unauthorized.selector);
        emergency.setEmergency(BetTypes420.EmergencyDomain.GAME_VERSION, GAME, true);

        vm.prank(GUARDIAN);
        vm.expectRevert(BetEmergencyState420.Unauthorized.selector);
        emergency.setEmergency(BetTypes420.EmergencyDomain.GAME, GAME_V1, true);
    }

    function testResumeUsesSameExactAuthorityAndNoStateChangeFails() public {
        _allow(BetTypes420.EmergencyDomain.VAULT_NEW_RISK, VAULT);
        vm.prank(GUARDIAN);
        emergency.setEmergency(BetTypes420.EmergencyDomain.VAULT_NEW_RISK, VAULT, true);

        vm.prank(OTHER);
        vm.expectRevert(BetEmergencyState420.Unauthorized.selector);
        emergency.setEmergency(BetTypes420.EmergencyDomain.VAULT_NEW_RISK, VAULT, false);

        vm.prank(GUARDIAN);
        emergency.setEmergency(BetTypes420.EmergencyDomain.VAULT_NEW_RISK, VAULT, false);
        require(!emergency.isHalted(BetTypes420.EmergencyDomain.VAULT_NEW_RISK, VAULT), "resume failed");

        vm.prank(GUARDIAN);
        vm.expectRevert(BetEmergencyState420.NoStateChange.selector);
        emergency.setEmergency(BetTypes420.EmergencyDomain.VAULT_NEW_RISK, VAULT, false);
    }

    function testGlobalNewWagersRequiresZeroSubject() public {
        _allow(BetTypes420.EmergencyDomain.NEW_WAGERS, bytes32(0));
        vm.prank(GUARDIAN);
        emergency.setEmergency(BetTypes420.EmergencyDomain.NEW_WAGERS, bytes32(0), true);
        require(emergency.isHalted(BetTypes420.EmergencyDomain.NEW_WAGERS, bytes32(0)), "global halt missing");

        vm.expectRevert(BetEmergencyState420.InvalidSubject.selector);
        emergency.isHalted(BetTypes420.EmergencyDomain.NEW_WAGERS, GAME);
    }

    function testScopedDomainsRejectZeroSubject() public {
        vm.expectRevert(BetEmergencyState420.InvalidSubject.selector);
        emergency.isHalted(BetTypes420.EmergencyDomain.GAME, bytes32(0));
        vm.expectRevert(BetEmergencyState420.InvalidSubject.selector);
        emergency.isHalted(BetTypes420.EmergencyDomain.RANDOMNESS_PROFILE, bytes32(0));
        vm.expectRevert(BetEmergencyState420.InvalidSubject.selector);
        emergency.isHalted(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, bytes32(0));
    }

    function testNoneDomainRejected() public {
        vm.expectRevert(BetEmergencyState420.InvalidDomain.selector);
        emergency.isHalted(BetTypes420.EmergencyDomain.NONE, bytes32(0));
    }

    function testFrozenPositiveDomainsHaveStableDistinctKeys() public view {
        BetTypes420.EmergencyDomain[17] memory domains = [
            BetTypes420.EmergencyDomain.NEW_WAGERS,
            BetTypes420.EmergencyDomain.GAME,
            BetTypes420.EmergencyDomain.GAME_VERSION,
            BetTypes420.EmergencyDomain.VAULT_NEW_RISK,
            BetTypes420.EmergencyDomain.RANDOMNESS_PROFILE,
            BetTypes420.EmergencyDomain.SPORTS_MARKET,
            BetTypes420.EmergencyDomain.ORACLE_PROFILE,
            BetTypes420.EmergencyDomain.FANTASY_NEW_ENTRIES,
            BetTypes420.EmergencyDomain.FANTASY_CONTEST_CREATION,
            BetTypes420.EmergencyDomain.POKER_NEW_TABLES,
            BetTypes420.EmergencyDomain.POKER_NEW_HANDS,
            BetTypes420.EmergencyDomain.POKER_TOURNAMENT_REGISTRATION,
            BetTypes420.EmergencyDomain.PREDICTION_NEW_MARKETS,
            BetTypes420.EmergencyDomain.PREDICTION_TRADING,
            BetTypes420.EmergencyDomain.PREDICTION_NEW_LIQUIDITY,
            BetTypes420.EmergencyDomain.PROMOTION,
            BetTypes420.EmergencyDomain.SETTLEMENT_HOLD
        ];

        bytes32 previous;
        for (uint256 i = 0; i < domains.length; i++) {
            bytes32 subject = domains[i] == BetTypes420.EmergencyDomain.NEW_WAGERS ? bytes32(0) : bytes32(uint256(i + 1));
            bytes32 key = emergency.emergencyKey(domains[i], subject);
            require(key != bytes32(0), "zero key");
            require(i == 0 || key != previous, "domain key collision");
            previous = key;
        }
    }

    function testRepresentativeOperationalDomainsToggleIndependently() public {
        _allow(BetTypes420.EmergencyDomain.RANDOMNESS_PROFILE, RANDOMNESS);
        _allow(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, SETTLEMENT);

        vm.prank(GUARDIAN);
        emergency.setEmergency(BetTypes420.EmergencyDomain.RANDOMNESS_PROFILE, RANDOMNESS, true);
        vm.prank(GUARDIAN);
        emergency.setEmergency(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, SETTLEMENT, true);

        require(emergency.isHalted(BetTypes420.EmergencyDomain.RANDOMNESS_PROFILE, RANDOMNESS), "randomness halt missing");
        require(emergency.isHalted(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, SETTLEMENT), "settlement halt missing");
        require(!emergency.isHalted(BetTypes420.EmergencyDomain.GAME, GAME), "unrelated domain halted");
    }
}
