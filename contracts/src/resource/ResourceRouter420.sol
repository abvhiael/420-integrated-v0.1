// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourcePolicyRegistry420.sol";
import "./ResourceNodeRegistry420.sol";
import "./ResourceOfferRegistry420.sol";

contract ResourceRouter420 is I420System {
    ResourcePolicyRegistry420 public immutable policy; ResourceNodeRegistry420 public immutable nodes; ResourceOfferRegistry420 public immutable offers;
    constructor(address p,address n,address o){require(p!=address(0)&&n!=address(0)&&o!=address(0),"dependency");policy=ResourcePolicyRegistry420(p);nodes=ResourceNodeRegistry420(n);offers=ResourceOfferRegistry420(o);}
    function systemName() external pure returns(string memory){return "ResourceRouter420";} function protocolVersion() external pure returns(uint32){return 1;}
    function canRoute(bytes32 nodeId,bytes32 serviceId) external view returns(bool){return policy.isActive(serviceId)&&nodes.isActiveFor(nodeId,serviceId);}
    function canOpen(bytes32 offerId) external view returns(bool){return offers.isEffective(offerId);}
}
