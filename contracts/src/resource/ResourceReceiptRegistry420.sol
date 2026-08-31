// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceSessionRegistry420.sol";
import "./ResourceOfferRegistry420.sol";
import "./ResourceNodeRegistry420.sol";

contract ResourceReceiptRegistry420 is I420System {
    struct Receipt { bytes32 sessionId; bytes32 nodeId; uint128 cumulativeUnits; bytes32 usageHash; uint64 observedAt; bool exists; }
    ResourceSessionRegistry420 public immutable sessions; ResourceOfferRegistry420 public immutable offers; ResourceNodeRegistry420 public immutable nodes; mapping(bytes32=>Receipt) private _receipts; mapping(bytes32=>uint128) public lastUnits;
    error InvalidReceipt(); error ReceiptExists(); error Unauthorized();
    constructor(address s,address o,address n){require(s!=address(0)&&o!=address(0)&&n!=address(0),"dependency");sessions=ResourceSessionRegistry420(s);offers=ResourceOfferRegistry420(o);nodes=ResourceNodeRegistry420(n);}
    function systemName() external pure returns(string memory){return "ResourceReceiptRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function canonicalReceiptId(bytes32 sessionId,uint128 cumulativeUnits,bytes32 usageHash) public view returns(bytes32){return keccak256(abi.encode("420/RESOURCE/RECEIPT/V1",block.chainid,address(this),sessionId,cumulativeUnits,usageHash));}
    function submitReceipt(bytes32 receiptId,bytes32 sessionId,uint128 cumulativeUnits,bytes32 usageHash) external { if(receiptId!=canonicalReceiptId(sessionId,cumulativeUnits,usageHash)||usageHash==0) revert InvalidReceipt(); if(_receipts[receiptId].exists) revert ReceiptExists(); ResourceSessionRegistry420.Session memory s=sessions.getSession(sessionId); ResourceOfferRegistry420.Offer memory o=offers.getOffer(s.offerId); ResourceNodeRegistry420.Node memory n=nodes.getNode(o.nodeId); if(msg.sender!=n.operatorAccount) revert Unauthorized(); if(!sessions.isOpen(sessionId)||cumulativeUnits<lastUnits[sessionId]||cumulativeUnits>s.maxUnits) revert InvalidReceipt(); lastUnits[sessionId]=cumulativeUnits; _receipts[receiptId]=Receipt(sessionId,o.nodeId,cumulativeUnits,usageHash,uint64(block.timestamp),true); }
    function getReceipt(bytes32 id) external view returns(Receipt memory r){r=_receipts[id];require(r.exists,"receipt");}
}
