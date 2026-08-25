
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IValidatorRegistry420 {
    function getValidator(bytes32 validatorId) external view returns (
        bytes32, bytes memory, address, address, uint256, uint256, uint8, uint64, uint64
    );
}

/// @notice Read-oriented application facade for validator staking/lifecycle.
/// No delegator stake or stake-weighted voting exists at genesis.
contract Stake420 {
    address public immutable validatorRegistry;
    address public immutable rewardController;

    constructor(address validatorRegistry_,address rewardController_) {
        require(validatorRegistry_!=address(0)&&rewardController_!=address(0),"zero");
        validatorRegistry=validatorRegistry_;
        rewardController=rewardController_;
    }

    function effectiveBond() external pure returns (uint256) { return 42_000 ether; }
    function delegationEnabled() external pure returns (bool) { return false; }
}
