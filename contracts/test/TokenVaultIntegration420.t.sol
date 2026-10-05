// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/token/TokenIds420.sol";
import "../src/token/TokenTemplateRegistry420.sol";
import "../src/token/TokenFactory420.sol";
import "../src/vault/VaultIds420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";

interface VmTokenVault420 {
    function deal(
        address who,
        uint256 amount
    ) external;
    function prank(
        address who
    ) external;
}

contract MockCapabilityRegistryTokenVault420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;

    function grant(
        bytes32 grantId
    ) external view returns (CapabilityGrant memory) {
        return _grants[grantId];
    }

    function isAuthorized(
        address,
        bytes32,
        bytes32,
        bytes32,
        uint256
    ) external pure returns (bool) {
        return false;
    }
}

contract TokenVaultIntegration420Test {
    VmTokenVault420 constant vm = VmTokenVault420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    bytes32 constant AUTH_POLICY = keccak256("token/vault/policy/auth");
    bytes32 constant ASSET_POLICY = keccak256("token/vault/policy/asset");
    bytes32 constant RELEASE_POLICY = keccak256("token/vault/policy/release");
    bytes32 constant ACCOUNTING_POLICY = keccak256("token/vault/policy/accounting");

    function testCreationFeeUsesRealAssetVaultAccounting() public {
        MockCapabilityRegistryTokenVault420 caps = new MockCapabilityRegistryTokenVault420();
        VaultAuthorization420 auth = new VaultAuthorization420(address(caps));
        VaultPolicyRegistry420 policies = new VaultPolicyRegistry420(address(this));
        VaultRegistry420 vaultRegistry = new VaultRegistry420(address(auth), address(policies));
        VaultAccounting420 accounting = new VaultAccounting420(address(vaultRegistry));

        policies.setPolicy(AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION, keccak256("auth-v1"), bytes32(0), true);
        policies.setPolicy(ASSET_POLICY, VaultIds420.POLICY_ASSET, keccak256("asset-v1"), bytes32(0), true);
        policies.setPolicy(RELEASE_POLICY, VaultIds420.POLICY_RELEASE, keccak256("release-v1"), bytes32(0), true);
        policies.setPolicy(
            ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING, keccak256("accounting-v1"), bytes32(0), true
        );

        bytes32 vaultId = TokenIds420.COMMUNITY_TOKEN_REVENUE_VAULT;
        AssetVault420 vault =
            new AssetVault420(vaultId, address(vaultRegistry), address(auth), address(accounting), address(this));
        vaultRegistry.registerVault(
            vaultId,
            address(vault),
            VaultIds420.VAULT_COMMUNITY,
            AUTH_POLICY,
            ASSET_POLICY,
            RELEASE_POLICY,
            ACCOUNTING_POLICY,
            bytes32(0),
            keccak256("420Token community revenue"),
            keccak256("token-community-vault-manifest-v1")
        );

        TokenTemplateRegistry420 templates = new TokenTemplateRegistry420(address(this));
        TokenFactory420 factory = new TokenFactory420(address(templates), address(vault));

        vm.deal(ALICE, 100 ether);
        vm.prank(ALICE);
        address token = factory.createERC20{ value: 42 ether }(
            TokenIds420.ERC20_FIXED, "Real Vault", "RV", 100 ether, 0, bytes32("real-vault")
        );

        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(vaultId, address(0));
        require(token != address(0), "deployment failed");
        require(a.recordedBalance == 42 ether, "vault accounting missing fee");
        require(a.reserved == 0 && a.claimable == 0, "unexpected obligation accounting");
        require(address(vault).balance == 42 ether, "vault did not receive fee");
        require(address(factory).balance == 0, "factory retained fee");
        require(factory.isFactoryDeployment(token), "deployment provenance missing");
    }
}
