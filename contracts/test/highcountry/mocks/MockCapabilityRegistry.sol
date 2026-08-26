// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract MockCapabilityRegistry is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) public authorized;

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) {
        return _grants[grantId];
    }

    function setAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount,
        bool value
    ) external {
        authorized[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
    }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount
    ) external view returns (bool) {
        return authorized[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}
