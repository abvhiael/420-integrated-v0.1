// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../libraries/CapabilityIds420.sol";

/// @notice Canonical scope construction for 420 Smart Account capability grants.
/// @dev Keeps account/session permissions interoperable with the frozen Genesis capability vocabulary.
library SmartAccountScopes420 {
    bytes32 private constant _SMART_ACCOUNT_COMPONENT_DOMAIN = keccak256("420/APP/SMART_ACCOUNT_COMPONENT/V1");

    function accountComponentId(address account) internal pure returns (bytes32) {
        return keccak256(abi.encode(_SMART_ACCOUNT_COMPONENT_DOMAIN, account));
    }

    function sessionExecuteCapability() internal pure returns (bytes32) {
        return CapabilityIds420.SESSION_EXECUTE;
    }

    function gasSponsorCapability() internal pure returns (bytes32) {
        return CapabilityIds420.GAS_SPONSOR;
    }

    function callScope(address account, bytes32 componentId, address target, bytes4 selector)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("420/ACCOUNT/CALL_SCOPE/V1", account, componentId, target, selector));
    }

    function sessionCallScope(
        address account,
        bytes32 componentId,
        uint64 authorizationEpoch,
        address target,
        bytes4 selector
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                "420/ACCOUNT/SESSION_CALL_SCOPE/V1",
                account,
                componentId,
                authorizationEpoch,
                target,
                selector
            )
        );
    }

    function assetScope(address account, bytes32 componentId, address asset)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("420/ACCOUNT/ASSET_SCOPE/V1", account, componentId, asset));
    }

    function sponsorScope(address account, bytes32 operation)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("420/ACCOUNT/GAS_SPONSOR_SCOPE/V1", account, operation));
    }

    function grantId(address account, address principal, bytes32 scopeHash, uint64 sequence)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("420/ACCOUNT/CAPABILITY_GRANT/V1", account, principal, scopeHash, sequence));
    }
}
