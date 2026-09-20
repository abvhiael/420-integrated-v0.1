// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ai/AINativePartialSettlementPlan420.sol";

contract AINativePartialSettlementPlan420Test is Test {
    address constant ADAPTER = address(0x4321);
    address constant PAYER = address(0xBEEF);
    address constant PROVIDER = address(0xCAFE);
    bytes32 constant JOB = keccak256("partial-job");
    bytes32 constant FUNDING = keccak256("partial-funding");
    bytes32 constant ORIGINAL = keccak256("partial-original");
    bytes32 constant DECISION = keccak256("partial-decision");

    function makePlan(uint256 amount, uint256 earned, bytes32 decision, bytes32 job)
        internal pure returns (AINativePartialSettlementPlan420.Plan memory)
    {
        return AINativePartialSettlementPlan420.plan(420, ADAPTER, job, FUNDING,
            ORIGINAL, decision, PAYER, PROVIDER, amount, earned);
    }

    function testExactConservationAndDistinctOperations() public pure {
        AINativePartialSettlementPlan420.Plan memory p = makePlan(100, 37, DECISION, JOB);
        assertEq(p.providerAmount, 37);
        assertEq(p.payerAmount, 63);
        assertEq(p.providerAmount + p.payerAmount, 100);
        require(p.providerObligation != ORIGINAL && p.payerObligation != ORIGINAL
            && p.providerObligation != p.payerObligation, "obligation collision");
        bytes32[7] memory ops = [p.cancelOperation, p.providerCreateOperation,
            p.payerCreateOperation, p.providerReleaseOperation, p.payerReleaseOperation,
            p.providerClaimOperation, p.payerClaimOperation];
        for (uint256 i; i < ops.length; ++i) {
            require(ops[i] != bytes32(0), "empty operation");
            for (uint256 j = i + 1; j < ops.length; ++j) require(ops[i] != ops[j], "operation collision");
        }
    }

    function testSameDecisionProducesStableIdsAndChangedDecisionOrJobChangesIds() public pure {
        AINativePartialSettlementPlan420.Plan memory a = makePlan(100, 37, DECISION, JOB);
        AINativePartialSettlementPlan420.Plan memory same = makePlan(100, 37, DECISION, JOB);
        AINativePartialSettlementPlan420.Plan memory differentDecision =
            makePlan(100, 37, keccak256("another-decision"), JOB);
        AINativePartialSettlementPlan420.Plan memory differentJob =
            makePlan(100, 37, DECISION, keccak256("another-job"));
        assertEq(a.settlementRef, same.settlementRef);
        assertEq(a.providerClaimOperation, same.providerClaimOperation);
        require(a.settlementRef != differentDecision.settlementRef
            && a.settlementRef != differentJob.settlementRef, "reused settlement reference");
        require(a.providerObligation != differentDecision.providerObligation
            && a.payerObligation != differentJob.payerObligation, "reused obligation");
    }

    function testRejectsZeroAndFullEarnedAmounts() public {
        vm.expectRevert(AINativePartialSettlementPlan420.InvalidSplit.selector);
        makePlan(100, 0, DECISION, JOB);
        vm.expectRevert(AINativePartialSettlementPlan420.InvalidSplit.selector);
        makePlan(100, 100, DECISION, JOB);
        vm.expectRevert(AINativePartialSettlementPlan420.InvalidSplit.selector);
        makePlan(100, 101, DECISION, JOB);
        vm.expectRevert(AINativePartialSettlementPlan420.InvalidSplit.selector);
        makePlan(1, 1, DECISION, JOB);
    }

    function testRejectsMissingDecisionAndJob() public {
        vm.expectRevert(AINativePartialSettlementPlan420.InvalidSplit.selector);
        makePlan(100, 37, bytes32(0), JOB);
        vm.expectRevert(AINativePartialSettlementPlan420.InvalidSplit.selector);
        makePlan(100, 37, DECISION, bytes32(0));
    }
}
