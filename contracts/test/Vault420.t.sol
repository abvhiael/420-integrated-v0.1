// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/vault/VaultIds420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultRegistry420.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/AssetVault420.sol";
import "../src/vault/VaultRouter420.sol";

interface VmVault420 { function prank(address) external; function expectRevert(bytes4) external; function deal(address,uint256) external; }

contract MockCapabilityRegistryVault420 is ICapabilityRegistry420 {
    mapping(bytes32=>CapabilityGrant) private _grants;
    mapping(bytes32=>bool) public allowed;
    function setAllowed(address principal,bytes32 componentId,bytes32 capabilityId,bytes32 scopeHash,bool value) external { allowed[keccak256(abi.encode(principal,componentId,capabilityId,scopeHash))]=value; }
    function grant(bytes32 grantId) external view returns(CapabilityGrant memory){return _grants[grantId];}
    function isAuthorized(address principal,bytes32 componentId,bytes32 capabilityId,bytes32 scopeHash,uint256) external view returns(bool){return allowed[keccak256(abi.encode(principal,componentId,capabilityId,scopeHash))];}
}

contract Vault420Test {
    VmVault420 constant vm=VmVault420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE=address(0xA11CE); address constant BOB=address(0xB0B);
    bytes32 constant VAULT_ID=keccak256("vault/alice/1");
    bytes32 constant AUTH_POLICY=keccak256("vault/policy/auth"); bytes32 constant ASSET_POLICY=keccak256("vault/policy/asset"); bytes32 constant RELEASE_POLICY=keccak256("vault/policy/release"); bytes32 constant ACCOUNTING_POLICY=keccak256("vault/policy/accounting");

    struct Suite { MockCapabilityRegistryVault420 caps; VaultAuthorization420 auth; VaultPolicyRegistry420 policies; VaultRegistry420 registry; VaultAccounting420 accounting; AssetVault420 vault; VaultRouter420 router; }

    function _deploy() private returns(Suite memory s){
        s.caps=new MockCapabilityRegistryVault420(); s.auth=new VaultAuthorization420(address(s.caps)); s.policies=new VaultPolicyRegistry420(address(this)); s.registry=new VaultRegistry420(address(s.auth),address(s.policies)); s.accounting=new VaultAccounting420(address(s.registry));
        s.policies.setPolicy(AUTH_POLICY,VaultIds420.POLICY_AUTHORIZATION,keccak256("auth-v1"),bytes32(0),true);
        s.policies.setPolicy(ASSET_POLICY,VaultIds420.POLICY_ASSET,keccak256("asset-v1"),bytes32(0),true);
        s.policies.setPolicy(RELEASE_POLICY,VaultIds420.POLICY_RELEASE,keccak256("release-v1"),bytes32(0),true);
        s.policies.setPolicy(ACCOUNTING_POLICY,VaultIds420.POLICY_ACCOUNTING,keccak256("accounting-v1"),bytes32(0),true);
        s.vault=new AssetVault420(VAULT_ID,address(s.registry),address(s.auth),address(s.accounting));
        vm.prank(ALICE); s.registry.registerVault(VAULT_ID,address(s.vault),VaultIds420.VAULT_PERSONAL,AUTH_POLICY,ASSET_POLICY,RELEASE_POLICY,ACCOUNTING_POLICY,bytes32(0),bytes32(0),bytes32(0));
        s.router=new VaultRouter420(address(s.registry),address(s.accounting),address(s.auth));
    }
    function _allow(Suite memory s,address who,bytes32 actionId) private { s.caps.setAllowed(who,VaultIds420.COMPONENT_VAULT,actionId,s.auth.scopeForVault(VAULT_ID),true); }
    function _deposit(Suite memory s,uint256 amount) private { vm.deal(ALICE,amount); vm.prank(ALICE); s.vault.depositNative{value:amount}(); }

    function testCreatorHasNoImplicitWithdrawalAuthority() public { Suite memory s=_deploy(); _deposit(s,10 ether); vm.prank(ALICE); vm.expectRevert(AssetVault420.Unauthorized.selector); s.vault.withdraw(keccak256("op1"),address(0),ALICE,1 ether); }
    function testAuthorizedWithdrawalUsesFreeBalance() public { Suite memory s=_deploy(); _deposit(s,10 ether); _allow(s,ALICE,VaultIds420.ACTION_WITHDRAW); vm.prank(ALICE); s.vault.withdraw(keccak256("op1"),address(0),ALICE,2 ether); VaultAccounting420.AssetAccounting memory a=s.accounting.getAccounting(VAULT_ID,address(0)); require(a.recordedBalance==8 ether,"balance"); }
    function testObligationProtectsEncumberedBalance() public { Suite memory s=_deploy(); _deposit(s,10 ether); _allow(s,ALICE,VaultIds420.ACTION_CREATE_OBLIGATION); _allow(s,ALICE,VaultIds420.ACTION_WITHDRAW); vm.prank(ALICE); s.vault.createObligation(keccak256("op-ob"),keccak256("ob1"),address(0),BOB,7 ether,keccak256("BENEFICIARY"),bytes32(0)); require(s.accounting.freeBalance(VAULT_ID,address(0))==3 ether,"free"); vm.prank(ALICE); vm.expectRevert(VaultAccounting420.InsufficientFreeBalance.selector); s.vault.withdraw(keccak256("op2"),address(0),ALICE,4 ether); }
    function testReleasedBeneficiaryCanClaimWithoutAdminRedirect() public { Suite memory s=_deploy(); _deposit(s,5 ether); _allow(s,ALICE,VaultIds420.ACTION_CREATE_OBLIGATION); _allow(s,ALICE,VaultIds420.ACTION_RELEASE_OBLIGATION); bytes32 ob=keccak256("ob"); vm.prank(ALICE); s.vault.createObligation(keccak256("create"),ob,address(0),BOB,2 ether,keccak256("BENEFICIARY"),bytes32(0)); vm.prank(ALICE); s.vault.releaseObligation(keccak256("release"),ob); uint256 beforeBal=BOB.balance; vm.prank(BOB); s.vault.claim(keccak256("claim"),ob); require(BOB.balance==beforeBal+2 ether,"claim"); }
    function testOperationReplayRejected() public { Suite memory s=_deploy(); _deposit(s,3 ether); _allow(s,ALICE,VaultIds420.ACTION_WITHDRAW); bytes32 op=keccak256("same"); vm.prank(ALICE); s.vault.withdraw(op,address(0),ALICE,1 ether); vm.prank(ALICE); vm.expectRevert(AssetVault420.Replay.selector); s.vault.withdraw(op,address(0),ALICE,1 ether); }
    function testClosedVaultCannotReactivate() public { Suite memory s=_deploy(); _allow(s,ALICE,VaultIds420.ACTION_BEGIN_WIND_DOWN); _allow(s,ALICE,VaultIds420.ACTION_CLOSE); _allow(s,ALICE,VaultIds420.ACTION_UNFREEZE); vm.prank(ALICE); s.registry.setState(VAULT_ID,VaultRegistry420.VaultState.WINDING_DOWN); vm.prank(ALICE); s.registry.setState(VAULT_ID,VaultRegistry420.VaultState.CLOSED); vm.prank(ALICE); vm.expectRevert(VaultRegistry420.InvalidStateTransition.selector); s.registry.setState(VAULT_ID,VaultRegistry420.VaultState.ACTIVE); }
    function testRouterReadsAccounting() public { Suite memory s=_deploy(); _deposit(s,4 ether); IVault420.AssetAccountingRead memory a=s.router.readAccounting(VAULT_ID,address(0)); require(a.recordedBalance==4 ether&&a.freeBalance==4 ether,"router accounting"); }
}