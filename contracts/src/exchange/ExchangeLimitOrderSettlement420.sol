// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeAtomicRouter420.sol";
import "./ExchangeEmergencyControl420.sol";

interface IExchangeLimitOrderAuthorization420 {
    function canPlaceLimitOrder(address principal, bytes32 marketId, uint256 amount) external view returns (bool);
}

interface IERC1271LimitOrder420 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

interface IERC20LimitOrder420 {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice EIP-712 signed exact-input limit orders settled through ExchangeAtomicRouter420.
/// @dev Makers approve only this settlement contract. Relayers never receive maker funds and cannot nominate a
///      different principal. The atomic router independently rechecks per-hop swap capability, oracle health,
///      emergency state, route validity, slippage, and retained-fee settlement.
contract ExchangeLimitOrderSettlement420 {
    bytes4 internal constant ERC1271_MAGICVALUE = 0x1626ba7e;
    uint256 internal constant SECP256K1N_HALF =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "LimitOrder(address maker,address sellToken,address buyToken,uint128 sellAmount,uint128 minBuyAmount,address recipient,bytes32 marketId,uint256 nonce,uint64 expiry,bool allowPartial)"
    );
    bytes32 public constant NAME_HASH = keccak256("420Exchange Limit Orders");
    bytes32 public constant VERSION_HASH = keccak256("1");

    ExchangeAtomicRouter420 public immutable atomicRouter;
    IExchangeLimitOrderAuthorization420 public immutable authorization;
    ExchangeEmergencyControl420 public immutable emergencyControl;

    mapping(bytes32 => uint128) public filledSellAmount;
    mapping(bytes32 => bool) public cancelledOrder;
    mapping(address => mapping(uint256 => bool)) public cancelledNonce;
    mapping(address => mapping(uint256 => bytes32)) public nonceOrderHash;
    mapping(address => uint256) public minValidNonce;

    uint256 private _entered;

    struct LimitOrder {
        address maker;
        address sellToken;
        address buyToken;
        uint128 sellAmount;
        uint128 minBuyAmount;
        address recipient;
        bytes32 marketId;
        uint256 nonce;
        uint64 expiry;
        bool allowPartial;
    }

    error InvalidAddress();
    error InvalidOrder();
    error InvalidSignature();
    error OrderExpired();
    error OrderCancelled();
    error NonceInvalid();
    error NonceAlreadyBound();
    error OrderFullyFilled();
    error PartialFillNotAllowed();
    error FillExceedsRemaining();
    error UnauthorizedLimitOrder();
    error InvalidOrderPath();
    error TokenCallFailed();
    error InputBalanceMismatch();
    error ResidualBalance();
    error InvalidNonceFloor();
    error Reentrancy();

