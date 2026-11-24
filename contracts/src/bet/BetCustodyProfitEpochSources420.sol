// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IBetProfitEpochSource420} from "./BetGovernedProfitEpoch420.sol";
import {BetProfitAccounting420} from "./BetProfitAccounting420.sol";
import {BetEconomics420} from "./BetEconomics420.sol";

interface IProfitToken420 { function balanceOf(address) external view returns(uint256); }
interface IPokerProfitLedger420 {
    function assetPlayerChips(address) external view returns(uint256);
    function assetDeposits(address) external view returns(uint256);
    function assetWithdrawals(address) external view returns(uint256);
    function assetRake(address) external view returns(uint256);
    function rakePaidTo(address,address) external view returns(uint256);
}
interface ITournamentProfitLedger420 {
    function asset() external view returns(address);
    function totalLiability() external view returns(uint256);
    function heldPrizes() external view returns(uint256);
    function heldFees() external view returns(uint256);
    function totalCredits() external view returns(uint256);
    function totalReceived() external view returns(uint256);
    function totalWithdrawn() external view returns(uint256);
    function finalizedDevelopmentFees() external view returns(uint256);
    function solvent() external view returns(bool);
}
interface ISportsProfitLedger420 {
    function assetLiability(address) external view returns(uint256);
    function assetCollateral(address) external view returns(uint256);
    function assetPendingStake(address) external view returns(uint256);
    function assetPlayerCredit(address) external view returns(uint256);
    function assetProfitExposure(address) external view returns(uint256);
    function settledStakes(address) external view returns(uint256);
    function settledPayouts(address) external view returns(uint256);
    function collateralDeposited(address) external view returns(uint256);
    function collateralWithdrawn(address) external view returns(uint256);
}

/// @notice Immutable, read-only custody projections. No authority to move
/// player funds, operator collateral, LP equity or separately payable fees.
abstract contract BetPinnedCustodySource420 is IBetProfitEpochSource420 {
    address public immutable override asset;
    address public immutable override custody;
    bytes32 public immutable custodyCodeHash;
    error InvalidBinding();
    constructor(address asset_, address custody_, bytes32 expectedHash) {
        if(custody_.code.length==0 || custody_.codehash!=expectedHash ||
            (asset_!=address(0)&&asset_.code.length==0)) revert InvalidBinding();
        asset=asset_;custody=custody_;custodyCodeHash=expectedHash;
    }
    function _balance(address account) internal view returns(uint256){
        return asset==address(0)?account.balance:IProfitToken420(asset).balanceOf(account);
    }
    function _valid() internal view returns(bool){return custody.codehash==custodyCodeHash;}
}

contract BetBankrollProfitEpochSource420 is BetPinnedCustodySource420 {
    BetProfitAccounting420 public immutable accounting;
    bytes32 public immutable accountingCodeHash;
    constructor(BetProfitAccounting420 report_,bytes32 expectedHash)
        BetPinnedCustodySource420(report_.bankroll().asset(),address(report_.bankroll()),expectedHash){
        accounting=report_;accountingCodeHash=address(report_).codehash;
    }
    function profitTotals() external view override returns(Totals memory t){
        if(!_valid()||address(accounting).codehash!=accountingCodeHash)return t;
        BetProfitAccounting420.Report memory r=accounting.report();
        // All equity belongs to the current LP redemption ledger. Do not
        // manufacture protocol revenue or charge third-party LP losses twice.
        t.reconciled=r.reconciled&&r.asset==asset&&r.eligibleRevenue==0;
    }
}

