// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../treasury/TreasuryReleaseExecutor420.sol";
import {BankrollVault420} from "./BankrollVault420.sol";
import {VaultAccounting420 as BetVaultAccounting420} from "./VaultAccounting420.sol";

/// @notice Governed native casino capitalization; no deployment grants or live funding implied.
/// @dev One governed budget, source vault and bankroll per adapter. Shares are retained here,
/// not assigned to an operator. No LP withdrawal or arbitrary transfer entry point exists.
contract BetGenesisCapitalization420 {
    uint256 public constant GENESIS_CAP = 1_000_000 ether;
    bytes32 public constant PURPOSE = keccak256("420/BET/GENESIS/CAPITALIZATION/V1");
    BankrollVault420 public immutable bankroll;
    TreasuryReleaseExecutor420 public immutable releaseExecutor;
    bytes32 public immutable budgetId;
    bytes32 public immutable sourceVaultId;
    address public immutable governance;
    uint256 public capitalized;
    mapping(bytes32 => bytes32) public releaseCommitment;
    uint256 private entered;
    address private expectedSource;
    uint256 private expectedAmount;

    error InvalidConfiguration();
    error Unauthorized();
    error InvalidRelease();
    error CapExceeded();
    error Replay();
    error UnexpectedFunds();
    error Reentrancy();
    error AccountingMismatch();

    event Capitalized(bytes32 indexed disbursementId, bytes32 indexed commitment, uint256 amount,
        uint256 cumulative, uint256 shares);

    constructor(address registry_, address bankroll_, bytes32 budgetId_, bytes32 sourceVaultId_) {
        if (registry_.code.length == 0 || bankroll_.code.length == 0 ||
            budgetId_ == bytes32(0) || sourceVaultId_ == bytes32(0)) revert InvalidConfiguration();
        bankroll = BankrollVault420(bankroll_);
        if (bankroll.asset() != address(0) || bankroll.accounting().assetOf(bankroll.vaultId()) != address(0))
            revert InvalidConfiguration();
        governance = ProtocolRegistry(registry_).governanceTimelock();
        budgetId = budgetId_;
        sourceVaultId = sourceVaultId_;
        releaseExecutor = new TreasuryReleaseExecutor420(registry_, address(this));
    }

    /// @notice Preview uses canonical release commitment; caller cannot supply amounts or recipients.
    function preview(bytes32 id) public view returns (bytes32 commitment) {
        (bytes memory evidence, bytes32 c) = releaseExecutor.preview(id);
        _validate(abi.decode(evidence, (TreasuryReleaseExecutor420.ReleaseEvidence)));
        return c;
    }

    /// @notice Only the canonical governance timelock can execute; Treasury and Vault
    /// independently authorize the child executor, and Bet authorizes the deposit.
    function capitalize(bytes32 id, bytes32 commitment) external returns (uint256 shares) {
        if (msg.sender != governance) revert Unauthorized();
        if (entered != 0) revert Reentrancy();
        if (releaseCommitment[id] != bytes32(0)) revert Replay();
        entered = 1;
        (bytes memory evidence, bytes32 actual) = releaseExecutor.preview(id);
        TreasuryReleaseExecutor420.ReleaseEvidence memory e =
            abi.decode(evidence, (TreasuryReleaseExecutor420.ReleaseEvidence));
        _validate(e);
        if (actual != commitment || commitment == bytes32(0)) revert InvalidRelease();
        uint256 amount = e.amount;
        uint256 balanceBefore = address(this).balance;
        uint256 bankrollBefore = address(bankroll).balance;
        uint256 sharesBefore = bankroll.shareBalance(address(this));
        BetVaultAccounting420 accounting = bankroll.accounting();
        BetVaultAccounting420.VaultState memory beforeState = accounting.getVault(bankroll.vaultId());
        // Bind receipt to the exact canonical source and exact native amount.
        expectedSource = e.vault;
        expectedAmount = amount;
        capitalized += amount;
        releaseCommitment[id] = commitment;
        if (releaseExecutor.execute(id, commitment) != commitment || expectedAmount != 0
            || address(this).balance != balanceBefore + amount) revert UnexpectedFunds();
        expectedSource = address(0);
        shares = bankroll.depositNative{value: amount}();
        BetVaultAccounting420.VaultState memory afterState = accounting.getVault(bankroll.vaultId());
        if (shares == 0 || bankroll.shareBalance(address(this)) != sharesBefore + shares
            || address(this).balance != balanceBefore || address(bankroll).balance != bankrollBefore + amount
            || afterState.totalAssets != beforeState.totalAssets + amount
            || afterState.activeReservedLiability != beforeState.activeReservedLiability
            || afterState.pendingWithdrawals != beforeState.pendingWithdrawals
            || afterState.safetyReserve != beforeState.safetyReserve
            || afterState.realizedPnl != beforeState.realizedPnl) revert AccountingMismatch();
        emit Capitalized(id, commitment, amount, capitalized, shares);
        entered = 0;
    }

    function _validate(TreasuryReleaseExecutor420.ReleaseEvidence memory e) private view {
        TreasuryBudgetRegistry420.Budget memory b = TreasuryBudgetRegistry420(e.budgetRegistry).budget(budgetId);
        if (e.budgetId != budgetId || e.vaultId != sourceVaultId || e.asset != address(0)
            || e.recipient != address(this) || e.purposeHash != PURPOSE || e.amount == 0
            || b.category != TreasuryIds420.BUDGET_PROTOCOL || b.asset != address(0)
            || b.vaultId != sourceVaultId || b.ceiling > GENESIS_CAP
            || b.ceiling == 0 || b.civicActionHash != e.civicActionHash
            || TreasuryBudgetRegistry420(e.budgetRegistry).governanceTimelock() != governance)
            revert InvalidRelease();
        if (capitalized + e.amount > GENESIS_CAP || capitalized + e.amount > b.ceiling) revert CapExceeded();
    }

    receive() external payable {
        if (entered != 1 || msg.sender != expectedSource || expectedAmount == 0
            || msg.value != expectedAmount) revert UnexpectedFunds();
        expectedAmount = 0;
    }
}