    event LimitOrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed filler,
        uint256 nonce,
        uint128 sellAmountFilled,
        uint256 netBuyAmount,
        uint128 totalSellAmountFilled
    );
    event LimitOrderCancelled(bytes32 indexed orderHash, address indexed maker, uint256 indexed nonce);
    event LimitOrderNonceCancelled(address indexed maker, uint256 indexed nonce);
    event LimitOrderNonceFloorSet(address indexed maker, uint256 previousFloor, uint256 newFloor);

    constructor(address atomicRouter_, address authorization_, address emergencyControl_) {
        if (
            atomicRouter_ == address(0) || atomicRouter_.code.length == 0 || authorization_ == address(0)
                || authorization_.code.length == 0 || emergencyControl_ == address(0) || emergencyControl_.code.length == 0
        ) revert InvalidAddress();
        atomicRouter = ExchangeAtomicRouter420(payable(atomicRouter_));
        authorization = IExchangeLimitOrderAuthorization420(authorization_);
        emergencyControl = ExchangeEmergencyControl420(emergencyControl_);
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function hashOrder(LimitOrder calldata order) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                order.maker,
                order.sellToken,
                order.buyToken,
                order.sellAmount,
                order.minBuyAmount,
                order.recipient,
                order.marketId,
                order.nonce,
                order.expiry,
                order.allowPartial
            )
        );
    }

    function orderDigest(LimitOrder calldata order) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), hashOrder(order)));
    }

    function cancelOrder(LimitOrder calldata order) external {
        if (msg.sender != order.maker || order.maker == address(0)) revert InvalidOrder();
        bytes32 orderHash = hashOrder(order);
        cancelledOrder[orderHash] = true;
        emit LimitOrderCancelled(orderHash, order.maker, order.nonce);
    }

    function cancelNonce(uint256 nonce) external {
        cancelledNonce[msg.sender][nonce] = true;
        emit LimitOrderNonceCancelled(msg.sender, nonce);
    }

    function invalidateNoncesBefore(uint256 newFloor) external {
        uint256 previous = minValidNonce[msg.sender];
        if (newFloor <= previous) revert InvalidNonceFloor();
        minValidNonce[msg.sender] = newFloor;
        emit LimitOrderNonceFloorSet(msg.sender, previous, newFloor);
    }

    function fillOrder(
        LimitOrder calldata order,
        uint128 fillSellAmount,
        bytes calldata signature,
        bytes32 expectedPathHash,
        ExchangeAtomicRouter420.Hop[] calldata hops
    ) external nonReentrant returns (uint256 netBuyAmount) {
        emergencyControl.requireOpen(ExchangeEmergencyControl420.Domain.LIMIT_ORDERS);
        _validateOrder(order, fillSellAmount, hops);

        bytes32 orderHash = hashOrder(order);
        if (cancelledOrder[orderHash] || cancelledNonce[order.maker][order.nonce]) revert OrderCancelled();
        if (order.nonce < minValidNonce[order.maker]) revert NonceInvalid();
        if (!_isValidSignature(order.maker, orderDigest(order), signature)) revert InvalidSignature();

        bytes32 boundHash = nonceOrderHash[order.maker][order.nonce];
        if (boundHash == bytes32(0)) {
            nonceOrderHash[order.maker][order.nonce] = orderHash;
        } else if (boundHash != orderHash) {
            revert NonceAlreadyBound();
        }

        uint128 alreadyFilled = filledSellAmount[orderHash];
        if (alreadyFilled >= order.sellAmount) revert OrderFullyFilled();
        uint128 remaining = order.sellAmount - alreadyFilled;
        if (fillSellAmount > remaining) revert FillExceedsRemaining();
        if (!order.allowPartial && fillSellAmount != remaining) revert PartialFillNotAllowed();

        if (!authorization.canPlaceLimitOrder(order.maker, order.marketId, fillSellAmount)) {
            revert UnauthorizedLimitOrder();
        }

        uint256 minFillBuyAmount = _proportionalMinimum(order, fillSellAmount);
        bytes32 computedPathHash = atomicRouter.hashPath(order.sellToken, fillSellAmount, order.recipient, hops);
        if (computedPathHash != expectedPathHash) revert InvalidOrderPath();

        filledSellAmount[orderHash] = alreadyFilled + fillSellAmount;

        uint256 settlementBalanceBefore = _balanceOf(order.sellToken, address(this));
        _safeTransferFrom(order.sellToken, order.maker, address(this), fillSellAmount);
        uint256 settlementBalanceAfter = _balanceOf(order.sellToken, address(this));
        if (settlementBalanceAfter - settlementBalanceBefore != fillSellAmount) revert InputBalanceMismatch();

        _forceApprove(order.sellToken, address(atomicRouter), fillSellAmount);
        netBuyAmount = atomicRouter.swapExactInputPathDelegated(
            order.maker,
            order.sellToken,
            fillSellAmount,
            minFillBuyAmount,
            order.recipient,
            expectedPathHash,
            hops
        );
        _forceApprove(order.sellToken, address(atomicRouter), 0);

        if (_balanceOf(order.sellToken, address(this)) != settlementBalanceBefore) revert ResidualBalance();
        emit LimitOrderFilled(
            orderHash,
            order.maker,
            msg.sender,
            order.nonce,
            fillSellAmount,
            netBuyAmount,
            alreadyFilled + fillSellAmount
        );
    }

    function _validateOrder(
        LimitOrder calldata order,
        uint128 fillSellAmount,
        ExchangeAtomicRouter420.Hop[] calldata hops
    ) private view {
        if (
            order.maker == address(0) || order.sellToken == address(0) || order.buyToken == address(0)
                || order.sellToken == order.buyToken || order.sellAmount == 0 || order.minBuyAmount == 0
                || order.recipient == address(0) || order.marketId == bytes32(0) || fillSellAmount == 0
                || hops.length == 0
        ) revert InvalidOrder();
        if (block.timestamp > order.expiry) revert OrderExpired();
        if (hops[0].marketId != order.marketId || hops[hops.length - 1].tokenOut != order.buyToken) {
            revert InvalidOrderPath();
        }
    }

    function _proportionalMinimum(LimitOrder calldata order, uint128 fillSellAmount)
        private
        pure
        returns (uint256 minimum)
    {
        uint256 product = uint256(order.minBuyAmount) * uint256(fillSellAmount);
        uint256 denominator = uint256(order.sellAmount);
        minimum = product / denominator;
        if (product % denominator != 0) ++minimum;
        if (minimum == 0) revert InvalidOrder();
    }

    function _isValidSignature(address maker, bytes32 digest, bytes calldata signature) private view returns (bool) {
        if (maker.code.length != 0) {
            (bool ok, bytes memory data) = maker.staticcall(
                abi.encodeWithSelector(IERC1271LimitOrder420.isValidSignature.selector, digest, signature)
            );
            return ok && data.length >= 32 && abi.decode(data, (bytes4)) == ERC1271_MAGICVALUE;
        }

        if (signature.length != 65) return false;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > SECP256K1N_HALF || (v != 27 && v != 28)) return false;
        address recovered = ecrecover(digest, v, r, s);
        return recovered != address(0) && recovered == maker;
    }

    function _balanceOf(address token, address account) private view returns (uint256 balance) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(IERC20LimitOrder420.balanceOf.selector, account));
        if (!ok || data.length != 32) revert TokenCallFailed();
        balance = abi.decode(data, (uint256));
    }

    function _forceApprove(address token, address spender, uint256 amount) private {
        if (amount != 0) _safeApprove(token, spender, 0);
        _safeApprove(token, spender, amount);
    }

    function _safeApprove(address token, address spender, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
        if (!ok || (data.length != 0 && (data.length != 32 || !abi.decode(data, (bool))))) revert TokenCallFailed();
    }

    function _safeTransferFrom(address token, address from, address recipient, uint256 amount) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, recipient, amount));
        if (!ok || (data.length != 0 && (data.length != 32 || !abi.decode(data, (bool))))) revert TokenCallFailed();
    }
}
