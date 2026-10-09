// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./PayIds420.sol";

interface IPaymentRefundAccounting420 {
    function refundAccounting(
        bytes32 paymentId
    )
        external
        view
        returns (
            address payer,
            address settlementAsset,
            uint256 refundableMaximum,
            uint256 authorizedRefunded,
            uint8 status
        );
}

interface IERC20RefundAsset420 {
    function balanceOf(address holder) external view returns (uint256);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract RefundManager420 is GenesisResidentAccess420 {
    struct Refund {
        bytes32 paymentId;
        address settlementAsset;
        address recipient;
        uint256 amount;
        bytes32 reasonHash;
        uint64 createdAt;
    }

    mapping(bytes32 => Refund) public refunds;
    mapping(bytes32 => uint256) public refundedByPayment;
    address public paymentRegistry;
    mapping(bytes32 => uint256) public authorizedRefundEscrow;
    mapping(bytes32 => bool) public fundedRefundExecuted;
    bool private refundPayoutLocked;

    event PaymentRegistrySet(address indexed registry);
    event RefundRecorded(bytes32 indexed refundId, bytes32 indexed paymentId, address settlementAsset, uint256 amount);
    event AuthorizedRefundFunded(bytes32 indexed paymentId, address indexed asset, uint256 amount);
    event AuthorizedRefundFundingCancelled(bytes32 indexed paymentId, address indexed asset, uint256 amount);
    event FundedRefundPaid(bytes32 indexed refundId, bytes32 indexed paymentId, address indexed recipient, address asset, uint256 amount);

    modifier refundNonReentrant() {
        require(!refundPayoutLocked, "refund reentrant");
        refundPayoutLocked = true;
        _;
        refundPayoutLocked = false;
    }

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) { }

    function componentId() public pure override returns (bytes32) {
        return PayIds420.REFUND_MANAGER;
    }

    function setPaymentRegistry(
        address registry_
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        require(registry_ != address(0) && registry_.code.length != 0, "payment registry");
        paymentRegistry = registry_;
        emit PaymentRegistrySet(registry_);
    }

    function recordRefund(
        bytes32 refundId,
        bytes32 paymentId,
        address settlementAsset,
        address recipient,
        uint256 amount,
        uint256 refundableMaximum,
        bytes32 reasonHash
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_REFUND);
        _requireOperational(
            PayIds420.ACTION_REFUND, ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED, Types420.Direction.NONE
        );
        require(paymentRegistry != address(0) && paymentRegistry.code.length != 0, "payment registry");
        _canonicalSettlementAsset(settlementAsset);
        require(refundId != bytes32(0) && refunds[refundId].paymentId == bytes32(0), "invalid/exists");
        require(paymentId != bytes32(0) && recipient != address(0) && amount > 0, "invalid");

        (
            address canonicalPayer,
            address canonicalSettlementAsset,
            uint256 canonicalMaximum,
            uint256 authorizedRefunded,
            uint8 status
        ) = IPaymentRefundAccounting420(paymentRegistry).refundAccounting(paymentId);

        require(canonicalPayer == recipient, "refund recipient");
        require(canonicalSettlementAsset == settlementAsset, "settlement asset");
        require(canonicalMaximum == refundableMaximum, "refund maximum");
        require(status == 6 || status == 7, "refund not authorized");
        require(refundedByPayment[paymentId] + authorizedRefundEscrow[paymentId] + amount <= authorizedRefunded, "refund exceeds authorized");
        require(refundedByPayment[paymentId] + amount <= canonicalMaximum, "refund exceeds payment");

