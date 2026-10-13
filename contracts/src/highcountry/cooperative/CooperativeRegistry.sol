// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {OrganizationRegistry} from "../organization/OrganizationRegistry.sol";

/// @notice Immutable organization-backed cooperative identity and bounded voter roll.
contract CooperativeRegistry {
    error Invalid();
    error Unauthorized();
    struct Cooperative {bytes32 organization; address creator; uint32 version; uint32 memberCount; bool active;}
    OrganizationRegistry public immutable organizations;
    mapping(bytes32 => Cooperative) public cooperatives;
    mapping(bytes32 => address[]) internal roster;
    mapping(bytes32 => mapping(address => bool)) public enrolled;
    event CooperativeCreated(bytes32 indexed id,bytes32 indexed organization);
    event MemberEnrolled(bytes32 indexed id,address indexed member,uint32 count);
    constructor(address organizations_) {
        if(organizations_.code.length==0) revert Invalid();
        organizations=OrganizationRegistry(organizations_);
    }
    function create(bytes32 id,bytes32 org) external {
        (address admin,bool active,)=organizations.organizations(org);
        if(id==bytes32(0)||!active||admin!=msg.sender||cooperatives[id].active) revert Unauthorized();
        cooperatives[id]=Cooperative(org,msg.sender,1,0,true);
        emit CooperativeCreated(id,org);
    }
    /// @dev Only members can consent to enrollment. Fixed cap bounds snapshot gas.
    function enroll(bytes32 id) external {
        Cooperative storage c=cooperatives[id];
        if(!c.active||enrolled[id][msg.sender]||c.memberCount>=64
          ||!organizations.isActiveMember(c.organization,msg.sender)) revert Unauthorized();
        enrolled[id][msg.sender]=true;
        roster[id].push(msg.sender);
        c.memberCount++;
        emit MemberEnrolled(id,msg.sender,c.memberCount);
    }
    function voterAt(bytes32 id,uint256 idx) external view returns(address){return roster[id][idx];}
    function voterCount(bytes32 id) external view returns(uint256){return roster[id].length;}
}
