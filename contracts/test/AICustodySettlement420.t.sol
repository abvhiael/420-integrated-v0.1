// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/ai/AIIds420.sol";
import "../src/ai/AIJobManager.sol";
import "../src/ai/AIJobEscrow.sol";

interface VmAICustody420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function etch(address target, bytes calldata code) external;
}

contract MockAICustodyManager420 {
    uint256 public fundingCalls;
    uint256 public settlementCalls;
    uint256 public refundCalls;

    function confirmFunding(bytes32, bytes32, uint256) external { ++fundingCalls; }
    function confirmSettlement(bytes32) external { ++settlementCalls; }
    function confirmRefund(bytes32) external { ++refundCalls; }
}

contract AICustodySettlement420Test {
    VmAICustody420 constant vm =
        VmAICustody420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant REQUESTER = address(0xA11CE);
    address constant COMPUTE = address(0xC011);
    address constant VAULT = address(0xA017);
    address constant SETTLEMENT = address(0x5E771E);
    address constant BENEFICIARY = address(0xB0B);
    bytes32 constant PROVIDER = keccak256("compute-provider");

    function _create(AIJobManager jobs, bytes32 jobId, uint256 maxSpend) private {
        vm.prank(REQUESTER);
        jobs.createRequest(
            jobId,
            keccak256("model-version"),
            AIIds420.WORKLOAD_TEXT,
            keccak256(abi.encode("request", jobId)),
            keccak256("privacy"),
            keccak256("verification"),
            maxSpend,
            uint64(block.timestamp + 1 days)
        );
    }

    function testCanonicalFundingIsComputeBoundAndCeilingLimited() public {
        AIJobManager jobs = new AIJobManager(address(this));
        jobs.bindComputeAdapter(COMPUTE);
        bytes32 jobId = keccak256("funding");
        _create(jobs, jobId, 100);

        vm.prank(address(0xBAD));
        vm.expectRevert(AIJobManager.NotComputeAdapter.selector);
        jobs.confirmCanonicalFunding(jobId, keccak256("funding-ref"), 80);

        vm.prank(COMPUTE);
        vm.expectRevert(AIJobManager.FundingExceedsMaximum.selector);
        jobs.confirmCanonicalFunding(jobId, keccak256("funding-ref"), 101);

        vm.prank(COMPUTE);
        jobs.confirmCanonicalFunding(jobId, keccak256("funding-ref"), 80);

        vm.prank(COMPUTE);
        vm.expectRevert(AIJobManager.InvalidTransition.selector);
        jobs.confirmCanonicalFunding(jobId, keccak256("funding-ref-2"), 80);

        (,,,,,,,,, uint256 fundedAmount,,,,,,, AIJobManager.Status status) = jobs.jobs(jobId);
        require(fundedAmount == 80, "funded amount drift");
        require(status == AIJobManager.Status.FUNDED, "funding not reconciled");
    }

    function testCanonicalSettlementIsOneTimeAndDisputeHeld() public {
        AIJobManager jobs = new AIJobManager(address(this));
        jobs.bindComputeAdapter(COMPUTE);
        bytes32 jobId = keccak256("settlement");
        _create(jobs, jobId, 100);

        vm.prank(COMPUTE);
        jobs.confirmCanonicalFunding(jobId, keccak256("funding-ref"), 80);
        vm.prank(COMPUTE);
        jobs.matchCompute(jobId, keccak256("request"), keccak256("compute-job"), PROVIDER);
        vm.prank(COMPUTE);
        jobs.acceptCompute(jobId);
        vm.prank(COMPUTE);
        jobs.markRunning(jobId);
        vm.prank(COMPUTE);
        jobs.commitResult(jobId, keccak256("result"), keccak256("manifest"));
        vm.prank(COMPUTE);
        jobs.verifyResult(jobId);

        vm.prank(REQUESTER);
        jobs.openDispute(jobId, keccak256("dispute"));

        vm.prank(COMPUTE);
        vm.expectRevert(AIJobManager.InvalidTransition.selector);
        jobs.confirmCanonicalSettlement(jobId);

        jobs.resolveDispute(jobId, false, keccak256("provider-wins-resolution"));

        vm.prank(COMPUTE);
        jobs.confirmCanonicalSettlement(jobId);
        vm.prank(COMPUTE);
        vm.expectRevert(AIJobManager.InvalidTransition.selector);
        jobs.confirmCanonicalSettlement(jobId);

        (,,,,,,,,,,,,,,,, AIJobManager.Status status) = jobs.jobs(jobId);
        require(status == AIJobManager.Status.SETTLED, "settlement not terminal");
    }

    function testCanonicalRefundIsOneTimeAndCannotRedirectPayer() public {
        AIJobManager jobs = new AIJobManager(address(this));
        jobs.bindComputeAdapter(COMPUTE);
        bytes32 jobId = keccak256("refund");
        _create(jobs, jobId, 100);

        vm.prank(COMPUTE);
        jobs.confirmCanonicalFunding(jobId, keccak256("funding-ref"), 70);
        vm.prank(COMPUTE);
        jobs.confirmCanonicalRefund(jobId);

        vm.prank(COMPUTE);
        vm.expectRevert(AIJobManager.InvalidTransition.selector);
        jobs.confirmCanonicalRefund(jobId);

        (,,,,,,,,,,,,,,,, AIJobManager.Status status) = jobs.jobs(jobId);
        require(status == AIJobManager.Status.REFUNDED, "refund not terminal");
    }

    function testCompatibilityEscrowHasNoCustodyAndFreezesRecipient() public {
        AIJobEscrow escrow = new AIJobEscrow(address(this));
        MockAICustodyManager420 manager = new MockAICustodyManager420();
        vm.etch(escrow.AI_JOB_MANAGER(), address(manager).code);

        escrow.bindVaultAdapter(VAULT);
        escrow.bindSettlementAdapter(SETTLEMENT);

        bytes32 jobId = keccak256("escrow-settlement");
        vm.expectRevert(AIJobEscrow.DirectCustodyDisabled.selector);
        escrow.fund{value: 1}(jobId, PROVIDER);

        vm.prank(VAULT);
        escrow.confirmCanonicalVaultFunding(
            jobId, REQUESTER, keccak256("vault-obligation"), keccak256("funding-ref"), 60
        );

        vm.prank(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.InvalidStateTransition.selector);
        escrow.markClaimable(jobId, keccak256("settlement-ref"));

        vm.prank(SETTLEMENT);
        escrow.bindSettlementBeneficiary(jobId, PROVIDER, BENEFICIARY);
        vm.prank(SETTLEMENT);
        escrow.markClaimable(jobId, keccak256("settlement-ref"));

        vm.prank(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.InvalidRecipient.selector);
        escrow.release(jobId, payable(address(0xBAD)));

        vm.prank(SETTLEMENT);
        escrow.release(jobId, payable(BENEFICIARY));

        vm.prank(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.InvalidStateTransition.selector);
        escrow.release(jobId, payable(BENEFICIARY));
    }

    function testCompatibilityEscrowRefundAlwaysUsesRecordedPayer() public {
        AIJobEscrow escrow = new AIJobEscrow(address(this));
        MockAICustodyManager420 manager = new MockAICustodyManager420();
        vm.etch(escrow.AI_JOB_MANAGER(), address(manager).code);
        escrow.bindVaultAdapter(VAULT);
        escrow.bindSettlementAdapter(SETTLEMENT);

        bytes32 jobId = keccak256("escrow-refund");
        vm.prank(VAULT);
        escrow.confirmCanonicalVaultFunding(
            jobId, REQUESTER, keccak256("vault-obligation"), keccak256("funding-ref"), 55
        );

        vm.prank(SETTLEMENT);
        escrow.markRefundable(jobId, keccak256("refund-ref"));
        vm.prank(SETTLEMENT);
        escrow.refund(jobId);

        (address payer,,,,,,, AIJobEscrow.EscrowState state) = escrow.escrows(jobId);
        require(payer == REQUESTER, "payer changed");
        require(state == AIJobEscrow.EscrowState.CLOSED, "refund not terminal");

        vm.prank(SETTLEMENT);
        vm.expectRevert(AIJobEscrow.InvalidStateTransition.selector);
        escrow.refund(jobId);
    }
}
