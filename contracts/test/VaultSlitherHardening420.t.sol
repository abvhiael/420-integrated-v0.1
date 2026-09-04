// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/vault/VaultIds420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";

interface VmVaultSlither420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function deal(address, uint256) external;
}

contract MockCapabilityRegistryVaultSlither420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value)
        external
    {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) { return _grants[grantId]; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external
        view
        returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract MockReentrantTokenVault420 {
    mapping(address => uint256) public balanceOf;
    AssetVault420 public vault;
    bool public attackDeposit;
    bool public attackWithdraw;
    bool public depositReentryBlocked;
    bool public withdrawReentryBlocked;

    function setVault(AssetVault420 vault_) external { vault = vault_; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function setAttackDeposit(bool value) external { attackDeposit = value; }
    function setAttackWithdraw(bool value) external { attackWithdraw = value; }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (attackDeposit) {
            try vault.depositToken(address(this), 1) {
                revert("deposit reentry unexpectedly succeeded");
            } catch (bytes memory reason) {
                depositReentryBlocked = _selector(reason) == AssetVault420.Reentrancy.selector;
            }
        }
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (attackWithdraw) {
            try vault.withdraw(keccak256("reentrant-withdraw"), address(this), to, 1) {
                revert("withdraw reentry unexpectedly succeeded");
            } catch (bytes memory reason) {
                withdrawReentryBlocked = _selector(reason) == AssetVault420.Reentrancy.selector;
            }
        }
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function _selector(bytes memory reason) private pure returns (bytes4 selector) {
        if (reason.length < 4) return bytes4(0);
        assembly ("memory-safe") {
            selector := mload(add(reason, 0x20))
        }
    }
}

contract VaultSlitherHardening420Test {
    VmVaultSlither420 constant vm =
        VmVaultSlither420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    bytes32 constant VAULT_ID = keccak256("vault/slither/1");
    bytes32 constant AUTH_POLICY = keccak256("vault/slither/auth");
    bytes32 constant ASSET_POLICY = keccak256("vault/slither/asset");
    bytes32 constant RELEASE_POLICY = keccak256("vault/slither/release");
    bytes32 constant ACCOUNTING_POLICY = keccak256("vault/slither/accounting");

    struct Suite {
        MockCapabilityRegistryVaultSlither420 caps;
        VaultAuthorization420 auth;
        VaultPolicyRegistry420 policies;
        VaultRegistry420 registry;
        VaultAccounting420 accounting;
        AssetVault420 vault;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryVaultSlither420();
        s.auth = new VaultAuthorization420(address(s.caps));
        s.policies = new VaultPolicyRegistry420(address(this));
        s.registry = new VaultRegistry420(address(s.auth), address(s.policies));
        s.accounting = new VaultAccounting420(address(s.registry));

        s.policies.setPolicy(AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION, keccak256("auth-v1"), bytes32(0), true);
        s.policies.setPolicy(ASSET_POLICY, VaultIds420.POLICY_ASSET, keccak256("asset-v1"), bytes32(0), true);
        s.policies.setPolicy(RELEASE_POLICY, VaultIds420.POLICY_RELEASE, keccak256("release-v1"), bytes32(0), true);
        s.policies.setPolicy(
            ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING, keccak256("accounting-v1"), bytes32(0), true
        );

        s.vault = new AssetVault420(VAULT_ID, address(s.registry), address(s.auth), address(s.accounting), ALICE);
        vm.prank(ALICE);
        s.registry.registerVault(
            VAULT_ID,
            address(s.vault),
            VaultIds420.VAULT_PERSONAL,
            AUTH_POLICY,
            ASSET_POLICY,
            RELEASE_POLICY,
            ACCOUNTING_POLICY,
            bytes32(0),
            bytes32(0),
            bytes32(0)
        );
    }

    function _allowVault(Suite memory s, address principal, bytes32 actionId) private {
        s.caps.setAllowed(principal, VaultIds420.COMPONENT_VAULT, actionId, s.auth.scopeForVault(VAULT_ID), true);
    }

    function _allowRoute(Suite memory s, address principal, address asset, address recipient) private {
        s.caps.setAllowed(
            principal,
            VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_WITHDRAW,
            s.auth.scopeForRoute(VAULT_ID, asset, recipient, VaultIds420.ACTION_WITHDRAW),
            true
        );
    }

    function _depositNative(Suite memory s, uint256 amount) private {
        vm.deal(ALICE, amount);
        vm.prank(ALICE);
        s.vault.depositNative{value: amount}();
    }

    function testVaultScopedWithdrawCannotRedirectNativeValue() public {
        Suite memory s = _deploy();
        _depositNative(s, 2 ether);
        _allowVault(s, ALICE, VaultIds420.ACTION_WITHDRAW);

        vm.prank(ALICE);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        s.vault.withdraw(keccak256("redirect-denied"), address(0), BOB, 1 ether);
    }

    function testRouteScopedWithdrawCanPayBoundNativeRecipient() public {
        Suite memory s = _deploy();
        _depositNative(s, 2 ether);
        _allowRoute(s, ALICE, address(0), BOB);
        uint256 beforeBalance = BOB.balance;

        vm.prank(ALICE);
        s.vault.withdraw(keccak256("route-native"), address(0), BOB, 1 ether);

        require(BOB.balance == beforeBalance + 1 ether, "route payout failed");
    }

    function testTokenCannotReenterDuringDepositDeltaCheck() public {
        Suite memory s = _deploy();
        MockReentrantTokenVault420 token = new MockReentrantTokenVault420();
        token.setVault(s.vault);
        token.mint(ALICE, 10 ether);
        token.setAttackDeposit(true);

        vm.prank(ALICE);
        s.vault.depositToken(address(token), 4 ether);

        require(token.depositReentryBlocked(), "deposit callback bypassed lock");
        VaultAccounting420.AssetAccounting memory a = s.accounting.getAccounting(VAULT_ID, address(token));
        require(a.recordedBalance == 4 ether, "deposit accounting changed");
        require(token.balanceOf(address(s.vault)) == 4 ether, "deposit custody changed");
    }

    function testTokenCannotReenterDuringWithdrawalDeltaCheck() public {
        Suite memory s = _deploy();
        MockReentrantTokenVault420 token = new MockReentrantTokenVault420();
        token.setVault(s.vault);
        token.mint(ALICE, 10 ether);

        vm.prank(ALICE);
        s.vault.depositToken(address(token), 4 ether);
        _allowRoute(s, ALICE, address(token), BOB);
        token.setAttackWithdraw(true);

        vm.prank(ALICE);
        s.vault.withdraw(keccak256("route-token"), address(token), BOB, 2 ether);

        require(token.withdrawReentryBlocked(), "withdraw callback bypassed lock");
        VaultAccounting420.AssetAccounting memory a = s.accounting.getAccounting(VAULT_ID, address(token));
        require(a.recordedBalance == 2 ether, "withdraw accounting changed");
        require(token.balanceOf(address(s.vault)) == 2 ether, "vault token balance changed");
        require(token.balanceOf(BOB) == 2 ether, "recipient token balance changed");
    }
}
