// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetProfitAccounting420.sol";
import "./BetEconomics420.sol";

/// @notice Immutable, asset-specific source inventory. Accounting only; no custody or payout authority.
/// @dev The deployer must supply the governed canonical source inventory. Unlisted sources
/// are not represented and no report authorizes revenue distribution.
contract BetCasinoProfitAccounting420 {
    address public immutable asset;
    BetProfitAccounting420[] private vaults;
    BetEconomics420[] private economics;
    bytes32 public immutable inventoryHash;
    error InvalidInventory();
    struct Report {
        uint256 capitalized;
        uint256 deposits;
        uint256 withdrawals;
        uint256 escrow;
        uint256 wagers;
        uint256 payouts;
        uint256 refunds;
        uint256 unresolvedReturns;
        int256 gamingResult;
        uint256 assets;
        uint256 liabilities;
        uint256 pendingWithdrawals;
        uint256 reserves;
        uint256 lpEquity;
        uint256 genesisEquity;
        uint256 otherLpEquity;
        uint256 feeFunding;
        uint256 protocolFees;
        uint256 operatorFees;
        uint256 feePaid;
        uint256 feeObligations;
        uint256 feeReserved;
        uint256 feeAvailable;
        uint256 rewardFunding;
        uint256 promotionFunding;
        uint256 paidExpenses;
        uint256 outstandingExpenses;
        uint256 uncommittedExpenseFunding;
        uint256 economicsCustody;
        bool reconciled;
        uint256 eligibleRevenue;
    }
    constructor(address asset_, BetProfitAccounting420[] memory v, BetEconomics420[] memory e) {
        if (v.length == 0) revert InvalidInventory();
        asset = asset_;
        for (uint256 i; i < v.length; ++i) {
            if (address(v[i]).code.length == 0 || v[i].bankroll().asset() != asset_) revert InvalidInventory();
            for (uint256 j; j < i; ++j) {
                if (address(v[i].bankroll()) == address(v[j].bankroll()) ||
                    (address(v[i].bankroll().accounting()) == address(v[j].bankroll().accounting()) &&
                     v[i].bankroll().vaultId() == v[j].bankroll().vaultId())) revert InvalidInventory();
            }
            vaults.push(v[i]);
        }
        for (uint256 i; i < e.length; ++i) {
            if (address(e[i]).code.length == 0 || e[i].asset() != asset_) revert InvalidInventory();
            for (uint256 j; j < i; ++j) if (e[i] == e[j]) revert InvalidInventory();
            economics.push(e[i]);
        }
        inventoryHash = keccak256(abi.encode(block.chainid, asset_, v, e));
    }
    function sourceCounts() external view returns(uint256,uint256) { return (vaults.length,economics.length); }
    function vaultSource(uint256 i) external view returns(address) { return address(vaults[i]); }
    function economicsSource(uint256 i) external view returns(address) { return address(economics[i]); }
    function report() external view returns (Report memory r) {
        r.reconciled = true;
        for (uint256 i; i < vaults.length; ++i) {
            BetProfitAccounting420.Report memory v = vaults[i].report();
            r.capitalized += v.capitalized;
            r.deposits += v.deposits;
            r.withdrawals += v.withdrawals;
            r.escrow += v.escrow;
            r.wagers += v.grossWagers;
            r.payouts += v.grossPayouts;
            r.refunds += v.refunds;
            r.unresolvedReturns += v.unresolvedReturns;
            r.gamingResult += v.gamingResult;
            r.assets += v.assets;
            r.liabilities += v.liability;
            r.pendingWithdrawals += v.pendingWithdrawals;
            r.reserves += v.safetyReserve;
            r.lpEquity += v.lpEquity;
            r.genesisEquity += v.genesisEquity;
            r.otherLpEquity += v.otherLpEquity;
            r.reconciled = r.reconciled && v.reconciled;
        }
        for (uint256 i; i < economics.length; ++i) {
            BetEconomics420 e = economics[i];
            uint256 custody = asset == address(0) ? address(e).balance : IERC20Bankroll420(asset).balanceOf(address(e));
            r.economicsCustody += custody;
            r.feeFunding += e.feesFunded();
            r.protocolFees += e.protocolFeesAccrued();
            r.operatorFees += e.operatorFeesAccrued();
            r.feePaid += e.feesPaid();
            r.feeObligations += e.feeClaimableTotal();
            r.feeReserved += e.feeReserved();
            r.feeAvailable += e.feeAvailable();
            r.rewardFunding += e.rewardsFunded();
            r.promotionFunding += e.promotionsFunded();
            r.paidExpenses += e.rewardsPaid() + e.promotionsPaid();
            r.outstandingExpenses += e.rewardReserved() + e.promotionReserved();
            r.uncommittedExpenseFunding += e.rewardAvailable() + e.promotionAvailable();
            r.reconciled = r.reconciled && custody == e.accountedBalance()
                && e.feesFunded() == e.feeAvailable() + e.feeReserved() + e.feeClaimableTotal() + e.feesPaid()
                && e.protocolFeesAccrued() + e.operatorFeesAccrued() == e.feeClaimableTotal() + e.feesPaid()
                && e.rewardsFunded() == e.rewardAvailable() + e.rewardReserved() + e.rewardsPaid()
                && e.promotionsFunded() == e.promotionAvailable() + e.promotionReserved() + e.promotionsPaid();
        }
        // Neither earmarked prefunding, claimable external fees nor shareholder
        // equity is retained protocol revenue. No finalized epoch or governed
        // retained-revenue source exists here. Keep the distribution basis zero.
        r.eligibleRevenue = 0;
    }
}
