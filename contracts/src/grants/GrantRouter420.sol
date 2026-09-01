// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./GrantProgramRegistry420.sol";
import "./GrantAwardRegistry420.sol";
import "./GrantMilestoneRegistry420.sol";

contract GrantRouter420 is I420System {
    GrantProgramRegistry420 public immutable programs;
    GrantAwardRegistry420 public immutable awards;
    GrantMilestoneRegistry420 public immutable milestones;
    constructor(address programs_,address awards_,address milestones_){require(programs_!=address(0)&&awards_!=address(0)&&milestones_!=address(0),"dependency");programs=GrantProgramRegistry420(programs_);awards=GrantAwardRegistry420(awards_);milestones=GrantMilestoneRegistry420(milestones_);}
    function systemName() external pure returns(string memory){return "GrantRouter420";}
    function protocolVersion() external pure returns(uint32){return 1;}
    function isProgramOpen(bytes32 programId) external view returns(bool){return programs.isOpen(programId);}
    function awardState(bytes32 awardId) external view returns(GrantAwardRegistry420.State){return awards.award(awardId).state;}
    function milestoneState(bytes32 milestoneId) external view returns(GrantMilestoneRegistry420.State){return milestones.milestone(milestoneId).state;}
}
