// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {CapabilityRegistry420} from "../../../src/system/CapabilityRegistry420.sol";
import {HighCountryAuthorization} from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import {EmergencyState} from "../../../src/highcountry/security/EmergencyState.sol";
import {SecurityCouncilController} from "../../../src/highcountry/security/SecurityCouncilController.sol";
import {RandomnessCoordinator} from "../../../src/highcountry/random/RandomnessCoordinator.sol";
import {UpgradeCoordinator} from "../../../src/highcountry/upgrades/UpgradeCoordinator.sol";
import {ActionIds} from "../../../src/highcountry/constants/ActionIds.sol";
import {ModuleIds} from "../../../src/highcountry/constants/ModuleIds.sol";
import {EmergencyDomains} from "../../../src/highcountry/constants/EmergencyDomains.sol";
interface VmR04Integration { function prank(address) external; function warp(uint256) external; }
contract R04AuthorityIntegrationTest {
    VmR04Integration constant vm = VmR04Integration(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant RELEASE = address(0xA11CE);
    address constant REVIEW = address(0xB0B);
    CapabilityRegistry420 caps;
    HighCountryAuthorization auth;
    EmergencyState emergency;
    SecurityCouncilController council;
    RandomnessCoordinator random;
    bytes32 constant D = keccak256("HC.TEST.RANDOM.DOMAIN");
    bytes32 constant C = keccak256("HC.TEST.RANDOM.CONTEXT");
    bytes32 constant RELEASE_GRANT = keccak256("release-grant");
    function _grant(bytes32 id, address principal, bytes32 module, bytes32 action, bytes32 scope) internal {
        caps.createGrant(id, principal, module, action, scope, 0, 0, 0, 0, 0);
    }
    function setUp() public {
        caps = new CapabilityRegistry420();
        auth = new HighCountryAuthorization(address(caps));
        emergency = new EmergencyState(address(auth));
        council = new SecurityCouncilController(address(emergency), address(this), RELEASE);
        random = new RandomnessCoordinator(address(auth));
        caps.registerProtocolComponent(ModuleIds.EMERGENCY_STATE, address(this));
        caps.registerProtocolComponent(ModuleIds.RANDOMNESS_COORDINATOR, address(this));
        _grant(keccak256("bind"), address(this), ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_BIND_EMERGENCY, random.EMERGENCY_BIND_SCOPE());
        random.bindEmergencyState(address(emergency));
        _grant(keccak256("request1"), address(this), ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_REQUEST, bytes32(uint256(1)));
        _grant(keccak256("request2"), address(this), ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_REQUEST, bytes32(uint256(2)));
        _grant(keccak256("fulfill1"), address(this), ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_FULFILL, bytes32(uint256(1)));
    }
    function _restrictGrant() internal {
        _grant(keccak256("restrict"), address(council), ModuleIds.EMERGENCY_STATE,
            ActionIds.EMERGENCY_RESTRICT, EmergencyDomains.RANDOMNESS_REQUEST);
    }
    function _schedule() internal { vm.prank(RELEASE); council.scheduleRelease(EmergencyDomains.RANDOMNESS_REQUEST); }
    function _releaseCall() internal returns (bool ok) {
        vm.prank(RELEASE);
        (ok,) = address(council).call(abi.encodeCall(council.release, (EmergencyDomains.RANDOMNESS_REQUEST)));
    }
    function testRealControllerRestrictsConsumerPreservesRecoveryAndRevokedRelease() public {
        random.request(bytes32(uint256(1)), D, C);
        _restrictGrant();
        council.restrict(EmergencyDomains.RANDOMNESS_REQUEST);
        (bool entry,) = address(random).call(abi.encodeCall(random.request, (bytes32(uint256(2)), D, C)));
        require(!entry, "restricted entry");
        random.fulfill(bytes32(uint256(1)), keccak256("entropy"));
        require(random.consume(bytes32(uint256(1)), D, C) == keccak256("entropy"), "recovery lost");
        (bool replay,) = address(random).call(abi.encodeCall(random.consume, (bytes32(uint256(1)), D, C)));
        require(!replay, "recovery replay");
        _grant(RELEASE_GRANT, address(council), ModuleIds.EMERGENCY_STATE,
            ActionIds.EMERGENCY_RELEASE, EmergencyDomains.RANDOMNESS_REQUEST);
        _schedule();
        uint64 ready = council.releaseReadyAt(EmergencyDomains.RANDOMNESS_REQUEST);
        require(!_releaseCall(), "early release");
        vm.warp(ready);
        caps.revokeGrant(RELEASE_GRANT);
        require(!_releaseCall(), "revoked release");
        require(emergency.isRestricted(EmergencyDomains.RANDOMNESS_REQUEST), "restriction lost");
        require(council.releaseReadyAt(EmergencyDomains.RANDOMNESS_REQUEST) == ready, "failed release consumed schedule");
        _grant(keccak256("restored"), address(council), ModuleIds.EMERGENCY_STATE,
            ActionIds.EMERGENCY_RELEASE, EmergencyDomains.RANDOMNESS_REQUEST);
        require(_releaseCall(), "authorized release failed");
        require(!_releaseCall(), "release replay");
        random.request(bytes32(uint256(2)), D, C);
    }
    function testRealRegistryWrongPrincipalDomainAndVetoFailClosed() public {
        _grant(keccak256("officer"), address(this), ModuleIds.EMERGENCY_STATE,
            ActionIds.EMERGENCY_RESTRICT, EmergencyDomains.RANDOMNESS_REQUEST);
        (bool principal,) = address(council).call(abi.encodeCall(council.restrict, (EmergencyDomains.RANDOMNESS_REQUEST)));
        require(!principal, "officer grant impersonated controller");
        _grant(keccak256("wrong-domain"), address(council), ModuleIds.EMERGENCY_STATE,
            ActionIds.EMERGENCY_RESTRICT, EmergencyDomains.CULTIVATION);
        (bool scope,) = address(council).call(abi.encodeCall(council.restrict, (EmergencyDomains.RANDOMNESS_REQUEST)));
        require(!scope, "foreign domain accepted");
        _restrictGrant();
        council.restrict(EmergencyDomains.RANDOMNESS_REQUEST);
        _schedule();
        council.vetoRelease(EmergencyDomains.RANDOMNESS_REQUEST);
        vm.warp(block.timestamp + council.RELEASE_DELAY());
        require(!_releaseCall() && emergency.isRestricted(EmergencyDomains.RANDOMNESS_REQUEST), "veto bypass");
    }
    function testReplacementProvenanceDoesNotRebindLiveConsumerOrTransferAuthority() public {
        UpgradeCoordinator upgrades = new UpgradeCoordinator(address(this), REVIEW);
        EmergencyState replacement = new EmergencyState(address(auth));
        bytes32 id = keccak256("emergency-replacement");
        upgrades.propose(id, address(emergency), address(replacement), address(emergency).codehash,
            address(replacement).codehash, keccak256("migration-plan"), keccak256("config"));
        vm.prank(REVIEW); upgrades.review(id);
        vm.warp(block.timestamp + upgrades.DELAY());
        upgrades.accept(id);
        require(address(random.emergencyState()) == address(emergency), "silent consumer rebind");
        require(address(council.emergency()) == address(emergency), "silent council rebind");
        _restrictGrant();
        council.restrict(EmergencyDomains.RANDOMNESS_REQUEST);
        require(!replacement.isRestricted(EmergencyDomains.RANDOMNESS_REQUEST), "replacement silently controlled");
        (bool rebind,) = address(random).call(abi.encodeCall(random.bindEmergencyState, (address(replacement))));
        require(!rebind, "immutable binding overwritten");
    }
}
