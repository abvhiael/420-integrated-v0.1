// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";

interface IBetProfitEpochSource420 {
    struct Totals {
        uint256 retainedReceipts;
        uint256 losses;
        uint256 operatingExpenses;
        uint256 separatelyRoutedBasis;
        uint256 freeProtocolCash;
        bool reconciled;
    }

    function asset() external view returns (address);
    function custody() external view returns (address);
    function profitTotals() external view returns (Totals memory);
}

/// @notice Finalizes a per-asset accounting basis under an immutable governed source inventory.
/// @dev Adapters publish cumulative, custody-derived counters. Only protocol-owned receipts
/// and withdrawals net of protected obligations may be certified as free protocol cash.
contract BetGovernedProfitEpoch420 is SystemAccess {
    enum Kind { Bankroll, SharedPools, PokerRake, Tournament, Sportsbook, Fantasy, Expenses }

    struct Source {
        Kind kind;
        IBetProfitEpochSource420 adapter;
    }

    struct Epoch {
        uint256 eligibleRevenue;
        uint256 developerReserve;
        uint256 carriedLoss;
        uint64 finalizedAt;
    }

    error InvalidInventory();
    error UnreconciledSource();
    error EpochNotReady();

    uint256 public constant REQUIRED_KINDS = (1 << (uint256(Kind.Expenses) + 1)) - 1;
    address public immutable asset;
    uint64 public immutable duration;
    bytes32 public immutable inventoryHash;
    uint64 public nextClose;
    uint256 public epochCount;
    uint256 public carriedLoss;
    uint256 public accountedRevenue;
    mapping(uint256 => Epoch) public epochs;
    Source[] private sources;
    address[] private custody;
    IBetProfitEpochSource420.Totals[] private checkpoints;

    event EpochFinalized(uint256 indexed epoch, uint256 eligibleRevenue, uint256 developerReserve, uint256 carriedLoss);

    constructor(address governance, address asset_, uint64 duration_, Source[] memory inventory)
        SystemAccess(governance)
    {
        if (duration_ == 0) revert InvalidInventory();
        asset = asset_;
        duration = duration_;
        uint256 coverage;
        for (uint256 i; i < inventory.length; ++i) {
            Source memory source = inventory[i];
            if (address(source.adapter).code.length == 0 || source.adapter.asset() != asset_) revert InvalidInventory();
            address owner = source.adapter.custody();
            if (owner.code.length == 0) revert InvalidInventory();
            for (uint256 j; j < i; ++j) {
                if (owner == custody[j] || address(source.adapter) == address(sources[j].adapter)) {
                    revert InvalidInventory();
                }
            }
            coverage |= 1 << uint256(source.kind);
            sources.push(source);
            custody.push(owner);
            checkpoints.push(source.adapter.profitTotals());
            if (!checkpoints[i].reconciled) revert UnreconciledSource();
        }
        if (coverage != REQUIRED_KINDS) revert InvalidInventory();
        inventoryHash = keccak256(abi.encode(block.chainid, asset_, duration_, inventory, custody));
        nextClose = uint64(block.timestamp) + duration_;
    }

    function finalize() external onlyGovernance returns (uint256 id, Epoch memory result) {
        if (block.timestamp < nextClose) revert EpochNotReady();
        uint256 receipts;
        uint256 deductions = carriedLoss;
        uint256 freeCash;
        for (uint256 i; i < sources.length; ++i) {
            IBetProfitEpochSource420 adapter = sources[i].adapter;
            IBetProfitEpochSource420.Totals memory current = adapter.profitTotals();
            IBetProfitEpochSource420.Totals storage previous = checkpoints[i];
            if (!current.reconciled || adapter.asset() != asset || adapter.custody() != custody[i]
                || current.retainedReceipts < previous.retainedReceipts || current.losses < previous.losses
                || current.operatingExpenses < previous.operatingExpenses
                || current.separatelyRoutedBasis < previous.separatelyRoutedBasis) revert UnreconciledSource();

            uint256 gross = current.retainedReceipts - previous.retainedReceipts;
            uint256 separate = current.separatelyRoutedBasis - previous.separatelyRoutedBasis;
            if (separate > gross || (sources[i].kind == Kind.Fantasy && gross != separate)) {
                revert UnreconciledSource();
            }
            receipts += gross - separate;
            deductions += current.losses - previous.losses;
            deductions += current.operatingExpenses - previous.operatingExpenses;
            freeCash += current.freeProtocolCash;
            checkpoints[i] = current;
        }

        if (deductions > receipts) carriedLoss = deductions - receipts;
        else {
            carriedLoss = 0;
            result.eligibleRevenue = receipts - deductions;
            // The checkpointed basis remains charged against cash in later epochs.
            // Counter deltas alone cannot authorize the same cash a second time.
            if (result.eligibleRevenue != 0 && accountedRevenue + result.eligibleRevenue > freeCash) {
                revert UnreconciledSource();
            }
            accountedRevenue += result.eligibleRevenue;
        }
        result.developerReserve = result.eligibleRevenue / 10;
        result.carriedLoss = carriedLoss;
        result.finalizedAt = uint64(block.timestamp);
        nextClose = result.finalizedAt + duration;
        id = ++epochCount;
        epochs[id] = result;
        emit EpochFinalized(id, result.eligibleRevenue, result.developerReserve, result.carriedLoss);
    }
}
