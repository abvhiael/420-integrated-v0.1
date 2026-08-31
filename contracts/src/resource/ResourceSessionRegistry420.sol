// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceOfferRegistry420.sol";
import "./ResourceAuthorization420.sol";
import "./ResourceIds420.sol";

contract ResourceSessionRegistry420 is I420System {
    enum State { NONE, OPEN, CLOSED, SETTLED, CANCELLED }
    struct Session { bytes32 offerId; address consumer; uint128 maxUnits; uint256 maxSpend420; uint64 openedAt; uint64 expiresAt; State state; bool exists; }
    ResourceOfferRegistry420 public immutable offers;
    ResourceAuthorization420 public immutable authorization;
    mapping(bytes32=>Session) private _sessions;
    error InvalidSession(); error SessionExists(); error Unauthorized(); error InvalidState();
    constructor(address offers_, address authorization_){require(offers_!=address(0)&&authorization_!=address(0),"dependency");offers=ResourceOfferRegistry420(offers_);authorization=ResourceAuthorization420(authorization_);}
    function systemName() external pure returns(string memory){return "ResourceSessionRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function canonicalSessionId(address consumer,bytes32 offerId,uint256 nonce) public view returns(bytes32){return keccak256(abi.encode("420/RESOURCE/SESSION/V1",block.chainid,address(this),consumer,offerId,nonce));}
    function openSession(bytes32 sessionId,bytes32 offerId,uint128 maxUnits,uint64 expiresAt) external { if(sessionId==bytes32(0)||offerId==bytes32(0)||maxUnits==0||expiresAt<=block.timestamp||!offers.isEffective(offerId)) revert InvalidSession(); if(_sessions[sessionId].exists) revert SessionExists(); ResourceOfferRegistry420.Offer memory o=offers.getOffer(offerId); if(maxUnits>o.maxUnits) revert InvalidSession(); _sessions[sessionId]=Session(offerId,msg.sender,maxUnits,uint256(maxUnits)*uint256(o.unitPrice420),uint64(block.timestamp),expiresAt,State.OPEN,true); }
    function closeSession(bytes32 sessionId) external { Session storage s=_get(sessionId); if(msg.sender!=s.consumer) revert Unauthorized(); if(s.state!=State.OPEN) revert InvalidState(); s.state=State.CLOSED; }
    function markSettled(bytes32 sessionId,uint256 settledAmount420) external { Session storage s=_get(sessionId); if(s.state!=State.CLOSED||settledAmount420>s.maxSpend420) revert InvalidState(); if(!authorization.isSessionAuthorized(msg.sender,sessionId,ResourceIds420.ACTION_SETTLE,settledAmount420)) revert Unauthorized(); s.state=State.SETTLED; }
    function getSession(bytes32 id) external view returns(Session memory){return _get(id);} function isOpen(bytes32 id) external view returns(bool){Session memory s=_sessions[id];return s.exists&&s.state==State.OPEN&&block.timestamp<=s.expiresAt;}
    function _get(bytes32 id) private view returns(Session storage s){s=_sessions[id];if(!s.exists) revert InvalidSession();}
}
