// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "./AINativeSplitSettlement420.t.sol";
import "./Vault420.t.sol";

/// @notice Real Vault registry/authorization/accounting/asset contract qualification.
/// Manager, escrow, and funding remain mocks; this is NOT full protocol integration.
contract AINativeSplitRealVault420Test is Test {
    bytes32 constant VAULT_ID = keccak256("native-split-real-vault");
    bytes32 constant JOB = keccak256("native-split-real-job");
    bytes32 constant FUNDING = keccak256("native-split-real-funding");
    bytes32 constant PROVIDER_ID = keccak256("native-split-real-provider-id");
    bytes32 constant DECISION = keccak256("native-split-real-decision");
    address constant PAYER = address(0xBEEF);
    address constant PROVIDER = address(0xCAFE);
    uint256 constant TOTAL = 1 ether;
    uint256 constant EARNED = 0.37 ether;

    MockCapabilityRegistryVault420 caps;
    VaultAuthorization420 auth;
    VaultPolicyRegistry420 policies;
    VaultRegistry420 registry;
    VaultAccounting420 accounting;
    AssetVault420 vault;
    RefundManagerMock420 manager;
    SplitEscrowMock420 escrow;
    RefundFundingMock420 funding;
    AINativeSplitSettlement420 adapter;
    bytes32 original;

    function _grant(address who, bytes32 action) internal {
        caps.setAllowed(who, VaultIds420.COMPONENT_VAULT, action, auth.scopeForVault(VAULT_ID), true);
    }

    function setUp() public {
        caps = new MockCapabilityRegistryVault420();
        auth = new VaultAuthorization420(address(caps));
        policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth), address(policies));
        accounting = new VaultAccounting420(address(registry));
        policies.setPolicy(keccak256("split-auth"), VaultIds420.POLICY_AUTHORIZATION, keccak256("auth-v1"), bytes32(0), true);
        policies.setPolicy(keccak256("split-asset"), VaultIds420.POLICY_ASSET, keccak256("asset-v1"), bytes32(0), true);
        policies.setPolicy(keccak256("split-release"), VaultIds420.POLICY_RELEASE, keccak256("release-v1"), bytes32(0), true);
        policies.setPolicy(keccak256("split-accounting"), VaultIds420.POLICY_ACCOUNTING, keccak256("accounting-v1"), bytes32(0), true);
        vault = new AssetVault420(VAULT_ID, address(registry), address(auth), address(accounting), address(this));
        registry.registerVault(VAULT_ID, address(vault), VaultIds420.VAULT_ESCROW,
            keccak256("split-auth"), keccak256("split-asset"), keccak256("split-release"),
            keccak256("split-accounting"), bytes32(0), bytes32(0), bytes32(0));

        manager = new RefundManagerMock420();
        escrow = new SplitEscrowMock420(address(manager));
        funding = new RefundFundingMock420(address(manager), address(escrow), address(vault), VAULT_ID);
        adapter = new AINativeSplitSettlement420(address(this), address(manager), payable(address(escrow)),
            address(funding), payable(address(vault)), VAULT_ID);
        original = keccak256(abi.encode("420AI_NATIVE_OBLIGATION_V1", FUNDING));
        manager.seed(JOB, PAYER, PROVIDER_ID, FUNDING, TOTAL, AIJobManager.Status.VERIFIED);
        escrow.seed(JOB, PAYER, PROVIDER, PROVIDER_ID, VAULT_ID, FUNDING, TOTAL);
        escrow.bind(address(adapter));
        funding.seed(JOB, original);
        vm.deal(address(this), TOTAL);
        vault.depositNative{value: TOTAL}();
        _grant(address(this), VaultIds420.ACTION_CREATE_OBLIGATION);
        vault.createObligation(keccak256("split-original-create"), original, address(0), PROVIDER,
            TOTAL, keccak256("420AI_NATIVE_JOB_V1"), FUNDING);
        _grant(address(adapter), VaultIds420.ACTION_CANCEL_OBLIGATION);
        _grant(address(adapter), VaultIds420.ACTION_CREATE_OBLIGATION);
        _grant(address(adapter), VaultIds420.ACTION_RELEASE_OBLIGATION);
        _grant(address(adapter), VaultIds420.ACTION_CLAIM);
    }

    function _assertPristine() internal view {
        assertEq(uint256(accounting.getObligation(original).state), 1);
        assertEq(accounting.openObligationCount(VAULT_ID), 1);
        assertEq(accounting.freeBalance(VAULT_ID, address(0)), 0);
        assertEq(address(vault).balance, TOTAL);
        assertEq(PROVIDER.balance, 0);
        assertEq(PAYER.balance, 0);
        (,,,,,,,AIJobEscrow.EscrowState state) = escrow.escrows(JOB);
        assertEq(uint256(state), uint256(AIJobEscrow.EscrowState.FUNDED));
        assertEq(adapter.splitJob(JOB) ? uint256(1) : uint256(0), 0);
    }

    function testRealVaultConservesAndClaimsBothLegs() public {
        adapter.settleSplit(JOB, DECISION, EARNED);
        assertEq(PROVIDER.balance, EARNED);
        assertEq(PAYER.balance, TOTAL - EARNED);
        assertEq(address(vault).balance, 0);
        assertEq(accounting.openObligationCount(VAULT_ID), 0);
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));
        assertEq(a.recordedBalance, 0);
        assertEq(a.reserved, 0);
        assertEq(a.claimable, 0);
        assertEq(a.released, TOTAL);
        assertEq(uint256(accounting.getObligation(original).state), 4);
        assertEq(uint256(accounting.getObligation(escrow.providerObligation()).state), 3);
        assertEq(uint256(accounting.getObligation(escrow.payerObligation()).state), 3);
    }

    function testRealVaultSecondRecipientRevertRollsBackBothLegsAndAccounting() public {
        RefundRejectPayee420 reject = new RefundRejectPayee420();
        manager.seed(JOB, address(reject), PROVIDER_ID, FUNDING, TOTAL, AIJobManager.Status.VERIFIED);
        escrow.seed(JOB, address(reject), PROVIDER, PROVIDER_ID, VAULT_ID, FUNDING, TOTAL);
        vm.expectRevert(AssetVault420.TransferFailed.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
        _assertPristine();
    }

    function testRealVaultMissingClaimCapabilityCannotLeakFirstLeg() public {
        caps.setAllowed(address(adapter), VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_CLAIM,
            auth.scopeForVault(VAULT_ID), false);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
        _assertPristine();
    }

    function testRealVaultMissingCreateCapabilityPreservesOriginalReservation() public {
        caps.setAllowed(address(adapter), VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_CREATE_OBLIGATION,
            auth.scopeForVault(VAULT_ID), false);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        adapter.settleSplit(JOB, DECISION, EARNED);
        _assertPristine();
    }
}
