// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./GrantProgramRegistry420.sol";
import "./GrantApplicationRegistry420.sol";

contract GrantAwardRegistry420 is I420System, SystemAccess {
    enum State { NONE, ACTIVE, CANCELLED, COMPLETED }
    struct Award { bytes32 programId; bytes32 applicationId; address recipient; uint128 amount; bytes32 termsHash; State state; bool exists; }
    GrantProgramRegistry420 public immutable programs;
    GrantApplicationRegistry420 public immutable applications;
    mapping(bytes32=>Award) private _awards;
    mapping(bytes32=>uint128) public programAwarded;
    error InvalidAward(); error AwardExists(); error AwardNotFound(); error AwardCapExceeded(); error InvalidState();
    event AwardCreated(bytes32 indexed awardId, bytes32 indexed programId, bytes32 indexed applicationId, address recipient, uint128 amount, bytes32 termsHash);
    event AwardStateChanged(bytes32 indexed awardId, State state);
    constructor(address timelock_,address programs_,address applications_) SystemAccess(timelock_){require(programs_!=address(0)&&applications_!=address(0),"dependency");programs=GrantProgramRegistry420(programs_);applications=GrantApplicationRegistry420(applications_);}
    function systemName() external pure returns(string memory){return "GrantAwardRegistry420";}
    function protocolVersion() external pure returns(uint32){return 1;}
    function canonicalId(bytes32 applicationId,address recipient,uint128 amount,bytes32 termsHash) public pure returns(bytes32){return keccak256(abi.encode(keccak256("420/GRANTS/AWARD/V1"),applicationId,recipient,amount,termsHash));}
    function createAward(bytes32 id,bytes32 applicationId,address recipient,uint128 amount,bytes32 termsHash) external onlyGovernance {
        GrantApplicationRegistry420.Application memory a=applications.application(applicationId); GrantProgramRegistry420.Program memory p=programs.program(a.programId);
        if(id==bytes32(0)||recipient==address(0)||recipient!=a.applicant||amount==0||amount>a.requestedAmount||amount>p.maxAward||termsHash==bytes32(0)||id!=canonicalId(applicationId,recipient,amount,termsHash)) revert InvalidAward();
        if(_awards[id].exists) revert AwardExists(); if(uint256(programAwarded[a.programId])+amount>p.totalCap) revert AwardCapExceeded();
        programAwarded[a.programId]+=amount; _awards[id]=Award(a.programId,applicationId,recipient,amount,termsHash,State.ACTIVE,true); emit AwardCreated(id,a.programId,applicationId,recipient,amount,termsHash);
    }
    function cancel(bytes32 id) external onlyGovernance {Award storage a=_get(id);if(a.state!=State.ACTIVE) revert InvalidState();a.state=State.CANCELLED;emit AwardStateChanged(id,a.state);}
    function markCompleted(bytes32 id) external onlyGovernance {Award storage a=_get(id);if(a.state!=State.ACTIVE) revert InvalidState();a.state=State.COMPLETED;emit AwardStateChanged(id,a.state);}
    function award(bytes32 id) external view returns(Award memory){return _get(id);}
    function _get(bytes32 id) private view returns(Award storage a){a=_awards[id];if(!a.exists) revert AwardNotFound();}
}
