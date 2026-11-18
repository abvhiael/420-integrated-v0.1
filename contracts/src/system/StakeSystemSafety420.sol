// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SystemAccess.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../libraries/StakeIds420.sol";

/// @notice Deployable shared-interface safety provider scoped to Stake actions.
/// @dev Register its actual address/code hash under SYSTEM_SAFETY only for the
/// Stake deployment. This is not a replacement policy for unrelated applications.
contract StakeSystemSafety420 is SystemAccess, ISystemSafety420 {
    SafetyState public override safetyState;
    bytes32 public override recoveryReference;
    mapping(bytes32 => bool) public actionDenied;
    event StakeActionRestriction(bytes32 indexed actionId, bool denied, bytes32 reasonHash);
    error InvalidSafetyEvidence();
    error UnknownStakeAction();
    constructor(address timelock_) SystemAccess(timelock_) {}
    function setSafetyState(SafetyState next, bytes32 reason, bytes32 recovery) external onlyGovernance {
        if (reason == bytes32(0) || (next == SafetyState.RECOVERY && recovery == bytes32(0))) revert InvalidSafetyEvidence();
        SafetyState previous=safetyState;
        safetyState=next;
        recoveryReference=next == SafetyState.RECOVERY ? recovery : bytes32(0);
        emit SafetyStateChanged(previous,next,reason);
    }
    function setActionDenied(bytes32 actionId, bool denied, bytes32 reason) external onlyGovernance {
        if (actionId != StakeIds420.ACTION_ACTIVATE && actionId != StakeIds420.ACTION_WITHDRAW) revert UnknownStakeAction();
        if (reason == bytes32(0)) revert InvalidSafetyEvidence();
        actionDenied[actionId]=denied;
        emit StakeActionRestriction(actionId,denied,reason);
    }
    function actionAllowed(bytes32 componentId, bytes32 actionId, ActionClass actionClass) external view override returns (bool) {
        if (componentId != StakeIds420.VALIDATOR_REGISTRY || actionDenied[actionId]) return false;
        if (actionId == StakeIds420.ACTION_ACTIVATE) return actionClass == ActionClass.NORMAL_ONLY && safetyState == SafetyState.NORMAL;
        // Mature withdrawals are explicitly safe exits, never a new activation.
        // Governance may still deny this action if custody integrity is uncertain.
        if (actionId == StakeIds420.ACTION_WITHDRAW) return actionClass == ActionClass.WITHDRAWAL_ONLY;
        return false;
    }
}
