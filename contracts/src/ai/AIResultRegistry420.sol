// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../interfaces/I420System.sol"; import "./AIJobManager.sol";
contract AIResultRegistry420 is I420System {
    AIJobManager public immutable jobs; error InvalidDependency();
    struct ResultView{bytes32 requestId;bytes32 computeJobId;bytes32 providerId;bytes32 modelVersionId;bytes32 outputCommitment;bytes32 resultManifestHash;bytes32 disputeRef;AIJobManager.Status status;}
    constructor(address j){if(j==address(0)||j.code.length==0)revert InvalidDependency();jobs=AIJobManager(j);}
    function systemName() external pure returns(string memory){return "AIResultRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function getResult(bytes32 id) external view returns(ResultView memory r){
        (,bytes32 mv,,,,,,,,,,bytes32 cj,bytes32 pid,bytes32 out,bytes32 manifest,bytes32 dispute,AIJobManager.Status st)=jobs.jobs(id);
        r=ResultView(id,cj,pid,mv,out,manifest,dispute,st);
    }
}
