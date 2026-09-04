// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../interfaces/I420System.sol";
import "./TreasuryBudgetRegistry420.sol";
import "./TreasuryDisbursementRegistry420.sol";
contract TreasuryRouter420 is I420System {
    TreasuryBudgetRegistry420 public immutable budgets; TreasuryDisbursementRegistry420 public immutable disbursements;
    constructor(address b,address d){require(b!=address(0)&&d!=address(0),"dependency");budgets=TreasuryBudgetRegistry420(b);disbursements=TreasuryDisbursementRegistry420(d);}
    function systemName() external pure returns(string memory){return "TreasuryRouter420";} function protocolVersion() external pure returns(uint32){return 1;}
    function remainingBudget(bytes32 budgetId) external view returns(uint256){TreasuryBudgetRegistry420.Budget memory b=budgets.budget(budgetId);return uint256(b.ceiling)-uint256(b.committed);}
    function isExecutable(bytes32 id) external view returns(bool){TreasuryDisbursementRegistry420.Disbursement memory d=disbursements.disbursement(id);return d.state==TreasuryDisbursementRegistry420.State.SCHEDULED&&block.timestamp>=d.notBefore&&block.timestamp<=d.expiresAt&&budgets.isEffective(d.budgetId);}
}
