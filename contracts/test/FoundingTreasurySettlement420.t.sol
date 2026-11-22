// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

// Production Solidity dependencies, never mocked releases or ledger updates.
// Only the caller identity, unrelated Civic readiness and test funding are fixtures.
import "../src/treasury/FoundingTreasuryAuthority420.sol";
import "../src/governance/FoundingWalletClaims420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/apps/ProtocolRegistry.sol";
import "../src/vault/VaultAccounting420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";

interface VmFoundingSettlement420 {
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function deal(address recipient, uint256 amount) external;
}

contract FoundingSettlementCivic420 is IFoundingCivicStatus420, IFoundingRetirementReadiness420 {
    function civicAuthorityActivated() external pure returns (bool) { return false; }
    function retirementReady() external pure returns (bool) { return false; }
}

contract FoundingTreasurySettlement420Test {
    VmFoundingSettlement420 private constant vm =
        VmFoundingSettlement420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ADMIN = address(0xA11CE);
    address private constant ANDREW = address(0xA22);
    address private constant JANET = address(0xA33);
    address private constant PAYEE = address(0xBEEF);

    bytes32 private constant OPS = keccak256("gov-pre-03-ops");
    bytes32 private constant CONT = keccak256("gov-pre-03-contingency");
    bytes32 private constant AUTH = keccak256("gov-pre-03-auth-policy");
    bytes32 private constant ASSET = keccak256("gov-pre-03-asset-policy");
    bytes32 private constant RELEASE = keccak256("gov-pre-03-release-policy");
    bytes32 private constant ACCOUNTING = keccak256("gov-pre-03-accounting-policy");
    bytes32 private constant SERVICE = keccak256("gov-pre-03-service");

    CapabilityRegistry420 private caps;
    ProtocolRegistry private registry;
    TreasuryAuthorization420 private tAuth;
    TreasuryPolicyRegistry420 private policy;
    TreasuryBudgetRegistry420 private budgets;
    TreasuryDisbursementRegistry420 private disb;
    TreasuryRouter420 private treasuryRouter;
    VaultAuthorization420 private vAuth;
    VaultPolicyRegistry420 private vPolicy;
    VaultRegistry420 private vRegistry;
    VaultAccounting420 private accounting;
    VaultRouter420 private vaultRouter;
    AssetVault420 private opsVault;
    AssetVault420 private contingencyVault;
    FoundingTreasuryAuthority420 private founder;
    TreasuryReleaseExecutor420 private executor;

    function setUp() public {
        vm.warp(1_000_000);
        FoundingSettlementCivic420 civic = new FoundingSettlementCivic420();
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY, address(this));
        caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        registry = new ProtocolRegistry(address(this));
        tAuth = new TreasuryAuthorization420(address(caps));
        policy = new TreasuryPolicyRegistry420(address(civic));
        budgets = new TreasuryBudgetRegistry420(address(civic), address(policy));
        disb = new TreasuryDisbursementRegistry420(
            address(civic), address(tAuth), address(policy), address(budgets)
        );
        vm.prank(address(civic));
        budgets.setController(address(disb));
        treasuryRouter = new TreasuryRouter420(address(budgets), address(disb));

        vAuth = new VaultAuthorization420(address(caps));
        vPolicy = new VaultPolicyRegistry420(address(this));
        vRegistry = new VaultRegistry420(address(vAuth), address(vPolicy));
        accounting = new VaultAccounting420(address(vRegistry));
        vaultRouter = new VaultRouter420(address(vRegistry), address(accounting), address(vAuth));
        vPolicy.setPolicy(AUTH, VaultIds420.POLICY_AUTHORIZATION, AUTH, bytes32(0), true);
        vPolicy.setPolicy(ASSET, VaultIds420.POLICY_ASSET, ASSET, bytes32(0), true);
        vPolicy.setPolicy(RELEASE, VaultIds420.POLICY_RELEASE, RELEASE, bytes32(0), true);
        vPolicy.setPolicy(ACCOUNTING, VaultIds420.POLICY_ACCOUNTING, ACCOUNTING, bytes32(0), true);
        opsVault = _register(OPS);
        contingencyVault = _register(CONT);
        registry.publishRegisteredService(
            ServiceIds420.TREASURY, address(treasuryRouter), SERVICE, 1, true,
            ProtocolRegistry.ComponentType.SERVICE, AUTH, ASSET, RELEASE
        );
        registry.publishRegisteredService(
            ServiceIds420.VAULT, address(vaultRouter), SERVICE, 1, true,
            ProtocolRegistry.ComponentType.SERVICE, AUTH, ASSET, RELEASE
        );

        FoundingWalletClaims420 claims = new FoundingWalletClaims420(
            ADMIN, ANDREW, JANET, keccak256("gov-pre-03-approved-genesis-fixture")
        );
        vm.prank(ADMIN); claims.claimFounderWallet();
        vm.prank(ANDREW); claims.claimFounderWallet();
        vm.prank(JANET); claims.claimFounderWallet();
        founder = new FoundingTreasuryAuthority420(
            ADMIN, ANDREW, JANET, address(claims), address(civic), address(civic),
            address(budgets), address(disb), address(policy), address(vRegistry), OPS, CONT
        );
        budgets.bindFoundingAuthority(address(founder));
        disb.bindFoundingAuthority(address(founder));
        policy.bindFoundingAuthority(address(founder));
        vm.prank(ADMIN); founder.initializeNativePolicy();
        vm.prank(ADMIN); founder.initializeBudgets();

        executor = new TreasuryReleaseExecutor420(address(registry), address(founder));
        founder.bindReleaseExecutor(address(executor), address(executor).codehash);
    }

    function _register(bytes32 vaultId) private returns (AssetVault420 result) {
        result = new AssetVault420(
            vaultId, address(vRegistry), address(vAuth), address(accounting), address(this)
        );
        vRegistry.registerVault(vaultId, address(result), VaultIds420.VAULT_TREASURY,
            AUTH, ASSET, RELEASE, ACCOUNTING, bytes32(0), bytes32(0), bytes32(0));
    }

    function _scheduleNative(uint128 amount, address recipient) private returns (bytes32 paymentId, bytes32 id) {
        vm.prank(ADMIN);
        paymentId = founder.proposePayment(false, recipient, amount,
            FoundingTreasuryAuthority420.Purpose.BOUNTY, keccak256(abi.encode("proof", recipient, amount)),
            uint64(block.timestamp), uint64(block.timestamp + 10 days)
        );
        vm.prank(ADMIN);
        id = founder.schedulePayment(paymentId);
    }

    function _grantTreasury(bytes32 id, uint128 amount) private {
        caps.createGrant(
            keccak256(abi.encode("treasury", id)), address(executor),
            TreasuryIds420.COMPONENT_TREASURY, TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
            tAuth.scopeForDisbursement(id), amount, 0, 0, 0, 0
        );
    }

    function _grantVault(bytes32 id, address recipient, uint128 amount) private {
        caps.createGrant(
            keccak256(abi.encode("vault", id)), address(executor),
            VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_WITHDRAW,
            vAuth.scopeForRoute(OPS, address(0), recipient, VaultIds420.ACTION_WITHDRAW),
            amount, 0, 0, 0, 0
        );
    }

    function testNativeOperationsReleaseSettlesExactlyOnceWithTwoIndependentCapabilities() public {
        vm.deal(address(this), 20 ether);
        opsVault.depositNative{value: 20 ether}();
        (bytes32 paymentId, bytes32 id) = _scheduleNative(uint128(5 ether), PAYEE);
        (, bytes32 reviewedCommitment) = executor.preview(id);
        uint256 beforePayee = PAYEE.balance;
        uint256 beforeVault = address(opsVault).balance;
        TreasuryBudgetRegistry420.Budget memory beforeBudget = budgets.budget(founder.operationsBudgetId());
        require(beforeBudget.committed == 5 ether && beforeBudget.executed == 0,
                "genuine Treasury budget reservation required");

        vm.prank(address(executor));
        (bool forged,) = address(disb).call(
            abi.encodeCall(disb.markExecuted, (id, keccak256("fake-ledger-receipt")))
        );
        require(!forged, "capability-free fake founding settlement accepted");

        vm.prank(ADMIN);
        (bool noGrants,) = address(founder).call(abi.encodeCall(
            founder.executeApprovedRelease, (paymentId, address(executor), reviewedCommitment)
        ));
        require(!noGrants, "absent Treasury and Vault grants enabled withdrawal");

        _grantTreasury(id, uint128(5 ether));
        vm.prank(ADMIN);
        (bool noRoute,) = address(founder).call(abi.encodeCall(
            founder.executeApprovedRelease, (paymentId, address(executor), reviewedCommitment)
        ));
        require(!noRoute, "Treasury-only grant enabled arbitrary Vault withdrawal");

        _grantVault(id, PAYEE, uint128(5 ether));
        vm.prank(ANDREW);
        (bool nonAdmin,) = address(founder).call(abi.encodeCall(
            founder.executeApprovedRelease, (paymentId, address(executor), reviewedCommitment)
        ));
        require(!nonAdmin, "non-admin released routine payment");
        vm.prank(ADMIN);
        (bool badReview,) = address(founder).call(abi.encodeCall(
            founder.executeApprovedRelease, (paymentId, address(executor), keccak256("wrong-review"))
        ));
        require(!badReview, "unreviewed commitment was executed");
        require(PAYEE.balance == beforePayee && address(opsVault).balance == beforeVault,
                "failed attempt moved native funds");
        require(budgets.budget(founder.operationsBudgetId()).executed == 0,
                "failed attempt changed settled amount");
        require(disb.disbursement(id).state == TreasuryDisbursementRegistry420.State.SCHEDULED,
                "failed attempt consumed Treasury disbursement");

        vm.prank(ADMIN);
        bytes32 settled = founder.executeApprovedRelease(paymentId, address(executor), reviewedCommitment);
        require(settled == reviewedCommitment, "reviewed commitment mismatch");
        require(PAYEE.balance == beforePayee + 5 ether && address(opsVault).balance == beforeVault - 5 ether,
                "exact native delivery failed");
        require(disb.disbursement(id).state == TreasuryDisbursementRegistry420.State.EXECUTED,
                "real disbursement not settled");
        require(disb.disbursement(id).vaultReleaseHash == settled,
                "immutable reviewed settlement commitment not retained");
        require(budgets.budget(founder.operationsBudgetId()).executed == 5 ether,
                "Treasury settled accounting not updated");
        require(accounting.getAccounting(OPS, address(0)).released == 5 ether,
                "Vault released accounting not updated");
        require(opsVault.executedOperation(executor.operationId(address(disb), id)),
                "exact vault operation ID not consumed");
        require(founder.rollingReleased(false) == 5 ether, "founder rolling release missing");
        require(!founder.isActiveFoundingRelease(id, address(executor)),
                "founding active release flag retained after execution");

        vm.prank(ADMIN);
        (bool replay,) = address(founder).call(abi.encodeCall(
            founder.executeApprovedRelease, (paymentId, address(executor), reviewedCommitment)
        ));
        require(!replay, "exact founding payment executed twice");
        vm.prank(address(executor));
        (bool forgedAfter,) = address(disb).call(
            abi.encodeCall(disb.markExecuted, (id, reviewedCommitment))
        );
        require(!forgedAfter, "replayed vault execution forged after successful release");
        require(PAYEE.balance == beforePayee + 5 ether && founder.operationsReleased() == 5 ether,
                "replay modified immutable native settlement totals");
    }

    function testExecutorBindingIsOneShotCodeHashPinnedAndNotChosenByFounder() public {
        TreasuryReleaseExecutor420 alternate =
            new TreasuryReleaseExecutor420(address(registry), address(founder));
        vm.prank(ADMIN);
        (bool adminSwap,) = address(founder).call(abi.encodeCall(
            founder.bindReleaseExecutor, (address(alternate), address(alternate).codehash)
        ));
        require(!adminSwap, "founder replaced approved executor");
        (bool redeploy,) = address(founder).call(abi.encodeCall(
            founder.bindReleaseExecutor, (address(alternate), address(alternate).codehash)
        ));
        require(!redeploy, "approved executor replaced by original deployer");
        require(founder.foundingReleaseExecutor() == address(executor), "pinned release executor changed");
    }

    function testExpiredScheduledNativeDisbursementCannotWithdrawVaultAssets() public {
        vm.deal(address(this), 20 ether);
        opsVault.depositNative{value: 20 ether}();
        (bytes32 paymentId, bytes32 id) = _scheduleNative(uint128(3 ether), PAYEE);
        _grantTreasury(id, uint128(3 ether));
        _grantVault(id, PAYEE, uint128(3 ether));
        vm.warp(block.timestamp + 11 days);
        vm.prank(ADMIN);
        (bool late,) = address(founder).call(abi.encodeCall(
            founder.executeApprovedRelease, (paymentId, address(executor), keccak256("late"))
        ));
        require(!late && PAYEE.balance == 0, "expired release moved funds");
        require(disb.disbursement(id).state == TreasuryDisbursementRegistry420.State.SCHEDULED,
                "expired release forged settlement state");
    }
}
