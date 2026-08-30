// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ICapabilityRegistry420.sol";

/// @notice Backward-compatible operational extension for the frozen capability registry interface.
/// @dev The v1 frozen view interface remains unchanged. This extension adds grant lifecycle and
/// metered consumption needed by programmable smart accounts and other delegated operators.
interface ICapabilityRegistryExtended420 is ICapabilityRegistry420 {
    struct UsageView {
        uint64 periodIndex;
        uint256 used;
    }

    event ComponentAuthorityRegistered(bytes32 indexed componentId, address indexed authority);
    event CapabilityConsumed(bytes32 indexed grantId, address indexed principal, uint256 amount, uint256 periodUsed);

    function componentAuthority(bytes32 componentId) external view returns (address);

    function registerSmartAccount(address account) external returns (bytes32 componentId);

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
    ) external;

    function revokeGrant(bytes32 grantId) external;

    function activeGrantId(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash
    ) external view returns (bytes32);

    function usage(bytes32 grantId) external view returns (UsageView memory);

    function consume(bytes32 grantId, uint256 amount) external returns (uint256 periodUsed);
}
