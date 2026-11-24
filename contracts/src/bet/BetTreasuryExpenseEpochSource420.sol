// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IBetProfitEpochSource420} from "./BetGovernedProfitEpoch420.sol";
import {TreasuryReleaseExecutor420} from "../treasury/TreasuryReleaseExecutor420.sol";
import {TreasuryDisbursementRegistry420} from "../treasury/TreasuryDisbursementRegistry420.sol";
import {ServiceIds420} from "../libraries/ServiceIds420.sol";
import {TreasuryRouter420} from "../treasury/TreasuryRouter420.sol";
import {TreasuryBudgetRegistry420} from "../treasury/TreasuryBudgetRegistry420.sol";

/// @notice Reads operating expenses from a governed casino budget's completed Vault releases.
contract BetTreasuryExpenseEpochSource420 is IBetProfitEpochSource420 {
    error InvalidExpenseBudget();

    address public immutable override asset;
    address public immutable override custody;
    TreasuryReleaseExecutor420 public immutable executor;
    bytes32 public immutable budgetId;
    bytes32 private immutable executorCodeHash;
    bytes32 private immutable registryCodeHash;

    constructor(
        address asset_,
        TreasuryDisbursementRegistry420 disbursements,
        TreasuryReleaseExecutor420 executor_,
        bytes32 budgetId_,
        bytes32 expectedExecutorCodeHash
    ) {
        if (address(disbursements).code.length == 0 || address(executor_).code.length == 0
            || address(executor_).codehash != expectedExecutorCodeHash || budgetId_ == bytes32(0)
            || !_registered(executor_, disbursements)) {
            revert InvalidExpenseBudget();
        }
        TreasuryBudgetRegistry420.Budget memory budget = disbursements.budgets().budget(budgetId_);
        if (budget.asset != asset_) revert InvalidExpenseBudget();
        asset = asset_;
        custody = address(disbursements);
        executor = executor_;
        budgetId = budgetId_;
        executorCodeHash = expectedExecutorCodeHash;
        registryCodeHash = address(disbursements).codehash;
    }

    function profitTotals() external view override returns (Totals memory totals) {
        TreasuryDisbursementRegistry420 disbursements = TreasuryDisbursementRegistry420(custody);
        if (address(executor).codehash != executorCodeHash || custody.codehash != registryCodeHash
            || !_registered(executor, disbursements)) return totals;
        totals.operatingExpenses = executor.paidByBudgetAsset(custody, budgetId, asset);
        // All paid value must be attributable to the pinned release executor. A
        // legacy or alternative release path must be reconciled before closing.
        totals.reconciled = disbursements.budgets().budget(budgetId).executed
            == totals.operatingExpenses;
    }
    function _registered(TreasuryReleaseExecutor420 release, TreasuryDisbursementRegistry420 disbursements)
        private view returns (bool)
    {
        (address router,) = release.registry().resolveActive(ServiceIds420.TREASURY);
        return router.code.length != 0 && address(TreasuryRouter420(router).disbursements()) == address(disbursements);
    }
}
