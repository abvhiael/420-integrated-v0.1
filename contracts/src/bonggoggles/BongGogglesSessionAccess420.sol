// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../accounts/SmartAccountScopes420.sol";
import "../libraries/CapabilityIds420.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "../interfaces/genesis/ICapabilityRegistryExtended420.sol";
import "./BongGogglesSessionPolicy420.sol";

interface ISmartAccountBongGogglesSession420 {
    function authorizationEpoch() external view returns (uint64);
    function sessionEpoch(address key) external view returns (uint64);
    function accountComponentId() external view returns (bytes32);
    function capabilityRegistry() external view returns (ICapabilityRegistryExtended420);
    function sessionScope(address target, bytes4 selector) external view returns (bytes32);
}

/// @notice Bong Goggles Phase 11C bridge between social UX policy and live SmartAccount420 session authority.
/// @dev This contract is read-only. It never creates/revokes session keys, grants capabilities, signs,
///      executes calls, moves value, or weakens passkey/owner confirmation requirements.
contract BongGogglesSessionAccess420 {
    enum ExecutionMode { DENIED, ROUTINE_SESSION, OWNER_PASSKEY }

    BongGogglesSessionPolicy420 public immutable policy;

    error ZeroAddress();
    error SessionNotAuthorized();

    constructor(address policy_) {
        if (policy_ == address(0)) revert ZeroAddress();
        policy = BongGogglesSessionPolicy420(policy_);
    }

    /// @notice Resolve the wallet UX path for a concrete Bong Goggles call.
    /// @dev Any native value fails closed because Phase 11 social sessions are zero-value only.
    function executionMode(address target, bytes4 selector, uint256 nativeValue)
        public
        view
        returns (ExecutionMode)
    {
        if (nativeValue != 0) return ExecutionMode.DENIED;

        BongGogglesSessionPolicy420.SessionAction memory action = policy.classify(target, selector);
        if (action.riskClass == BongGogglesSessionPolicy420.RiskClass.ROUTINE) {
            return ExecutionMode.ROUTINE_SESSION;
        }
        if (action.riskClass == BongGogglesSessionPolicy420.RiskClass.OWNER_CONFIRM_REQUIRED) {
            return ExecutionMode.OWNER_PASSKEY;
        }
        return ExecutionMode.DENIED;
    }

    function requiresOwnerPasskey(address target, bytes4 selector, uint256 nativeValue)
        external
        view
        returns (bool)
    {
        return executionMode(target, selector, nativeValue) == ExecutionMode.OWNER_PASSKEY;
    }

    /// @notice Verify that a live SmartAccount420 session key currently holds the exact grant
    ///         required for a routine Bong Goggles target+selector pair.
    /// @dev Recovery, revoke-all, credential changes and other authorization-epoch changes make
    ///      stale local sessions fail closed because sessionEpoch must equal authorizationEpoch and
    ///      the canonical scope is recomputed with the current epoch.
    function isRoutineSessionAuthorized(
        address smartAccount,
        address sessionKey,
        address target,
        bytes4 selector
    ) public view returns (bool) {
        if (smartAccount == address(0) || sessionKey == address(0)) return false;
        if (executionMode(target, selector, 0) != ExecutionMode.ROUTINE_SESSION) return false;

        ISmartAccountBongGogglesSession420 account = ISmartAccountBongGogglesSession420(smartAccount);

        uint64 accountEpoch;
        uint64 keyEpoch;
        bytes32 componentId;
        bytes32 scopeHash;
        ICapabilityRegistryExtended420 registry;

        try account.authorizationEpoch() returns (uint64 epoch) {
            accountEpoch = epoch;
        } catch {
            return false;
        }
        if (accountEpoch == 0) return false;

        try account.sessionEpoch(sessionKey) returns (uint64 epoch) {
            keyEpoch = epoch;
        } catch {
            return false;
        }
        if (keyEpoch != accountEpoch) return false;

        try account.accountComponentId() returns (bytes32 component) {
            componentId = component;
        } catch {
            return false;
        }
        if (componentId != SmartAccountScopes420.accountComponentId(smartAccount)) return false;

        try account.sessionScope(target, selector) returns (bytes32 scope) {
            scopeHash = scope;
        } catch {
            return false;
        }
        if (scopeHash != SmartAccountScopes420.sessionCallScope(smartAccount, componentId, accountEpoch, target, selector)) {
            return false;
        }

        try account.capabilityRegistry() returns (ICapabilityRegistryExtended420 capabilityRegistry_) {
            registry = capabilityRegistry_;
        } catch {
            return false;
        }
        if (address(registry) == address(0)) return false;

        bytes32 grantId;
        try registry.activeGrantId(sessionKey, componentId, CapabilityIds420.SESSION_EXECUTE, scopeHash)
            returns (bytes32 activeGrant)
        {
            grantId = activeGrant;
        } catch {
            return false;
        }
        if (grantId == bytes32(0)) return false;

        try ICapabilityRegistry420(address(registry)).isAuthorized(
            sessionKey,
            componentId,
            CapabilityIds420.SESSION_EXECUTE,
            scopeHash,
            0
        ) returns (bool allowed) {
            return allowed;
        } catch {
            return false;
        }
    }

    function requireRoutineSessionAuthorized(
        address smartAccount,
        address sessionKey,
        address target,
        bytes4 selector
    ) external view {
        if (!isRoutineSessionAuthorized(smartAccount, sessionKey, target, selector)) {
            revert SessionNotAuthorized();
        }
    }

    /// @notice Canonical device/session binding digest for clients displaying current/stale devices.
    /// @dev Delegates to the Phase 11 policy domain so Bong Goggles does not invent a second binding format.
    function deviceBindingDigest(
        address smartAccount,
        address sessionKey,
        bytes32 deviceCommitment,
        uint64 authorizationEpoch
    ) external view returns (bytes32) {
        return policy.deviceBindingDigest(smartAccount, sessionKey, deviceCommitment, authorizationEpoch);
    }
}
