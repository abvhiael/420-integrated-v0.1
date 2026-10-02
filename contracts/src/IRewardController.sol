// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Public ABI interface for the canonical RewardController predeploy.
/// @dev Native issuance authority remains protocol-level and applyConsensusReward is consensus-system-only.
interface IRewardController {
    function ATTENTION_TREASURY() external view returns (address);
    function DEVELOPMENT_TREASURY() external view returns (address);
    function MAX_ACTIVE_VALIDATORS() external view returns (uint256);
    function consensusSystemCaller() external view returns (address);
    function consensusSystemCallerBound() external view returns (bool);

    function grossSecurityIssued() external view returns (uint256);
    function grossAttentionIssued() external view returns (uint256);
    function grossDevelopmentIssued() external view returns (uint256);
    function validatorAccrued(address validator) external view returns (uint256);
    function rewardApplied(uint64 blockNumber) external view returns (bool);

    function applyConsensusReward(
        uint64 blockNumber,
        address proposer,
        address[] calldata participants,
        uint256 proposerAmount,
        uint256 perParticipantAmount,
        uint256 attentionAmount,
        uint256 developmentAmount
    ) external;
}
