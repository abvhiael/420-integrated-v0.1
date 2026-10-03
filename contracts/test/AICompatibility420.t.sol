// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/ai/AIIds420.sol";
import "../src/ai/AIProviderRegistry.sol";
import "../src/ai/AIModelRegistry.sol";
import "../src/ai/AIJobManager.sol";
import "../src/ai/AIJobEscrow.sol";
import "../src/ai/AIReputationRegistry.sol";

interface VmAICompatibility420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function etch(address target, bytes calldata code) external;
}

contract MockAIJobManagerCompatibility420 {
    uint256 public fundingCalls;
    uint256 public settlementCalls;
    uint256 public refundCalls;

    function confirmFunding(bytes32, bytes32, uint256) external { fundingCalls += 1; }
    function confirmSettlement(bytes32) external { settlementCalls += 1; }
    function confirmRefund(bytes32) external { refundCalls += 1; }
}

contract AICompatibility420Test {
    VmAICompatibility420 constant vm =
        VmAICompatibility420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant ATTACKER = address(0xBAD);
    address constant COMPUTE = address(0xC011);
    address constant VAULT = address(0xA017);
    address constant SETTLEMENT = address(0x5E771E);
    address constant TRUST = address(0x7A057);

    address constant AI_PROVIDER_REGISTRY = address(0x000000000000000000000000000000000000042f);
    address constant AI_MODEL_REGISTRY = address(0x0000000000000000000000000000000000000430);
    address constant AI_JOB_MANAGER = address(0x0000000000000000000000000000000000000431);
    address constant AI_JOB_ESCROW = address(0x0000000000000000000000000000000000000432);
    address constant AI_REPUTATION_REGISTRY = address(0x0000000000000000000000000000000000000433);

    bytes32 constant PROVIDER_ID = keccak256("ai/audit/provider");
    bytes32 constant MODEL_ID = keccak256("ai/audit/model");
    bytes32 constant VERSION_ID = keccak256("ai/audit/model/v1");
    bytes32 constant JOB_ID = keccak256("ai/audit/job");

    bytes4 constant UNAUTHORIZED = bytes4(keccak256("Unauthorized()"));

    function testFrozenPeerAddressesAndDiscoveryNames() public {
        AIProviderRegistry providers = new AIProviderRegistry(address(this));
        AIModelRegistry models = new AIModelRegistry(address(this));
        AIJobManager jobs = new AIJobManager(address(this));
        AIJobEscrow escrow = new AIJobEscrow(address(this));
        AIReputationRegistry reputation = new AIReputationRegistry(address(this));

        require(jobs.AI_JOB_ESCROW() == AI_JOB_ESCROW, "job escrow identity drift");
        require(escrow.AI_JOB_MANAGER() == AI_JOB_MANAGER, "job manager identity drift");

        require(keccak256(bytes(providers.systemName())) == keccak256("AIProviderRegistry"), "provider discovery");
        require(keccak256(bytes(models.systemName())) == keccak256("AIModelRegistry"), "model discovery");
        require(keccak256(bytes(jobs.systemName())) == keccak256("AIJobManager"), "job discovery");
        require(keccak256(bytes(escrow.systemName())) == keccak256("AIJobEscrow"), "escrow discovery");
        require(keccak256(bytes(reputation.systemName())) == keccak256("AIReputationRegistry"), "reputation discovery");

        require(AI_PROVIDER_REGISTRY != AI_MODEL_REGISTRY, "provider/model collision");
        require(AI_REPUTATION_REGISTRY != AI_JOB_ESCROW, "reputation/escrow collision");
    }

    function testAdaptersBindOnceAndOnlyGovernance() public {
        AIJobManager jobs = new AIJobManager(address(this));
        AIJobEscrow escrow = new AIJobEscrow(address(this));
        AIReputationRegistry reputation = new AIReputationRegistry(address(this));

        vm.prank(ATTACKER);
        vm.expectRevert(UNAUTHORIZED);
        jobs.bindComputeAdapter(COMPUTE);
        jobs.bindComputeAdapter(COMPUTE);
        vm.expectRevert(AIJobManager.AdapterAlreadyBound.selector);
        jobs.bindComputeAdapter(BOB);

        vm.prank(ATTACKER);
        vm.expectRevert(UNAUTHORIZED);
        escrow.bindVaultAdapter(VAULT);
        escrow.bindVaultAdapter(VAULT);
        vm.expectRevert(AIJobEscrow.AdapterAlreadyBound.selector);
        escrow.bindVaultAdapter(BOB);

        vm.prank(ATTACKER);
        vm.expectRevert(UNAUTHORIZED);
        escrow.bindSettlementAdapter(SETTLEMENT);
        escrow.bindSettlementAdapter(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.AdapterAlreadyBound.selector);
        escrow.bindSettlementAdapter(BOB);

        vm.prank(ATTACKER);
        vm.expectRevert(UNAUTHORIZED);
        reputation.bindTrustAdapter(TRUST);
        reputation.bindTrustAdapter(TRUST);
        vm.expectRevert(AIReputationRegistry.AdapterAlreadyBound.selector);
        reputation.bindTrustAdapter(BOB);
    }

    function testProviderSuspensionAndRetirementCannotBeBypassed() public {
        AIProviderRegistry providers = new AIProviderRegistry(address(this));

        vm.prank(ALICE);
        providers.registerProvider(
            PROVIDER_ID, ALICE, ALICE, keccak256("meta"), keccak256("stake"), keccak256("compute-provider")
        );
        vm.prank(ALICE);
        providers.activate(PROVIDER_ID);
        require(providers.isOperational(PROVIDER_ID), "provider should be active");

        providers.setActive(PROVIDER_ID, false);
        require(!providers.isOperational(PROVIDER_ID), "suspension should disable provider");

        vm.prank(ALICE);
        vm.expectRevert(AIProviderRegistry.InvalidStateTransition.selector);
        providers.activate(PROVIDER_ID);

        vm.prank(ALICE);
        providers.retire(PROVIDER_ID);

        vm.expectRevert(AIProviderRegistry.InvalidStateTransition.selector);
        providers.setActive(PROVIDER_ID, true);

        vm.prank(ALICE);
        vm.expectRevert(AIProviderRegistry.InvalidStateTransition.selector);
        providers.updateMetadata(PROVIDER_ID, keccak256("mutated-after-retirement"));
    }

    function testModelVersionIdentityAndVersionNumberStayPermanentAfterDeprecation() public {
        AIModelRegistry models = new AIModelRegistry(address(this));

        vm.prank(ALICE);
        models.registerModel(MODEL_ID, keccak256("model-meta"), keccak256("license"));
        vm.prank(ALICE);
        models.registerVersion(
            VERSION_ID,
            MODEL_ID,
            1,
            keccak256("manifest"),
            keccak256("weights"),
            keccak256("runtime"),
            keccak256("compute"),
            keccak256("schema"),
            keccak256("verify"),
            keccak256("license")
        );

        vm.prank(ALICE);
        models.deprecateVersion(VERSION_ID);
        require(!models.isVersionOperational(VERSION_ID), "deprecated version operational");

        vm.prank(ALICE);
        vm.expectRevert(AIModelRegistry.AlreadyExists.selector);
        models.registerVersion(
            VERSION_ID,
            MODEL_ID,
            1,
            keccak256("manifest-2"),
            keccak256("weights-2"),
            keccak256("runtime-2"),
            keccak256("compute-2"),
            keccak256("schema-2"),
            keccak256("verify-2"),
            keccak256("license-2")
        );

        vm.prank(ALICE);
        vm.expectRevert(AIModelRegistry.AlreadyExists.selector);
        models.registerVersion(
            keccak256("different-id-same-version"),
            MODEL_ID,
            1,
            keccak256("manifest-3"),
            keccak256("weights-3"),
            keccak256("runtime-3"),
            keccak256("compute-3"),
            keccak256("schema-3"),
            keccak256("verify-3"),
            keccak256("license-3")
        );
    }

    function testTerminalJobCannotReopenAfterFailureAndRefund() public {
        AIJobManager jobs = new AIJobManager(address(this));
        jobs.bindComputeAdapter(COMPUTE);

        vm.prank(ALICE);
        jobs.createRequest(
            JOB_ID,
            VERSION_ID,
            AIIds420.WORKLOAD_TEXT,
            keccak256("request"),
            keccak256("privacy"),
            keccak256("verify"),
            100,
            uint64(block.timestamp + 1 days)
        );

        vm.prank(AI_JOB_ESCROW);
        jobs.confirmFunding(JOB_ID, keccak256("funding"), 100);
        vm.prank(COMPUTE);
        jobs.matchCompute(JOB_ID, keccak256("compute-request"), keccak256("compute-job"), PROVIDER_ID);
        vm.prank(COMPUTE);
        jobs.acceptCompute(JOB_ID);
        vm.prank(COMPUTE);
        jobs.markRunning(JOB_ID);
        vm.prank(COMPUTE);
        jobs.markFailed(JOB_ID);

        vm.prank(COMPUTE);
        vm.expectRevert(AIJobManager.InvalidTransition.selector);
        jobs.matchCompute(JOB_ID, keccak256("new-request"), keccak256("new-job"), PROVIDER_ID);

        vm.prank(AI_JOB_ESCROW);
        jobs.confirmRefund(JOB_ID);

        vm.prank(COMPUTE);
        vm.expectRevert(AIJobManager.InvalidTransition.selector);
        jobs.matchCompute(JOB_ID, keccak256("reopen-request"), keccak256("reopen-job"), PROVIDER_ID);

        vm.prank(AI_JOB_ESCROW);
        vm.expectRevert(AIJobManager.InvalidTransition.selector);
        jobs.confirmRefund(JOB_ID);
    }

    function testEscrowUsesBoundBeneficiaryAndSettlementIsOneShot() public {
        AIJobEscrow escrow = new AIJobEscrow(address(this));
        MockAIJobManagerCompatibility420 manager = new MockAIJobManagerCompatibility420();
        vm.etch(AI_JOB_MANAGER, address(manager).code);

        escrow.bindVaultAdapter(VAULT);
        escrow.bindSettlementAdapter(SETTLEMENT);

        vm.prank(VAULT);
        escrow.confirmVaultFunding(
            JOB_ID,
            ALICE,
            PROVIDER_ID,
            BOB,
            keccak256("vault-ref"),
            keccak256("funding-ref"),
            50
        );

        vm.prank(SETTLEMENT);
        escrow.markClaimable(JOB_ID, keccak256("settlement-ref"));

        vm.prank(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.InvalidRecipient.selector);
        escrow.release(JOB_ID, payable(ALICE));

        vm.prank(SETTLEMENT);
        escrow.release(JOB_ID, payable(BOB));

        vm.prank(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.InvalidStateTransition.selector);
        escrow.release(JOB_ID, payable(BOB));

        MockAIJobManagerCompatibility420 etched = MockAIJobManagerCompatibility420(AI_JOB_MANAGER);
        require(etched.fundingCalls() == 1, "funding replay");
        require(etched.settlementCalls() == 1, "settlement replay");
    }

    function testRefundAlwaysReturnsToBoundPayerAndIsOneShot() public {
        AIJobEscrow escrow = new AIJobEscrow(address(this));
        MockAIJobManagerCompatibility420 manager = new MockAIJobManagerCompatibility420();
        vm.etch(AI_JOB_MANAGER, address(manager).code);

        escrow.bindVaultAdapter(VAULT);
        escrow.bindSettlementAdapter(SETTLEMENT);

        bytes32 refundJob = keccak256("ai/audit/refund-job");
        vm.prank(VAULT);
        escrow.confirmVaultFunding(
            refundJob,
            ALICE,
            PROVIDER_ID,
            BOB,
            keccak256("vault-ref-refund"),
            keccak256("funding-ref-refund"),
            50
        );

        vm.prank(SETTLEMENT);
        escrow.markRefundable(refundJob, keccak256("refund-settlement-ref"));
        vm.prank(SETTLEMENT);
        escrow.refund(refundJob);

        (address payer,,,,,,, AIJobEscrow.EscrowState state) = escrow.escrows(refundJob);
        require(payer == ALICE, "payer changed");
        require(state == AIJobEscrow.EscrowState.CLOSED, "refund not closed");

        vm.prank(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.InvalidStateTransition.selector);
        escrow.refund(refundJob);

        MockAIJobManagerCompatibility420 etched = MockAIJobManagerCompatibility420(AI_JOB_MANAGER);
        require(etched.refundCalls() == 1, "refund replay");
    }

    function testReputationMutationIsTrustOnlyAndEvidenceCannotReplay() public {
        AIReputationRegistry reputation = new AIReputationRegistry(address(this));
        reputation.bindTrustAdapter(TRUST);

        bytes32 evidenceId = keccak256("ai/audit/evidence");
        vm.prank(ATTACKER);
        vm.expectRevert(AIReputationRegistry.NotTrustAdapter.selector);
        reputation.applyEvidence(PROVIDER_ID, evidenceId, AIIds420.OUTCOME_COMPLETED);

        vm.expectRevert(AIReputationRegistry.InvalidEvidence.selector);
        reputation.setReputation(PROVIDER_ID, 99, 0, 0);

        vm.prank(TRUST);
        reputation.applyEvidence(PROVIDER_ID, evidenceId, AIIds420.OUTCOME_COMPLETED);

        vm.prank(TRUST);
        vm.expectRevert(AIReputationRegistry.EvidenceAlreadyApplied.selector);
        reputation.applyEvidence(PROVIDER_ID, evidenceId, AIIds420.OUTCOME_FAILED);

        (uint64 completed, uint64 disputed, uint64 upheld, uint64 failed) = reputation.reputation(PROVIDER_ID);
        require(completed == 1 && disputed == 0 && upheld == 0 && failed == 0, "evidence counters drift");
    }
}
