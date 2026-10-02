// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./PayIds420.sol";

interface IERC20PaySplit420 {
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract SettlementRouter420 is GenesisResidentAccess420 {
    uint256 public constant MAX_RECIPIENTS = 8;
    uint256 public constant BPS = 10_000;

    address public paymentRouter;
    address public settlementAdapter;
    mapping(bytes32 => bool) public consumedSplit;
    uint256 private _entered;

    event PaymentRouterSet(address indexed router);
    event SettlementAdapterSet(address indexed adapter);
    event NativeSettlement(bytes32 indexed paymentId, address indexed asset, uint256 amount);
    event SplitPaid(bytes32 indexed paymentId, address indexed recipient, uint256 amount, uint16 bps);

    error UnauthorizedSettlementSource();
    error Replay();
    error TransferFailed();
    error AccountingMismatch();
    error Reentrancy();

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) { }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function componentId() public pure override returns (bytes32) {
        return PayIds420.SETTLEMENT_ROUTER;
    }

    function setPaymentRouter(
        address router_
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        require(router_ != address(0) && router_.code.length != 0, "payment router");
        paymentRouter = router_;
        emit PaymentRouterSet(router_);
    }

    function setSettlementAdapter(
        address adapter_
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        require(adapter_ != address(0) && adapter_.code.length != 0, "settlement adapter");
        settlementAdapter = adapter_;
        emit SettlementAdapterSet(adapter_);
    }

    function validateSplit(
        address[] calldata recipients,
        uint16[] calldata bps,
        uint8 primaryIndex
    ) public pure returns (bool) {
        require(recipients.length > 0 && recipients.length <= MAX_RECIPIENTS, "recipient count");
        require(recipients.length == bps.length, "length");
        require(primaryIndex < recipients.length, "primary");
        uint256 total;
        for (uint256 i; i < bps.length; i++) {
            require(recipients[i] != address(0), "zero recipient");
            total += bps[i];
        }
        require(total == BPS, "split total");
        return true;
    }

    function splitAmounts(
        uint256 amount,
        uint16[] calldata bps,
        uint8 primaryIndex
    ) public pure returns (uint256[] memory amounts) {
        require(amount > 0, "amount");
        require(bps.length > 0 && bps.length <= MAX_RECIPIENTS && primaryIndex < bps.length, "shape");
        uint256 totalBps;
        amounts = new uint256[](bps.length);
        uint256 assigned;
        for (uint256 i; i < bps.length; i++) {
            totalBps += bps[i];
            amounts[i] = (amount * bps[i]) / BPS;
            assigned += amounts[i];
        }
        require(totalBps == BPS, "split total");
        amounts[primaryIndex] += amount - assigned;
    }

    function executeNativeSplit(
        bytes32 paymentId,
        uint256 amount,
        address[] calldata recipients,
        uint16[] calldata bps,
        uint8 primaryIndex
    ) external payable nonReentrant {
        if (msg.sender != paymentRouter || paymentRouter == address(0)) revert UnauthorizedSettlementSource();
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        require(msg.value == amount && amount > 0, "native amount");
        _consume(paymentId);
        validateSplit(recipients, bps, primaryIndex);
        uint256[] memory amounts = splitAmounts(amount, bps, primaryIndex);
        for (uint256 i; i < recipients.length; i++) {
            if (amounts[i] != 0) {
                (bool ok,) = recipients[i].call{ value: amounts[i] }("");
                if (!ok) revert TransferFailed();
            }
            emit SplitPaid(paymentId, recipients[i], amounts[i], bps[i]);
        }
        if (address(this).balance != 0) revert AccountingMismatch();
        emit NativeSettlement(paymentId, address(0), amount);
    }

    function executeDirectTokenSplit(
        bytes32 paymentId,
        address payer,
        address asset,
        uint256 amount,
        address[] calldata recipients,
        uint16[] calldata bps,
        uint8 primaryIndex
    ) external nonReentrant {
        if (msg.sender != paymentRouter || paymentRouter == address(0)) revert UnauthorizedSettlementSource();
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        require(payer != address(0) && asset != address(0) && amount > 0, "direct split");
        _canonicalSettlementAsset(asset);
        _consume(paymentId);
        validateSplit(recipients, bps, primaryIndex);

        IERC20PaySplit420 token = IERC20PaySplit420(asset);
        uint256 balanceBefore = token.balanceOf(address(this));
        if (!token.transferFrom(payer, address(this), amount)) revert TransferFailed();
        if (token.balanceOf(address(this)) - balanceBefore != amount) revert AccountingMismatch();
        _distributeToken(paymentId, token, amount, recipients, bps, primaryIndex, balanceBefore);
    }

    function executeHeldTokenSplit(
        bytes32 paymentId,
        address asset,
        uint256 amount,
        address[] calldata recipients,
        uint16[] calldata bps,
        uint8 primaryIndex
    ) external nonReentrant {
        if (msg.sender != settlementAdapter || settlementAdapter == address(0)) revert UnauthorizedSettlementSource();
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        require(asset != address(0) && amount > 0, "held split");
        _canonicalSettlementAsset(asset);
        _consume(paymentId);
        validateSplit(recipients, bps, primaryIndex);

        IERC20PaySplit420 token = IERC20PaySplit420(asset);
        uint256 balanceBefore = token.balanceOf(address(this));
        if (balanceBefore != amount) revert AccountingMismatch();
        _distributeToken(paymentId, token, amount, recipients, bps, primaryIndex, 0);
    }

    function requireHealthy(address settlementAsset, bytes32 marketId, bool conversionRequired) public view {
        _canonicalSettlementAsset(settlementAsset);
        if (conversionRequired) _requireHealthyMarket(marketId);
    }

    function _consume(bytes32 paymentId) private {
        require(paymentId != bytes32(0), "payment id");
        if (consumedSplit[paymentId]) revert Replay();
        consumedSplit[paymentId] = true;
    }

    function _distributeToken(
        bytes32 paymentId,
        IERC20PaySplit420 token,
        uint256 amount,
        address[] calldata recipients,
        uint16[] calldata bps,
        uint8 primaryIndex,
        uint256 expectedResidual
    ) private {
        uint256[] memory amounts = splitAmounts(amount, bps, primaryIndex);
        for (uint256 i; i < recipients.length; i++) {
            uint256 recipientBefore = token.balanceOf(recipients[i]);
            if (amounts[i] != 0 && !token.transfer(recipients[i], amounts[i])) revert TransferFailed();
            if (token.balanceOf(recipients[i]) - recipientBefore != amounts[i]) revert AccountingMismatch();
            emit SplitPaid(paymentId, recipients[i], amounts[i], bps[i]);
        }
        if (token.balanceOf(address(this)) != expectedResidual) revert AccountingMismatch();
    }
}
