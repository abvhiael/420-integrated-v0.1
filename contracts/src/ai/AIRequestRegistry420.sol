// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../interfaces/I420System.sol"; import "./AIJobManager.sol";
contract AIRequestRegistry420 is I420System {
    AIJobManager public immutable jobs; error InvalidDependency();
    struct RequestView{address requester;bytes32 modelVersionId;bytes32 workloadClass;bytes32 inputCommitment;bytes32 privacyPolicyId;bytes32 verificationProfileId;uint256 maxSpend;uint64 deadline;bytes32 computeRequestId;bytes32 computeJobId;bytes32 providerId;AIJobManager.Status status;}
    constructor(address j){if(j==address(0)||j.code.length==0)revert InvalidDependency();jobs=AIJobManager(j);}
    function systemName() external pure returns(string memory){return "AIRequestRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function getRequest(bytes32 id) external view returns(RequestView memory r){
        (address requester,bytes32 mv,bytes32 w,bytes32 input,bytes32 privacy,bytes32 verify,uint256 maxSpend,uint64 deadline,,,bytes32 cr,bytes32 cj,bytes32 pid,,,,AIJobManager.Status st)=jobs.jobs(id);
        r=RequestView(requester,mv,w,input,privacy,verify,maxSpend,deadline,cr,cj,pid,st);
    }
}
