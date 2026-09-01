// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./GrantIds420.sol";

contract GrantAuthorization420 {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    error ZeroAddress();
    constructor(address capabilityRegistry_) { if (capabilityRegistry_ == address(0)) revert ZeroAddress(); capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_); }
    function scopeProgram(bytes32 programId) public pure returns (bytes32) { return keccak256(abi.encode("420/GRANTS/SCOPE/PROGRAM/V1", programId)); }
    function scopeAward(bytes32 awardId) public pure returns (bytes32) { return keccak256(abi.encode("420/GRANTS/SCOPE/AWARD/V1", awardId)); }
    function isProgramAuthorized(address principal, bytes32 programId, bytes32 actionId) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, GrantIds420.COMPONENT_GRANTS, actionId, scopeProgram(programId), 0);
    }
    function isAwardAuthorized(address principal, bytes32 awardId, bytes32 actionId) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, GrantIds420.COMPONENT_GRANTS, actionId, scopeAward(awardId), 0);
    }
}
