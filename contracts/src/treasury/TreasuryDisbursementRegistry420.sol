// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./TreasuryIds420.sol";
import "./TreasuryAuthorization420.sol";
import "./TreasuryPolicyRegistry420.sol";
import "./TreasuryBudgetRegistry420.sol";

contract TreasuryDisbursementRegistry420 is I420System, SystemAccess {
    enum State { NONE, SCHEDULED, EXECUTED, CANCELLED }
    struct Disbursement { bytes32 budgetId; address recipient; address asset; uint128 amount; uint64 notBefore; uint64 expiresAt; bytes32 civicActionHash; bytes32 purposeHash; bytes32 vaultReleaseHash; State state; bool exists; }
    TreasuryAuthorization420 public immutable authorization; TreasuryPolicyRegistry420 public immutable policy; TreasuryBudgetRegistry420 public immutable budgets;
    mapping(bytes32=>Disbursement) private _disbursements; mapping(address=>mapping(uint256=>uint256)) public epochSpent;
    error InvalidDisbursement(); error DisbursementExists(); error DisbursementNotFound(); error ExecutionUnauthorized(); error InvalidState(); error NotExecutable(); error EpochLimit();
    event DisbursementScheduled(bytes32 indexed disbursementId, bytes32 indexed budgetId, address indexed recipient, address asset, uint128 amount, uint64 notBefore, uint64 expiresAt, bytes32 civicActionHash);
    event DisbursementExecuted(bytes32 indexed disbursementId, bytes32 vaultReleaseHash, address indexed executor);
    event DisbursementCancelled(bytes32 indexed disbursementId);
    constructor(address timelock_, address authorization_, address policy_, address budgets_) SystemAccess(timelock_) { require(authorization_!=address(0)&&policy_!=address(0)&&budgets_!=address(0),"dependency"); authorization=TreasuryAuthorization420(authorization_);policy=TreasuryPolicyRegistry420(policy_);budgets=TreasuryBudgetRegistry420(budgets_); }
    function systemName() external pure returns(string memory){return "TreasuryDisbursementRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function canonicalId(bytes32 budgetId,address recipient,uint128 amount,uint64 notBefore,uint64 expiresAt,bytes32 civicActionHash,bytes32 purposeHash) public pure returns(bytes32){return keccak256(abi.encode(keccak256("420/TREASURY/DISBURSEMENT/V1"),budgetId,recipient,amount,notBefore,expiresAt,civicActionHash,purposeHash));}
    function schedule(bytes32 id, bytes32 budgetId,address recipient,uint128 amount,uint64 notBefore,uint64 expiresAt,bytes32 civicActionHash,bytes32 purposeHash) external onlyGovernance {
        if(id==bytes32(0)||recipient==address(0)||amount==0||civicActionHash==bytes32(0)||purposeHash==bytes32(0)||expiresAt<=notBefore||id!=canonicalId(budgetId,recipient,amount,notBefore,expiresAt,civicActionHash,purposeHash)) revert InvalidDisbursement();
        if(_disbursements[id].exists) revert DisbursementExists(); TreasuryBudgetRegistry420.Budget memory b=budgets.budget(budgetId); if(!budgets.isEffective(budgetId)||b.civicActionHash!=civicActionHash||!policy.isAllowed(b.asset,amount)) revert InvalidDisbursement();
        budgets.reserve(budgetId,amount); _disbursements[id]=Disbursement(budgetId,recipient,b.asset,amount,notBefore,expiresAt,civicActionHash,purposeHash,bytes32(0),State.SCHEDULED,true); emit DisbursementScheduled(id,budgetId,recipient,b.asset,amount,notBefore,expiresAt,civicActionHash);
    }
    function markExecuted(bytes32 id, bytes32 vaultReleaseHash) external { Disbursement storage d=_get(id); if(d.state!=State.SCHEDULED) revert InvalidState(); if(block.timestamp<d.notBefore||block.timestamp>d.expiresAt||vaultReleaseHash==bytes32(0)) revert NotExecutable(); if(!authorization.isDisbursementAuthorized(msg.sender,id,TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,d.amount)) revert ExecutionUnauthorized(); TreasuryPolicyRegistry420.AssetPolicy memory p=policy.assetPolicy(d.asset); uint256 epoch=block.timestamp/p.epochSeconds; if(epochSpent[d.asset][epoch]+d.amount>p.maxEpochDisbursement) revert EpochLimit(); epochSpent[d.asset][epoch]+=d.amount; budgets.settle(d.budgetId,d.amount); d.vaultReleaseHash=vaultReleaseHash; d.state=State.EXECUTED; emit DisbursementExecuted(id,vaultReleaseHash,msg.sender); }
    function cancel(bytes32 id) external onlyGovernance { Disbursement storage d=_get(id); if(d.state!=State.SCHEDULED) revert InvalidState(); budgets.release(d.budgetId,d.amount); d.state=State.CANCELLED; emit DisbursementCancelled(id); }
    function disbursement(bytes32 id) external view returns(Disbursement memory){return _get(id);} function _get(bytes32 id) private view returns(Disbursement storage d){d=_disbursements[id];if(!d.exists) revert DisbursementNotFound();}
}
