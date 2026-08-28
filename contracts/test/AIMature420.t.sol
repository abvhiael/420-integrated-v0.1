// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/ai/AIIds420.sol";
import "../src/ai/AIProviderRegistry.sol";
import "../src/ai/AIModelRegistry.sol";
import "../src/ai/AIJobManager.sol";
import "../src/ai/AIJobEscrow.sol";
import "../src/ai/AIReputationRegistry.sol";

interface VmAI420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function etch(address target, bytes calldata code) external;
}

contract MockAIJobManagerEscrow420 {
    function confirmFunding(bytes32, bytes32, uint256) external {}
    function confirmSettlement(bytes32) external {}
    function confirmRefund(bytes32) external {}
}

contract AIMature420Test {
    VmAI420 constant vm = VmAI420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant COMPUTE = address(0xC011);
    address constant VAULT = address(0xA017);
    address constant SETTLEMENT = address(0x5E771E);
    address constant TRUST = address(0x7A057);

    bytes32 constant PROVIDER_ID = keccak256("ai/provider/alice");
    bytes32 constant MODEL_ID = keccak256("ai/model/example");
    bytes32 constant VERSION_ID = keccak256("ai/model/example/v1");
    bytes32 constant JOB_ID = keccak256("ai/job/1");

    function testProviderRegistrationIsSelfAuthorizedAndActivationRequiresStake() public {
        AIProviderRegistry providers = new AIProviderRegistry(address(this));
        vm.prank(BOB);
        vm.expectRevert(AIProviderRegistry.NotOperator.selector);
        providers.registerProvider(PROVIDER_ID, ALICE, ALICE, keccak256("meta"), bytes32(0), bytes32(0));

        vm.prank(ALICE);
        providers.registerProvider(PROVIDER_ID, ALICE, ALICE, keccak256("meta"), bytes32(0), bytes32(0));
        vm.prank(ALICE);
        vm.expectRevert(AIProviderRegistry.MissingStake.selector);
        providers.activate(PROVIDER_ID);

        vm.prank(ALICE);
        providers.updateStakeReference(PROVIDER_ID, keccak256("stake-ref"));
        vm.prank(ALICE);
        providers.activate(PROVIDER_ID);
        require(providers.isOperational(PROVIDER_ID), "provider operational");

        vm.prank(ALICE);
        vm.expectRevert(AIProviderRegistry.ActiveStakeLocked.selector);
        providers.updateStakeReference(PROVIDER_ID, keccak256("stake-ref-2"));
    }

    function testGovernanceSuspensionCannotBeBypassedByProvider() public {
        AIProviderRegistry providers = new AIProviderRegistry(address(this));
        vm.prank(ALICE);
        providers.registerProvider(PROVIDER_ID, ALICE, ALICE, bytes32(0), keccak256("stake"), bytes32(0));
        vm.prank(ALICE);
        providers.activate(PROVIDER_ID);
        providers.setActive(PROVIDER_ID, false);
        vm.prank(ALICE);
        vm.expectRevert(AIProviderRegistry.InvalidStateTransition.selector);
        providers.activate(PROVIDER_ID);
        require(!providers.isOperational(PROVIDER_ID), "suspended");
        providers.setActive(PROVIDER_ID, true);
        require(providers.isOperational(PROVIDER_ID), "reactivated");
    }

    function testModelVersionIdentityIsImmutableAndCreatorScoped() public {
        AIModelRegistry models = new AIModelRegistry(address(this));
        vm.prank(ALICE);
        models.registerModel(MODEL_ID, keccak256("family-meta"), keccak256("license"));
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
        vm.expectRevert(AIModelRegistry.AlreadyExists.selector);
        models.registerVersion(
            VERSION_ID,
            MODEL_ID,
            1,
            keccak256("manifest-2"),
            keccak256("weights-2"),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0)
        );
        require(models.isVersionOperational(VERSION_ID), "version operational");
    }

    function testJobLifecycleDefaultsToCreatedAndComputeAuthorityIsNarrow() public {
        AIJobManager jobs = new AIJobManager(address(this));
        jobs.bindComputeAdapter(COMPUTE);
        vm.prank(ALICE);
        jobs.createRequest(
            JOB_ID,
            VERSION_ID,
            AIIds420.WORKLOAD_TEXT,
            keccak256("input"),
            keccak256("privacy"),
            keccak256("verify"),
            100,
            uint64(block.timestamp + 1 hours)
        );
        (,,,,,,,,,,,,,,,, AIJobManager.Status status) = jobs.jobs(JOB_ID);
        require(status == AIJobManager.Status.CREATED, "created not funded");

        vm.prank(COMPUTE);
        vm.expectRevert(AIJobManager.InvalidTransition.selector);
        jobs.matchCompute(JOB_ID, keccak256("request"), keccak256("compute-job"), PROVIDER_ID);

        vm.prank(address(0x0000000000000000000000000000000000000432));
        jobs.confirmFunding(JOB_ID, keccak256("funding"), 100);
        vm.prank(COMPUTE);
        jobs.matchCompute(JOB_ID, keccak256("request"), keccak256("compute-job"), PROVIDER_ID);
        vm.prank(COMPUTE);
        jobs.acceptCompute(JOB_ID);
        vm.prank(COMPUTE);
        jobs.markRunning(JOB_ID);
        vm.prank(COMPUTE);
        jobs.commitResult(JOB_ID, keccak256("output"), keccak256("result-manifest"));
        vm.prank(COMPUTE);
        jobs.verifyResult(JOB_ID);
        (,,,,,,,,,,,,,,,, status) = jobs.jobs(JOB_ID);
        require(status == AIJobManager.Status.VERIFIED, "verified");
    }

    function testEscrowRejectsCustodyAndCannotRedirectBeneficiary() public {
        AIJobEscrow escrow = new AIJobEscrow(address(this));
        MockAIJobManagerEscrow420 manager = new MockAIJobManagerEscrow420();
        vm.etch(escrow.AI_JOB_MANAGER(), address(manager).code);

        escrow.bindVaultAdapter(VAULT);
        escrow.bindSettlementAdapter(SETTLEMENT);

        vm.expectRevert(AIJobEscrow.DirectCustodyDisabled.selector);
        escrow.fund{value: 1}(JOB_ID, PROVIDER_ID);

        vm.prank(VAULT);
        escrow.confirmVaultFunding(JOB_ID, ALICE, PROVIDER_ID, BOB, keccak256("vault"), keccak256("funding"), 50);
        vm.prank(SETTLEMENT);
        escrow.markClaimable(JOB_ID, keccak256("settlement"));
        vm.prank(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.InvalidRecipient.selector);
        escrow.release(JOB_ID, payable(ALICE));
        vm.prank(SETTLEMENT);
        escrow.release(JOB_ID, payable(BOB));
        (,,,,,,, AIJobEscrow.EscrowState state) = escrow.escrows(JOB_ID);
        require(state == AIJobEscrow.EscrowState.CLOSED, "closed");
    }

    function testReputationIsAppendOnlyEvidenceNotGovernanceEditable() public {
        AIReputationRegistry reputation = new AIReputationRegistry(address(this));
        reputation.bindTrustAdapter(TRUST);
        vm.expectRevert(AIReputationRegistry.InvalidEvidence.selector);
        reputation.setReputation(PROVIDER_ID, 100, 0, 0);

        bytes32 evidenceId = keccak256("evidence-1");
        vm.prank(TRUST);
        reputation.applyEvidence(PROVIDER_ID, evidenceId, AIIds420.OUTCOME_COMPLETED);
        vm.prank(TRUST);
        vm.expectRevert(AIReputationRegistry.EvidenceAlreadyApplied.selector);
        reputation.applyEvidence(PROVIDER_ID, evidenceId, AIIds420.OUTCOME_COMPLETED);
        (uint64 completed,,,) = reputation.reputation(PROVIDER_ID);
        require(completed == 1, "append only");
    }
}
