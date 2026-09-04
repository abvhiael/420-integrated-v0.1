// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/exchange/ExchangeAtomicRouter420.sol";
import "../src/exchange/ExchangeEmergencyControl420.sol";
import "../src/exchange/ExchangeLimitOrderSettlement420.sol";

contract MockOrderToken420 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockOrderAuthorization420 {
    bool public allowed = true;

    function setAllowed(bool value) external {
        allowed = value;
    }

    function canPlaceLimitOrder(address, bytes32, uint256) external view returns (bool) {
        return allowed;
    }
}

contract MockOrderEmergency420 {
    bool public halted;

    function setHalted(bool value) external {
        halted = value;
    }

    function requireOpen(ExchangeEmergencyControl420.Domain) external view {
        require(!halted, "exchange halted");
    }
}

contract MockOrderAtomicRouter420 {
    function hashPath(
        address tokenIn,
        uint256 amountIn,
        address recipient,
        ExchangeAtomicRouter420.Hop[] calldata hops
    ) external pure returns (bytes32) {
        return keccak256(abi.encode(tokenIn, amountIn, recipient, hops));
    }

    function swapExactInputPathDelegated(
        address,
        address tokenIn,
        uint256 amountIn,
        uint256 minFinalAmountOut,
        address recipient,
        bytes32 expectedPathHash,
        ExchangeAtomicRouter420.Hop[] calldata hops
    ) external returns (uint256 amountOut) {
        require(
            expectedPathHash == keccak256(abi.encode(tokenIn, amountIn, recipient, hops)),
            "path"
        );
        MockOrderToken420(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        amountOut = minFinalAmountOut;
        MockOrderToken420(hops[hops.length - 1].tokenOut).mint(recipient, amountOut);
    }
}

contract ExchangeLimitOrderSettlement420Test is Test {
    uint256 internal constant MAKER_PK = 0xA11CE;
    address internal maker;
    address internal filler = address(0xF111);
    bytes32 internal constant MARKET = keccak256("420/TEST/MARKET");
    bytes32 internal constant ROUTE = keccak256("420/TEST/ROUTE");

    MockOrderToken420 internal sellToken;
    MockOrderToken420 internal buyToken;
    MockOrderAuthorization420 internal authorization;
    MockOrderEmergency420 internal emergency;
    MockOrderAtomicRouter420 internal router;
    ExchangeLimitOrderSettlement420 internal settlement;

    function setUp() public {
        maker = vm.addr(MAKER_PK);
        sellToken = new MockOrderToken420("Sell", "SELL");
        buyToken = new MockOrderToken420("Buy", "BUY");
        authorization = new MockOrderAuthorization420();
        emergency = new MockOrderEmergency420();
        router = new MockOrderAtomicRouter420();
        settlement = new ExchangeLimitOrderSettlement420(address(router), address(authorization), address(emergency));

        sellToken.mint(maker, 1_000 ether);
        vm.prank(maker);
        sellToken.approve(address(settlement), type(uint256).max);
    }

    function testPartialFillUsesProportionalMinimumAndTracksFill() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(1, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 pathHash = router.hashPath(address(sellToken), 40 ether, maker, hops);

        vm.prank(filler);
        uint256 amountOut = settlement.fillOrder(order, 40 ether, signature, pathHash, hops);

        assertEq(amountOut, 80 ether);
        assertEq(buyToken.balanceOf(maker), 80 ether);
        assertEq(settlement.filledSellAmount(settlement.hashOrder(order)), 40 ether);
        assertEq(sellToken.balanceOf(address(settlement)), 0);
        assertEq(sellToken.allowance(address(settlement), address(router)), 0);
    }

    function testNonPartialOrderRejectsPartialFill() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(2, false);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 pathHash = router.hashPath(address(sellToken), 40 ether, maker, hops);

        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.PartialFillNotAllowed.selector);
        settlement.fillOrder(order, 40 ether, signature, pathHash, hops);
    }

    function testCancelOrderFailsClosed() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(3, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 pathHash = router.hashPath(address(sellToken), 10 ether, maker, hops);

        vm.prank(maker);
        settlement.cancelOrder(order);

        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.OrderCancelled.selector);
        settlement.fillOrder(order, 10 ether, signature, pathHash, hops);
    }

    function testCancelNonceFailsClosed() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(4, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 pathHash = router.hashPath(address(sellToken), 10 ether, maker, hops);

        vm.prank(maker);
        settlement.cancelNonce(order.nonce);

        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.OrderCancelled.selector);
        settlement.fillOrder(order, 10 ether, signature, pathHash, hops);
    }

    function testNonceFloorInvalidatesOlderOrders() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(5, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 pathHash = router.hashPath(address(sellToken), 10 ether, maker, hops);

        vm.prank(maker);
        settlement.invalidateNoncesBefore(6);

        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.NonceInvalid.selector);
        settlement.fillOrder(order, 10 ether, signature, pathHash, hops);
    }

    function testSameNonceCannotBindDifferentSignedOrders() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory first = _order(7, true);
        ExchangeLimitOrderSettlement420.LimitOrder memory second = _order(7, true);
        second.minBuyAmount = 210 ether;
        bytes memory firstSignature = _sign(first, MAKER_PK);
        bytes memory secondSignature = _sign(second, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();

        bytes32 firstPath = router.hashPath(address(sellToken), 10 ether, maker, hops);
        vm.prank(filler);
        settlement.fillOrder(first, 10 ether, firstSignature, firstPath, hops);

        bytes32 secondPath = router.hashPath(address(sellToken), 10 ether, maker, hops);
        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.NonceAlreadyBound.selector);
        settlement.fillOrder(second, 10 ether, secondSignature, secondPath, hops);
    }

    function testExpiredOrderFailsClosed() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(8, true);
        order.expiry = uint64(block.timestamp + 1);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 pathHash = router.hashPath(address(sellToken), 10 ether, maker, hops);
        vm.warp(block.timestamp + 2);

        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.OrderExpired.selector);
        settlement.fillOrder(order, 10 ether, signature, pathHash, hops);
    }

    function testInvalidSignatureFailsClosed() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(9, true);
        bytes memory signature = _sign(order, 0xB0B);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 pathHash = router.hashPath(address(sellToken), 10 ether, maker, hops);

        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.InvalidSignature.selector);
        settlement.fillOrder(order, 10 ether, signature, pathHash, hops);
    }

    function testLimitOrderCapabilityFailsClosed() public {
        authorization.setAllowed(false);
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(10, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 pathHash = router.hashPath(address(sellToken), 10 ether, maker, hops);

        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.UnauthorizedLimitOrder.selector);
        settlement.fillOrder(order, 10 ether, signature, pathHash, hops);
    }

    function _order(uint256 nonce, bool allowPartial)
        internal
        view
        returns (ExchangeLimitOrderSettlement420.LimitOrder memory order)
    {
        order = ExchangeLimitOrderSettlement420.LimitOrder({
            maker: maker,
            sellToken: address(sellToken),
            buyToken: address(buyToken),
            sellAmount: uint128(100 ether),
            minBuyAmount: uint128(200 ether),
            recipient: maker,
            marketId: MARKET,
            nonce: nonce,
            expiry: uint64(block.timestamp + 1 days),
            allowPartial: allowPartial
        });
    }

    function _hops() internal view returns (ExchangeAtomicRouter420.Hop[] memory hops) {
        hops = new ExchangeAtomicRouter420.Hop[](1);
        hops[0] = ExchangeAtomicRouter420.Hop({
            marketId: MARKET,
            routeId: ROUTE,
            tokenOut: address(buyToken),
            minAmountOut: 1,
            routeData: ""
        });
    }

    function _sign(ExchangeLimitOrderSettlement420.LimitOrder memory order, uint256 privateKey)
        internal
        returns (bytes memory signature)
    {
        bytes32 digest = settlement.orderDigest(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        signature = abi.encodePacked(r, s, v);
    }
}
