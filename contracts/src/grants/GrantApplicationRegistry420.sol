// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./GrantIds420.sol";
import "./GrantAuthorization420.sol";
import "./GrantProgramRegistry420.sol";

contract GrantApplicationRegistry420 is I420System {
    struct Application { bytes32 programId; address applicant; uint128 requestedAmount; bytes32 contentHash; uint64 submittedAt; bool exists; }
    GrantAuthorization420 public immutable authorization;
    GrantProgramRegistry420 public immutable programs;
    mapping(bytes32=>Application) private _applications;
    error InvalidApplication(); error ApplicationExists(); error ApplicationNotFound(); error UnauthorizedApplicant();
    event ApplicationSubmitted(bytes32 indexed applicationId, bytes32 indexed programId, address indexed applicant, uint128 requestedAmount, bytes32 contentHash);
    constructor(address authorization_,address programs_){require(authorization_!=address(0)&&programs_!=address(0),"dependency");authorization=GrantAuthorization420(authorization_);programs=GrantProgramRegistry420(programs_);}
    function systemName() external pure returns(string memory){return "GrantApplicationRegistry420";}
    function protocolVersion() external pure returns(uint32){return 1;}
    function canonicalId(bytes32 programId,address applicant,uint256 nonce,bytes32 contentHash) public pure returns(bytes32){return keccak256(abi.encode(keccak256("420/GRANTS/APPLICATION/V1"),programId,applicant,nonce,contentHash));}
    function submit(bytes32 id,bytes32 programId,address applicant,uint256 nonce,uint128 requestedAmount,bytes32 contentHash) external {
        if(id==bytes32(0)||applicant==address(0)||requestedAmount==0||contentHash==bytes32(0)||id!=canonicalId(programId,applicant,nonce,contentHash)||!programs.isOpen(programId)) revert InvalidApplication();
        if(_applications[id].exists) revert ApplicationExists();
        GrantProgramRegistry420.Program memory p=programs.program(programId); if(requestedAmount>p.maxAward) revert InvalidApplication();
        if(msg.sender!=applicant&&!authorization.isProgramAuthorized(msg.sender,programId,GrantIds420.ACTION_SUBMIT_APPLICATION)) revert UnauthorizedApplicant();
        _applications[id]=Application(programId,applicant,requestedAmount,contentHash,uint64(block.timestamp),true); emit ApplicationSubmitted(id,programId,applicant,requestedAmount,contentHash);
    }
    function application(bytes32 id) external view returns(Application memory){Application memory a=_applications[id];if(!a.exists) revert ApplicationNotFound();return a;}
}
