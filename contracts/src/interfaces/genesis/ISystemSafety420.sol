// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ISystemSafety420 {
    enum SafetyState { NORMAL, DEGRADED, HALTED, RECOVERY }
    enum ActionClass { NORMAL_ONLY, SAFE_WHEN_PAUSED, WITHDRAWAL_ONLY, RECOVERY_ONLY }

    event SafetyStateChanged(SafetyState indexed previousState,SafetyState indexed newState,bytes32 reasonHash);

    function safetyState() external view returns (SafetyState);
    function actionAllowed(bytes32 componentId,bytes32 actionId,ActionClass actionClass) external view returns (bool);
    function recoveryReference() external view returns (bytes32);
}
