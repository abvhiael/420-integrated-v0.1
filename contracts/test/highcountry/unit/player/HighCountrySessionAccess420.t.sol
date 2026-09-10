// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HighCountrySessionAccess420 } from "../../../../src/highcountry/player/HighCountrySessionAccess420.sol";
import { SmartAccountScopes420 } from "../../../../src/accounts/SmartAccountScopes420.sol";
import { CapabilityIds420 } from "../../../../src/libraries/CapabilityIds420.sol";
import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { ICapabilityRegistryExtended420 } from "../../../../src/interfaces/genesis/ICapabilityRegistryExtended420.sol";
import { IHighCountryAuthorization } from "../../../../src/highcountry/interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../../../../src/highcountry/types/HighCountryTypes.sol";

contract MockHCAuthorizationSessionAccess is IHighCountryAuthorization {
    bool public allowed = true;

    function setAllowed(bool allowed_) external { allowed = allowed_; }
    function capabilityRegistry() external pure returns (address) { return address(1); }
    function isAuthorized(AuthorizationRequest calldata) external view returns (bool) { return allowed; }
    function requireAuthorized(AuthorizationRequest calldata) external view { require(allowed, "unauthorized"); }
}

contract MockCapabilityRegistryHCSession is ICapabilityRegistryExtended420 {
    mapping(bytes32 => CapabilityGrant) internal grants;
    mapping(bytes32 => UsageView) internal usages;
    mapping(bytes32 => bytes32) internal active;
    mapping(bytes32 => bool) internal authorized;

    function _key(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(principal, componentId, capabilityId, scopeHash));
    }

    function setGrant(
        bytes32 grantId,
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        bool allowed
    ) external {
        grants[grantId] = CapabilityGrant({
            principal: principal,
            componentId: componentId,
            capabilityId: capabilityId,
            scopeHash: scopeHash,
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: 0,
            revoked: !allowed
        });
        bytes32 key = _key(principal, componentId, capabilityId, scopeHash);
        active[key] = allowed ? grantId : bytes32(0);
        authorized[key] = allowed;
    }

    function setAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool allowed)
        external
    {
        authorized[_key(principal, componentId, capabilityId, scopeHash)] = allowed;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) { return grants[grantId]; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external
        view
        returns (bool)
    {
        return authorized[_key(principal, componentId, capabilityId, scopeHash)];
    }

    function componentAuthority(bytes32) external pure returns (address) { return address(0); }
    function registerSmartAccount(address) external pure returns (bytes32) { return bytes32(0); }

    function createGrant(
        bytes32,
        address,
        bytes32,
        bytes32,
        bytes32,
        uint256,
        uint256,
        uint64,
        uint64,
        uint64
    ) external {}

    function revokeGrant(bytes32 grantId) external { grants[grantId].revoked = true; }

    function activeGrantId(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash)
        external
        view
        returns (bytes32)
    {
        return active[_key(principal, componentId, capabilityId, scopeHash)];
    }

    function usage(bytes32 grantId) external view returns (UsageView memory) { return usages[grantId]; }
    function consume(bytes32, uint256) external pure returns (uint256) { return 0; }
}

contract MockSmartAccountHCSession {
    uint64 public authorizationEpoch = 1;
    mapping(address => uint64) public sessionEpoch;
    bytes32 public immutable accountComponentId;
    ICapabilityRegistryExtended420 public immutable capabilityRegistry;

    constructor(address registry) {
        capabilityRegistry = ICapabilityRegistryExtended420(registry);
        accountComponentId = SmartAccountScopes420.accountComponentId(address(this));
    }

    function setAuthorizationEpoch(uint64 epoch) external { authorizationEpoch = epoch; }
    function setSessionEpoch(address key, uint64 epoch) external { sessionEpoch[key] = epoch; }

    function sessionScope(address target, bytes4 selector) external view returns (bytes32) {
        return SmartAccountScopes420.sessionCallScope(
            address(this), accountComponentId, authorizationEpoch, target, selector
        );
    }
}

