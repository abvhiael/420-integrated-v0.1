// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./RightsIds420.sol";

contract RightsAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "RightsAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeForSubject(bytes32 subjectId) public pure returns (bytes32) {
        return keccak256(abi.encode(subjectId));
    }

    function scopeForRight(bytes32 rightId) public pure returns (bytes32) {
        return keccak256(abi.encode(rightId));
    }

    function isSubjectAuthorized(address principal, bytes32 subjectId, bytes32 actionId) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, RightsIds420.COMPONENT_RIGHTS, actionId, scopeForSubject(subjectId), 0);
    }

    function isRightAuthorized(address principal, bytes32 rightId, bytes32 actionId) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, RightsIds420.COMPONENT_RIGHTS, actionId, scopeForRight(rightId), 0);
    }
}