contract BetSharedPoolsProfitEpochSource420 is BetPinnedCustodySource420 {
    constructor(BetEconomics420 owner,bytes32 expectedHash)
        BetPinnedCustodySource420(owner.asset(),address(owner),expectedHash){}
    function profitTotals() external view override returns(Totals memory t){
        if(!_valid())return t;
        BetEconomics420 e=BetEconomics420(payable(custody));
        t.reconciled=_balance(custody)==e.accountedBalance()
            &&e.feesFunded()==e.feeAvailable()+e.feeReserved()+e.feeClaimableTotal()+e.feesPaid()
            &&e.protocolFeesAccrued()+e.operatorFeesAccrued()==e.feeClaimableTotal()+e.feesPaid()
            &&e.rewardsFunded()==e.rewardAvailable()+e.rewardReserved()+e.rewardsPaid()
            &&e.promotionsFunded()==e.promotionAvailable()+e.promotionReserved()+e.promotionsPaid();
        // Prefunded fees are not incremental receipts. Expenses are counted
        // by the governed expense source, not by a second prefunding balance.
    }
}

contract BetPokerRakeProfitEpochSource420 is BetPinnedCustodySource420 {
    address public immutable protocolRecipient;
    bytes32 public immutable recipientCodeHash;
    constructor(address token,address ledger,bytes32 expectedHash,address recipient,bytes32 recipientHash)
        BetPinnedCustodySource420(token,ledger,expectedHash){
        if(token==address(0)||recipient==ledger||recipient.code.length==0||recipient.codehash!=recipientHash)revert InvalidBinding();
        protocolRecipient=recipient;recipientCodeHash=recipientHash;
    }
    function profitTotals() external view override returns(Totals memory t){
        if(!_valid()||protocolRecipient.codehash!=recipientCodeHash)return t;
        IPokerProfitLedger420 l=IPokerProfitLedger420(custody);
        uint256 rake=l.assetRake(asset);
        uint256 paid=l.rakePaidTo(asset,protocolRecipient);
        t.reconciled=paid<=rake&&_balance(custody)==l.assetPlayerChips(asset)
            &&l.assetDeposits(asset)==l.assetWithdrawals(asset)+rake+l.assetPlayerChips(asset);
        // Recipient may have unrelated funds or obligations: count only
        // verified receipts and never claim free cash based on its balance.
        // The dedicated protocol receipt owner must reconcile spendable cash.
        t.retainedReceipts=paid;
    }
}

contract BetTournamentProfitEpochSource420 is BetPinnedCustodySource420 {
    constructor(address owner,bytes32 expectedHash)
        BetPinnedCustodySource420(ITournamentProfitLedger420(owner).asset(),owner,expectedHash){}
    function profitTotals() external view override returns(Totals memory t){
        if(!_valid())return t;
        ITournamentProfitLedger420 l=ITournamentProfitLedger420(custody);
        t.reconciled=l.asset()==asset&&l.solvent()&&_balance(custody)==l.totalLiability()
            &&l.totalLiability()==l.heldPrizes()+l.heldFees()+l.totalCredits()
            &&l.totalReceived()==l.totalWithdrawn()+l.totalLiability();
        // Dedicated 3% purchase-fee exception, not general retained profit.
        t.retainedReceipts=l.finalizedDevelopmentFees();
        t.separatelyRoutedBasis=t.retainedReceipts;
    }
}

contract BetSportsbookProfitEpochSource420 is BetPinnedCustodySource420 {
    constructor(address token,address owner,bytes32 expectedHash)
        BetPinnedCustodySource420(token,owner,expectedHash){if(token==address(0))revert InvalidBinding();}
    function profitTotals() external view override returns(Totals memory t){
        if(!_valid())return t;
        ISportsProfitLedger420 l=ISportsProfitLedger420(custody);
        uint256 collateral=l.assetCollateral(asset);
        uint256 liability=l.assetLiability(asset);
        t.reconciled=_balance(custody)==liability
            &&liability==collateral+l.assetPendingStake(asset)+l.assetPlayerCredit(asset)
            &&l.assetProfitExposure(asset)<=collateral
            &&l.collateralDeposited(asset)+l.settledStakes(asset)
                ==l.collateralWithdrawn(asset)+l.settledPayouts(asset)+collateral;
        // The registered market operator owns all collateral and net results.
        // No approved protocol fee exists here; do not seize or count it.
    }
}
