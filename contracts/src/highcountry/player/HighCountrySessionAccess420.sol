// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { SmartAccountScopes420 } from "../../accounts/SmartAccountScopes420.sol";
import { CapabilityIds420 } from "../../libraries/CapabilityIds420.sol";
import { ICapabilityRegistry420 } from "../../interfaces/genesis/ICapabilityRegistry420.sol";
import { ICapabilityRegistryExtended420 } from "../../interfaces/genesis/ICapabilityRegistryExtended420.sol";
import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCInvalidState, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface ISmartAccountHCSession420 {
    function authorizationEpoch() external view returns (uint64);
    function sessionEpoch(address key) external view returns (uint64);
    function accountComponentId() external view returns (bytes32);
    function capabilityRegistry() external view returns (ICapabilityRegistryExtended420);
    function sessionScope(address target, bytes4 selector) external view returns (bytes32);
}

/// @notice High Country policy bridge for SmartAccount420 session grants.
/// @dev This contract never creates keys or grants. The wallet-owned SmartAccount420 remains
///      authoritative for session-key lifecycle. High Country only declares which exact
///      target+selector pairs are routine game actions and verifies existing account grants.
contract HighCountrySessionAccess420 {
    IHighCountryAuthorization public immutable authorization;

    mapping(address => mapping(bytes4 => bool)) public routineCall;

    event RoutineSessionCallSet(address indexed target, bytes4 indexed selector, bool allowed);

    error SessionCallRequiresWallet();

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
    }

    /// @notice High Country routine sessions may never spend native $420.
    function native420SpendLimit() external pure returns (uint256) {
        return 0;
    }

    /// @notice Capability-authorized administration of the exact High Country call surface
    ///         that may be delegated to a SmartAccount420 session key.
    function setRoutineCall(address target, bytes4 selector, bool allowed) external {
        if (target == address(0) || selector == bytes4(0)) revert HCInvalidState();

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.GAMING_SESSION_POLICY,
                actionId: ActionIds.SESSION_POLICY_SET_ROUTINE_CALL,
                scopeHash: keccak256(abi.encode(target, selector)),
                amount: 0
            })
        );

        routineCall[target][selector] = allowed;
        emit RoutineSessionCallSet(target, selector, allowed);
    }

    function isRoutineCall(address target, bytes4 selector, uint256 nativeValue) public view returns (bool) {
        return nativeValue == 0 && routineCall[target][selector];
    }

    /// @notice Anything not explicitly routine, or any native-value transfer, must escalate
    ///         to owner/passkey authority in the wallet rather than a background game session.
    function requiresWalletEscalation(address target, bytes4 selector, uint256 nativeValue)
        external
        view
        returns (bool)
    {
        return !isRoutineCall(target, selector, nativeValue);
    }

    function requireRoutineCall(address target, bytes4 selector, uint256 nativeValue) external view {
        if (!isRoutineCall(target, selector, nativeValue)) revert SessionCallRequiresWallet();
    }

    /// @notice Verify that an enabled SmartAccount420 session key currently holds the exact
    ///         zero-value target+selector grant for a High Country routine action.
    /// @dev Epoch mismatch, revocation, expiry, wrong target, wrong selector and missing grants
    ///      all fail closed through the existing SmartAccount420 / CapabilityRegistry420 state.
    function isRoutineSessionAuthorized(
        address smartAccount,
        address sessionKey,
        address target,
        bytes4 selector
    ) public view returns (bool) {
        if (smartAccount == address(0) || sessionKey == address(0) || !routineCall[target][selector]) return false;

        ISmartAccountHCSession420 account = ISmartAccountHCSession420(smartAccount);

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
        try account.sessionEpoch(sessionKey) returns (uint64 epoch) {
            keyEpoch = epoch;
        } catch {
            return false;
        }
        if (accountEpoch == 0 || keyEpoch != accountEpoch) return false;

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
            revert SessionCallRequiresWallet();
        }
    }
}
