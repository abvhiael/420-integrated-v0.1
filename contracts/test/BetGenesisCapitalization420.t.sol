// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/BetGenesisCapitalization420.sol";
import "../src/system/CapabilityRegistry420.sol";
import {BetAuthorization420} from "../src/bet/BetAuthorization420.sol";
import {BetIds420} from "../src/bet/BetIds420.sol";
import {WithdrawalQueue420} from "../src/bet/WithdrawalQueue420.sol";
import {VaultAccounting420 as BetAccounting} from "../src/bet/VaultAccounting420.sol";

interface VmCapitalization420 {
    function deal(address, uint256) external;
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}
contract BetGenesisCapitalization420Test {
    VmCapitalization420 constant vm = VmCapitalization420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant SOURCE = keccak256("capital-source");
    bytes32 constant BUDGET = keccak256("capital-budget");
    bytes32 constant BANKROLL = keccak256("capital-bankroll");
    bytes32 constant CIVIC = keccak256("capital-civic");
    bytes32 constant AUTH = keccak256("auth");
    bytes32 constant ASSET = keccak256("asset");
    bytes32 constant RELEASE = keccak256("release");
    bytes32 constant ACCOUNTING = keccak256("accounting");
    uint128 constant CAP = 1_000_000 ether;
    CapabilityRegistry420 caps;
    TreasuryAuthorization420 ta;
    TreasuryPolicyRegistry420 policy;
    TreasuryBudgetRegistry420 budgets;
    TreasuryDisbursementRegistry420 disb;
    VaultAuthorization420 va;
    VaultRegistry420 vr;
    VaultAccounting420 custody;
    AssetVault420 source;
    BankrollVault420 bankroll;
    BetAccounting accounting;
    BetAuthorization420 ba;
    BetGenesisCapitalization420 adapter;
    ProtocolRegistry registry;
    uint256 nonce;

    function setUp() public {
        vm.warp(1000);
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY, address(this));
        caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        caps.registerProtocolComponent(BetIds420.COMPONENT_BET, address(this));
        registry = new ProtocolRegistry(address(this));
        ta = new TreasuryAuthorization420(address(caps));
        policy = new TreasuryPolicyRegistry420(address(this));
        budgets = new TreasuryBudgetRegistry420(address(this), address(policy));
        disb = new TreasuryDisbursementRegistry420(address(this), address(ta), address(policy), address(budgets));
        budgets.setController(address(disb));
        TreasuryRouter420 tr = new TreasuryRouter420(address(budgets), address(disb));
        va = new VaultAuthorization420(address(caps));
        VaultPolicyRegistry420 vp = new VaultPolicyRegistry420(address(this));
        vr = new VaultRegistry420(address(va), address(vp));
        custody = new VaultAccounting420(address(vr));
        VaultRouter420 vrouter = new VaultRouter420(address(vr), address(custody), address(va));
        vp.setPolicy(AUTH, VaultIds420.POLICY_AUTHORIZATION, AUTH, bytes32(0), true);
        vp.setPolicy(ASSET, VaultIds420.POLICY_ASSET, ASSET, bytes32(0), true);
        vp.setPolicy(RELEASE, VaultIds420.POLICY_RELEASE, RELEASE, bytes32(0), true);
        vp.setPolicy(ACCOUNTING, VaultIds420.POLICY_ACCOUNTING, ACCOUNTING, bytes32(0), true);
        source = new AssetVault420(SOURCE, address(vr), address(va), address(custody), address(this));
        vr.registerVault(SOURCE,address(source),VaultIds420.VAULT_TREASURY,AUTH,ASSET,RELEASE,ACCOUNTING,bytes32(0),bytes32(0),bytes32(0));
        registry.publishRegisteredService(ServiceIds420.TREASURY,address(tr),CIVIC,1,true,ProtocolRegistry.ComponentType.SERVICE,AUTH,ASSET,RELEASE);
        registry.publishRegisteredService(ServiceIds420.VAULT,address(vrouter),CIVIC,1,true,ProtocolRegistry.ComponentType.SERVICE,AUTH,ASSET,RELEASE);
        ba = new BetAuthorization420(address(caps));
        accounting = new BetAccounting(address(ba));
        WithdrawalQueue420 queue = new WithdrawalQueue420(address(ba));
        bankroll = new BankrollVault420(BANKROLL,address(0),address(ba),address(accounting),address(queue),1 days);
        _grant(address(this),BetIds420.COMPONENT_BET,BetIds420.ACTION_VAULT_REGISTER,ba.scopeForVault(BANKROLL),0);
        accounting.registerVault(BANKROLL,address(0));
        adapter = new BetGenesisCapitalization420(address(registry),address(bankroll),BUDGET,SOURCE);
        _grant(address(bankroll),BetIds420.COMPONENT_BET,BetIds420.ACTION_VAULT_RECORD_DEPOSIT,ba.scopeForVault(BANKROLL),CAP);
        policy.setAssetPolicy(address(0),true,CAP+1,CAP+1,100);
        vm.deal(address(this),CAP+1);
        source.depositNative{value:CAP+1}();
    }

    function _grant(address who,bytes32 component,bytes32 action,bytes32 scope,uint128 amount) private {
        caps.createGrant(keccak256(abi.encode(++nonce)),who,component,action,scope,amount,0,0,0,0);
    }
    function _depositGrant() private {
        _grant(address(adapter),BetIds420.COMPONENT_BET,BetIds420.ACTION_LP_DEPOSIT,ba.scopeForVault(BANKROLL),CAP);
    }
    function _budget(uint128 ceiling,bytes32 category,address asset) private {
        budgets.createBudget(BUDGET,SOURCE,category,asset,ceiling,1000,2000,CIVIC,AUTH);
    }
    function _schedule(uint128 amount,address recipient,bytes32 purpose,uint64 start) private returns(bytes32 id) {
        id = disb.canonicalId(BUDGET,recipient,amount,start,1900,CIVIC,purpose);
        disb.schedule(id,BUDGET,recipient,amount,start,1900,CIVIC,purpose);
    }
    function _releaseGrants(bytes32 id,uint128 amount,address recipient,address asset) private {
        address executor = address(adapter.releaseExecutor());
        _grant(executor,TreasuryIds420.COMPONENT_TREASURY,TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,ta.scopeForDisbursement(id),amount);
        _grant(executor,VaultIds420.COMPONENT_VAULT,VaultIds420.ACTION_WITHDRAW,va.scopeForRoute(SOURCE,asset,recipient,VaultIds420.ACTION_WITHDRAW),amount);
    }
    function _valid(uint128 amount) private returns(bytes32 id) {
        id = _schedule(amount,address(adapter),adapter.PURPOSE(),1000);
        _releaseGrants(id,amount,address(adapter),address(0));
    }
    function _assertUnchanged(bytes32 id) private view {
        require(adapter.capitalized()==0 && address(bankroll).balance==0 && adapter.releaseCommitment(id)==0,"capital changed");
        require(disb.disbursement(id).state==TreasuryDisbursementRegistry420.State.SCHEDULED,"disbursement changed");
        require(custody.freeBalance(SOURCE,address(0))==CAP+1 && budgets.budget(BUDGET).executed==0,"custody changed");
        require(!source.executedOperation(adapter.releaseExecutor().operationId(address(disb),id)),"operation consumed");
    }
    function testAtomicFundingAndReplay() public {
        _budget(CAP,TreasuryIds420.BUDGET_PROTOCOL,address(0)); _depositGrant();
        bytes32 id=_valid(CAP);
        bytes32 commitment=adapter.preview(id);
        uint256 shares=adapter.capitalize(id,commitment);
        require(shares==CAP && adapter.capitalized()==CAP && address(bankroll).balance==CAP,"funding mismatch");
        require(accounting.getVault(BANKROLL).totalAssets==CAP && accounting.getVault(BANKROLL).realizedPnl==0,"accounting mismatch");
        require(bankroll.shareBalance(address(adapter))==CAP && address(adapter).balance==0,"share custody");
        require(custody.freeBalance(SOURCE,address(0))==1 && budgets.budget(BUDGET).executed==CAP,"source mismatch");
        require(disb.disbursement(id).vaultReleaseHash==commitment,"receipt mismatch");
        vm.expectRevert(BetGenesisCapitalization420.Replay.selector); adapter.capitalize(id,commitment);
    }
    function testUnauthorizedCaller() public {
        _budget(CAP,TreasuryIds420.BUDGET_PROTOCOL,address(0)); _depositGrant();
        bytes32 id=_valid(10); bytes32 c=adapter.preview(id);
        vm.prank(address(0xBAD)); vm.expectRevert(BetGenesisCapitalization420.Unauthorized.selector); adapter.capitalize(id,c);
        _assertUnchanged(id);
    }
    function testMissingDepositGrantRollsBackRelease() public {
        _budget(CAP,TreasuryIds420.BUDGET_PROTOCOL,address(0));
        bytes32 id=_valid(10); bytes32 c=adapter.preview(id);
        vm.expectRevert(BankrollVault420.Unauthorized.selector); adapter.capitalize(id,c);
        _assertUnchanged(id);
        _depositGrant(); adapter.capitalize(id,c);
        require(adapter.capitalized()==10,"retry failed");
    }
    function testMissingTreasuryAndVaultGrants() public {
        _budget(CAP,TreasuryIds420.BUDGET_PROTOCOL,address(0)); _depositGrant();
        bytes32 id=_schedule(10,address(adapter),adapter.PURPOSE(),1000); bytes32 c=adapter.preview(id);
        vm.expectRevert(TreasuryReleaseExecutor420.UnauthorizedRelease.selector); adapter.capitalize(id,c);
        _assertUnchanged(id);
    }
    function testWrongCommitment() public {
        _budget(CAP,TreasuryIds420.BUDGET_PROTOCOL,address(0)); _depositGrant(); bytes32 id=_valid(10);
        vm.expectRevert(BetGenesisCapitalization420.InvalidRelease.selector); adapter.capitalize(id,bytes32(uint256(1)));
        _assertUnchanged(id);
    }
    function testExcessiveBudgetRejected() public {
        _budget(CAP+1,TreasuryIds420.BUDGET_PROTOCOL,address(0)); _depositGrant(); bytes32 id=_valid(CAP+1);
        vm.expectRevert(BetGenesisCapitalization420.InvalidRelease.selector); adapter.preview(id);
        _assertUnchanged(id);
    }
    function testWrongPurposeRejected() public {
        _budget(CAP,TreasuryIds420.BUDGET_PROTOCOL,address(0)); bytes32 id=_schedule(10,address(adapter),RELEASE,1000);
        vm.expectRevert(BetGenesisCapitalization420.InvalidRelease.selector); adapter.preview(id);
        _assertUnchanged(id);
    }
    function testWrongCategoryRejected() public {
        _budget(CAP,TreasuryIds420.BUDGET_COMMUNITY,address(0)); bytes32 id=_valid(10);
        vm.expectRevert(BetGenesisCapitalization420.InvalidRelease.selector); adapter.preview(id);
        _assertUnchanged(id);
    }
    function testWrongRecipientRejected() public {
        _budget(CAP,TreasuryIds420.BUDGET_PROTOCOL,address(0)); bytes32 id=_schedule(10,address(0xBAD),adapter.PURPOSE(),1000);
        vm.expectRevert(BetGenesisCapitalization420.InvalidRelease.selector); adapter.preview(id);
        _assertUnchanged(id);
    }
    function testUnsolicitedNativeRejected() public {
        vm.deal(address(this),1);
        (bool ok,)=address(adapter).call{value:1}("");
        require(!ok && adapter.capitalized()==0 && address(adapter).balance==0,"unsolicited funding");
    }
    function testMultipleTranchesConserveCap() public {
        _budget(CAP,TreasuryIds420.BUDGET_PROTOCOL,address(0)); _depositGrant();
        bytes32 a=_valid(CAP-1); adapter.capitalize(a,adapter.preview(a));
        bytes32 b=_valid(1); adapter.capitalize(b,adapter.preview(b));
        require(adapter.capitalized()==CAP && accounting.getVault(BANKROLL).totalAssets==CAP,"cap mismatch");
        require(address(bankroll).balance==CAP && address(adapter).balance==0,"balance mismatch");
    }
}
