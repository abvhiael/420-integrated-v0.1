// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesIds420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesRelationshipGraph420.sol";
import "./BongGogglesSocialObjectRegistry420.sol";
import "./BongGogglesReactionRegistry420.sol";

/// @notice Read-only policy surface used by wallet clients when proposing Bong Goggles session-key grants.
/// @dev SmartAccount420 and CapabilityRegistry420 remain the authority. This contract never grants,
///      revokes, executes, signs, or moves value.
contract BongGogglesSessionPolicy420 {
    enum RiskClass { DENIED, ROUTINE, OWNER_CONFIRM_REQUIRED }

    struct SessionAction {
        bytes32 actionId;
        RiskClass riskClass;
        uint64 maxSessionSeconds;
        bool valueAllowed;
    }

    uint64 public constant MAX_ROUTINE_SESSION_SECONDS = 7 days;

    address public immutable profiles;
    address public immutable relationships;
    address public immutable objects;
    address public immutable reactions;

    error ZeroAddress();
    error SessionActionDenied();
    error ValueForbidden();
    error InvalidSessionDuration();

    constructor(address profiles_, address relationships_, address objects_, address reactions_) {
        if (profiles_ == address(0) || relationships_ == address(0) || objects_ == address(0) || reactions_ == address(0)) {
            revert ZeroAddress();
        }
        profiles = profiles_;
        relationships = relationships_;
        objects = objects_;
        reactions = reactions_;
    }

    /// @notice Classify a concrete target/selector pair for wallet session-key UX.
    /// @dev Unknown pairs fail closed. Economic value is forbidden for all Bong Goggles social-session actions in V1.
    function classify(address target, bytes4 selector) public view returns (SessionAction memory action) {
        if (target == profiles) {
            if (selector == BongGogglesProfileRegistry420.updateProfile.selector) {
                return _routine(BongGogglesIds420.ACTION_PROFILE_UPDATE);
            }
            if (selector == BongGogglesProfileRegistry420.updatePreferences.selector) {
                return _routine(BongGogglesIds420.ACTION_PREFERENCES_UPDATE);
            }
            if (selector == BongGogglesProfileRegistry420.setStatus.selector) {
                return _confirm(BongGogglesIds420.ACTION_PROFILE_DEACTIVATE);
            }
            return _denied();
        }

        if (target == relationships) {
            if (selector == BongGogglesRelationshipGraph420.requestFriend.selector) return _routine(BongGogglesIds420.ACTION_FRIEND_REQUEST);
            if (selector == BongGogglesRelationshipGraph420.acceptFriend.selector) return _routine(BongGogglesIds420.ACTION_FRIEND_ACCEPT);
            if (selector == BongGogglesRelationshipGraph420.declineFriend.selector) return _routine(BongGogglesIds420.ACTION_FRIEND_DECLINE);
            if (selector == BongGogglesRelationshipGraph420.cancelFriendRequest.selector) return _routine(BongGogglesIds420.ACTION_FRIEND_CANCEL);
            if (selector == BongGogglesRelationshipGraph420.removeFriend.selector) return _routine(BongGogglesIds420.ACTION_FRIEND_REMOVE);
            if (selector == BongGogglesRelationshipGraph420.follow.selector) return _routine(BongGogglesIds420.ACTION_FOLLOW);
            if (selector == BongGogglesRelationshipGraph420.acceptFollow.selector) return _routine(BongGogglesIds420.ACTION_FOLLOW_ACCEPT);
            if (selector == BongGogglesRelationshipGraph420.declineFollow.selector) return _routine(BongGogglesIds420.ACTION_FOLLOW_DECLINE);
            if (selector == BongGogglesRelationshipGraph420.cancelFollowRequest.selector) return _routine(BongGogglesIds420.ACTION_FOLLOW_CANCEL);
            if (selector == BongGogglesRelationshipGraph420.unfollow.selector) return _routine(BongGogglesIds420.ACTION_UNFOLLOW);
            if (selector == BongGogglesRelationshipGraph420.muteUser.selector) return _routine(BongGogglesIds420.ACTION_MUTE);
            if (selector == BongGogglesRelationshipGraph420.unmuteUser.selector) return _routine(BongGogglesIds420.ACTION_UNMUTE);
            if (selector == BongGogglesRelationshipGraph420.blockUser.selector) return _confirm(BongGogglesIds420.ACTION_BLOCK);
            if (selector == BongGogglesRelationshipGraph420.unblockUser.selector) return _confirm(BongGogglesIds420.ACTION_UNBLOCK);
            return _denied();
        }

        if (target == objects) {
            if (selector == BongGogglesSocialObjectRegistry420.publish.selector) return _routine(BongGogglesIds420.ACTION_POST_CREATE);
            if (selector == BongGogglesSocialObjectRegistry420.edit.selector) return _routine(BongGogglesIds420.ACTION_POST_EDIT);
            if (selector == BongGogglesSocialObjectRegistry420.hide.selector) return _routine(BongGogglesIds420.ACTION_POST_HIDE);
            if (selector == BongGogglesSocialObjectRegistry420.restore.selector) return _routine(BongGogglesIds420.ACTION_POST_HIDE);
            if (selector == BongGogglesSocialObjectRegistry420.repost.selector) return _routine(BongGogglesIds420.ACTION_REPOST_CREATE);
            if (selector == BongGogglesSocialObjectRegistry420.quotePost.selector) return _routine(BongGogglesIds420.ACTION_QUOTE_POST_CREATE);
            if (selector == BongGogglesSocialObjectRegistry420.share.selector) return _routine(BongGogglesIds420.ACTION_SHARE);
            if (selector == BongGogglesSocialObjectRegistry420.deleteObject.selector) return _confirm(BongGogglesIds420.ACTION_POST_DELETE);
            return _denied();
        }

        if (target == reactions) {
            if (selector == BongGogglesReactionRegistry420.setReaction.selector) return _routine(BongGogglesIds420.ACTION_REACTION_SET);
            if (selector == BongGogglesReactionRegistry420.clearReaction.selector) return _routine(BongGogglesIds420.ACTION_REACTION_CLEAR);
            return _denied();
        }

        return _denied();
    }

    /// @notice Wallet-side preflight for a routine social-session grant.
    function validateRoutineGrant(address target, bytes4 selector, uint256 valueLimit, uint64 validForSeconds)
        external view returns (bytes32 actionId)
    {
        SessionAction memory action = classify(target, selector);
        if (action.riskClass != RiskClass.ROUTINE) revert SessionActionDenied();
        if (valueLimit != 0) revert ValueForbidden();
        if (validForSeconds == 0 || validForSeconds > action.maxSessionSeconds) revert InvalidSessionDuration();
        return action.actionId;
    }

    /// @notice Domain-separated wallet metadata binding for a session key and device commitment.
    /// @dev This digest is UX/audit metadata only; SmartAccount420 authorizationEpoch/sessionEpoch remain authoritative.
    function deviceBindingDigest(
        address smartAccount,
        address sessionKey,
        bytes32 deviceCommitment,
        uint64 authorizationEpoch
    ) external view returns (bytes32) {
        if (smartAccount == address(0) || sessionKey == address(0) || deviceCommitment == bytes32(0)) revert ZeroAddress();
        return keccak256(abi.encode(
            "420/BONG_GOGGLES/SESSION_DEVICE_BINDING/V1",
            block.chainid,
            smartAccount,
            sessionKey,
            deviceCommitment,
            authorizationEpoch
        ));
    }

    function policyDigest() external view returns (bytes32) {
        return keccak256(abi.encode(
            "420/BONG_GOGGLES/SESSION_POLICY/V1",
            block.chainid,
            profiles,
            relationships,
            objects,
            reactions,
            MAX_ROUTINE_SESSION_SECONDS
        ));
    }

    function _routine(bytes32 actionId) private pure returns (SessionAction memory) {
        return SessionAction(actionId, RiskClass.ROUTINE, MAX_ROUTINE_SESSION_SECONDS, false);
    }

    function _confirm(bytes32 actionId) private pure returns (SessionAction memory) {
        return SessionAction(actionId, RiskClass.OWNER_CONFIRM_REQUIRED, 0, false);
    }

    function _denied() private pure returns (SessionAction memory) {
        return SessionAction(bytes32(0), RiskClass.DENIED, 0, false);
    }
}
