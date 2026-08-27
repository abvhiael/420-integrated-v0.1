// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/market/MarketPolicyRegistry420.sol";
import "../src/market/ListingRegistry420.sol";
import "../src/market/OrderRegistry420.sol";

interface VmMarket420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract Market420Test {
    VmMarket420 internal constant vm = VmMarket420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant SELLER = address(0x5E11E2);
    address internal constant BUYER = address(0xB0B);
    address internal constant SETTLEMENT = address(0x5E771E);
    address internal constant QUOTE = address(0x420);

    bytes32 internal constant POLICY = keccak256("market-policy");
    bytes32 internal constant ADAPTER = keccak256("420pay-adapter");
    bytes32 internal constant PHYSICAL = keccak256("420/MARKET/ITEM/PHYSICAL_GOOD/V1");
    bytes32 internal constant SERVICE = keccak256("420/MARKET/ITEM/SERVICE/V1");
    bytes32 internal constant FIXED = keccak256("420/MARKET/SALE/FIXED_PRICE/V1");

    function _deploy() private returns (MarketPolicyRegistry420 policy, ListingRegistry420 listings, OrderRegistry420 orders) {
        policy = new MarketPolicyRegistry420(address(this));
        policy.setPolicy(POLICY, keccak256("policy-meta"), bytes32(0), 0, true);
        policy.setSettlementAdapter(ADAPTER, SETTLEMENT, keccak256("420/pay"), keccak256("adapter-meta"), true);
        listings = new ListingRegistry420(address(policy));
        orders = new OrderRegistry420(address(listings), address(policy));
    }

    function _createFixedListing(ListingRegistry420 listings, bytes32 listingId) private {
        vm.prank(SELLER);
        listings.createListing(
            listingId,
            keccak256("seller-profile"),
            PHYSICAL,
            keccak256("inventory-item-42"),
            keccak256("listing-meta"),
            POLICY,
            FIXED,
            ADAPTER,
            QUOTE,
            100 ether,
            5,
            0
        );
    }

    function testListingHistoryIsRevisionPinned() public {
        (, ListingRegistry420 listings,) = _deploy();
        bytes32 listingId = keccak256("listing-1");
        _createFixedListing(listings, listingId);

        vm.prank(SELLER);
        listings.reviseListing(
            listingId,
            keccak256("listing-meta-v2"),
            POLICY,
            FIXED,
            ADAPTER,
            QUOTE,
            120 ether,
            4,
            0
        );

        ListingRegistry420.Listing memory current = listings.getListing(listingId);
        ListingRegistry420.Listing memory first = listings.getListingRevision(listingId, 1);
        require(current.revision == 2 && current.unitPrice == 120 ether, "current revision");
        require(first.revision == 1 && first.unitPrice == 100 ether, "historical revision");
        require(first.assetRef == current.assetRef, "asset identity changed");
    }

    function testInactivePolicyCannotPublishListing() public {
        (MarketPolicyRegistry420 policy, ListingRegistry420 listings,) = _deploy();
        policy.setPolicy(POLICY, bytes32(0), bytes32(0), 0, false);

        vm.prank(SELLER);
        vm.expectRevert(ListingRegistry420.InactivePolicy.selector);
        listings.createListing(
            keccak256("listing-disabled"),
            bytes32(0),
            SERVICE,
            keccak256("service-offer"),
            bytes32(0),
            POLICY,
            FIXED,
            ADAPTER,
            QUOTE,
            1 ether,
            1,
            0
        );
    }

    function testOrderLifecycleUsesAuthorizedSettlementReporter() public {
        (, ListingRegistry420 listings, OrderRegistry420 orders) = _deploy();
        bytes32 listingId = keccak256("listing-order");
        bytes32 orderId = keccak256("order-1");
        _createFixedListing(listings, listingId);

        vm.prank(BUYER);
        orders.createOrder(orderId, listingId, 1, 2, QUOTE, 200 ether);

        vm.prank(BUYER);
        vm.expectRevert(OrderRegistry420.UnauthorizedSettlementReporter.selector);
        orders.recordPayment(orderId, keccak256("fake-payment"));

        vm.prank(SETTLEMENT);
        orders.recordPayment(orderId, keccak256("420pay-payment"));

        vm.prank(SELLER);
        orders.recordFulfillment(orderId, keccak256("carrier-or-delivery-proof"));

        vm.prank(BUYER);
        orders.completeOrder(orderId);

        (,,,,,,,,,, OrderRegistry420.Status status,,) = orders.orders(orderId);
        require(status == OrderRegistry420.Status.COMPLETED, "not completed");
    }

    function testDisputeCanOnlyRefundThroughSettlementAdapter() public {
        (, ListingRegistry420 listings, OrderRegistry420 orders) = _deploy();
        bytes32 listingId = keccak256("listing-dispute");
        bytes32 orderId = keccak256("order-dispute");
        _createFixedListing(listings, listingId);

        vm.prank(BUYER);
        orders.createOrder(orderId, listingId, 1, 1, QUOTE, 100 ether);
        vm.prank(SETTLEMENT);
        orders.recordPayment(orderId, keccak256("payment"));
        vm.prank(BUYER);
        orders.disputeOrder(orderId, keccak256("dispute-manifest"));

        vm.prank(SELLER);
        vm.expectRevert(OrderRegistry420.UnauthorizedSettlementReporter.selector);
        orders.recordRefund(orderId, keccak256("fake-refund"));

        vm.prank(SETTLEMENT);
        orders.recordRefund(orderId, keccak256("420pay-refund"));

        (,,,,,,,,,, OrderRegistry420.Status status,,) = orders.orders(orderId);
        require(status == OrderRegistry420.Status.REFUNDED, "not refunded");
    }
}
