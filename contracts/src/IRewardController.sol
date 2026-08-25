// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Interface sketch only. Native issuance authority remains protocol-level.
interface IRewardController {
    function attentionTreasury() external view returns (address);
    function developmentTreasury() external view returns (address);
    function validatorRegistry() external view returns (address);
}
