// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./LaunchpadIds420.sol";
import "./LaunchpadAuthorization420.sol";
import "./LaunchpadSaleRegistry420.sol";
import "./ILaunchpadCrowdfundingIntegration420.sol";

contract LaunchpadAllocationRegistry420 is I420System {
    LaunchpadAuthorization420 public immutable authorization;
    LaunchpadSaleRegistry420 public immutable sales;
    address public crowdfundingIntegration;

    mapping(bytes32 => mapping(address => uint128)) public contributed;
    mapping(bytes32 => mapping(address => uint128)) public claimed;
    mapping(bytes32 => mapping(address => bool)) public refunded;

    error UnauthorizedAction();
    error InvalidContribution();
    error NotClaimable();
    error NotRefundable();
    error InvalidIntegration();

    event CrowdfundingIntegrationSet(address indexed integration);
    event ContributionRecorded(
        bytes32 indexed saleId,
        address indexed participant,
        uint128 amount,
        bytes32 paymentCommitment
    );
    event AllocationClaimed(
        bytes32 indexed saleId,
        address indexed participant,
        uint128 tokenAmount,
        bytes32 deliveryCommitment
    );
    event RefundRecorded(
        bytes32 indexed saleId,
        address indexed participant,
        uint128 amount,
        bytes32 refundCommitment
    );

    constructor(
        address authorization_,
        address sales_
    ) {
        require(authorization_ != address(0) && sales_ != address(0), "dependency");
        authorization = LaunchpadAuthorization420(authorization_);
        sales = LaunchpadSaleRegistry420(sales_);
    }

    function systemName() external pure returns (string memory) {
        return "LaunchpadAllocationRegistry420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function setCrowdfundingIntegration(
        address integration_
    ) external {
        if (msg.sender != sales.governanceTimelock()) revert UnauthorizedAction();
        if (
            crowdfundingIntegration != address(0) || integration_ == address(0)
                || integration_.code.length == 0
        ) revert InvalidIntegration();
        crowdfundingIntegration = integration_;
        emit CrowdfundingIntegrationSet(integration_);
    }

    function contribute(
        bytes32 saleId,
        uint128 amount,
        bytes32 paymentCommitment
    ) external {
        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        if (
            amount == 0 || paymentCommitment == bytes32(0)
                || sale_.state != LaunchpadSaleRegistry420.State.ACTIVE
                || block.timestamp < sale_.startsAt || block.timestamp > sale_.endsAt
                || uint256(contributed[saleId][msg.sender]) + amount > sale_.perWalletCap
                || !authorization.isAuthorized(
                    msg.sender, saleId, LaunchpadIds420.ACTION_CONTRIBUTE, amount
                )
        ) revert InvalidContribution();

        address integration = crowdfundingIntegration;
        if (
            integration != address(0)
                && !ILaunchpadCrowdfundingIntegration420(integration).consumeContribution(
                    msg.sender, saleId, amount, paymentCommitment
                )
        ) revert InvalidContribution();

        contributed[saleId][msg.sender] += amount;
        sales.recordContribution(saleId, amount);
        emit ContributionRecorded(saleId, msg.sender, amount, paymentCommitment);
    }

    function claim(
        bytes32 saleId,
        bytes32 deliveryCommitment
    ) external {
        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        uint128 paid = contributed[saleId][msg.sender];
        if (
            sale_.state != LaunchpadSaleRegistry420.State.SUCCEEDED
                || block.timestamp < sale_.claimStartsAt || paid == 0
                || claimed[saleId][msg.sender] != 0 || deliveryCommitment == bytes32(0)
                || !authorization.isAuthorized(
                    msg.sender, saleId, LaunchpadIds420.ACTION_CLAIM, 0
                )
        ) revert NotClaimable();

        uint128 tokens = uint128((uint256(sale_.tokenAllocation) * paid) / sale_.raised);
        claimed[saleId][msg.sender] = tokens;

        address integration = crowdfundingIntegration;
        if (integration != address(0)) {
            ILaunchpadCrowdfundingIntegration420(integration).recordDelivery(
                msg.sender, saleId, tokens, deliveryCommitment
            );
        }

        emit AllocationClaimed(saleId, msg.sender, tokens, deliveryCommitment);
    }

    function recordRefund(
        bytes32 saleId,
        bytes32 refundCommitment
    ) external {
        LaunchpadSaleRegistry420.Sale memory sale_ = sales.sale(saleId);
        uint128 paid = contributed[saleId][msg.sender];
        if (
            (
                sale_.state != LaunchpadSaleRegistry420.State.FAILED
                    && sale_.state != LaunchpadSaleRegistry420.State.CANCELLED
            ) || paid == 0 || refunded[saleId][msg.sender]
                || refundCommitment == bytes32(0)
                || !authorization.isAuthorized(
                    msg.sender, saleId, LaunchpadIds420.ACTION_REFUND, paid
                )
        ) revert NotRefundable();

        address integration = crowdfundingIntegration;
        if (
            integration != address(0)
                && !ILaunchpadCrowdfundingIntegration420(integration).consumeRefund(
                    msg.sender, saleId, paid, refundCommitment
                )
        ) revert NotRefundable();

        refunded[saleId][msg.sender] = true;
        emit RefundRecorded(saleId, msg.sender, paid, refundCommitment);
    }
}
