// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ai/AINativeSplitSettlement420.sol";
import "../src/ai/AINativeVaultFundingAdapter420.sol";
import "./Vault420.t.sol";

/// @notice 6.4.3.6 integration: real manager, escrow, funding adapter and Vault.
/// @dev The production manager and escrow require each other at canonical system addresses.
contract AINativeSplitProtocol420Test is Test {
    bytes32 constant VAULT_ID = keccak256("ai-split-protocol-vault");
    bytes32 constant JOB = keccak256("ai-split-protocol-job");
    bytes32 constant PROVIDER_ID = keccak256("ai-split-protocol-provider");
    bytes32 constant NONCE = keccak256("ai-split-protocol-nonce");
    bytes32 constant DECISION = keccak256("ai-split-protocol-approved-decision");
    address constant PAYER = address(0xBEEF);
    address constant OPERATOR = address(0xCAFE);
    address constant PROVIDER = address(0xD00D);
    uint256 constant TOTAL = 1 ether;
    uint256 constant EARNED = 0.37 ether;

    AIJobManager manager;
    AIJobEscrow escrow;
    AIProviderRegistry providers;
    AINativeVaultFundingAdapter420 funding;
    AINativeSplitSettlement420 settlement;
    MockCapabilityRegistryVault420 caps;
    VaultAuthorization420 auth;
    VaultPolicyRegistry420 policies;
    VaultRegistry420 registry;
    VaultAccounting420 accounting;
    AssetVault420 vault;

    function _grant(address who, bytes32 action) internal {
        caps.setAllowed(who, VaultIds420.COMPONENT_VAULT, action, auth.scopeForVault(VAULT_ID), true);
    }

    function setUp() public {
        AIJobManager managerImplementation = new AIJobManager(address(this));
        vm.etch(address(0x431), address(managerImplementation).code);
        manager = AIJobManager(address(0x431));
        AIJobEscrow escrowImplementation = new AIJobEscrow(address(this));
        vm.etch(address(0x432), address(escrowImplementation).code);
        escrow = AIJobEscrow(payable(address(0x432)));
        providers = new AIProviderRegistry(address(this));
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
        funding = new AINativeVaultFundingAdapter420(address(manager), address(providers),
            address(escrow), payable(address(vault)), VAULT_ID);
        settlement = new AINativeSplitSettlement420(address(this), address(manager), payable(address(escrow)),
            address(funding), payable(address(vault)), VAULT_ID);
        escrow.bindVaultAdapter(address(funding));
        escrow.bindSettlementAdapter(address(settlement));
        _grant(address(funding), VaultIds420.ACTION_CREATE_OBLIGATION);
        _grant(address(settlement), VaultIds420.ACTION_CANCEL_OBLIGATION);
        _grant(address(settlement), VaultIds420.ACTION_CREATE_OBLIGATION);
        _grant(address(settlement), VaultIds420.ACTION_RELEASE_OBLIGATION);
        _grant(address(settlement), VaultIds420.ACTION_CLAIM);
        vm.prank(OPERATOR);
        providers.registerProvider(PROVIDER_ID, OPERATOR, PROVIDER, keccak256("metadata"),
            keccak256("stake"), keccak256("compute"));
        vm.prank(OPERATOR);
        providers.activate(PROVIDER_ID);
        vm.deal(PAYER, TOTAL);
        vm.prank(PAYER);
        manager.createRequest(JOB, keccak256("model"), AIIds420.WORKLOAD_TEXT, keccak256("request"),
            bytes32(0), bytes32(0), TOTAL, uint64(block.timestamp + 1 days));
        vm.prank(PAYER);
        funding.fundNative{value: TOTAL}(JOB, PROVIDER_ID, NONCE);
        manager.bindComputeAdapter(address(this));
        manager.matchCompute(JOB, keccak256("compute-request"), keccak256("compute-job"), PROVIDER_ID);
        manager.acceptCompute(JOB);
        manager.markRunning(JOB);
        manager.commitResult(JOB, keccak256("result"), keccak256("manifest"));
        manager.verifyResult(JOB);
    }

    function _original() internal view returns (bytes32) { return funding.obligationForJob(JOB); }

    function _assertFunded() internal view {
        assertEq(uint256(manager.getJob(JOB).status), uint256(AIJobManager.Status.VERIFIED));
        (,,,,,,,AIJobEscrow.EscrowState state) = escrow.escrows(JOB);
        assertEq(uint256(state), uint256(AIJobEscrow.EscrowState.FUNDED));
        assertEq(uint256(accounting.getObligation(_original()).state), 1);
        assertEq(accounting.openObligationCount(VAULT_ID), 1);
        assertEq(accounting.freeBalance(VAULT_ID, address(0)), 0);
        assertEq(address(vault).balance, TOTAL);
        assertEq(PROVIDER.balance, 0);
        assertEq(settlement.splitJob(JOB) ? uint256(1) : 0, 0);
    }

    function testRealProtocolPaysTwoRecipientsAndClosesManagerAndEscrow() public {
        assertEq(funding.consumedJob(JOB) ? uint256(1) : 0, 1);
        _assertFunded();
        settlement.settleSplit(JOB, DECISION, EARNED);
        assertEq(PROVIDER.balance, EARNED);
        assertEq(PAYER.balance, TOTAL - EARNED);
        assertEq(address(vault).balance, 0);
        assertEq(accounting.openObligationCount(VAULT_ID), 0);
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));
        assertEq(a.recordedBalance, 0);
        assertEq(a.reserved, 0);
        assertEq(a.claimable, 0);
        assertEq(a.released, TOTAL);
        assertEq(uint256(accounting.getObligation(_original()).state), 4);
        assertEq(uint256(manager.getJob(JOB).status), uint256(AIJobManager.Status.SETTLED));
        (,,,,,,,AIJobEscrow.EscrowState state) = escrow.escrows(JOB);
        assertEq(uint256(state), uint256(AIJobEscrow.EscrowState.CLOSED));
        vm.expectRevert(AINativeSplitSettlement420.SplitReplay.selector);
        settlement.settleSplit(JOB, DECISION, EARNED);
    }

    function testRealProtocolUnauthorizedCallerCannotSettle() public {
        vm.prank(PAYER);
        vm.expectRevert(AINativeSplitSettlement420.SplitUnauthorized.selector);
        settlement.settleSplit(JOB, DECISION, EARNED);
        _assertFunded();
    }

    function testRealProtocolClaimPermissionDenialRollsBackManagerEscrowAndFunds() public {
        caps.setAllowed(address(settlement), VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_CLAIM,
            auth.scopeForVault(VAULT_ID), false);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        settlement.settleSplit(JOB, DECISION, EARNED);
        _assertFunded();
        assertEq(PAYER.balance, 0);
    }

    function testRealProtocolCannotSettleWithoutVerifiedResult() public {
        vm.prank(PAYER);
        manager.openDispute(JOB, keccak256("dispute"));
        vm.expectRevert(AINativeSplitSettlement420.SplitInvalidJob.selector);
        settlement.settleSplit(JOB, DECISION, EARNED);
        assertEq(uint256(manager.getJob(JOB).status), uint256(AIJobManager.Status.DISPUTED));
        assertEq(address(vault).balance, TOTAL);
    }
}
