// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SmartAccount420.sol";

contract SmartAccountFactory420 {
    address public immutable entryPoint;
    address public immutable capabilityRegistry;

    event AccountCreated(
        address indexed account,
        address indexed owner,
        address indexed recoveryAuthority,
        bytes32 salt
    );

    error InvalidAddress();

    constructor(address entryPoint_, address capabilityRegistry_) {
        if (entryPoint_ == address(0) || capabilityRegistry_ == address(0)) revert InvalidAddress();
        entryPoint = entryPoint_;
        capabilityRegistry = capabilityRegistry_;
    }

    function createAccount(address owner, address recoveryAuthority, bytes32 salt)
        external
        returns (SmartAccount420 account)
    {
        address predicted = getAddress(owner, recoveryAuthority, salt);
        if (predicted.code.length != 0) return SmartAccount420(payable(predicted));

        account = new SmartAccount420{salt: salt}(entryPoint, capabilityRegistry, owner, recoveryAuthority);
        emit AccountCreated(address(account), owner, recoveryAuthority, salt);
    }

    function getAddress(address owner, address recoveryAuthority, bytes32 salt) public view returns (address predicted) {
        if (owner == address(0)) revert InvalidAddress();
        bytes memory creationCode = abi.encodePacked(
            type(SmartAccount420).creationCode,
            abi.encode(entryPoint, capabilityRegistry, owner, recoveryAuthority)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creationCode))
        );
        predicted = address(uint160(uint256(hash)));
    }
}
