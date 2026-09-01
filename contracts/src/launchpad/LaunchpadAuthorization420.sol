// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./LaunchpadIds420.sol";

contract LaunchpadAuthorization420 {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    error ZeroAddress();
    constructor(address capabilityRegistry_) { if (capabilityRegistry_ == address(0)) revert ZeroAddress(); capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_); }
    function scopeSale(bytes32 saleId) public pure returns (bytes32) { return keccak256(abi.encode("420/LAUNCHPAD/SCOPE/SALE/V1", saleId)); }
    function isAuthorized(address principal, bytes32 saleId, bytes32 actionId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(principal, LaunchpadIds420.COMPONENT_LAUNCHPAD, actionId, scopeSale(saleId), amount);
    }
}
