// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/SmartAccountScopes420.sol";
import "../src/libraries/CapabilityIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistryExtended420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesRelationshipGraph420.sol";
import "../src/bonggoggles/BongGogglesSocialObjectRegistry420.sol";
import "../src/bonggoggles/BongGogglesReactionRegistry420.sol";
import "../src/bonggoggles/BongGogglesSessionPolicy420.sol";
import "../src/bonggoggles/BongGogglesSessionAccess420.sol";

interface VmBongGogglesSessionAccess420 {
    function expectRevert(bytes4) external;
}

contract MockBongGogglesCapabilityRegistry420 {
    bytes32 public activeGrant;
    bool public authorized;

    function setGrant(bytes32 grantId_, bool authorized_) external {
        activeGrant = grantId_;
        authorized = authorized_;
    }

    function activeGrantId(address, bytes32, bytes32, bytes32) external view returns (bytes32) {
        return activeGrant;
    }

    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external view returns (bool) {
        return authorized;
    }
}

contract MockBongGogglesSmartAccount420 {
    uint64 public authorizationEpoch = 1;
    mapping(address => uint64) public sessionEpoch;
    MockBongGogglesCapabilityRegistry420 public registry;

    constructor(MockBongGogglesCapabilityRegistry420 registry_) {
        registry = registry_;
    }

    function setAuthorizationEpoch(uint64 epoch) external {
        authorizationEpoch = epoch;
    }

    function setSessionEpoch(address key, uint64 epoch) external {
        sessionEpoch[key] = epoch;
    }

    function accountComponentId() external view returns (bytes32) {
        return SmartAccountScopes420.accountComponentId(address(this));
    }

    function capabilityRegistry() external view returns (ICapabilityRegistryExtended420) {
        return ICapabilityRegistryExtended420(address(registry));
    }

    function sessionScope(address target, bytes4 selector) external view returns (bytes32) {
        bytes32 componentId = SmartAccountScopes420.accountComponentId(address(this));
        return SmartAccountScopes420.sessionCallScope(address(this), componentId, authorizationEpoch, target, selector);
    }
}

contract BongGogglesSessionAccess420Test {
    VmBongGogglesSessionAccess420 constant vm = VmBongGogglesSessionAccess420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PROFILES = address(0x1001);
    address constant RELATIONSHIPS = address(0x1002);
    address constant OBJECTS = address(0x1003);
    address constant REACTIONS = address(0x1004);
    address constant SESSION_KEY = address(0xA11CE);

    BongGogglesSessionPolicy420 policy;
    BongGogglesSessionAccess420 access;
    MockBongGogglesCapabilityRegistry420 registry;
    MockBongGogglesSmartAccount420 account;

    function setUp() public {
        policy = new BongGogglesSessionPolicy420(PROFILES, RELATIONSHIPS, OBJECTS, REACTIONS);
        access = new BongGogglesSessionAccess420(address(policy));
        registry = new MockBongGogglesCapabilityRegistry420();
        account = new MockBongGogglesSmartAccount420(registry);
        account.setSessionEpoch(SESSION_KEY, 1);
        registry.setGrant(keccak256("grant"), true);
    }

    function testRoutineActionsUseSessionAndSensitiveActionsEscalate() public view {
        require(
            access.executionMode(OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector, 0)
                == BongGogglesSessionAccess420.ExecutionMode.ROUTINE_SESSION,
            "post did not use routine session"
        );
        require(
            access.executionMode(REACTIONS, BongGogglesReactionRegistry420.setReaction.selector, 0)
                == BongGogglesSessionAccess420.ExecutionMode.ROUTINE_SESSION,
            "reaction did not use routine session"
        );
        require(
            access.executionMode(RELATIONSHIPS, BongGogglesRelationshipGraph420.blockUser.selector, 0)
                == BongGogglesSessionAccess420.ExecutionMode.OWNER_PASSKEY,
            "block did not escalate"
        );
        require(
            access.executionMode(OBJECTS, BongGogglesSocialObjectRegistry420.deleteObject.selector, 0)
                == BongGogglesSessionAccess420.ExecutionMode.OWNER_PASSKEY,
            "delete did not escalate"
        );
    }

    function testUnknownAndValueBearingCallsFailClosed() public view {
        require(
            access.executionMode(address(0xDEAD), bytes4(keccak256("pwn()")), 0)
                == BongGogglesSessionAccess420.ExecutionMode.DENIED,
            "unknown call opened"
        );
        require(
            access.executionMode(OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector, 1)
                == BongGogglesSessionAccess420.ExecutionMode.DENIED,
            "native value opened"
        );
    }

    function testLiveRoutineSessionGrantAuthorizesExactCall() public view {
        require(
            access.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector
            ),
            "live session rejected"
        );
        require(
            !access.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, OBJECTS, BongGogglesSocialObjectRegistry420.deleteObject.selector
            ),
            "sensitive action entered session path"
        );
    }

    function testAuthorizationEpochDriftInvalidatesStaleDeviceSession() public {
        require(
            access.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector
            ),
            "baseline session rejected"
        );

        account.setAuthorizationEpoch(2);

        require(
            !access.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector
            ),
            "stale epoch remained authorized"
        );
    }

    function testMissingOrRevokedGrantFailsClosed() public {
        registry.setGrant(bytes32(0), true);
        require(
            !access.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector
            ),
            "missing grant authorized"
        );

        registry.setGrant(keccak256("grant"), false);
        require(
            !access.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector
            ),
            "revoked grant authorized"
        );
    }

    function testRequireRoutineSessionAuthorizedRevertsOnStaleSession() public {
        account.setAuthorizationEpoch(2);
        vm.expectRevert(BongGogglesSessionAccess420.SessionNotAuthorized.selector);
        access.requireRoutineSessionAuthorized(
            address(account), SESSION_KEY, OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector
        );
    }

    function testDeviceBindingUsesExistingPhase11Domain() public view {
        bytes32 commitment = keccak256("device-a");
        bytes32 direct = policy.deviceBindingDigest(address(account), SESSION_KEY, commitment, 1);
        bytes32 bridged = access.deviceBindingDigest(address(account), SESSION_KEY, commitment, 1);
        require(direct == bridged, "device binding domain diverged");
    }
}
