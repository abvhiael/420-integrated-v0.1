// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HighCountrySessionAccess420 } from "../../../../src/highcountry/player/HighCountrySessionAccess420.sol";
import { SmartAccount420 } from "../../../../src/accounts/SmartAccount420.sol";
import { SmartAccountFactory420 } from "../../../../src/accounts/SmartAccountFactory420.sol";
import { SmartAccountScopes420 } from "../../../../src/accounts/SmartAccountScopes420.sol";
import { CapabilityIds420 } from "../../../../src/libraries/CapabilityIds420.sol";
import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { ICapabilityRegistryExtended420 } from "../../../../src/interfaces/genesis/ICapabilityRegistryExtended420.sol";
import { IHighCountryAuthorization } from "../../../../src/highcountry/interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../../../../src/highcountry/types/HighCountryTypes.sol";

contract MockHCAuthorizationSessionAccess is IHighCountryAuthorization {
    bool public allowed = true;
    address public registry;

    function setAllowed(
        bool allowed_
    ) external {
        allowed = allowed_;
    }

    function setRegistry(
        address value
    ) external {
        registry = value;
    }

    function capabilityRegistry() external view returns (address) {
        return registry;
    }

    function isAuthorized(
        AuthorizationRequest calldata
    ) external view returns (bool) {
        return allowed;
    }

    function requireAuthorized(
        AuthorizationRequest calldata
    ) external view {
        require(allowed, "unauthorized");
    }
}

contract MockCapabilityRegistryHCSession is ICapabilityRegistryExtended420 {
    mapping(bytes32 => CapabilityGrant) internal grants;
    mapping(bytes32 => UsageView) internal usages;
    mapping(bytes32 => bytes32) internal active;
    mapping(bytes32 => bool) internal authorized;

    function setPeriodicLimits(
        bytes32 id,
        uint256 limit,
        uint64 seconds_
    ) external {
        grants[id].periodLimit = limit;
        grants[id].periodSeconds = seconds_;
    }

    function _key(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash
    ) internal pure returns (bytes32) {
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

    function setAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        bool allowed
    ) external {
        authorized[_key(principal, componentId, capabilityId, scopeHash)] = allowed;
    }

    function grant(
        bytes32 grantId
    ) external view returns (CapabilityGrant memory) {
        return grants[grantId];
    }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256
    ) external view returns (bool) {
        return authorized[_key(principal, componentId, capabilityId, scopeHash)];
    }

    function componentAuthority(
        bytes32
    ) external pure returns (address) {
        return address(0);
    }

    function componentRegistrar() external pure returns (address) {
        return address(0);
    }

    function protocolComponentManaged(
        bytes32
    ) external pure returns (bool) {
        return false;
    }

    function registerSmartAccount(
        address account
    ) external pure returns (bytes32) {
        return SmartAccountScopes420.accountComponentId(account);
    }
    function registerProtocolComponent(
        bytes32,
        address
    ) external pure { }
    function updateProtocolComponentAuthority(
        bytes32,
        address
    ) external pure { }
    function transferComponentRegistrar(
        address
    ) external pure { }

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
    ) external { }

    function revokeGrant(
        bytes32 grantId
    ) external {
        grants[grantId].revoked = true;
    }

    function activeGrantId(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash
    ) external view returns (bytes32) {
        return active[_key(principal, componentId, capabilityId, scopeHash)];
    }

    function usage(
        bytes32 grantId
    ) external view returns (UsageView memory) {
        return usages[grantId];
    }

    function consume(
        bytes32,
        uint256
    ) external pure returns (uint256) {
        return 0;
    }
}

contract MockSmartAccountHCSession {
    uint64 public authorizationEpoch = 1;
    mapping(address => uint64) public sessionEpoch;
    address public entryPoint = address(0x420);
    address public pendingRecoveryOwner;
    bytes32 public immutable accountComponentId;
    ICapabilityRegistryExtended420 public immutable capabilityRegistry;

    constructor(
        address registry
    ) {
        capabilityRegistry = ICapabilityRegistryExtended420(registry);
        accountComponentId = SmartAccountScopes420.accountComponentId(address(this));
    }

    function setAuthorizationEpoch(
        uint64 epoch
    ) external {
        authorizationEpoch = epoch;
    }

    function setSessionEpoch(
        address key,
        uint64 epoch
    ) external {
        sessionEpoch[key] = epoch;
    }

    function sessionScope(
        address target,
        bytes4 selector
    ) external view returns (bytes32) {
        return SmartAccountScopes420.sessionCallScope(
            address(this), accountComponentId, authorizationEpoch, target, selector
        );
    }
}