        refundedByPayment[paymentId] += amount;
        refunds[refundId] = Refund(paymentId, settlementAsset, recipient, amount, reasonHash, uint64(block.timestamp));
        emit RefundRecorded(refundId, paymentId, settlementAsset, amount);
    }
    // A governance-controlled, *explicitly pre-funded* refund escrow. The
    // canonical settlement router already paid merchants; it holds no refund
    // float. Never infer that updating the Pay ledger returns actual funds.
    function fundAuthorizedRefund(
        bytes32 paymentId,
        address asset,
        uint256 amount
    ) external payable refundNonReentrant {
        _requireGenesisGovernance(PayIds420.ACTION_REFUND);
        _requireOperational(
            PayIds420.ACTION_REFUND, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.INBOUND
        );
        require(paymentRegistry != address(0) && paymentRegistry.code.length != 0, "payment registry");
        _canonicalSettlementAsset(asset);
        require(paymentId != bytes32(0) && amount > 0, "invalid funding");
        (, address canonicalAsset, uint256 maximum, uint256 authorized, uint8 status) =
            IPaymentRefundAccounting420(paymentRegistry).refundAccounting(paymentId);
        require(asset == canonicalAsset && (status == 6 || status == 7), "funding not authorized");
        require(authorized <= maximum && refundedByPayment[paymentId] <= authorized, "refund accounting");
        require(authorizedRefundEscrow[paymentId] + amount <= authorized - refundedByPayment[paymentId], "exceeds authorization");
        authorizedRefundEscrow[paymentId] += amount;
        if (asset == address(0)) {
            require(msg.value == amount, "native funding");
        } else {
            require(msg.value == 0, "unexpected native");
            IERC20RefundAsset420 token = IERC20RefundAsset420(asset);
            uint256 beforeBalance = token.balanceOf(address(this));
            require(token.transferFrom(msg.sender, address(this), amount), "fund transfer");
            require(token.balanceOf(address(this)) - beforeBalance == amount, "fund delta");
        }
        emit AuthorizedRefundFunded(paymentId, asset, amount);
    }

    // Emergency governance-only unwind returns unspent escrow to the exact
    // governance funding caller, never to an arbitrary user-supplied payee.
    // A cancelled deposit is NOT a refund and does not alter Pay accounting.
    function cancelAuthorizedRefundFunding(
        bytes32 paymentId,
        address asset,
        uint256 amount
    ) external refundNonReentrant {
        _requireGenesisGovernance(PayIds420.ACTION_REFUND);
        _requireOperational(
            PayIds420.ACTION_REFUND, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        _canonicalSettlementAsset(asset);
        require(paymentRegistry != address(0) && paymentRegistry.code.length != 0, "payment registry");
        (, address canonicalAsset,,,) = IPaymentRefundAccounting420(paymentRegistry).refundAccounting(paymentId);
        require(canonicalAsset == asset && amount > 0 && authorizedRefundEscrow[paymentId] >= amount, "refund funding");
        authorizedRefundEscrow[paymentId] -= amount;
        if (asset == address(0)) {
            (bool ok,) = payable(msg.sender).call{value: amount}("");
            require(ok, "native funding unwind");
        } else {
            IERC20RefundAsset420 token = IERC20RefundAsset420(asset);
            uint256 beforeRecipient = token.balanceOf(msg.sender);
            uint256 beforeContract = token.balanceOf(address(this));
            require(token.transfer(msg.sender, amount), "fund unwind transfer");
            require(token.balanceOf(msg.sender) - beforeRecipient == amount, "fund unwind recipient");
            require(beforeContract - token.balanceOf(address(this)) == amount, "fund unwind delta");
        }
        emit AuthorizedRefundFundingCancelled(paymentId, asset, amount);
    }

    // The sole new real-transfer entrypoint. Pay must have already approved
    // the cumulative amount through PaymentRegistry420.applyRefund. This
    // invocation atomically records evidence AND pays the original payer.
    function executeFundedRefund(
        bytes32 refundId,
        bytes32 paymentId,
        address asset,
        address recipient,
        uint256 amount,
        uint256 refundableMaximum,
        bytes32 reasonHash
    ) external refundNonReentrant {
        _requireGenesisGovernance(PayIds420.ACTION_REFUND);
        _requireOperational(
            PayIds420.ACTION_REFUND, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        require(paymentRegistry != address(0) && paymentRegistry.code.length != 0, "payment registry");
        _canonicalSettlementAsset(asset);
        require(refundId != bytes32(0) && refunds[refundId].paymentId == bytes32(0), "invalid/exists");
        require(paymentId != bytes32(0) && recipient != address(0) && amount > 0, "invalid");
        (address payer, address canonicalAsset, uint256 maximum, uint256 authorized, uint8 status) =
            IPaymentRefundAccounting420(paymentRegistry).refundAccounting(paymentId);
        require(recipient == payer && asset == canonicalAsset && refundableMaximum == maximum, "payment mismatch");
        require(status == 6 || status == 7, "refund not authorized");
        require(refundedByPayment[paymentId] + amount <= authorized, "exceeds authorized");
        require(refundedByPayment[paymentId] + amount <= maximum, "exceeds payment");
        require(authorizedRefundEscrow[paymentId] >= amount, "refund not funded");
        authorizedRefundEscrow[paymentId] -= amount;
        refundedByPayment[paymentId] += amount;
        refunds[refundId] = Refund(paymentId, asset, recipient, amount, reasonHash, uint64(block.timestamp));
        fundedRefundExecuted[refundId] = true;
        if (asset == address(0)) {
            (bool paid,) = payable(recipient).call{value: amount}("");
            require(paid, "native refund transfer");
        } else {
            IERC20RefundAsset420 token = IERC20RefundAsset420(asset);
            uint256 beforeRecipient = token.balanceOf(recipient);
            uint256 beforeContract = token.balanceOf(address(this));
            require(token.transfer(recipient, amount), "refund transfer");
            require(token.balanceOf(recipient) - beforeRecipient == amount, "recipient delta");
            require(beforeContract - token.balanceOf(address(this)) == amount, "payout delta");
        }
        emit RefundRecorded(refundId, paymentId, asset, amount);
        emit FundedRefundPaid(refundId, paymentId, recipient, asset, amount);
    }

}
