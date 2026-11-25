// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./ResourceGenesis420.t.sol";
import "../src/resource/ResourceProviderCollateral420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";

interface VmResourceCollateral420 {
    function prank(address) external;
    function deal(address,uint256) external;
    function warp(uint256) external;
}
contract ResourceProviderCollateral420Test {
    VmResourceCollateral420 constant vm = VmResourceCollateral420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant OWNER = address(0xA11CE);
    address constant OTHER = address(0xB0B);
    bytes32 constant ID = keccak256("resource-provider");
    bytes32 constant VID = keccak256("resource-collateral-vault");
    uint256 nonce;
    MockResourceCaps420 caps;
    VaultAuthorization420 auth;
    VaultRegistry420 registry;
    VaultAccounting420 accounting;
    AssetVault420 vault;
    ResourceProviderRegistry420 providers;
    ResourceProviderCollateral420 collateral;
    function setUp() public {
        caps = new MockResourceCaps420();
        auth = new VaultAuthorization420(address(caps));
        VaultPolicyRegistry420 policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth),address(policies));
        accounting = new VaultAccounting420(address(registry));
        bytes32 a = keccak256("auth"); bytes32 b = keccak256("asset");
        bytes32 c = keccak256("release"); bytes32 d = keccak256("accounting");
        policies.setPolicy(a,VaultIds420.POLICY_AUTHORIZATION,a,0,true);
        policies.setPolicy(b,VaultIds420.POLICY_ASSET,b,0,true);
        policies.setPolicy(c,VaultIds420.POLICY_RELEASE,c,0,true);
        policies.setPolicy(d,VaultIds420.POLICY_ACCOUNTING,d,0,true);
        vault = new AssetVault420(VID,address(registry),address(auth),address(accounting),address(this));
        registry.registerVault(VID,address(vault),VaultIds420.VAULT_COLLATERAL,a,b,c,d,0,a,b);
        providers = new ResourceProviderRegistry420(address(new ResourceAuthorization420(address(caps))),address(this));
        vm.prank(OWNER);
        providers.registerProvider(ID,OWNER,0,0);
        collateral = new ResourceProviderCollateral420(address(providers),address(vault),address(registry),address(accounting));
        providers.bindCollateral(address(collateral));
        providers.publishCollateralPolicy(1 ether,1 ether,1 days,10000,true,keccak256("test policy only"));
        collateral.configureReservationController(address(this),true);
        _grant(address(collateral),VaultIds420.ACTION_CREATE_OBLIGATION,true);
        _grant(address(collateral),VaultIds420.ACTION_RELEASE_OBLIGATION,true);
        _grant(address(collateral),VaultIds420.ACTION_CLAIM,true);
    }
    function _grant(address who,bytes32 action,bool allow) internal {
        caps.set(who,VaultIds420.COMPONENT_VAULT,action,auth.scopeForVault(VID),allow);
    }
    function _deposit(uint256 amount) internal returns(bytes32) {
        bytes32 n = bytes32(++nonce);
        vm.deal(OWNER,amount);
        vm.prank(OWNER);
        return collateral.deposit{value:amount}(ID,n);
    }
    function testNativeDepositAndTopupReconcile() public {
        bytes32 id = _deposit(2 ether);
        require(id == collateral.positionId(ID),"identity");
        require(_deposit(3 ether) == id,"topup identity");
        ResourceProviderCollateral420.Position memory p = collateral.getPosition(id);
        require(p.owner == OWNER && p.providerId == ID && p.deposited == 5 ether && p.slashable == 5 ether,"position");
        require(p.state == ResourceProviderCollateral420.State.BONDED && p.trancheCount == 2,"state");
        require(collateral.trancheObligation(id,1) != collateral.trancheObligation(id,2),"reuse");
        require(collateral.reconciledTranche(id,1) == 2 ether && collateral.reconciledTranche(id,2) == 3 ether,"tranches");
        require(address(vault).balance == 5 ether && collateral.custodyInvariant(),"custody");
    }
    function testForeignDepositorAndMissingGrantRollback() public {
        vm.deal(OTHER,1 ether); vm.prank(OTHER);
        (bool ok,) = address(collateral).call{value:1 ether}(abi.encodeCall(collateral.deposit,(ID,bytes32(uint256(1)))));
        require(!ok,"foreign owner");
        _grant(address(collateral),VaultIds420.ACTION_CREATE_OBLIGATION,false);
        vm.deal(OWNER,1 ether); vm.prank(OWNER);
        (ok,) = address(collateral).call{value:1 ether}(abi.encodeCall(collateral.deposit,(ID,bytes32(uint256(1)))));
        require(!ok && address(vault).balance == 0 && collateral.totalSlashable() == 0,"atomic rollback");
    }
    function testGenericVaultGrantCannotUnlockResourceCollateral() public {
        bytes32 id = _deposit(1 ether);
        bytes32 obligation = collateral.trancheObligation(id,1);
        _grant(OTHER,VaultIds420.ACTION_CANCEL_OBLIGATION,true);
        _grant(OTHER,VaultIds420.ACTION_RELEASE_OBLIGATION,true);
        vm.prank(OTHER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.cancelObligation,(keccak256("cancel"),obligation)));
        require(!ok,"generic cancellation");
        vm.prank(OTHER);
        (ok,) = address(vault).call(abi.encodeCall(vault.releaseObligation,(keccak256("release"),obligation)));
        require(!ok && collateral.reconciledTranche(id,1) == 1 ether,"generic release");
    }
    function testWalletAndDirectVaultBalanceAreNotProviderCollateral() public {
        vm.deal(OWNER,10 ether); vm.prank(OWNER);
        vault.depositNative{value:1 ether}();
        require(collateral.getPosition(collateral.positionId(ID)).slashable == 0,"unpledged funds counted");
        require(collateral.totalSlashable() == 0,"unpledged reserve");
    }
    function testWrongAccountingBindingRejected() public {
        VaultAccounting420 other = new VaultAccounting420(address(registry));
        try new ResourceProviderCollateral420(address(providers),address(vault),address(registry),address(other)) {
            revert("incorrect binding accepted");
        } catch {}
    }
    function _activate(bytes32 id) internal {
        vm.prank(OWNER);
        providers.updateProvider(ID,0,id);
        vm.prank(OWNER);
        providers.setState(ID,ResourceProviderRegistry420.State.ACTIVE);
    }
    function testReplayCannotCountDepositTwice() public {
        bytes32 id = _deposit(2 ether);
        vm.deal(OWNER,2 ether);
        vm.prank(OWNER);
        (bool ok,) = address(collateral).call{value:2 ether}(abi.encodeCall(collateral.deposit,(ID,bytes32(uint256(1)))));
        require(!ok && collateral.getPosition(id).slashable == 2 ether && address(vault).balance == 2 ether,"replayed deposit");
    }
    function testPositionCannotActivateSecondProviderOrAlias() public {
        bytes32 id = _deposit(2 ether);
        _activate(id);
        bytes32 second = keccak256("second");
        vm.prank(OWNER);
        providers.registerProvider(second,OWNER,0,id);
        vm.prank(OWNER);
        (bool ok,) = address(providers).call(abi.encodeCall(providers.setState,(second,ResourceProviderRegistry420.State.ACTIVE)));
        require(!ok && !providers.isActive(second),"cross-provider reuse");
        require(!collateral.eligible(ID,keccak256(abi.encode(id)),OWNER,1 ether),"alias");
    }
    function testComputeObligationCannotReuseReservedFunds() public {
        _deposit(2 ether);
        _grant(OTHER,VaultIds420.ACTION_CREATE_OBLIGATION,true);
        vm.prank(OTHER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.createObligation,(keccak256("op"),keccak256("compute"),address(0),OTHER,2 ether,keccak256("420/CMP/WORKER-COLLATERAL/V1"),ID)));
        require(!ok && collateral.totalSlashable()==2 ether,"cross protocol reuse");
    }
    function testReservationsPreventOverbookingAndWithdrawal() public {
        bytes32 id = _deposit(2 ether);
        _activate(id);
        bytes32 key = collateral.reserveExposure(ID,keccak256("first"),2 ether);
        (bool ok,) = address(collateral).call(abi.encodeCall(collateral.reserveExposure,(ID,keccak256("second"),1)));
        require(!ok,"overbook");
        (ok,) = address(collateral).call(abi.encodeCall(collateral.reserveExposure,(ID,keccak256("first"),0)));
        require(!ok,"reservation replay");
        vm.prank(OWNER);
        collateral.requestExit(id);
        vm.warp(block.timestamp+1 days);
        vm.prank(OWNER);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.withdraw,(id)));
        require(!ok,"reserved withdrawal");
        collateral.releaseExposure(key);
        (ok,) = address(collateral).call(abi.encodeCall(collateral.releaseExposure,(key)));
        require(!ok,"release replay");
        vm.prank(OWNER);
        collateral.withdraw(id);
        require(collateral.getPosition(id).state==ResourceProviderCollateral420.State.WITHDRAWN && collateral.totalSlashable()==0 && address(vault).balance==0,"exit");
    }
}
