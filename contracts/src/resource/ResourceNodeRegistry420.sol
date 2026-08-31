// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceAuthorization420.sol";
import "./ResourceProviderRegistry420.sol";
import "./ResourceIds420.sol";

contract ResourceNodeRegistry420 is I420System {
    enum State { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }
    struct Node { bytes32 providerId; bytes32 serviceId; address operatorAccount; bytes32 endpointHash; bytes32 capacityHash; uint32 revision; State state; bool exists; }
    ResourceAuthorization420 public immutable authorization; ResourceProviderRegistry420 public immutable providers; mapping(bytes32=>Node) private _nodes;
    error InvalidNode(); error NodeExists(); error NodeNotFound(); error Unauthorized(); error InvalidState();
    event NodeRegistered(bytes32 indexed nodeId,bytes32 indexed providerId,bytes32 indexed serviceId); event NodeStateChanged(bytes32 indexed nodeId,State state);
    constructor(address authorization_,address providers_){require(authorization_!=address(0)&&providers_!=address(0),"dependency");authorization=ResourceAuthorization420(authorization_);providers=ResourceProviderRegistry420(providers_);}
    function systemName() external pure returns(string memory){return "ResourceNodeRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function registerNode(bytes32 nodeId,bytes32 providerId,bytes32 serviceId,address operatorAccount,bytes32 endpointHash,bytes32 capacityHash) external { if(nodeId==0||providerId==0||!ResourceIds420.isService(serviceId)||operatorAccount==address(0)||endpointHash==0||capacityHash==0) revert InvalidNode(); if(_nodes[nodeId].exists) revert NodeExists(); ResourceProviderRegistry420.Provider memory p=providers.getProvider(providerId); if(msg.sender!=p.operatorAccount&&!authorization.isNodeAuthorized(msg.sender,providerId,nodeId,ResourceIds420.ACTION_REGISTER_NODE)) revert Unauthorized(); _nodes[nodeId]=Node(providerId,serviceId,operatorAccount,endpointHash,capacityHash,1,State.REGISTERED,true); emit NodeRegistered(nodeId,providerId,serviceId); }
    function setState(bytes32 nodeId,State next) external { Node storage n=_get(nodeId); ResourceProviderRegistry420.Provider memory p=providers.getProvider(n.providerId); if(msg.sender!=n.operatorAccount&&msg.sender!=p.operatorAccount&&!authorization.isNodeAuthorized(msg.sender,n.providerId,nodeId,ResourceIds420.ACTION_SET_NODE_STATE)) revert Unauthorized(); State old=n.state; bool ok=(old==State.REGISTERED&&(next==State.ACTIVE||next==State.RETIRED))||(old==State.ACTIVE&&(next==State.SUSPENDED||next==State.RETIRED))||(old==State.SUSPENDED&&(next==State.ACTIVE||next==State.RETIRED)); if(!ok) revert InvalidState(); if(next==State.ACTIVE&&!providers.isActive(n.providerId)) revert InvalidState(); n.state=next; n.revision++; emit NodeStateChanged(nodeId,next); }
    function getNode(bytes32 nodeId) external view returns(Node memory){return _get(nodeId);} function isActiveFor(bytes32 nodeId,bytes32 serviceId) external view returns(bool){Node memory n=_nodes[nodeId];return n.exists&&n.state==State.ACTIVE&&n.serviceId==serviceId&&providers.isActive(n.providerId);}
    function _get(bytes32 id) private view returns(Node storage n){n=_nodes[id]; if(!n.exists) revert NodeNotFound();}
}
