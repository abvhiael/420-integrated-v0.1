// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

contract GrantProgramRegistry420 is I420System, SystemAccess {
    struct Program { bytes32 programType; bytes32 treasuryBudgetId; bytes32 civicActionHash; uint128 totalCap; uint128 maxAward; uint128 awarded; uint64 opensAt; uint64 closesAt; bytes32 metadataHash; bool active; bool exists; }
    mapping(bytes32=>Program) private _programs;
    error InvalidProgram(); error ProgramExists(); error ProgramNotFound(); error CapExceeded();
    event ProgramCreated(bytes32 indexed programId, bytes32 indexed treasuryBudgetId, bytes32 indexed programType, uint128 totalCap, uint128 maxAward, uint64 opensAt, uint64 closesAt, bytes32 civicActionHash);
    event ProgramActiveChanged(bytes32 indexed programId, bool active);
    event ProgramAwardedChanged(bytes32 indexed programId, uint128 awarded);
    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns(string memory){return "GrantProgramRegistry420";}
    function protocolVersion() external pure returns(uint32){return 1;}
    function createProgram(bytes32 id,bytes32 programType,bytes32 treasuryBudgetId,bytes32 civicActionHash,uint128 totalCap,uint128 maxAward,uint64 opensAt,uint64 closesAt,bytes32 metadataHash) external onlyGovernance {
        if(id==bytes32(0)||programType==bytes32(0)||treasuryBudgetId==bytes32(0)||civicActionHash==bytes32(0)||totalCap==0||maxAward==0||maxAward>totalCap||closesAt<=opensAt) revert InvalidProgram();
        if(_programs[id].exists) revert ProgramExists();
        _programs[id]=Program(programType,treasuryBudgetId,civicActionHash,totalCap,maxAward,0,opensAt,closesAt,metadataHash,true,true);
        emit ProgramCreated(id,treasuryBudgetId,programType,totalCap,maxAward,opensAt,closesAt,civicActionHash);
    }
    function setActive(bytes32 id,bool active) external onlyGovernance { Program storage p=_get(id); p.active=active; emit ProgramActiveChanged(id,active); }
    function reserveAward(bytes32 id,uint128 amount) external onlyGovernance { Program storage p=_get(id); if(!isOpen(id)||amount==0||amount>p.maxAward||uint256(p.awarded)+amount>p.totalCap) revert CapExceeded(); p.awarded+=amount; emit ProgramAwardedChanged(id,p.awarded); }
    function program(bytes32 id) external view returns(Program memory){return _get(id);}
    function isOpen(bytes32 id) public view returns(bool){Program storage p=_programs[id];return p.exists&&p.active&&block.timestamp>=p.opensAt&&block.timestamp<=p.closesAt;}
    function _get(bytes32 id) private view returns(Program storage p){p=_programs[id];if(!p.exists) revert ProgramNotFound();}
}
