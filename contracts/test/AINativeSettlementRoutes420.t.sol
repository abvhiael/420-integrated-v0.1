// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./AINativeSplitProtocol420.t.sol";

/// @notice 6.4.3.8: all three inherited routes execute through the SAME escrow-bound
/// adapter with the real manager, escrow, funding adapter, Vault and accounting.
/// These local EVM tests do not qualify an actual deployment or off-chain decision.
contract AINativeSettlementRoutes420Test is AINativeSplitProtocol420Test {
    function _assertTerminal(uint256 providerPaid, uint256 payerPaid) internal view {
        assertEq(PROVIDER.balance, providerPaid);
        assertEq(PAYER.balance, payerPaid);
        assertEq(providerPaid + payerPaid, TOTAL);
        assertEq(address(vault).balance, 0);
        assertEq(accounting.openObligationCount(VAULT_ID), 0);
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));
        assertEq(a.recordedBalance, 0);
        assertEq(a.reserved, 0);
        assertEq(a.claimable, 0);
        assertEq(a.released, TOTAL);
        (,,,,,,,AIJobEscrow.EscrowState state) = escrow.escrows(JOB);
        assertEq(uint256(state), uint256(AIJobEscrow.EscrowState.CLOSED));
    }

    function testFullProviderThenCompetingRefundAndSplitCannotPay() public {
        settlement.payProvider(JOB, DECISION);
        assertEq(uint256(manager.getJob(JOB).status), uint256(AIJobManager.Status.SETTLED));
        assertEq(uint256(accounting.getObligation(_original()).state), 3);
        _assertTerminal(TOTAL, 0);
        vm.expectRevert(AINativeSplitSettlement420.RefundInvalidJob.selector);
        settlement.refundPayer(JOB, keccak256("different-refund"));
        vm.expectRevert(AINativeSplitSettlement420.SplitInvalidJob.selector);
        settlement.settleSplit(JOB, keccak256("different-split"), EARNED);
        _assertTerminal(TOTAL, 0);
    }

    function testSplitThenCompetingFullProviderAndRefundCannotPay() public {
        settlement.settleSplit(JOB, DECISION, EARNED);
        assertEq(uint256(manager.getJob(JOB).status), uint256(AIJobManager.Status.SETTLED));
        assertEq(uint256(accounting.getObligation(_original()).state), 4);
        _assertTerminal(EARNED, TOTAL - EARNED);
        vm.expectRevert(AINativeSplitSettlement420.InvalidSettlement.selector);
        settlement.payProvider(JOB, keccak256("different-provider"));
        vm.expectRevert(AINativeSplitSettlement420.RefundInvalidJob.selector);
        settlement.refundPayer(JOB, keccak256("different-refund"));
        _assertTerminal(EARNED, TOTAL - EARNED);
    }

    function testVerifiedJobCannotRefundBeforeSettlement() public {
        vm.expectRevert(AINativeSplitSettlement420.RefundInvalidJob.selector);
        settlement.refundPayer(JOB, DECISION);
        _assertFunded();
    }

    function testFuzzSplitConservesFundsAndBlocksOtherRoutes(uint256 earned) public {
        vm.assume(earned > 0 && earned < TOTAL);
        settlement.settleSplit(JOB, DECISION, earned);
        _assertTerminal(earned, TOTAL - earned);
        vm.expectRevert(AINativeSplitSettlement420.InvalidSettlement.selector);
        settlement.payProvider(JOB, DECISION);
        vm.expectRevert(AINativeSplitSettlement420.RefundInvalidJob.selector);
        settlement.refundPayer(JOB, DECISION);
        _assertTerminal(earned, TOTAL - earned);
    }

    function testInvalidSplitBoundariesLeaveOriginalReserved() public {
        vm.expectRevert(AINativeSplitSettlement420.SplitInvalidJob.selector);
        settlement.settleSplit(bytes32(0), DECISION, EARNED);
        vm.expectRevert();
        settlement.settleSplit(JOB, DECISION, 0);
        vm.expectRevert();
        settlement.settleSplit(JOB, DECISION, TOTAL);
        vm.expectRevert();
        settlement.settleSplit(JOB, DECISION, TOTAL + 1);
        _assertFunded();
        assertEq(PAYER.balance, 0);
    }
}
