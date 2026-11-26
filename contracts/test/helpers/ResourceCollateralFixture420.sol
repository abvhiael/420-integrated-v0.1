// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/resource/ResourceProviderCollateral420.sol";
import "../../src/vault/VaultPolicyRegistry420.sol";
import "../../src/system/CapabilityRegistry420.sol";

interface ResourceFixtureCaps420 {
    function set(address,bytes32,bytes32,bytes32,bool) external;
}
interface ResourceFixtureVm420 {
    function prank(address) external;
    function deal(address,uint256) external;
}
library ResourceCollateralFixture420 {
    ResourceFixtureVm420 constant vm = ResourceFixtureVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function deploy(ResourceProviderRegistry420 providers, address caps) internal returns (ResourceProviderCollateral420 collateral) {
        return _deploy(providers,caps,false);
    }
    function deployWithRegistry(ResourceProviderRegistry420 providers, CapabilityRegistry420 caps) internal returns (ResourceProviderCollateral420) {
        return _deploy(providers,address(caps),true);
    }
    function _deploy(ResourceProviderRegistry420 providers,address caps,bool realRegistry) private returns (ResourceProviderCollateral420 collateral) {
        VaultAuthorization420 auth = new VaultAuthorization420(caps);
        VaultPolicyRegistry420 policies = new VaultPolicyRegistry420(address(this));
        VaultRegistry420 registry = new VaultRegistry420(address(auth),address(policies));
        VaultAccounting420 accounting = new VaultAccounting420(address(registry));
        bytes32 a = keccak256("fixture auth"); bytes32 b = keccak256("fixture asset");
        bytes32 c = keccak256("fixture release"); bytes32 d = keccak256("fixture accounting");
        policies.setPolicy(a,VaultIds420.POLICY_AUTHORIZATION,a,0,true);
        policies.setPolicy(b,VaultIds420.POLICY_ASSET,b,0,true);
        policies.setPolicy(c,VaultIds420.POLICY_RELEASE,c,0,true);
        policies.setPolicy(d,VaultIds420.POLICY_ACCOUNTING,d,0,true);
        bytes32 vid = keccak256("fixture resource collateral");
        AssetVault420 vault = new AssetVault420(vid,address(registry),address(auth),address(accounting),address(this));
        registry.registerVault(vid,address(vault),VaultIds420.VAULT_COLLATERAL,a,b,c,d,0,a,b);
        collateral = new ResourceProviderCollateral420(address(providers),address(vault),address(registry),address(accounting));
        providers.bindCollateral(address(collateral));
        providers.publishCollateralPolicy(1 ether,1 ether,1 days,10000,true,keccak256("test-only policy"));
        if (realRegistry) {
            bytes32[3] memory actions = [VaultIds420.ACTION_CREATE_OBLIGATION,VaultIds420.ACTION_RELEASE_OBLIGATION,VaultIds420.ACTION_CLAIM];
            for (uint256 i; i < actions.length; ++i) {
                CapabilityRegistry420(caps).createGrant(keccak256(abi.encode(vid,actions[i])),address(collateral),VaultIds420.COMPONENT_VAULT,actions[i],auth.scopeForVault(vid),0,0,0,0,0);
            }
        } else {
            ResourceFixtureCaps420(caps).set(address(collateral),VaultIds420.COMPONENT_VAULT,VaultIds420.ACTION_CREATE_OBLIGATION,auth.scopeForVault(vid),true);
            ResourceFixtureCaps420(caps).set(address(collateral),VaultIds420.COMPONENT_VAULT,VaultIds420.ACTION_RELEASE_OBLIGATION,auth.scopeForVault(vid),true);
            ResourceFixtureCaps420(caps).set(address(collateral),VaultIds420.COMPONENT_VAULT,VaultIds420.ACTION_CLAIM,auth.scopeForVault(vid),true);
        }
    }
    function fund(ResourceProviderRegistry420 providers,bytes32 providerId,address owner) internal {
        ResourceProviderCollateral420 collateral = ResourceProviderCollateral420(address(providers.collateral()));
        vm.deal(owner, 1000000 ether);
        vm.prank(owner);
        bytes32 id = collateral.deposit{value:1000000 ether}(providerId,keccak256(abi.encode(providerId)));
        bytes32 meta = providers.getProvider(providerId).metadataHash;
        vm.prank(owner);
        providers.updateProvider(providerId,meta,id);
    }
    function enable(ResourceProviderRegistry420 providers,address controller) internal {
        ResourceProviderCollateral420(address(providers.collateral())).configureReservationController(controller,true);
    }
}
