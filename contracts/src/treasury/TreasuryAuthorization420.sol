// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./TreasuryIds420.sol";

contract TreasuryAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    error ZeroAddress();
    constructor(address registry_) { if (registry_ == address(0)) revert ZeroAddress(); capabilityRegistry = ICapabilityRegistry420(registry_); }
    function systemName() external pure returns (string memory) { return "TreasuryAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function scopeForDisbursement(bytes32 disbursementId) public pure returns (bytes32) { return keccak256(abi.encode(disbursementId)); }
    function isDisbursementAuthorized(address principal, bytes32 disbursementId, bytes32 actionId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, TreasuryIds420.COMPONENT_TREASURY, actionId, scopeForDisbursement(disbursementId), amount);
    }
}
