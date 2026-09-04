// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./GrantIds420.sol";
import "./GrantAuthorization420.sol";
import "./GrantProgramRegistry420.sol";
import "./GrantAwardRegistry420.sol";

interface ITreasuryDisbursementGrant420 {
    enum State { NONE, SCHEDULED, EXECUTED, CANCELLED }
    struct Disbursement { bytes32 budgetId; address recipient; address asset; uint128 amount; uint64 notBefore; uint64 expiresAt; bytes32 civicActionHash; bytes32 purposeHash; bytes32 vaultReleaseHash; State state; bool exists; }
    function disbursement(bytes32 id) external view returns (Disbursement memory);
}

contract GrantMilestoneRegistry420 is I420System, SystemAccess {
    enum State { NONE, PENDING, CLAIMED, APPROVED, PAID, CANCELLED }
    struct Milestone { bytes32 awardId; uint128 amount; bytes32 purposeHash; bytes32 claimHash; bytes32 treasuryDisbursementId; State state; bool exists; }
    GrantAuthorization420 public immutable authorization;
    GrantProgramRegistry420 public immutable programs;
    GrantAwardRegistry420 public immutable awards;
    ITreasuryDisbursementGrant420 public immutable treasury;
    mapping(bytes32=>Milestone) private _milestones;
    mapping(bytes32=>uint128) public milestoneTotal;
    error InvalidMilestone(); error MilestoneExists(); error MilestoneNotFound(); error InvalidState(); error UnauthorizedClaimant(); error TreasuryMismatch();
    event MilestoneCreated(bytes32 indexed milestoneId, bytes32 indexed awardId, uint128 amount, bytes32 purposeHash);
    event MilestoneClaimed(bytes32 indexed milestoneId, bytes32 claimHash, address indexed submitter);
    event MilestoneApproved(bytes32 indexed milestoneId, bytes32 indexed treasuryDisbursementId);
    event MilestonePaid(bytes32 indexed milestoneId, bytes32 indexed treasuryDisbursementId);
    event MilestoneCancelled(bytes32 indexed milestoneId);
    constructor(address timelock_,address authorization_,address programs_,address awards_,address treasury_) SystemAccess(timelock_) { require(authorization_!=address(0)&&programs_!=address(0)&&awards_!=address(0)&&treasury_!=address(0),"dependency"); authorization=GrantAuthorization420(authorization_);programs=GrantProgramRegistry420(programs_);awards=GrantAwardRegistry420(awards_);treasury=ITreasuryDisbursementGrant420(treasury_); }
    function systemName() external pure returns(string memory){return "GrantMilestoneRegistry420";}
    function protocolVersion() external pure returns(uint32){return 1;}
    function canonicalId(bytes32 awardId,uint32 ordinal,uint128 amount,bytes32 purposeHash) public pure returns(bytes32){return keccak256(abi.encode(keccak256("420/GRANTS/MILESTONE/V1"),awardId,ordinal,amount,purposeHash));}
    function createMilestone(bytes32 id,bytes32 awardId,uint32 ordinal,uint128 amount,bytes32 purposeHash) external onlyGovernance {
        GrantAwardRegistry420.Award memory a=awards.award(awardId); if(a.state!=GrantAwardRegistry420.State.ACTIVE||id==bytes32(0)||amount==0||purposeHash==bytes32(0)||id!=canonicalId(awardId,ordinal,amount,purposeHash)) revert InvalidMilestone();
        if(_milestones[id].exists) revert MilestoneExists(); if(uint256(milestoneTotal[awardId])+amount>a.amount) revert InvalidMilestone(); milestoneTotal[awardId]+=amount; _milestones[id]=Milestone(awardId,amount,purposeHash,bytes32(0),bytes32(0),State.PENDING,true); emit MilestoneCreated(id,awardId,amount,purposeHash);
    }
    function submitClaim(bytes32 id,bytes32 claimHash) external { Milestone storage m=_get(id); if(m.state!=State.PENDING||claimHash==bytes32(0)) revert InvalidState(); GrantAwardRegistry420.Award memory a=awards.award(m.awardId); if(a.state!=GrantAwardRegistry420.State.ACTIVE) revert InvalidState(); if(msg.sender!=a.recipient&&!authorization.isAwardAuthorized(msg.sender,m.awardId,GrantIds420.ACTION_SUBMIT_MILESTONE)) revert UnauthorizedClaimant(); m.claimHash=claimHash;m.state=State.CLAIMED;emit MilestoneClaimed(id,claimHash,msg.sender); }
    function approve(bytes32 id,bytes32 treasuryDisbursementId) external onlyGovernance { Milestone storage m=_get(id); if(m.state!=State.CLAIMED||treasuryDisbursementId==bytes32(0)) revert InvalidState(); GrantAwardRegistry420.Award memory a=awards.award(m.awardId); GrantProgramRegistry420.Program memory p=programs.program(a.programId); ITreasuryDisbursementGrant420.Disbursement memory d=treasury.disbursement(treasuryDisbursementId); if(d.state!=ITreasuryDisbursementGrant420.State.SCHEDULED||d.budgetId!=p.treasuryBudgetId||d.recipient!=a.recipient||d.amount!=m.amount||d.civicActionHash!=p.civicActionHash||d.purposeHash!=m.purposeHash) revert TreasuryMismatch(); m.treasuryDisbursementId=treasuryDisbursementId;m.state=State.APPROVED;emit MilestoneApproved(id,treasuryDisbursementId); }
    function finalizePaid(bytes32 id) external { Milestone storage m=_get(id); if(m.state!=State.APPROVED) revert InvalidState(); ITreasuryDisbursementGrant420.Disbursement memory d=treasury.disbursement(m.treasuryDisbursementId); if(d.state!=ITreasuryDisbursementGrant420.State.EXECUTED||d.vaultReleaseHash==bytes32(0)) revert TreasuryMismatch(); m.state=State.PAID;emit MilestonePaid(id,m.treasuryDisbursementId); }
    function cancel(bytes32 id) external onlyGovernance { Milestone storage m=_get(id); if(m.state==State.PAID||m.state==State.CANCELLED) revert InvalidState(); m.state=State.CANCELLED; emit MilestoneCancelled(id); }
    function milestone(bytes32 id) external view returns(Milestone memory){return _get(id);}
    function _get(bytes32 id) private view returns(Milestone storage m){m=_milestones[id];if(!m.exists) revert MilestoneNotFound();}
}
