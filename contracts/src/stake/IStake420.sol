// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IStake420 {
    struct ValidatorBond {
        address owner;
        uint256 bonded;
        uint256 rewards;
        uint256 pendingWithdrawal;
        uint64 withdrawalBlock;
        bool exists;
    }

    function VALIDATOR_BOND() external view returns (uint256);
    function validatorRegistry() external view returns (address);
    function bond(uint64 validatorId) external view returns (ValidatorBond memory);
    function effectiveBond(uint64 validatorId) external view returns (uint256);
    function isFullyBonded(uint64 validatorId) external view returns (bool);

    function lockValidatorBond(uint64 validatorId, address owner) external payable;
    function creditValidatorReward(uint64 validatorId) external payable;
    function beginValidatorUnbond(uint64 validatorId, uint64 withdrawalBlock) external;
    function slashValidatorBond(uint64 validatorId, uint256 amount, address receiver) external returns (uint256 slashed);
}
