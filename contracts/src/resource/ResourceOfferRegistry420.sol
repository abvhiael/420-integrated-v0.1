// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceNodeRegistry420.sol";
import "./ResourceProviderRegistry420.sol";
import "./ResourcePolicyRegistry420.sol";
import "./ResourceAuthorization420.sol";
import "./ResourceIds420.sol";

contract ResourceOfferRegistry420 is I420System {
    struct Offer { bytes32 nodeId; bytes32 serviceId; uint128 unitPrice420; uint128 maxUnits; bytes32 termsHash; uint64 validUntil; bool active; bool exists; }
    ResourceNodeRegistry420 public immutable nodes; ResourceProviderRegistry420 public immutable providers; ResourcePolicyRegistry420 public immutable policy; ResourceAuthorization420 public immutable authorization; mapping(bytes32=>Offer) private _offers;
    error InvalidOffer(); error OfferExists(); error Unauthorized();
    constructor(address n,address p,address pol,address a){require(n!=address(0)&&p!=address(0)&&pol!=address(0)&&a!=address(0),"dependency");nodes=ResourceNodeRegistry420(n);providers=ResourceProviderRegistry420(p);policy=ResourcePolicyRegistry420(pol);authorization=ResourceAuthorization420(a);}
    function systemName() external pure returns(string memory){return "ResourceOfferRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function publishOffer(bytes32 offerId,bytes32 nodeId,uint128 unitPrice420,uint128 maxUnits,bytes32 termsHash,uint64 validUntil) external { if(offerId==0||nodeId==0||maxUnits==0||termsHash==0||(validUntil!=0&&validUntil<=block.timestamp)) revert InvalidOffer(); if(_offers[offerId].exists) revert OfferExists(); ResourceNodeRegistry420.Node memory n=nodes.getNode(nodeId); if(!nodes.isActiveFor(nodeId,n.serviceId)||!policy.isActive(n.serviceId)) revert InvalidOffer(); ResourceProviderRegistry420.Provider memory p=providers.getProvider(n.providerId); if(msg.sender!=p.operatorAccount&&!authorization.isNodeAuthorized(msg.sender,n.providerId,nodeId,ResourceIds420.ACTION_PUBLISH_OFFER)) revert Unauthorized(); _offers[offerId]=Offer(nodeId,n.serviceId,unitPrice420,maxUnits,termsHash,validUntil,true,true); }
    function getOffer(bytes32 offerId) external view returns(Offer memory o){o=_offers[offerId];require(o.exists,"offer");}
    function isEffective(bytes32 offerId) external view returns(bool){Offer memory o=_offers[offerId];return o.exists&&o.active&&(o.validUntil==0||block.timestamp<=o.validUntil)&&nodes.isActiveFor(o.nodeId,o.serviceId)&&policy.isActive(o.serviceId);}
}
