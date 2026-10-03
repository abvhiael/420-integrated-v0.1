// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../interfaces/I420System.sol"; import "../system/SystemAccess.sol"; import "./AIIds420.sol";
contract AIPolicyRegistry420 is I420System,SystemAccess {
    struct Policy{bytes32 workloadClass;bytes32 privacyPolicyId;bytes32 verificationProfileId;bytes32 servicePricingPolicyId;uint256 maxSpend420;uint64 maxDeadlineSeconds;uint32 revision;bool active;bool exists;}
    mapping(bytes32=>Policy) private current; mapping(bytes32=>mapping(uint32=>Policy)) private history;
    error InvalidPolicy(); error PolicyNotFound();
    event PolicyConfigured(bytes32 indexed policyId,uint32 indexed revision,bytes32 indexed workloadClass,bytes32 verificationProfileId,uint256 maxSpend420,uint64 maxDeadlineSeconds,bool active);
    constructor(address t) SystemAccess(t){}
    function systemName() external pure returns(string memory){return "AIPolicyRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function setPolicy(bytes32 id,bytes32 w,bytes32 privacy,bytes32 verify,bytes32 pricing,uint256 maxSpend,uint64 maxDeadline,bool active) external onlyGovernance {
        if(id==0||!AIIds420.isWorkload(w)||privacy==0||verify==0||pricing==0||maxSpend==0||maxDeadline==0)revert InvalidPolicy();
        uint32 rev=current[id].exists?current[id].revision+1:1; Policy memory p=Policy(w,privacy,verify,pricing,maxSpend,maxDeadline,rev,active,true);
        current[id]=p;history[id][rev]=p;emit PolicyConfigured(id,rev,w,verify,maxSpend,maxDeadline,active);
    }
    function getPolicy(bytes32 id) external view returns(Policy memory p){p=current[id];if(!p.exists)revert PolicyNotFound();}
    function getPolicyRevision(bytes32 id,uint32 rev) external view returns(Policy memory p){p=history[id][rev];if(!p.exists)revert PolicyNotFound();}
    function isActive(bytes32 id) external view returns(bool){return current[id].exists&&current[id].active;}
}
