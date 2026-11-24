// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BankrollVault420.sol";
import "./BetGenesisCapitalization420.sol";

/// @notice Read-only, custody-derived profit reconciliation for one canonical bankroll.
/// @dev No distribution, epoch finalization, or authority to move money. All LP equity
/// remains protected until an explicit governed revenue policy defines its entitlement.
contract BetProfitAccounting420 {
    BankrollVault420 public immutable bankroll;
    BetGenesisCapitalization420 public immutable capitalization;
    struct Report {
        address asset;
        uint256 capitalized;
        uint256 deposits;
        uint256 withdrawals;
        uint256 escrow;
        uint256 grossWagers;
        uint256 grossPayouts;
        uint256 refunds;
        uint256 unresolvedReturns;
        int256 gamingResult;
        int256 recordedPnl;
        uint256 assets;
        uint256 custody;
        uint256 liability;
        uint256 pendingWithdrawals;
        uint256 safetyReserve;
        uint256 lpEquity;
        uint256 freeLiquidity;
        bool reconciled;
        uint256 eligibleRevenue;
    }
    error InvalidConfiguration();
    constructor(address vault_, address capital_) {
        if (vault_.code.length == 0 || capital_.code.length == 0) revert InvalidConfiguration();
        bankroll = BankrollVault420(vault_);
        capitalization = BetGenesisCapitalization420(payable(capital_));
        if (address(capitalization.bankroll()) != vault_ || bankroll.asset() != address(0))
            revert InvalidConfiguration();
    }

    function report() external view returns (Report memory r) {
        VaultAccounting420.VaultState memory v = bankroll.accounting().getVault(bankroll.vaultId());
        r.asset = bankroll.asset();
        r.capitalized = capitalization.capitalized();
        r.deposits = bankroll.totalDeposited();
        r.withdrawals = bankroll.totalWithdrawn();
        r.escrow = bankroll.activeWagerStakeEscrow();
        r.grossWagers = bankroll.grossSettledWagers();
        r.grossPayouts = bankroll.grossSettledPayouts();
        r.refunds = bankroll.refundedStakes();
        r.unresolvedReturns = bankroll.unclassifiedEqualReturns();
        if (r.grossWagers >= r.grossPayouts) r.gamingResult = _signed(r.grossWagers-r.grossPayouts);
        else r.gamingResult = -_signed(r.grossPayouts-r.grossWagers);
        r.recordedPnl = v.realizedPnl;
        r.assets = v.totalAssets;
        r.custody = address(bankroll).balance;
        r.liability = v.activeReservedLiability;
        r.pendingWithdrawals = v.pendingWithdrawals;
        r.safetyReserve = v.safetyReserve;
        r.lpEquity = bankroll.accounting().lpEquity(bankroll.vaultId());
        r.freeLiquidity = bankroll.accounting().availableForNewRisk(bankroll.vaultId());
        r.reconciled = v.asset == r.asset && r.capitalized <= r.deposits
            && r.unresolvedReturns == 0 && r.refunds <= r.grossWagers && r.refunds <= r.grossPayouts
            && r.gamingResult == r.recordedPnl && r.custody == r.assets + r.escrow
            && r.assets >= r.liability + r.pendingWithdrawals + r.safetyReserve
            && r.deposits + r.grossWagers == r.withdrawals + r.grossPayouts + r.assets;
        // Gross gaming gain is not protocol revenue: current share redemption owns
        // all net vault equity. No expense/fee/LP policy or finalized epoch is assumed.
        // Fail closed until the subsequent governed waterfall and epoch adapter exist.
        r.eligibleRevenue = 0;
    }

    function _signed(uint256 amount) private pure returns (int256) {
        if (amount > uint256(type(int256).max)) revert InvalidConfiguration();
        return int256(amount);
    }
}
