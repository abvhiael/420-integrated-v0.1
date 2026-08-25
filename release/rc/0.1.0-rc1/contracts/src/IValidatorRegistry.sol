// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IValidatorRegistry {
    enum Status { None, Eligible, Active, Cooldown, Exiting, Slashed }

    struct Validator {
        bytes pubkey;
        address withdrawalAddress;
        uint256 bonded;
        uint64 eligibleFromEpoch;
        uint64 cooldownUntilEpoch;
        Status status;
    }

    function register(bytes calldata validatorPubkey, address withdrawalAddress) external payable;
    function validator(bytes32 validatorId) external view returns (Validator memory);
}
