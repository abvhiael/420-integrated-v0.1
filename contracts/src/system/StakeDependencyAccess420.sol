// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/IGenesisInitializable420.sol";
import "../interfaces/genesis/IProtocolRegistry420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/Types420.sol";
import "../libraries/AppDependencyIds420.sol";
import "../libraries/StakeIds420.sol";

/// @notice Narrow shared-interface adapter for canonical 420Stake runtime safety.
/// @dev Stake consensus authority remains in ConsensusSystemAccess420. This adapter only
/// resolves the frozen SystemSafety dependency through ProtocolRegistry and exposes
/// Genesis initialization introspection required by the shared interface layer.
abstract contract StakeDependencyAccess420 is IGenesisInitializable420 {
    address public immutable stakeProtocolRegistry;
    bytes32 public immutable override genesisConfigHash;
    uint32 public constant STAKE_GENESIS_INITIALIZATION_VERSION = 1;

    error InvalidStakeDependencyRegistry();
    error InactiveStakeDependency(bytes32 dependencyId);
    error StakeSafetyRestricted(bytes32 actionId);

    constructor(address registry_, bytes32 genesisConfigHash_) {
        if (registry_ == address(0)) revert InvalidStakeDependencyRegistry();
        stakeProtocolRegistry = registry_;
        genesisConfigHash = genesisConfigHash_;
    }

    function genesisInitialized() external pure override returns (bool) {
        return true;
    }

    function initializationVersion() external pure override returns (uint32) {
        return STAKE_GENESIS_INITIALIZATION_VERSION;
    }

    function assertGenesisConfiguration(bytes32 expectedConfigHash) external view override returns (bool) {
        return expectedConfigHash == genesisConfigHash;
    }

    function _requireStakeActivationAllowed() internal view {
        _requireStakeSafety(
            StakeIds420.ACTION_ACTIVATE,
            ISystemSafety420.ActionClass.NORMAL_ONLY
        );
    }

    function _requireStakeWithdrawalAllowed() internal view {
        _requireStakeSafety(
            StakeIds420.ACTION_WITHDRAW,
            ISystemSafety420.ActionClass.WITHDRAWAL_ONLY
        );
    }

    function _requireStakeSafety(bytes32 actionId, ISystemSafety420.ActionClass actionClass) private view {
        address safetyAddress = _resolveStakeDependency(AppDependencyIds420.SYSTEM_SAFETY);
        if (!ISystemSafety420(safetyAddress).actionAllowed(StakeIds420.VALIDATOR_REGISTRY, actionId, actionClass)) {
            revert StakeSafetyRestricted(actionId);
        }
    }

    function _resolveStakeDependency(bytes32 dependencyId) private view returns (address implementation) {
        Types420.ContractRef memory ref = IProtocolRegistry420(stakeProtocolRegistry).component(dependencyId);
        if (ref.implementation == address(0) || ref.lifecycle != Types420.Lifecycle.ACTIVE) {
            revert InactiveStakeDependency(dependencyId);
        }
        if (ref.runtimeCodeHash == bytes32(0) || ref.implementation.codehash != ref.runtimeCodeHash) {
            revert InactiveStakeDependency(dependencyId);
        }
        implementation = ref.implementation;
    }
}
