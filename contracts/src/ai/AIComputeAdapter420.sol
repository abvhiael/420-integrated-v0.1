// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../interfaces/I420System.sol"; import "../compute/ICompute420.sol"; import "./AIIds420.sol"; import "./AIAuthorization420.sol"; import "./AIJobManager.sol";
/// @notice AI-AUDIT-3 binds only the canonical ComputeRouter graph plus immutable AI constraints.
/// Validation against current Compute request/match/job economics is intentionally owned by AI-AUDIT-4.
contract AIComputeAdapter420 is I420System {
    struct Binding{bytes32 computeRequestId;bytes32 computeGraphHash;bytes32 modelVersionId;bytes32 workloadClass;bytes32 privacyPolicyId;bytes32 verificationProfileId;uint256 maxSpend;uint64 deadline;bool exists;}
    AIJobManager public immutable jobs;AIAuthorization420 public immutable authorization;ICompute420 public immutable computeRouter;mapping(bytes32=>Binding) private bindings;
    error InvalidDependency();error InvalidBinding();error BindingExists();error Unauthorized();error WrongState();
    event ComputeRequestBound(bytes32 indexed aiRequestId,bytes32 indexed computeRequestId,bytes32 indexed computeGraphHash,uint256 maxSpend,uint64 deadline);
    constructor(address j,address a,address c){if(j==address(0)||a==address(0)||c==address(0)||j.code.length==0||a.code.length==0||c.code.length==0)revert InvalidDependency();jobs=AIJobManager(j);authorization=AIAuthorization420(a);computeRouter=ICompute420(c);}
    function systemName() external pure returns(string memory){return "AIComputeAdapter420";} function protocolVersion() external pure returns(uint32){return 1;}
    function bindComputeRequest(bytes32 aiId,bytes32 computeId,bytes32 expectedGraph) external {
        if(aiId==0||computeId==0||expectedGraph==0)revert InvalidBinding();if(bindings[aiId].exists)revert BindingExists();
        (address requester,bytes32 mv,bytes32 w,,bytes32 privacy,bytes32 verify,uint256 maxSpend,uint64 deadline,,,,,,,,,AIJobManager.Status st)=jobs.jobs(aiId);
        if(st!=AIJobManager.Status.FUNDED)revert WrongState();
        if(msg.sender!=requester&&!authorization.isRequestAuthorized(msg.sender,aiId,AIIds420.ACTION_BIND_COMPUTE,maxSpend))revert Unauthorized();
        bytes32 graph=computeRouter.componentGraphHash();if(graph==0||graph!=expectedGraph)revert InvalidBinding();
        bindings[aiId]=Binding(computeId,graph,mv,w,privacy,verify,maxSpend,deadline,true);emit ComputeRequestBound(aiId,computeId,graph,maxSpend,deadline);
    }
    function getBinding(bytes32 id) external view returns(Binding memory b){b=bindings[id];if(!b.exists)revert InvalidBinding();}
}
