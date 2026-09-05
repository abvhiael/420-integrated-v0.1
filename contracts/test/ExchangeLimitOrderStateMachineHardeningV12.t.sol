// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeLimitOrderSettlement420.t.sol";

contract ExchangeLimitOrderStateMachineHardeningV12Test is ExchangeLimitOrderSettlement420Test {
    function testRepeatedPartialFillsAccumulateExactlyThenRejectReplay() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(101, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 orderHash = settlement.hashOrder(order);

        uint128[4] memory fills = [uint128(7 ether), uint128(13 ether), uint128(29 ether), uint128(51 ether)];
        uint256 expectedBought;
        uint256 expectedFilled;

        for (uint256 i = 0; i < fills.length; ++i) {
            bytes32 pathHash = router.hashPath(address(sellToken), fills[i], maker, hops);
            vm.prank(filler);
            uint256 amountOut = settlement.fillOrder(order, fills[i], signature, pathHash, hops);
            expectedFilled += fills[i];
            expectedBought += uint256(fills[i]) * 2;
            assertEq(amountOut, uint256(fills[i]) * 2);
            assertEq(settlement.filledSellAmount(orderHash), expectedFilled);
            assertEq(buyToken.balanceOf(maker), expectedBought);
            assertEq(sellToken.balanceOf(address(settlement)), 0);
            assertEq(sellToken.allowance(address(settlement), address(router)), 0);
        }

        bytes32 replayPath = router.hashPath(address(sellToken), 1 ether, maker, hops);
        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.OrderFullyFilled.selector);
        settlement.fillOrder(order, 1 ether, signature, replayPath, hops);
    }

    function testPartialFillThenCancelBlocksRemainingWithoutChangingFilledState() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(102, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 orderHash = settlement.hashOrder(order);

        bytes32 firstPath = router.hashPath(address(sellToken), 25 ether, maker, hops);
        vm.prank(filler);
        settlement.fillOrder(order, 25 ether, signature, firstPath, hops);
        assertEq(settlement.filledSellAmount(orderHash), 25 ether);

        vm.prank(maker);
        settlement.cancelOrder(order);

        bytes32 secondPath = router.hashPath(address(sellToken), 25 ether, maker, hops);
        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.OrderCancelled.selector);
        settlement.fillOrder(order, 25 ether, signature, secondPath, hops);
        assertEq(settlement.filledSellAmount(orderHash), 25 ether);
    }

    function testPartialFillThenNonceFloorInvalidatesRemainingOrder() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(103, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 orderHash = settlement.hashOrder(order);

        bytes32 firstPath = router.hashPath(address(sellToken), 10 ether, maker, hops);
        vm.prank(filler);
        settlement.fillOrder(order, 10 ether, signature, firstPath, hops);

        vm.prank(maker);
        settlement.invalidateNoncesBefore(104);

        bytes32 secondPath = router.hashPath(address(sellToken), 10 ether, maker, hops);
        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.NonceInvalid.selector);
        settlement.fillOrder(order, 10 ether, signature, secondPath, hops);
        assertEq(settlement.filledSellAmount(orderHash), 10 ether);
    }

    function testExpiryBoundaryAcceptsAtExpiryAndRejectsOneSecondLater() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory atBoundary = _order(104, true);
        atBoundary.expiry = uint64(block.timestamp + 100);
        bytes memory signature = _sign(atBoundary, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();

        vm.warp(atBoundary.expiry);
        bytes32 pathHash = router.hashPath(address(sellToken), 10 ether, maker, hops);
        vm.prank(filler);
        settlement.fillOrder(atBoundary, 10 ether, signature, pathHash, hops);

        ExchangeLimitOrderSettlement420.LimitOrder memory expired = _order(105, true);
        expired.expiry = uint64(block.timestamp + 100);
        bytes memory expiredSignature = _sign(expired, MAKER_PK);
        vm.warp(expired.expiry + 1);
        bytes32 expiredPath = router.hashPath(address(sellToken), 10 ether, maker, hops);
        vm.prank(filler);
        vm.expectRevert(ExchangeLimitOrderSettlement420.OrderExpired.selector);
        settlement.fillOrder(expired, 10 ether, expiredSignature, expiredPath, hops);
    }

    function testProportionalMinimumRoundsUpOnFractionalFill() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(106, true);
        order.sellAmount = 3;
        order.minBuyAmount = 10;
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();

        bytes32 pathHash = router.hashPath(address(sellToken), 1, maker, hops);
        uint256 beforeBuy = buyToken.balanceOf(maker);
        vm.prank(filler);
        uint256 amountOut = settlement.fillOrder(order, 1, signature, pathHash, hops);

        assertEq(amountOut, 4);
        assertEq(buyToken.balanceOf(maker) - beforeBuy, 4);
    }

    function testFailedDownstreamTransferRollsBackFillAndNonceBinding() public {
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(107, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 orderHash = settlement.hashOrder(order);
        bytes32 pathHash = router.hashPath(address(sellToken), 10 ether, maker, hops);

        vm.prank(maker);
        sellToken.approve(address(settlement), 0);

        vm.prank(filler);
        vm.expectRevert();
        settlement.fillOrder(order, 10 ether, signature, pathHash, hops);

        assertEq(settlement.filledSellAmount(orderHash), 0);
        assertEq(settlement.nonceOrderHash(maker, order.nonce), bytes32(0));
        assertEq(sellToken.balanceOf(address(settlement)), 0);
        assertEq(sellToken.allowance(address(settlement), address(router)), 0);
    }

    function testFuzzRepeatedTwoStagePartialFill(uint96 rawFirstFill) public {
        uint128 firstFill = uint128((uint256(rawFirstFill) % (99 ether)) + 1);
        uint128 secondFill = uint128(100 ether - firstFill);
        ExchangeLimitOrderSettlement420.LimitOrder memory order = _order(108, true);
        bytes memory signature = _sign(order, MAKER_PK);
        ExchangeAtomicRouter420.Hop[] memory hops = _hops();
        bytes32 orderHash = settlement.hashOrder(order);

        bytes32 firstPath = router.hashPath(address(sellToken), firstFill, maker, hops);
        vm.prank(filler);
        settlement.fillOrder(order, firstFill, signature, firstPath, hops);
        assertEq(settlement.filledSellAmount(orderHash), firstFill);

        bytes32 secondPath = router.hashPath(address(sellToken), secondFill, maker, hops);
        vm.prank(filler);
        settlement.fillOrder(order, secondFill, signature, secondPath, hops);

        assertEq(settlement.filledSellAmount(orderHash), 100 ether);
        assertEq(buyToken.balanceOf(maker), 200 ether);
        assertEq(sellToken.balanceOf(address(settlement)), 0);
        assertEq(sellToken.allowance(address(settlement), address(router)), 0);
    }
}
