// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IBetProfitEpochSource420} from "./BetGovernedProfitEpoch420.sol";
import {DevelopmentCompensationVault420} from "../revenue/DevelopmentCompensationVault420.sol";

/// @notice Accounts for finalized Fantasy entry basis that already funded compensation.
contract BetFantasyProfitEpochSource420 is IBetProfitEpochSource420 {
    error InvalidVault();

    address public immutable override asset;
    address public immutable override custody;
    bytes32 private immutable vaultCodeHash;

    constructor(address asset_, DevelopmentCompensationVault420 vault, bytes32 expectedVaultCodeHash) {
        address source = address(vault);
        if (source.code.length == 0 || source.codehash != expectedVaultCodeHash) revert InvalidVault();
        asset = asset_;
        custody = source;
        vaultCodeHash = expectedVaultCodeHash;
    }

    function profitTotals() external view override returns (Totals memory totals) {
        if (custody.codehash != vaultCodeHash) return totals;
        totals.retainedReceipts = DevelopmentCompensationVault420(payable(custody)).fantasyForwardedBasis(asset);
        totals.separatelyRoutedBasis = totals.retainedReceipts;
        totals.reconciled = true;
    }
}