contract RoutineTargetHCSession {
    function tick(uint64) external {}
    function risky(uint64) external {}
}

contract HighCountrySessionAccess420Test {
    MockHCAuthorizationSessionAccess internal authorization;
    MockCapabilityRegistryHCSession internal registry;
    MockSmartAccountHCSession internal account;
    RoutineTargetHCSession internal target;
    HighCountrySessionAccess420 internal sessionAccess;

    address internal constant SESSION_KEY = address(0x4201);

    function setUp() public {
        authorization = new MockHCAuthorizationSessionAccess();
        registry = new MockCapabilityRegistryHCSession();
        account = new MockSmartAccountHCSession(address(registry));
        target = new RoutineTargetHCSession();
        sessionAccess = new HighCountrySessionAccess420(address(authorization));
    }

    function _enableRoutineGrant() internal returns (bytes32 grantId, bytes32 scopeHash) {
        sessionAccess.setRoutineCall(address(target), target.tick.selector, true);
        account.setSessionEpoch(SESSION_KEY, account.authorizationEpoch());
        scopeHash = account.sessionScope(address(target), target.tick.selector);
        grantId = keccak256("hc-session-grant");
        registry.setGrant(
            grantId,
            SESSION_KEY,
            account.accountComponentId(),
            CapabilityIds420.SESSION_EXECUTE,
            scopeHash,
            true
        );
    }

    function testRoutineSessionsHaveZeroNative420SpendLimit() public {
        require(sessionAccess.native420SpendLimit() == 0, "native spend limit must be zero");
    }

    function testRoutineCallPolicyDefaultsToWalletEscalation() public {
        require(
            sessionAccess.requiresWalletEscalation(address(target), target.tick.selector, 0),
            "unknown call did not escalate"
        );
        sessionAccess.setRoutineCall(address(target), target.tick.selector, true);
        require(
            !sessionAccess.requiresWalletEscalation(address(target), target.tick.selector, 0),
            "routine call escalated"
        );
        require(
            sessionAccess.requiresWalletEscalation(address(target), target.tick.selector, 1),
            "native value bypassed escalation"
        );
    }

    function testRoutineSessionRequiresExactLiveSmartAccountGrant() public {
        _enableRoutineGrant();
        require(
            sessionAccess.isRoutineSessionAuthorized(address(account), SESSION_KEY, address(target), target.tick.selector),
            "valid routine session rejected"
        );
        require(
            !sessionAccess.isRoutineSessionAuthorized(address(account), SESSION_KEY, address(target), target.risky.selector),
            "wrong selector accepted"
        );
    }

    function testStaleSessionEpochFailsClosed() public {
        _enableRoutineGrant();
        account.setAuthorizationEpoch(2);
        require(
            !sessionAccess.isRoutineSessionAuthorized(address(account), SESSION_KEY, address(target), target.tick.selector),
            "stale session accepted"
        );
    }

    function testRevokedOrInactiveGrantFailsClosed() public {
        (, bytes32 scopeHash) = _enableRoutineGrant();
        registry.setAuthorized(
            SESSION_KEY,
            account.accountComponentId(),
            CapabilityIds420.SESSION_EXECUTE,
            scopeHash,
            false
        );
        require(
            !sessionAccess.isRoutineSessionAuthorized(address(account), SESSION_KEY, address(target), target.tick.selector),
            "inactive grant accepted"
        );
    }

    function testRoutinePolicyAdministrationIsCapabilityAuthorized() public {
        authorization.setAllowed(false);
        (bool ok,) = address(sessionAccess).call(
            abi.encodeWithSelector(sessionAccess.setRoutineCall.selector, address(target), target.tick.selector, true)
        );
        require(!ok, "unauthorized routine call policy update accepted");
    }
}
