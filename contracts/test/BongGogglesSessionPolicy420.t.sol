// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bonggoggles/BongGogglesIds420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesRelationshipGraph420.sol";
import "../src/bonggoggles/BongGogglesSocialObjectRegistry420.sol";
import "../src/bonggoggles/BongGogglesReactionRegistry420.sol";
import "../src/bonggoggles/BongGogglesSessionPolicy420.sol";

interface VmBongGogglesSession420 {
    function expectRevert(bytes4) external;
}

contract BongGogglesSessionPolicy420Test {
    VmBongGogglesSession420 constant vm = VmBongGogglesSession420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PROFILES = address(0x1001);
    address constant RELATIONSHIPS = address(0x1002);
    address constant OBJECTS = address(0x1003);
    address constant REACTIONS = address(0x1004);

    BongGogglesSessionPolicy420 policy;

    function setUp() public {
        policy = new BongGogglesSessionPolicy420(PROFILES, RELATIONSHIPS, OBJECTS, REACTIONS);
    }

    function testRoutinePostAndReactionActionsAreSessionEligible() public {
        BongGogglesSessionPolicy420.SessionAction memory post =
            policy.classify(OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector);
        require(post.riskClass == BongGogglesSessionPolicy420.RiskClass.ROUTINE, "post not routine");
        require(post.actionId == BongGogglesIds420.ACTION_POST_CREATE, "post action mismatch");
        require(post.maxSessionSeconds == 7 days, "post duration mismatch");
        require(!post.valueAllowed, "post value opened");

        BongGogglesSessionPolicy420.SessionAction memory reaction =
            policy.classify(REACTIONS, BongGogglesReactionRegistry420.setReaction.selector);
        require(reaction.riskClass == BongGogglesSessionPolicy420.RiskClass.ROUTINE, "reaction not routine");
        require(reaction.actionId == BongGogglesIds420.ACTION_REACTION_SET, "reaction action mismatch");
    }

    function testProfileAndRelationshipRoutineActionsAreScoped() public {
        BongGogglesSessionPolicy420.SessionAction memory prefs =
            policy.classify(PROFILES, BongGogglesProfileRegistry420.updatePreferences.selector);
        require(prefs.actionId == BongGogglesIds420.ACTION_PREFERENCES_UPDATE, "prefs action mismatch");
        require(prefs.riskClass == BongGogglesSessionPolicy420.RiskClass.ROUTINE, "prefs not routine");

        BongGogglesSessionPolicy420.SessionAction memory follow =
            policy.classify(RELATIONSHIPS, BongGogglesRelationshipGraph420.follow.selector);
        require(follow.actionId == BongGogglesIds420.ACTION_FOLLOW, "follow action mismatch");
        require(follow.riskClass == BongGogglesSessionPolicy420.RiskClass.ROUTINE, "follow not routine");
    }

    function testSensitiveActionsRequireOwnerConfirmation() public {
        BongGogglesSessionPolicy420.SessionAction memory blockAction =
            policy.classify(RELATIONSHIPS, BongGogglesRelationshipGraph420.blockUser.selector);
        require(blockAction.riskClass == BongGogglesSessionPolicy420.RiskClass.OWNER_CONFIRM_REQUIRED, "block not protected");
        require(blockAction.maxSessionSeconds == 0, "block received duration");

        BongGogglesSessionPolicy420.SessionAction memory deleteAction =
            policy.classify(OBJECTS, BongGogglesSocialObjectRegistry420.deleteObject.selector);
        require(deleteAction.riskClass == BongGogglesSessionPolicy420.RiskClass.OWNER_CONFIRM_REQUIRED, "delete not protected");

        vm.expectRevert(BongGogglesSessionPolicy420.SessionActionDenied.selector);
        policy.validateRoutineGrant(RELATIONSHIPS, BongGogglesRelationshipGraph420.blockUser.selector, 0, 1 days);
    }

    function testUnknownTargetsAndSelectorsFailClosed() public {
        BongGogglesSessionPolicy420.SessionAction memory unknown = policy.classify(address(0xDEAD), bytes4(keccak256("pwn()")));
        require(unknown.riskClass == BongGogglesSessionPolicy420.RiskClass.DENIED, "unknown target opened");
        require(unknown.actionId == bytes32(0), "unknown action assigned");

        BongGogglesSessionPolicy420.SessionAction memory unknownSelector = policy.classify(PROFILES, bytes4(keccak256("pwn()")));
        require(unknownSelector.riskClass == BongGogglesSessionPolicy420.RiskClass.DENIED, "unknown selector opened");
    }

    function testRoutineGrantIsZeroValueAndTimeBound() public {
        bytes32 actionId = policy.validateRoutineGrant(
            OBJECTS,
            BongGogglesSocialObjectRegistry420.publish.selector,
            0,
            1 days
        );
        require(actionId == BongGogglesIds420.ACTION_POST_CREATE, "grant action mismatch");

        vm.expectRevert(BongGogglesSessionPolicy420.ValueForbidden.selector);
        policy.validateRoutineGrant(OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector, 1, 1 days);

        vm.expectRevert(BongGogglesSessionPolicy420.InvalidSessionDuration.selector);
        policy.validateRoutineGrant(OBJECTS, BongGogglesSocialObjectRegistry420.publish.selector, 0, 8 days);
    }

    function testDeviceBindingBindsSessionKeyAndAuthorizationEpoch() public {
        bytes32 a = policy.deviceBindingDigest(address(0x4200), address(0xA11CE), keccak256("device-a"), 7);
        bytes32 b = policy.deviceBindingDigest(address(0x4200), address(0xB0B), keccak256("device-a"), 7);
        bytes32 c = policy.deviceBindingDigest(address(0x4200), address(0xA11CE), keccak256("device-a"), 8);
        require(a != b, "session key not bound");
        require(a != c, "authorization epoch not bound");
        require(policy.policyDigest() != bytes32(0), "policy digest missing");
    }
}
