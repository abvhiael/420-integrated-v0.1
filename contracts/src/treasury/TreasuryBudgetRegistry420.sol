// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./TreasuryPolicyRegistry420.sol";

contract TreasuryBudgetRegistry420 is I420System, SystemAccess {
    struct Budget { bytes32 vaultId; bytes32 category; address asset; uint128 ceiling; uint128 committed; uint128 executed; uint64 validFrom; uint64 validUntil; bytes32 civicActionHash; bytes32 metadataHash; bool active; bool exists; }
    TreasuryPolicyRegistry420 public immutable policy;
    address public controller;
    mapping(bytes32 => Budget) private _budgets;
    error UnauthorizedCaller(); error InvalidBudget(); error BudgetExists(); error BudgetNotFound(); error BudgetExceeded(); error ControllerAlreadySet();
    event ControllerSet(address indexed controller);
    event BudgetCreated(bytes32 indexed budgetId, bytes32 indexed vaultId, bytes32 indexed category, address asset, uint128 ceiling, uint64 validFrom, uint64 validUntil, bytes32 civicActionHash);
    event BudgetCommitmentChanged(bytes32 indexed budgetId, uint128 committed, uint128 executed);
    constructor(address timelock_, address policy_) SystemAccess(timelock_) { require(policy_ != address(0), "policy"); policy = TreasuryPolicyRegistry420(policy_); }
    function systemName() external pure returns (string memory) { return "TreasuryBudgetRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function setController(address controller_) external onlyGovernance { if (controller != address(0)) revert ControllerAlreadySet(); require(controller_ != address(0), "controller"); controller = controller_; emit ControllerSet(controller_); }
    function createBudget(bytes32 budgetId, bytes32 vaultId, bytes32 category, address asset, uint128 ceiling, uint64 validFrom, uint64 validUntil, bytes32 civicActionHash, bytes32 metadataHash) external onlyGovernance {
        if (budgetId == bytes32(0) || vaultId == bytes32(0) || category == bytes32(0) || asset == address(0) || ceiling == 0 || civicActionHash == bytes32(0) || validUntil <= validFrom) revert InvalidBudget();
        if (_budgets[budgetId].exists) revert BudgetExists(); if (!policy.isAllowed(asset, 1)) revert InvalidBudget();
        _budgets[budgetId] = Budget(vaultId, category, asset, ceiling, 0, 0, validFrom, validUntil, civicActionHash, metadataHash, true, true);
        emit BudgetCreated(budgetId, vaultId, category, asset, ceiling, validFrom, validUntil, civicActionHash);
    }
    function reserve(bytes32 budgetId, uint128 amount) external onlyController { Budget storage b = _get(budgetId); if (!_effective(b) || uint256(b.committed) + amount > b.ceiling) revert BudgetExceeded(); b.committed += amount; emit BudgetCommitmentChanged(budgetId,b.committed,b.executed); }
    function settle(bytes32 budgetId, uint128 amount) external onlyController { Budget storage b = _get(budgetId); if (amount > b.committed - b.executed) revert BudgetExceeded(); b.executed += amount; emit BudgetCommitmentChanged(budgetId,b.committed,b.executed); }
    function release(bytes32 budgetId, uint128 amount) external onlyController { Budget storage b = _get(budgetId); if (amount > b.committed - b.executed) revert BudgetExceeded(); b.committed -= amount; emit BudgetCommitmentChanged(budgetId,b.committed,b.executed); }
    function budget(bytes32 budgetId) external view returns (Budget memory) { return _get(budgetId); }
    function isEffective(bytes32 budgetId) external view returns (bool) { Budget storage b = _budgets[budgetId]; return b.exists && _effective(b); }
    modifier onlyController(){ if(msg.sender != controller || controller == address(0)) revert UnauthorizedCaller(); _; }
    function _effective(Budget storage b) private view returns(bool){ return b.active && block.timestamp >= b.validFrom && block.timestamp <= b.validUntil; }
    function _get(bytes32 id) private view returns(Budget storage b){ b=_budgets[id]; if(!b.exists) revert BudgetNotFound(); }
}
