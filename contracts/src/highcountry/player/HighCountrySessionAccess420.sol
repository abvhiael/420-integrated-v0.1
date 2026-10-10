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

interface ICanonicalHCFactory420 {
    function getAddress(
        address owner,
        address recovery,
        bytes32 salt
    ) external view returns (address);
    function entryPoint() external view returns (address);
    function capabilityRegistry() external view returns (address);
}

interface ISmartAccountHCSession420 {
    function entryPoint() external view returns (address);
    function pendingRecoveryOwner() external view returns (address);

    function authorizationEpoch() external view returns (uint64);
    function sessionEpoch(
        address key
    ) external view returns (uint64);
    function accountComponentId() external view returns (bytes32);
    function capabilityRegistry() external view returns (ICapabilityRegistryExtended420);
    function sessionScope(
        address target,
        bytes4 selector
    ) external view returns (bytes32);
}

/// @notice High Country policy bridge for SmartAccount420 session grants.
/// @dev This contract never creates keys or grants. The wallet-owned SmartAccount420 remains
///      authoritative for session-key lifecycle. High Country only declares which exact
///      target+selector pairs are routine game actions and verifies existing account grants.
contract HighCountrySessionAccess420 {
    IHighCountryAuthorization public immutable authorization;

    mapping(address => mapping(bytes4 => bool)) public routineCall;
    mapping(address => mapping(bytes4 => bytes32)) public reviewedCodeHash;
    event RoutineCallReviewed(address indexed target, bytes4 indexed selector, bytes32 codeHash);

    /// @notice Independent selector-level approval of the currently deployed code artifact.
    function reviewRoutineCall(
        address target,
        bytes4 selector
    ) external {
        if (target.code.length == 0 || selector == bytes4(0) || _sensitiveSelector(selector)) revert HCInvalidState();
        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.GAMING_SESSION_POLICY,
                actionId: ActionIds.SESSION_POLICY_REVIEW_ROUTINE_CALL,
                scopeHash: keccak256(abi.encode(target, selector, target.codehash)),
                amount: 0
            })
        );
        reviewedCodeHash[target][selector] = target.codehash;
        emit RoutineCallReviewed(target, selector, target.codehash);
    }

    ICanonicalHCFactory420 public immutable canonicalFactory;
    address public immutable canonicalEntryPoint;
    mapping(address => bool) public canonicalAccount;

    event CanonicalAccountAttested(address indexed account, address indexed initialOwner, bytes32 indexed salt);

    function _sensitiveSelector(
        bytes4 selector
    ) private pure returns (bool) {
        return selector == bytes4(keccak256("execute(address,uint256,bytes)"))
            || selector == bytes4(keccak256("executeBatch((address,uint256,bytes)[])"))
            || selector == bytes4(keccak256("executeSession(address,(address,uint256,bytes)[])"))
            || selector
                == bytes4(keccak256("createSessionGrant(address,address,bytes4,uint256,uint256,uint64,uint64,uint64)"))
            || selector == bytes4(keccak256("enableSessionKey(address)"))
            || selector == bytes4(keccak256("revokeKey(address)"))
            || selector == bytes4(keccak256("transfer(address,uint256)"))
            || selector == bytes4(keccak256("approve(address,uint256)"))
            || selector == bytes4(keccak256("transferFrom(address,address,uint256)"))
            || selector == bytes4(keccak256("setPasskeyVerifier(address)"))
            || selector == bytes4(keccak256("proposeRecovery(address)"));
    }

    event RoutineSessionCallSet(address indexed target, bytes4 indexed selector, bool allowed);

    error SessionCallRequiresWallet();

    constructor(
        address authorization_,
        address factory_
    ) {
        if (authorization_ == address(0) || factory_.code.length == 0) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        canonicalFactory = ICanonicalHCFactory420(factory_);
        canonicalEntryPoint = canonicalFactory.entryPoint();
        if (
            canonicalEntryPoint == address(0)
                || canonicalFactory.capabilityRegistry() != authorization.capabilityRegistry()
        ) {
            revert HCInvalidState();
        }
    }

    /// @notice Attest initial factory constructor inputs to the CREATE2-derived account address.
    function attestAccount(
        address account,
        address initialOwner,
        address initialRecovery,
        bytes32 salt
    ) external {
        if (
            account.code.length == 0 || initialOwner == address(0)
                || canonicalFactory.getAddress(initialOwner, initialRecovery, salt) != account
        ) revert HCInvalidState();
        ISmartAccountHCSession420 wallet = ISmartAccountHCSession420(account);
        if (
            wallet.entryPoint() != canonicalEntryPoint
                || address(wallet.capabilityRegistry()) != authorization.capabilityRegistry()
        ) revert HCInvalidState();
        canonicalAccount[account] = true;
        emit CanonicalAccountAttested(account, initialOwner, salt);
    }

    /// @notice High Country routine sessions may never spend native $420.
    function native420SpendLimit() external pure returns (uint256) {
        return 0;
    }

    /// @notice Capability-authorized administration of the exact High Country call surface
    ///         that may be delegated to a SmartAccount420 session key.
    function setRoutineCall(
        address target,
        bytes4 selector,
        bool allowed
    ) external {
        if (
            target.code.length == 0 || selector == bytes4(0)
                || (allowed && (_sensitiveSelector(selector) || reviewedCodeHash[target][selector] != target.codehash))
        ) {
            revert HCInvalidState();
        }

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

    function isRoutineCall(
        address target,
        bytes4 selector,
        uint256 nativeValue
    ) public view returns (bool) {
        return nativeValue == 0 && target.code.length != 0 && !_sensitiveSelector(selector) && routineCall[target][selector]
            && reviewedCodeHash[target][selector] == target.codehash;
    }

    /// @notice Anything not explicitly routine, or any native-value transfer, must escalate
    ///         to owner/passkey authority in the wallet rather than a background game session.
    function requiresWalletEscalation(
        address target,
        bytes4 selector,
        uint256 nativeValue
    ) external view returns (bool) {
        return !isRoutineCall(target, selector, nativeValue);
    }

    function requireRoutineCall(
        address target,
        bytes4 selector,
        uint256 nativeValue
    ) external view {
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
        if (
            !canonicalAccount[smartAccount] || smartAccount.code.length == 0 || sessionKey == address(0)
                || !isRoutineCall(target, selector, 0)
        ) return false;

        ISmartAccountHCSession420 account = ISmartAccountHCSession420(smartAccount);

        try account.entryPoint() returns (address ep) {
            if (ep != canonicalEntryPoint) return false;
        } catch {
            return false;
        }
        try account.pendingRecoveryOwner() returns (address pendingOwner) {
            if (pendingOwner != address(0)) return false;
        } catch {
            return false;
        }

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
        if (
            scopeHash
                != SmartAccountScopes420.sessionCallScope(smartAccount, componentId, accountEpoch, target, selector)
        ) {
            return false;
        }

        try account.capabilityRegistry() returns (ICapabilityRegistryExtended420 capabilityRegistry_) {
            registry = capabilityRegistry_;
        } catch {
            return false;
        }
        // An account cannot select an attacker-controlled authorization oracle.
        if (address(registry) == address(0) || address(registry) != authorization.capabilityRegistry()) return false;

        bytes32 grantId;
        try registry.activeGrantId(sessionKey, componentId, CapabilityIds420.SESSION_EXECUTE, scopeHash) returns (
            bytes32 activeGrant
        ) {
            grantId = activeGrant;
        } catch {
            return false;
        }
        if (grantId == bytes32(0)) return false;

        // Advisory HC session checks do not consume periodic wallet budgets.
        // Fail closed even for a zero-value call when a periodic grant is selected.
        try registry.grant(grantId) returns (ICapabilityRegistry420.CapabilityGrant memory g) {
            if (
                g.principal != sessionKey || g.componentId != componentId
                    || g.capabilityId != CapabilityIds420.SESSION_EXECUTE || g.scopeHash != scopeHash || g.revoked
                    || g.periodLimit != 0 || g.periodSeconds != 0
            ) return false;
        } catch {
            return false;
        }

        try ICapabilityRegistry420(address(registry))
            .isAuthorized(sessionKey, componentId, CapabilityIds420.SESSION_EXECUTE, scopeHash, 0) returns (
            bool allowed
        ) {
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