contract MockHCFactorySession {
    address public immutable entryPoint = address(0x420);
    address public immutable capabilityRegistry;
    address public account;

    constructor(
        address registry
    ) {
        capabilityRegistry = registry;
    }

    function setAccount(
        address candidate
    ) external {
        account = candidate;
    }

    function getAddress(
        address,
        address,
        bytes32
    ) external view returns (address) {
        return account;
    }
}

contract RoutineTargetHCSession {
    function tick(
        uint64
    ) external { }
    function risky(
        uint64
    ) external { }
}

contract HighCountrySessionAccess420Test {
    MockHCAuthorizationSessionAccess internal authorization;
    MockCapabilityRegistryHCSession internal registry;
    MockSmartAccountHCSession internal account;
    MockHCFactorySession internal factory;
    RoutineTargetHCSession internal target;
    HighCountrySessionAccess420 internal sessionAccess;

    address internal constant SESSION_KEY = address(0x4201);

    function setUp() public {
        authorization = new MockHCAuthorizationSessionAccess();
        registry = new MockCapabilityRegistryHCSession();
        authorization.setRegistry(address(registry));
        account = new MockSmartAccountHCSession(address(registry));
        target = new RoutineTargetHCSession();
        factory = new MockHCFactorySession(address(registry));
        factory.setAccount(address(account));
        sessionAccess = new HighCountrySessionAccess420(address(authorization), address(factory));
        sessionAccess.attestAccount(address(account), address(this), address(0), bytes32(uint256(1)));
    }

    function _enableRoutineGrant() internal returns (bytes32 grantId, bytes32 scopeHash) {
        sessionAccess.setRoutineCall(address(target), target.tick.selector, true);
        account.setSessionEpoch(SESSION_KEY, account.authorizationEpoch());
        scopeHash = account.sessionScope(address(target), target.tick.selector);
        grantId = keccak256("hc-session-grant");
        registry.setGrant(
            grantId, SESSION_KEY, account.accountComponentId(), CapabilityIds420.SESSION_EXECUTE, scopeHash, true
        );
    }

    function testR0213RealCanonicalFactorySmartAccountIntegration() public {
        SmartAccountFactory420 realFactory = new SmartAccountFactory420(address(0x420), address(registry));
        HighCountrySessionAccess420 realPolicy =
            new HighCountrySessionAccess420(address(authorization), address(realFactory));
        bytes32 salt = keccak256("r0213:canonical-factory");
        SmartAccount420 realAccount = realFactory.createAccount(address(this), address(0), salt);
        require(
            address(realAccount) == realFactory.getAddress(address(this), address(0), salt),
            "CREATE2 address mismatch"
        );
        realAccount.enableSessionKey(SESSION_KEY);
        realPolicy.setRoutineCall(address(target), target.tick.selector, true);
        bytes32 component = realAccount.accountComponentId();
        bytes32 scope = realAccount.sessionScope(address(target), target.tick.selector);
        registry.setGrant(
            keccak256("r0213:real-grant"), SESSION_KEY, component, CapabilityIds420.SESSION_EXECUTE, scope, true
        );
        require(
            !realPolicy.isRoutineSessionAuthorized(address(realAccount), SESSION_KEY, address(target), target.tick.selector),
            "unattested canonical wallet accepted"
        );
        realPolicy.attestAccount(address(realAccount), address(this), address(0), salt);
        require(
            realPolicy.isRoutineSessionAuthorized(address(realAccount), SESSION_KEY, address(target), target.tick.selector),
            "factory deployed and granted wallet denied"
        );
        require(
            !realPolicy.isRoutineSessionAuthorized(address(realAccount), SESSION_KEY, address(target), target.risky.selector),
            "unreviewed selector accepted"
        );
        require(
            realPolicy.requiresWalletEscalation(address(target), target.tick.selector, 1),
            "native value did not escalate"
        );
        realAccount.revokeKey(SESSION_KEY);
        require(
            !realPolicy.isRoutineSessionAuthorized(address(realAccount), SESSION_KEY, address(target), target.tick.selector),
            "revoked real wallet key accepted"
        );
    }

    function testR0213SensitiveSelectorsCannotBecomeRoutine() public {
        bytes4[5] memory blocked = [
            bytes4(keccak256("execute(address,uint256,bytes)")),
            bytes4(keccak256("transfer(address,uint256)")),
            bytes4(keccak256("approve(address,uint256)")),
            bytes4(keccak256("createSessionGrant(address,address,bytes4,uint256,uint256,uint64,uint64,uint64)")),
            bytes4(keccak256("enableSessionKey(address)"))
        ];
        for (uint256 i; i < blocked.length; i++) {
            (bool ok,) = address(sessionAccess)
                .call(abi.encodeWithSelector(sessionAccess.setRoutineCall.selector, address(target), blocked[i], true));
            require(!ok, "sensitive selector downgraded");
        }
    }

    function testR0213UnknownAccountNeverTrusted() public {
        _enableRoutineGrant();
        MockSmartAccountHCSession forged = new MockSmartAccountHCSession(address(registry));
        forged.setSessionEpoch(SESSION_KEY, 1);
        require(
            !sessionAccess.isRoutineSessionAuthorized(
                address(forged), SESSION_KEY, address(target), target.tick.selector
            ),
            "unattested account authorized"
        );
        (bool ok,) = address(sessionAccess)
            .call(
                abi.encodeCall(
                    sessionAccess.attestAccount, (address(forged), address(this), address(0), bytes32(uint256(1)))
                )
            );
        require(!ok, "nonfactory account attested");
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
            !sessionAccess.requiresWalletEscalation(address(target), target.tick.selector, 0), "routine call escalated"
        );
        require(
            sessionAccess.requiresWalletEscalation(address(target), target.tick.selector, 1),
            "native value bypassed escalation"
        );
    }

    function testRoutineSessionRequiresExactLiveSmartAccountGrant() public {
        _enableRoutineGrant();
        require(
            sessionAccess.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, address(target), target.tick.selector
            ),
            "valid routine session rejected"
        );
        require(
            !sessionAccess.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, address(target), target.risky.selector
            ),
            "wrong selector accepted"
        );
    }

    function testPeriodicRoutineGrantIsDeniedEvenForZeroNativeValue() public {
        (bytes32 id,) = _enableRoutineGrant();
        registry.setPeriodicLimits(id, 10, 60);
        require(
            !sessionAccess.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, address(target), target.tick.selector
            ),
            "periodic session accepted"
        );
        registry.setPeriodicLimits(id, 0, 60);
        require(
            !sessionAccess.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, address(target), target.tick.selector
            ),
            "period-only session accepted"
        );
        registry.setPeriodicLimits(id, 10, 0);
        require(
            !sessionAccess.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, address(target), target.tick.selector
            ),
            "limit-only session accepted"
        );
        registry.setPeriodicLimits(id, 0, 0);
        require(
            sessionAccess.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, address(target), target.tick.selector
            ),
            "nonperiodic session rejected"
        );
    }

    function testStaleSessionEpochFailsClosed() public {
        _enableRoutineGrant();
        account.setAuthorizationEpoch(2);
        require(
            !sessionAccess.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, address(target), target.tick.selector
            ),
            "stale session accepted"
        );
    }

    function testAccountCannotSubstituteCapabilityRegistry() public {
        _enableRoutineGrant();
        MockCapabilityRegistryHCSession rogueRegistry = new MockCapabilityRegistryHCSession();
        MockSmartAccountHCSession rogueAccount = new MockSmartAccountHCSession(address(rogueRegistry));
        rogueAccount.setSessionEpoch(SESSION_KEY, 1);
        rogueRegistry.setGrant(
            keccak256("rogue"),
            SESSION_KEY,
            rogueAccount.accountComponentId(),
            CapabilityIds420.SESSION_EXECUTE,
            rogueAccount.sessionScope(address(target), target.tick.selector),
            true
        );
        require(
            !sessionAccess.isRoutineSessionAuthorized(
                address(rogueAccount), SESSION_KEY, address(target), target.tick.selector
            ),
            "substituted registry accepted"
        );
    }

    function testRevokedOrInactiveGrantFailsClosed() public {
        (, bytes32 scopeHash) = _enableRoutineGrant();
        registry.setAuthorized(
            SESSION_KEY, account.accountComponentId(), CapabilityIds420.SESSION_EXECUTE, scopeHash, false
        );
        require(
            !sessionAccess.isRoutineSessionAuthorized(
                address(account), SESSION_KEY, address(target), target.tick.selector
            ),
            "inactive grant accepted"
        );
    }

    function testRoutinePolicyAdministrationIsCapabilityAuthorized() public {
        authorization.setAllowed(false);
        (bool ok,) = address(sessionAccess)
            .call(
                abi.encodeWithSelector(
                    sessionAccess.setRoutineCall.selector, address(target), target.tick.selector, true
                )
            );
        require(!ok, "unauthorized routine call policy update accepted");
    }
}
