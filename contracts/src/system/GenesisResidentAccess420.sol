// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../libraries/AppDependencyIds420.sol";

import "./SystemAccess.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/Errors420.sol";
import "../interfaces/genesis/IGenesisResident420.sol";
import "../interfaces/genesis/IGenesisInitializable420.sol";
import "../interfaces/genesis/IProtocolRegistry420.sol";
import "../interfaces/genesis/IGovernanceAuthority420.sol";
import "../interfaces/genesis/IPauseRegistry420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/IChainContext420.sol";
import "../interfaces/genesis/ICanonicalAssetRegistry420.sol";
import "../interfaces/genesis/IAssetCapabilities420.sol";
import "../interfaces/genesis/ISettlementHealth420.sol";
import "../libraries/GenesisInterfaceIds420.sol";

/// @notice Shared fail-closed runtime guard for genesis-resident application contracts.
/// @dev Component-specific contracts provide componentId(). All dependency addresses are
/// resolved through the frozen ProtocolRegistry and code-hash checked before use.
abstract contract GenesisResidentAccess420 is SystemAccess, IGenesisResident420, IGenesisInitializable420 {
    address public immutable override registry;
    bytes32 public immutable override genesisConfigHash;

    uint32 public constant GENESIS_INITIALIZATION_VERSION = 1;

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_) SystemAccess(timelock_) {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = registry_;
        genesisConfigHash = genesisConfigHash_;
    }

    function componentId() public pure virtual override returns (bytes32);

    function protocolVersion() public pure virtual override returns (Types420.Version memory) {
        return Types420.Version({ major: 1, minor: 0, patch: 0 });
    }

    function genesisInitialized() external pure override returns (bool) {
        return true;
    }

    function initializationVersion() external pure override returns (uint32) {
        return GENESIS_INITIALIZATION_VERSION;
    }

    function assertGenesisConfiguration(bytes32 expectedConfigHash) external view override returns (bool) {
        return expectedConfigHash == genesisConfigHash;
    }

    /// @dev Fail closed if the resident registration does not point at this exact runtime.
    function _requireResidentActive() internal view {
        Types420.ContractRef memory ref = IProtocolRegistry420(registry).component(componentId());
        if (ref.implementation != address(this) || ref.lifecycle != Types420.Lifecycle.ACTIVE) {
            revert Errors420.InactiveComponent(componentId());
        }
        bytes32 actualHash = address(this).codehash;
        if (ref.runtimeCodeHash == bytes32(0) || actualHash != ref.runtimeCodeHash) {
            revert Errors420.InactiveComponent(componentId());
        }
        Types420.Version memory v = protocolVersion();
        if (!IProtocolRegistry420(registry).supportsVersion(componentId(), v)) {
            revert Errors420.UnsupportedVersion(componentId(), v.major, v.minor, v.patch);
        }
    }

    function _resolveRequired(bytes32 dependencyId) internal view returns (address implementation) {
        Types420.ContractRef memory ref = IProtocolRegistry420(registry).component(dependencyId);
        if (ref.implementation == address(0) || ref.lifecycle != Types420.Lifecycle.ACTIVE) {
            revert Errors420.InactiveComponent(dependencyId);
        }
        bytes32 actualHash = ref.implementation.codehash;
        if (ref.runtimeCodeHash == bytes32(0) || actualHash != ref.runtimeCodeHash) {
            revert Errors420.InactiveComponent(dependencyId);
        }
        implementation = ref.implementation;
    }

    function _requireGenesisGovernance(bytes32 actionId) internal view {
        if (msg.sender != governanceTimelock) revert Unauthorized();
        IGovernanceAuthority420 authority = IGovernanceAuthority420(_resolveRequired(GenesisInterfaceIds420.GOVERNANCE_AUTHORITY));
        if (!authority.isAuthorized(msg.sender, actionId)) revert Unauthorized();
        if (!authority.timelockSatisfied(actionId)) revert Errors420.TimelockRequired();
    }

    function _requireOperational(
        bytes32 actionId,
        ISystemSafety420.ActionClass actionClass,
        Types420.Direction direction
    ) internal view {
        _requireResidentActive();

        ISystemSafety420 safety = ISystemSafety420(_resolveRequired(AppDependencyIds420.SYSTEM_SAFETY));
        if (!safety.actionAllowed(componentId(), actionId, actionClass)) {
            revert Errors420.Paused(componentId());
        }

        if (direction != Types420.Direction.NONE) {
            IPauseRegistry420(_resolveRequired(GenesisInterfaceIds420.PAUSE_REGISTRY)).requireNotPaused(componentId(), direction);
        }

        IChainContext420 chainContext = IChainContext420(_resolveRequired(AppDependencyIds420.CHAIN_CONTEXT));
        if (chainContext.chainId() != block.chainid) revert Errors420.InvalidIdentifier();
        Types420.Version memory chainVersion = chainContext.protocolVersion();
        Types420.Version memory localVersion = protocolVersion();
        if (chainVersion.major != localVersion.major) {
            revert Errors420.UnsupportedVersion(componentId(), chainVersion.major, chainVersion.minor, chainVersion.patch);
        }
    }

    function _canonicalSettlementAsset(address token) internal view returns (bytes32 assetId) {
        ICanonicalAssetRegistry420 assets = ICanonicalAssetRegistry420(
            _resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY)
        );
        assetId = assets.assetIdOf(token);
        if (assetId == bytes32(0) || !assets.isCanonical(assetId) || !assets.isUsable(assetId)) {
            revert Errors420.UnsupportedAsset(assetId);
        }

        IAssetCapabilities420 capabilities = IAssetCapabilities420(
            _resolveRequired(AppDependencyIds420.ASSET_CAPABILITIES)
        );
        if (!capabilities.eligibleForCanonicalSettlement(assetId)) revert Errors420.UnsupportedAsset(assetId);

        ISettlementHealth420 settlementHealth = ISettlementHealth420(
            _resolveRequired(GenesisInterfaceIds420.SETTLEMENT_HEALTH)
        );
        if (!settlementHealth.settlementAssetHealthy(assetId)) revert Errors420.Unhealthy(assetId);
    }

    function _requireHealthyMarket(bytes32 marketId) internal view {
        ISettlementHealth420 settlementHealth = ISettlementHealth420(
            _resolveRequired(GenesisInterfaceIds420.SETTLEMENT_HEALTH)
        );
        if (!settlementHealth.marketHealthy(marketId)) revert Errors420.Unhealthy(marketId);
    }
}
