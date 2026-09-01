// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./LaunchpadProjectRegistry420.sol";

contract LaunchpadSaleRegistry420 is I420System, SystemAccess {
    enum State { NONE, SCHEDULED, ACTIVE, SUCCEEDED, FAILED, CANCELLED }
    struct Sale { bytes32 projectId; address paymentAsset; address proceedsReceiver; uint128 softCap; uint128 hardCap; uint128 perWalletCap; uint128 tokenAllocation; uint64 startsAt; uint64 endsAt; uint64 claimStartsAt; bytes32 eligibilityPolicyHash; bytes32 liquidityCommitment; uint128 raised; State state; bool exists; }
    LaunchpadProjectRegistry420 public immutable projects;
    mapping(bytes32 => Sale) private _sales;
    error InvalidSale(); error SaleExists(); error SaleNotFound(); error InvalidState();
    event SaleCreated(bytes32 indexed saleId, bytes32 indexed projectId, address paymentAsset, uint128 softCap, uint128 hardCap, uint64 startsAt, uint64 endsAt);
    event SaleStateChanged(bytes32 indexed saleId, State state);
    constructor(address timelock_, address projects_) SystemAccess(timelock_) { require(projects_ != address(0), "dependency"); projects = LaunchpadProjectRegistry420(projects_); }
    function systemName() external pure returns (string memory) { return "LaunchpadSaleRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function canonicalId(bytes32 projectId,address paymentAsset,address proceedsReceiver,uint128 softCap,uint128 hardCap,uint128 perWalletCap,uint128 tokenAllocation,uint64 startsAt,uint64 endsAt,uint64 claimStartsAt,bytes32 eligibilityPolicyHash,bytes32 liquidityCommitment) public pure returns(bytes32){ return keccak256(abi.encode(keccak256("420/LAUNCHPAD/SALE/V1"),projectId,paymentAsset,proceedsReceiver,softCap,hardCap,perWalletCap,tokenAllocation,startsAt,endsAt,claimStartsAt,eligibilityPolicyHash,liquidityCommitment)); }
    function createSale(bytes32 saleId,bytes32 projectId,address paymentAsset,address proceedsReceiver,uint128 softCap,uint128 hardCap,uint128 perWalletCap,uint128 tokenAllocation,uint64 startsAt,uint64 endsAt,uint64 claimStartsAt,bytes32 eligibilityPolicyHash,bytes32 liquidityCommitment) external onlyGovernance {
        projects.project(projectId);
        if (paymentAsset==address(0)||proceedsReceiver==address(0)||softCap==0||hardCap<softCap||perWalletCap==0||perWalletCap>hardCap||tokenAllocation==0||endsAt<=startsAt||claimStartsAt<endsAt||eligibilityPolicyHash==bytes32(0)||saleId!=canonicalId(projectId,paymentAsset,proceedsReceiver,softCap,hardCap,perWalletCap,tokenAllocation,startsAt,endsAt,claimStartsAt,eligibilityPolicyHash,liquidityCommitment)) revert InvalidSale();
        if(_sales[saleId].exists) revert SaleExists();
        _sales[saleId]=Sale(projectId,paymentAsset,proceedsReceiver,softCap,hardCap,perWalletCap,tokenAllocation,startsAt,endsAt,claimStartsAt,eligibilityPolicyHash,liquidityCommitment,0,State.SCHEDULED,true);
        emit SaleCreated(saleId,projectId,paymentAsset,softCap,hardCap,startsAt,endsAt);
    }
    function activate(bytes32 saleId) external onlyGovernance { Sale storage s=_get(saleId); if(s.state!=State.SCHEDULED||block.timestamp>=s.endsAt) revert InvalidState(); s.state=State.ACTIVE; emit SaleStateChanged(saleId,s.state); }
    function recordContribution(bytes32 saleId,uint128 amount) external { Sale storage s=_get(saleId); if(msg.sender!=controller) revert InvalidState(); if(s.state!=State.ACTIVE||block.timestamp<s.startsAt||block.timestamp>s.endsAt||uint256(s.raised)+amount>s.hardCap) revert InvalidState(); s.raised+=amount; }
    address public controller;
    function setController(address controller_) external onlyGovernance { if(controller!=address(0)||controller_==address(0)) revert InvalidState(); controller=controller_; }
    function finalize(bytes32 saleId) external onlyGovernance { Sale storage s=_get(saleId); if(s.state!=State.ACTIVE||block.timestamp<=s.endsAt) revert InvalidState(); s.state=s.raised>=s.softCap?State.SUCCEEDED:State.FAILED; emit SaleStateChanged(saleId,s.state); }
    function cancel(bytes32 saleId) external onlyGovernance { Sale storage s=_get(saleId); if(s.state==State.SUCCEEDED||s.state==State.FAILED||s.state==State.CANCELLED) revert InvalidState(); s.state=State.CANCELLED; emit SaleStateChanged(saleId,s.state); }
    function sale(bytes32 saleId) external view returns(Sale memory){ return _get(saleId); }
    function _get(bytes32 saleId) private view returns(Sale storage s){ s=_sales[saleId]; if(!s.exists) revert SaleNotFound(); }
}
