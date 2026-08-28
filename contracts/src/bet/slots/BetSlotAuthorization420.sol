// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/I420System.sol";
import "../../interfaces/genesis/ICapabilityRegistry420.sol";
import "./BetSlotIds420.sol";

contract BetSlotAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "BetSlotAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeForSlot(bytes32 slotId, uint32 version) public pure returns (bytes32) {
        return keccak256(abi.encode(slotId, version));
    }

    function scopeForSlotVault(bytes32 vaultId, bytes32 slotId, uint32 version) public pure returns (bytes32) {
        return keccak256(abi.encode(vaultId, slotId, version));
    }

    function isSlotAuthorized(
        address principal,
        bytes32 slotId,
        uint32 version,
        bytes32 actionId
    ) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            BetSlotIds420.COMPONENT_BET_SLOTS,
            actionId,
            scopeForSlot(slotId, version),
            0
        );
    }

    function isSlotVaultAuthorized(
        address principal,
        bytes32 vaultId,
        bytes32 slotId,
        uint32 version,
        bytes32 actionId
    ) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            BetSlotIds420.COMPONENT_BET_SLOTS,
            actionId,
            scopeForSlotVault(vaultId, slotId, version),
            0
        );
    }
}