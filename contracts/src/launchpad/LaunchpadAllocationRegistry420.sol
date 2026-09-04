// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./LaunchpadIds420.sol";
import "./LaunchpadAuthorization420.sol";
import "./LaunchpadSaleRegistry420.sol";

contract LaunchpadAllocationRegistry420 is I420System {
    LaunchpadAuthorization420 public immutable authorization;
    LaunchpadSaleRegistry420 public immutable sales;
    mapping(bytes32=>mapping(address=>uint128)) public contributed;
    mapping(bytes32=>mapping(address=>uint128)) public claimed;
    mapping(bytes32=>mapping(address=>bool)) public refunded;
    error UnauthorizedAction(); error InvalidContribution(); error NotClaimable(); error NotRefundable();
    event ContributionRecorded(bytes32 indexed saleId,address indexed participant,uint128 amount,bytes32 paymentCommitment);
    event AllocationClaimed(bytes32 indexed saleId,address indexed participant,uint128 tokenAmount,bytes32 deliveryCommitment);
    event RefundRecorded(bytes32 indexed saleId,address indexed participant,uint128 amount,bytes32 refundCommitment);
    constructor(address authorization_,address sales_){require(authorization_!=address(0)&&sales_!=address(0),"dependency");authorization=LaunchpadAuthorization420(authorization_);sales=LaunchpadSaleRegistry420(sales_);}
    function systemName() external pure returns(string memory){return "LaunchpadAllocationRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function contribute(bytes32 saleId,uint128 amount,bytes32 paymentCommitment) external { LaunchpadSaleRegistry420.Sale memory s=sales.sale(saleId); if(amount==0||paymentCommitment==bytes32(0)||s.state!=LaunchpadSaleRegistry420.State.ACTIVE||block.timestamp<s.startsAt||block.timestamp>s.endsAt||uint256(contributed[saleId][msg.sender])+amount>s.perWalletCap||!authorization.isAuthorized(msg.sender,saleId,LaunchpadIds420.ACTION_CONTRIBUTE,amount)) revert InvalidContribution(); contributed[saleId][msg.sender]+=amount; sales.recordContribution(saleId,amount); emit ContributionRecorded(saleId,msg.sender,amount,paymentCommitment); }
    function claim(bytes32 saleId,bytes32 deliveryCommitment) external { LaunchpadSaleRegistry420.Sale memory s=sales.sale(saleId); uint128 paid=contributed[saleId][msg.sender]; if(s.state!=LaunchpadSaleRegistry420.State.SUCCEEDED||block.timestamp<s.claimStartsAt||paid==0||claimed[saleId][msg.sender]!=0||deliveryCommitment==bytes32(0)||!authorization.isAuthorized(msg.sender,saleId,LaunchpadIds420.ACTION_CLAIM,0)) revert NotClaimable(); uint128 tokens=uint128((uint256(s.tokenAllocation)*paid)/s.raised); claimed[saleId][msg.sender]=tokens; emit AllocationClaimed(saleId,msg.sender,tokens,deliveryCommitment); }
    function recordRefund(bytes32 saleId,bytes32 refundCommitment) external { LaunchpadSaleRegistry420.Sale memory s=sales.sale(saleId); uint128 paid=contributed[saleId][msg.sender]; if((s.state!=LaunchpadSaleRegistry420.State.FAILED&&s.state!=LaunchpadSaleRegistry420.State.CANCELLED)||paid==0||refunded[saleId][msg.sender]||refundCommitment==bytes32(0)||!authorization.isAuthorized(msg.sender,saleId,LaunchpadIds420.ACTION_REFUND,paid)) revert NotRefundable(); refunded[saleId][msg.sender]=true; emit RefundRecorded(saleId,msg.sender,paid,refundCommitment); }
}
