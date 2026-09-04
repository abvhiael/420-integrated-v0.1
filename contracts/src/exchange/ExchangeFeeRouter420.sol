// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../revenue/DevelopmentCompensationVault420.sol";
import "./ExchangeFeePolicy420.sol";

interface IERC20ExchangeFee420 {
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Atomic five-way router for retained 420Exchange protocol fees.
/// @dev LP/provider fees are outside this router; input is retained exchange protocol revenue only.
contract ExchangeFeeRouter420 is SystemAccess {
    uint16 private constant BPS_DENOMINATOR = 10_000;
    bytes32 public constant SOURCE_APPLICATION_ID = keccak256("420/EXCHANGE/APPLICATION/V1");
    bytes32 public constant REVENUE_POLICY_REF = keccak256("420/APPLICATION_REVENUE_POLICY/V1");

    ExchangeFeePolicy420 public immutable feePolicy;
    mapping(address => bool) public authorizedCollector;
    mapping(bytes32 => bool) public consumedTradeRef;
    uint256 private _entered;

    error UnauthorizedCollector();
    error Replay();
    error TransferFailed();
    error Reentrancy();
    error InvalidAmount();
    error AccountingMismatch();

    event CollectorAuthorizationSet(address indexed collector, bool authorized);
    event ExchangeFeeRouted(bytes32 indexed tradeRef, address indexed asset, uint256 grossRevenue, uint256 developerPayment);

    constructor(address timelock_, address feePolicy_) SystemAccess(timelock_) {
        if (feePolicy_ == address(0)) revert ZeroAddress();
        feePolicy = ExchangeFeePolicy420(feePolicy_);
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    modifier onlyCollector() {
        if (!authorizedCollector[msg.sender]) revert UnauthorizedCollector();
        _;
    }

    function setCollector(address collector, bool authorized) external onlyGovernance {
        if (collector == address(0)) revert ZeroAddress();
        authorizedCollector[collector] = authorized;
        emit CollectorAuthorizationSet(collector, authorized);
    }

    /// @notice Pull retained protocol revenue only from the authorized collector invoking this call.
    /// @dev Binding the token source to msg.sender prevents a collector from spending arbitrary third-party allowances.
    function routeTokenFee(bytes32 tradeRef, address token, uint256 amount)
        external
        onlyCollector
        nonReentrant
    {
        if (tradeRef == bytes32(0) || token == address(0) || amount == 0) revert InvalidAmount();
        _consume(tradeRef);

        IERC20ExchangeFee420 asset = IERC20ExchangeFee420(token);
        uint256 balanceBefore = asset.balanceOf(address(this));
        if (!asset.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        if (asset.balanceOf(address(this)) - balanceBefore != amount) revert AccountingMismatch();

        (
            uint16 protocolBps,
            uint16 developmentBps,
            uint16 communityBps,
            uint16 liquidityBps,
            uint16 developerBps
        ) = feePolicy.feeSplit();
        (
            address protocolTreasury,
            address developmentFund,
            address communityFund,
            address liquidityIncentives,
            address developmentVault
        ) = feePolicy.recipients();

        uint256 developmentAmount = amount * developmentBps / BPS_DENOMINATOR;
        uint256 communityAmount = amount * communityBps / BPS_DENOMINATOR;
        uint256 liquidityAmount = amount * liquidityBps / BPS_DENOMINATOR;
        uint256 developerAmount = amount * developerBps / BPS_DENOMINATOR;
        uint256 protocolAmount = amount - developmentAmount - communityAmount - liquidityAmount - developerAmount;
        require(protocolBps + developmentBps + communityBps + liquidityBps + developerBps == BPS_DENOMINATOR, "policy");
        if (protocolAmount + developmentAmount + communityAmount + liquidityAmount + developerAmount != amount) {
            revert AccountingMismatch();
        }

        _transfer(asset, protocolTreasury, protocolAmount);
        _transfer(asset, developmentFund, developmentAmount);
        _transfer(asset, communityFund, communityAmount);
        _transfer(asset, liquidityIncentives, liquidityAmount);

        if (developerAmount != 0) {
            if (!asset.approve(developmentVault, 0)) revert TransferFailed();
            if (!asset.approve(developmentVault, developerAmount)) revert TransferFailed();
            DevelopmentCompensationVault420(payable(developmentVault)).contributeToken(
                token,
                SOURCE_APPLICATION_ID,
                tradeRef,
                REVENUE_POLICY_REF,
                amount,
                developerBps
            );
            if (!asset.approve(developmentVault, 0)) revert TransferFailed();
        }

        emit ExchangeFeeRouted(tradeRef, token, amount, developerAmount);
    }

    function _consume(bytes32 tradeRef) private {
        if (consumedTradeRef[tradeRef]) revert Replay();
        consumedTradeRef[tradeRef] = true;
    }

    function _transfer(IERC20ExchangeFee420 asset, address recipient, uint256 amount) private {
        if (amount != 0 && !asset.transfer(recipient, amount)) revert TransferFailed();
    }
}
