// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/treasury/TreasuryVaultBinding420.sol";
import "../src/treasury/TreasuryIds420.sol";

interface VmTreasuryVault {
    function deal(address, uint256) external;
    function prank(address) external;
    function warp(uint256) external;
}

contract RejectTreasuryNative420 {
    receive() external payable { revert("reject"); }
}

contract TreasurySixDecimalToken420 {
    uint8 public constant decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract TreasuryNativeVaultIntegration420Test {
    VmTreasuryVault constant vm = VmTreasuryVault(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant EXECUTOR = address(0xE);
    address constant RECIPIENT = address(0xB0B);
    bytes32 constant VAULT = keccak256("rec3-treasury-vault-instance");
    bytes32 constant OTHER = keccak256("rec3-other-vault-instance");
    bytes32 constant PERSONAL = keccak256("rec3-personal-vault-instance");
    bytes32 constant CIVIC = keccak256("rec3-civic");
    bytes32 constant AUTH = keccak256("rec3-auth");
    bytes32 constant ASSET = keccak256("rec3-asset");
    bytes32 constant RELEASE = keccak256("rec3-release");
    bytes32 constant ACCOUNTING = keccak256("rec3-accounting");

    CapabilityRegistry420 caps;
    ProtocolRegistry registry;
    TreasuryAuthorization420 treasuryAuth;
    TreasuryPolicyRegistry420 policy;
    TreasuryBudgetRegistry420 budgets;
    TreasuryDisbursementRegistry420 disb;
    TreasuryRouter420 router;
    VaultAuthorization420 vaultAuth;
    VaultPolicyRegistry420 vaultPolicies;
    VaultRegistry420 vaultRegistry;
    VaultAccounting420 accounting;
    VaultRouter420 vaultRouter;
    AssetVault420 vault;
    AssetVault420 other;
    TreasurySixDecimalToken420 token;

    function setUp() public {
        vm.warp(1000);
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY, address(this));
        caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        registry = new ProtocolRegistry(address(this));
        treasuryAuth = new TreasuryAuthorization420(address(caps));
        policy = new TreasuryPolicyRegistry420(address(this));
        budgets = new TreasuryBudgetRegistry420(address(this), address(policy));
        disb = new TreasuryDisbursementRegistry420(address(this), address(treasuryAuth), address(policy), address(budgets));
        budgets.setController(address(disb));
        router = new TreasuryRouter420(address(budgets), address(disb));

        vaultAuth = new VaultAuthorization420(address(caps));
        vaultPolicies = new VaultPolicyRegistry420(address(this));
        vaultRegistry = new VaultRegistry420(address(vaultAuth), address(vaultPolicies));
        accounting = new VaultAccounting420(address(vaultRegistry));
        vaultRouter = new VaultRouter420(address(vaultRegistry), address(accounting), address(vaultAuth));
        vaultPolicies.setPolicy(AUTH, VaultIds420.POLICY_AUTHORIZATION, AUTH, bytes32(0), true);
        vaultPolicies.setPolicy(ASSET, VaultIds420.POLICY_ASSET, ASSET, bytes32(0), true);
        vaultPolicies.setPolicy(RELEASE, VaultIds420.POLICY_RELEASE, RELEASE, bytes32(0), true);
        vaultPolicies.setPolicy(ACCOUNTING, VaultIds420.POLICY_ACCOUNTING, ACCOUNTING, bytes32(0), true);
        vault = _register(VAULT, VaultIds420.VAULT_TREASURY);
        other = _register(OTHER, VaultIds420.VAULT_TREASURY);
        _register(PERSONAL, VaultIds420.VAULT_PERSONAL);
        _publish(ServiceIds420.TREASURY, address(router));
        _publish(ServiceIds420.VAULT, address(vaultRouter));
        token = new TreasurySixDecimalToken420();
    }

    function _publish(bytes32 service, address implementation) private {
        registry.publishRegisteredService(
            service, implementation, CIVIC, 1, true, ProtocolRegistry.ComponentType.SERVICE, AUTH, ASSET, RELEASE
        );
    }

    function _register(bytes32 id, bytes32 kind) private returns (AssetVault420 v) {
        v = new AssetVault420(id, address(vaultRegistry), address(vaultAuth), address(accounting), address(this));
        vaultRegistry.registerVault(
            id, address(v), kind, AUTH, ASSET, RELEASE, ACCOUNTING, bytes32(0), bytes32(0), bytes32(0)
        );
    }

    function _budget(bytes32 b, bytes32 vaultId, address asset, uint128 ceiling) private {
        budgets.createBudget(b, vaultId, TreasuryIds420.BUDGET_DEVELOPMENT, asset, ceiling, 1000, 2000, CIVIC, AUTH);
    }

    function _schedule(bytes32 b, address recipient, uint128 amount) private returns (bytes32 id) {
        id = disb.canonicalId(b, recipient, amount, 1000, 1200, CIVIC, RELEASE);
        disb.schedule(id, b, recipient, amount, 1000, 1200, CIVIC, RELEASE);
    }

    function _allow(address asset, uint128 cap) private {
        policy.setAssetPolicy(asset, true, cap, cap, 100);
    }

    function _grant(bytes32 id, bytes32 vaultId, address asset, address recipient, uint128 amount) private {
        caps.createGrant(
            keccak256(abi.encode("treasury", id)), EXECUTOR, TreasuryIds420.COMPONENT_TREASURY,
            TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, treasuryAuth.scopeForDisbursement(id), amount, 0, 0, 0, 0
        );
        caps.createGrant(
            keccak256(abi.encode("vault", id)), EXECUTOR, VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_WITHDRAW,
            vaultAuth.scopeForRoute(vaultId, asset, recipient, VaultIds420.ACTION_WITHDRAW), amount, 0, 0, 0, 0
        );
    }

    function _deposit(AssetVault420 v, uint256 amount) private {
        vm.deal(address(this), amount);
        v.depositNative{value: amount}();
    }

    function _depositToken(AssetVault420 v, uint256 amount) private {
        token.mint(address(this), amount);
        token.approve(address(v), amount);
        v.depositToken(address(token), amount);
    }

    // External view wrapper exists only to assert exact preflight reverts.
    function preview(bytes32 id) external view returns (TreasuryVaultBinding420.ReleaseTarget memory) {
        return TreasuryVaultBinding420.resolveRelease(registry, id);
    }

    function _release(bytes32 id, bytes32 operation) private {
        TreasuryVaultBinding420.ReleaseTarget memory t = TreasuryVaultBinding420.resolveRelease(registry, id);
        vm.prank(EXECUTOR);
        t.vault.withdraw(operation, t.asset, t.recipient, t.amount);
        // Test-only evidence commitment for the successful local release; not a production receipt format.
        bytes32 evidence = keccak256(abi.encode(operation, t.vaultId, t.asset, t.recipient, t.amount));
        vm.prank(EXECUTOR);
        disb.markExecuted(id, evidence);
    }

    function _assertScheduled(bytes32 b, bytes32 id, uint128 amount) private view {
        TreasuryBudgetRegistry420.Budget memory record = budgets.budget(b);
        require(record.committed == amount && record.executed == 0, "budget changed");
        require(disb.disbursement(id).state == TreasuryDisbursementRegistry420.State.SCHEDULED, "state changed");
        require(disb.epochSpent(record.asset, 10) == 0, "epoch changed");
    }

    function testNativeAndTokenDefaultDenyAndGovernanceAllowlist() public {
        require(!policy.isAllowed(address(0), 1), "native implicitly allowed");
        require(!policy.isAllowed(address(token), 1), "token implicitly allowed");
        bytes32 b = keccak256("native");
        (bool ok, bytes memory reason) = address(budgets).call(
            abi.encodeCall(budgets.createBudget, (b, VAULT, TreasuryIds420.BUDGET_DEVELOPMENT, address(0), 10, 1000, 2000, CIVIC, AUTH))
        );
        require(!ok && bytes4(reason) == TreasuryBudgetRegistry420.InvalidBudget.selector, "native default deny");
        vm.prank(EXECUTOR);
        (ok,) = address(policy).call(abi.encodeCall(policy.setAssetPolicy, (address(0), true, 10, 10, 100)));
        require(!ok, "unauthorized native policy");
        _allow(address(0), 10);
        _budget(b, VAULT, address(0), 10);
        require(budgets.budget(b).asset == address(0), "native identifier");
        require(!policy.isAllowed(address(token), 1) && !policy.isAllowed(address(0), 0), "wildcard or zero amount");
        (ok,) = address(budgets).call(
            abi.encodeCall(budgets.createBudget, (keccak256("unapproved"), VAULT, TreasuryIds420.BUDGET_DEVELOPMENT, address(token), 10, 1000, 2000, CIVIC, AUTH))
        );
        require(!ok, "unsupported token budget");
    }

    function testNativeWeiAndTokenBaseUnitsRemainDistinct() public {
        uint128 nativeAmount = 1 ether + 1;
        uint128 tokenAmount = 1_000_001;
        _allow(address(0), nativeAmount);
        _allow(address(token), tokenAmount);
        _deposit(vault, nativeAmount + 1);
        _depositToken(vault, tokenAmount + 1);
        bytes32 b = keccak256("native-budget");
        bytes32 tb = keccak256("token-budget");
        _budget(b, VAULT, address(0), nativeAmount);
        _budget(tb, VAULT, address(token), tokenAmount);
        bytes32 id = _schedule(b, RECIPIENT, nativeAmount);
        bytes32 tid = _schedule(tb, RECIPIENT, tokenAmount);
        _grant(id, VAULT, address(0), RECIPIENT, nativeAmount);
        _grant(tid, VAULT, address(token), RECIPIENT, tokenAmount);
        require(accounting.freeBalance(VAULT, address(0)) == nativeAmount + 1, "budget is not escrow");
        require(accounting.freeBalance(VAULT, address(token)) == tokenAmount + 1, "token budget is not escrow");
        uint256 beforeNative = RECIPIENT.balance;
        _release(id, keccak256("native-op"));
        _release(tid, keccak256("token-op"));
        require(RECIPIENT.balance == beforeNative + nativeAmount, "native precision");
        require(token.balanceOf(RECIPIENT) == tokenAmount && token.decimals() == 6, "token precision");
        require(budgets.budget(b).executed == nativeAmount && budgets.budget(tb).executed == tokenAmount, "execution units");
        require(disb.epochSpent(address(0), 10) == nativeAmount && disb.epochSpent(address(token), 10) == tokenAmount, "asset epoch separation");
        require(accounting.freeBalance(VAULT, address(0)) == 1 && accounting.freeBalance(VAULT, address(token)) == 1, "vault units");
        require(address(router).balance == 0 && address(budgets).balance == 0 && address(disb).balance == 0, "parallel custody");
        require(token.balanceOf(address(router)) == 0 && token.balanceOf(address(budgets)) == 0 && token.balanceOf(address(disb)) == 0, "token custody");
    }

    function testUnderfundedBudgetAndFailedReleasePreserveAccounting() public {
        _allow(address(0), 100);
        _deposit(vault, 40);
        bytes32 b = keccak256("underfunded-budget");
        _budget(b, VAULT, address(0), 100);
        bytes32 id = _schedule(b, RECIPIENT, 60);
        _grant(id, VAULT, address(0), RECIPIENT, 60);
        require(router.isExecutable(id), "Treasury eligibility independent of custody");
        (bool ready, bytes memory reason) = address(this).staticcall(abi.encodeCall(this.preview, (id)));
        require(!ready && bytes4(reason) == TreasuryVaultBinding420.InsufficientVaultFreeBalance.selector, "unfunded preflight");
        bytes32 op = keccak256("failed-op");
        vm.prank(EXECUTOR);
        (bool ok, bytes memory failure) = address(vault).call(
            abi.encodeCall(vault.withdraw, (op, address(0), RECIPIENT, 60))
        );
        require(!ok && bytes4(failure) == VaultAccounting420.InsufficientFreeBalance.selector, "unfunded withdrawal");
        require(accounting.freeBalance(VAULT, address(0)) == 40 && !vault.executedOperation(op), "vault rollback");
        _assertScheduled(b, id, 60);
        _deposit(vault, 20);
        _release(id, op);
        require(budgets.budget(b).executed == 60 && accounting.freeBalance(VAULT, address(0)) == 0, "funded retry");
    }

    function testRejectingRecipientDoesNotSettleOrConsumeOperation() public {
        RejectTreasuryNative420 rejecting = new RejectTreasuryNative420();
        _allow(address(0), 100);
        _deposit(vault, 100);
        bytes32 b = keccak256("reject-budget");
        _budget(b, VAULT, address(0), 100);
        bytes32 id = _schedule(b, address(rejecting), 10);
        _grant(id, VAULT, address(0), address(rejecting), 10);
        require(this.preview(id).recipient == address(rejecting), "recipient binding");
        bytes32 op = keccak256("reject-op");
        vm.prank(EXECUTOR);
        (bool ok, bytes memory reason) = address(vault).call(
            abi.encodeCall(vault.withdraw, (op, address(0), address(rejecting), 10))
        );
        require(!ok && bytes4(reason) == AssetVault420.TransferFailed.selector, "transfer should fail");
        require(!vault.executedOperation(op) && accounting.freeBalance(VAULT, address(0)) == 100, "rollback");
        _assertScheduled(b, id, 10);
    }

    function testWrongVaultAssetAndRecipientFailScopedAuthorization() public {
        _allow(address(0), 100);
        _allow(address(token), 100);
        _deposit(vault, 100);
        _deposit(other, 100);
        _depositToken(vault, 100);
        bytes32 b = keccak256("scoped-budget");
        _budget(b, VAULT, address(0), 100);
        bytes32 id = _schedule(b, RECIPIENT, 10);
        _grant(id, VAULT, address(0), RECIPIENT, 10);
        TreasuryVaultBinding420.ReleaseTarget memory t = this.preview(id);
        require(t.vaultId == VAULT && address(t.vault) == address(vault) && t.asset == address(0) && t.amount == 10, "exact release target");
        bytes32 op = keccak256("scope-op");
        vm.prank(EXECUTOR);
        (bool wrongVault,) = address(other).call(abi.encodeCall(other.withdraw, (op, address(0), RECIPIENT, 10)));
        vm.prank(EXECUTOR);
        (bool wrongAsset,) = address(vault).call(abi.encodeCall(vault.withdraw, (op, address(token), RECIPIENT, 10)));
        vm.prank(EXECUTOR);
        (bool wrongRecipient,) = address(vault).call(abi.encodeCall(vault.withdraw, (op, address(0), address(0xBAD), 10)));
        vm.prank(EXECUTOR);
        (bool excessive,) = address(vault).call(abi.encodeCall(vault.withdraw, (op, address(0), RECIPIENT, 11)));
        require(!wrongVault && !wrongAsset && !wrongRecipient && !excessive, "route substitution");
        require(!vault.executedOperation(op) && !other.executedOperation(op), "operation consumed");
        require(accounting.freeBalance(OTHER, address(0)) == 100 && accounting.freeBalance(VAULT, address(token)) == 100, "wrong domain changed");
        _assertScheduled(b, id, 10);
        _release(id, op);
        require(accounting.freeBalance(VAULT, address(0)) == 90, "correct release");
    }

    function testRejectUnregisteredAndWrongTypeVaultIdentifiers() public {
        _allow(address(0), 100);
        bytes32 b = keccak256("personal-budget");
        _budget(b, PERSONAL, address(0), 100);
        bytes32 id = _schedule(b, RECIPIENT, 10);
        (bool ready, bytes memory reason) = address(this).staticcall(abi.encodeCall(this.preview, (id)));
        require(!ready && bytes4(reason) == TreasuryVaultBinding420.InvalidVaultBinding.selector, "personal vault accepted");
        bytes32 missing = keccak256("unregistered-budget");
        _budget(missing, VaultIds420.VAULT_TREASURY, address(0), 100);
        bytes32 missingId = _schedule(missing, RECIPIENT, 10);
        (ready, reason) = address(this).staticcall(abi.encodeCall(this.preview, (missingId)));
        require(!ready && bytes4(reason) == VaultRegistry420.VaultNotFound.selector, "type treated as instance");
    }

    function testNativePolicyRevocationAndVaultFreezeBlockPreflight() public {
        _allow(address(0), 100);
        _deposit(vault, 100);
        bytes32 b = keccak256("revoked-budget");
        _budget(b, VAULT, address(0), 100);
        bytes32 id = _schedule(b, RECIPIENT, 10);
        _grant(id, VAULT, address(0), RECIPIENT, 10);
        policy.setAssetPolicy(address(0), false, 100, 100, 100);
        require(!router.isExecutable(id), "native revocation");
        (bool ready, bytes memory reason) = address(this).staticcall(abi.encodeCall(this.preview, (id)));
        require(!ready && bytes4(reason) == TreasuryVaultBinding420.IneligibleDisbursement.selector, "revocation preflight");
        _allow(address(0), 100);
        caps.createGrant(keccak256("freeze"), address(this), VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_FREEZE,
            vaultAuth.scopeForVault(VAULT), 0, 0, 0, 0, 0);
        vaultRegistry.setState(VAULT, VaultRegistry420.VaultState.FROZEN);
        (ready, reason) = address(this).staticcall(abi.encodeCall(this.preview, (id)));
        require(!ready && bytes4(reason) == TreasuryVaultBinding420.InvalidVaultBinding.selector, "frozen vault");
        _assertScheduled(b, id, 10);
    }
}
