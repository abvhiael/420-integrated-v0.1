// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistryExtended420.sol";

/// @notice Shared bounded-authority registry for session keys and delegated operators.
/// @dev Smart-account component IDs are deterministic and self-managed by the account address.
contract CapabilityRegistry420 is ICapabilityRegistryExtended420 {
    bytes32 private constant _SMART_ACCOUNT_COMPONENT_DOMAIN = keccak256("420/APP/SMART_ACCOUNT_COMPONENT/V1");

    struct UsageState {
        uint64 periodIndex;
        uint256 used;
    }

    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => UsageState) private _usage;
    mapping(bytes32 => address) public override componentAuthority;
    mapping(bytes32 => bytes32) private _activeGrantByAuthorization;

    error InvalidAddress();
    error InvalidIdentifier();
    error InvalidWindow();
    error InvalidLimitConfiguration();
    error UnauthorizedAuthority();
    error GrantAlreadyExists();
    error UnknownGrant();
    error GrantRevoked();
    error GrantInactive();
    error CapabilityLimitExceeded();

    function smartAccountComponentId(address account) public pure returns (bytes32) {
        return keccak256(abi.encode(_SMART_ACCOUNT_COMPONENT_DOMAIN, account));
    }

    function registerSmartAccount(address account) external override returns (bytes32 componentId) {
        if (account == address(0)) revert InvalidAddress();
        componentId = smartAccountComponentId(account);
        address current = componentAuthority[componentId];
        if (current == address(0)) {
            componentAuthority[componentId] = account;
            emit ComponentAuthorityRegistered(componentId, account);
        } else if (current != account) {
            revert UnauthorizedAuthority();
        }
    }

    function createGrant(
        bytes32 grantId,
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 perCallLimit,
        uint256 periodLimit,
        uint64 periodSeconds,
        uint64 validFrom,
        uint64 validUntil
    ) external override {
        if (grantId == bytes32(0) || componentId == bytes32(0) || capabilityId == bytes32(0) || scopeHash == bytes32(0)) {
            revert InvalidIdentifier();
        }
        if (principal == address(0)) revert InvalidAddress();
        if (componentAuthority[componentId] != msg.sender) revert UnauthorizedAuthority();
        if (_grants[grantId].principal != address(0)) revert GrantAlreadyExists();
        if (validUntil != 0 && validUntil <= validFrom) revert InvalidWindow();
        if ((periodLimit == 0) != (periodSeconds == 0)) revert InvalidLimitConfiguration();

        bytes32 authKey = _authorizationKey(principal, componentId, capabilityId, scopeHash);
        bytes32 previousGrantId = _activeGrantByAuthorization[authKey];
        if (previousGrantId != bytes32(0) && !_grants[previousGrantId].revoked) {
            _grants[previousGrantId].revoked = true;
            emit CapabilityRevoked(previousGrantId);
        }

        _grants[grantId] = CapabilityGrant({
            principal: principal,
            componentId: componentId,
            capabilityId: capabilityId,
            scopeHash: scopeHash,
            perCallLimit: perCallLimit,
            periodLimit: periodLimit,
            periodSeconds: periodSeconds,
            validFrom: validFrom,
            validUntil: validUntil,
            revoked: false
        });
        _activeGrantByAuthorization[authKey] = grantId;
        emit CapabilityGranted(grantId, principal, capabilityId, componentId, scopeHash);
    }

    function revokeGrant(bytes32 grantId) external override {
        CapabilityGrant storage g = _grants[grantId];
        if (g.principal == address(0)) revert UnknownGrant();
        if (componentAuthority[g.componentId] != msg.sender) revert UnauthorizedAuthority();
        if (!g.revoked) {
            g.revoked = true;
            emit CapabilityRevoked(grantId);
        }
    }

    function grant(bytes32 grantId) external view override returns (CapabilityGrant memory) {
        return _grants[grantId];
    }

    function activeGrantId(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash)
        public
        view
        override
        returns (bytes32)
    {
        return _activeGrantByAuthorization[_authorizationKey(principal, componentId, capabilityId, scopeHash)];
    }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount
    ) public view override returns (bool) {
        bytes32 grantId = activeGrantId(principal, componentId, capabilityId, scopeHash);
        if (grantId == bytes32(0)) return false;
        CapabilityGrant storage g = _grants[grantId];
        if (!_grantMatches(g, principal, componentId, capabilityId, scopeHash)) return false;
        if (!_timeActive(g)) return false;
        if (g.perCallLimit != 0 && amount > g.perCallLimit) return false;
        if (g.periodLimit != 0) {
            UsageState memory u = _currentUsage(grantId, g.periodSeconds);
            if (u.used > g.periodLimit || amount > g.periodLimit - u.used) return false;
        }
        return true;
    }

    function usage(bytes32 grantId) external view override returns (UsageView memory view_) {
        CapabilityGrant storage g = _grants[grantId];
        if (g.principal == address(0)) return view_;
        UsageState memory u = _currentUsage(grantId, g.periodSeconds);
        view_ = UsageView({ periodIndex: u.periodIndex, used: u.used });
    }

    function consume(bytes32 grantId, uint256 amount) external override returns (uint256 periodUsed) {
        CapabilityGrant storage g = _grants[grantId];
        if (g.principal == address(0)) revert UnknownGrant();
        if (componentAuthority[g.componentId] != msg.sender) revert UnauthorizedAuthority();
        if (g.revoked) revert GrantRevoked();
        if (!_timeActive(g)) revert GrantInactive();
        if (g.perCallLimit != 0 && amount > g.perCallLimit) revert CapabilityLimitExceeded();

        if (g.periodLimit == 0) {
            emit CapabilityConsumed(grantId, g.principal, amount, 0);
            return 0;
        }

        uint64 index = uint64(block.timestamp / g.periodSeconds);
        UsageState storage u = _usage[grantId];
        if (u.periodIndex != index) {
            u.periodIndex = index;
            u.used = 0;
        }
        if (u.used > g.periodLimit || amount > g.periodLimit - u.used) revert CapabilityLimitExceeded();
        uint256 next = u.used + amount;
        u.used = next;
        emit CapabilityConsumed(grantId, g.principal, amount, next);
        return next;
    }

    function _authorizationKey(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(principal, componentId, capabilityId, scopeHash));
    }

    function _grantMatches(
        CapabilityGrant storage g,
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash
    ) private view returns (bool) {
        return !g.revoked && g.principal == principal && g.componentId == componentId
            && g.capabilityId == capabilityId && g.scopeHash == scopeHash;
    }

    function _timeActive(CapabilityGrant storage g) private view returns (bool) {
        if (block.timestamp < g.validFrom) return false;
        if (g.validUntil != 0 && block.timestamp > g.validUntil) return false;
        return true;
    }

    function _currentUsage(bytes32 grantId, uint64 periodSeconds) private view returns (UsageState memory u) {
        if (periodSeconds == 0) return u;
        uint64 index = uint64(block.timestamp / periodSeconds);
        UsageState storage stored = _usage[grantId];
        if (stored.periodIndex == index) {
            u = stored;
        } else {
            u.periodIndex = index;
            u.used = 0;
        }
    }
}
