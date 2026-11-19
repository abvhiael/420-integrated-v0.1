// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./TreasuryBudgetRegistry420.sol";
import "./TreasuryPolicyRegistry420.sol";
import "./TreasuryDisbursementRegistry420.sol";

contract TreasuryRouter420 is I420System {
    TreasuryBudgetRegistry420 public immutable budgets;
    TreasuryDisbursementRegistry420 public immutable disbursements;

    constructor(
        address b,
        address d
    ) {
        require(b != address(0) && d != address(0), "dependency");
        budgets = TreasuryBudgetRegistry420(b);
        disbursements = TreasuryDisbursementRegistry420(d);
    }

    function systemName() external pure returns (string memory) {
        return "TreasuryRouter420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function remainingBudget(
        bytes32 budgetId
    ) external view returns (uint256) {
        TreasuryBudgetRegistry420.Budget memory b = budgets.budget(budgetId);
        return uint256(b.ceiling) - uint256(b.committed);
    }

    /// @notice Caller-independent eligibility at the current block, not execution authorization.
    /// @dev Missing IDs revert; the executor and nonzero release commitment are checked by markExecuted.
    function isExecutable(
        bytes32 id
    ) external view returns (bool) {
        TreasuryDisbursementRegistry420.Disbursement memory d = disbursements.disbursement(id);
        TreasuryPolicyRegistry420 policy = disbursements.policy();
        if (
            d.state != TreasuryDisbursementRegistry420.State.SCHEDULED || block.timestamp < d.notBefore
                || block.timestamp > d.expiresAt || !budgets.isEffective(d.budgetId)
                || !policy.isAllowed(d.asset, d.amount)
        ) return false;

        TreasuryPolicyRegistry420.AssetPolicy memory p = policy.assetPolicy(d.asset);
        uint256 spent = disbursements.epochSpent(d.asset, block.timestamp / p.epochSeconds);
        // A governance reduction may put current spending above the revised cap.
        return spent <= p.maxEpochDisbursement && d.amount <= uint256(p.maxEpochDisbursement) - spent;
    }
}
