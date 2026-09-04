// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/VaultAccounting420.sol";

interface VmVaultAccountingHardening420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryVaultAccountingHardening420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) {
        return _grants[grantId];
    }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256
    ) external view returns (bool) {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract VaultAccountingHardening420Test {
    VmVaultAccountingHardening420 constant vm =
        VmVaultAccountingHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    bytes32 constant VAULT = keccak256("420BET.VAULT.HARDENING");

    function testInt256MinPnlRevertsInsolventWithoutArithmeticPanic() public {
        MockCapabilityRegistryVaultAccountingHardening420 caps =
            new MockCapabilityRegistryVaultAccountingHardening420();
        BetAuthorization420 auth = new BetAuthorization420(address(caps));
        VaultAccounting420 accounting = new VaultAccounting420(address(auth));
        bytes32 scope = auth.scopeForVault(VAULT);

        caps.setAllowed(ADMIN, BetIds420.COMPONENT_BET, BetIds420.ACTION_VAULT_REGISTER, scope, true);
        caps.setAllowed(ADMIN, BetIds420.COMPONENT_BET, BetIds420.ACTION_VAULT_RECORD_PNL, scope, true);

        vm.prank(ADMIN);
        accounting.registerVault(VAULT, address(0x420));

        vm.prank(ADMIN);
        vm.expectRevert(VaultAccounting420.Insolvent.selector);
        accounting.recordRealizedPnl(VAULT, type(int256).min);
    }
}
