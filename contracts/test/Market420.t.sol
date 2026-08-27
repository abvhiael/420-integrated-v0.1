// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/market/MarketPolicyRegistry420.sol";
import "../src/market/ListingRegistry420.sol";
import "../src/market/InventoryReservation420.sol";
import "../src/market/OrderRegistry420.sol";

interface VmMarket420 { function prank(address) external; function expectRevert(bytes4) external; }

contract Market420Test {
    VmMarket420 internal constant vm = VmMarket420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant SELLER = address(0x5E11E2);
    address internal constant BUYER = address(0xB0B);
    address internal constant BUYER2 = address(0xB0B2);
    address internal constant SETTLEMENT = address(0x5E771E);
    address internal constant QUOTE = address(0x420);
    bytes32 internal constant POLICY = keccak256("market-policy");
    bytes32 internal constant ADAPTER = keccak256("420pay-adapter");
    bytes32 internal constant PHYSICAL = keccak256("420/MARKET/ITEM/PHYSICAL_GOOD/V1");
    bytes32 internal constant SERVICE = keccak256("420/MARKET/ITEM/SERVICE/V1");
    bytes32 internal constant FIXED = keccak256("420/MARKET/SALE/FIXED_PRICE/V1");

    function _deploy() private returns (MarketPolicyRegistry420 policy, ListingRegistry420 listings, InventoryReservation420 inventory, OrderRegistry420 orders) {
        policy = new MarketPolicyRegistry420(address(this));
        policy.setPolicy(POLICY, keccak256("policy-meta"), bytes32(0), 0, true);
        policy.setSettlementAdapter(ADAPTER, SETTLEMENT, keccak256("420/pay"), keccak256("adapter-meta"), true);
        listings = new ListingRegistry420(address(policy));
        inventory = new InventoryReservation420(address(this), address(listings));
        orders = new OrderRegistry420(address(listings), address(policy), address(inventory));
        inventory.bindOrderRegistry(address(orders));
    }

    function _createFixedListing(ListingRegistry420 listings, bytes32 listingId) private {
        vm.prank(SELLER);
        listings.createListing(listingId, keccak256("seller-profile"), PHYSICAL, keccak256("inventory-item-42"), keccak256("listing-meta"), POLICY, FIXED, ADAPTER, QUOTE, 100 ether, 5, 0);
    }

    function testListingHistoryIsRevisionPinned() public {
        (, ListingRegistry420 listings,,) = _deploy();
        bytes32 listingId = keccak256("listing-1"); _createFixedListing(listings, listingId);
        vm.prank(SELLER);
        listings.reviseListing(listingId, keccak256("listing-meta-v2"), POLICY, FIXED, ADAPTER, QUOTE, 120 ether, 5, 0);
        ListingRegistry420.Listing memory current = listings.getListing(listingId);
        ListingRegistry420.Listing memory first = listings.getListingRevision(listingId, 1);
        require(current.revision == 2 && current.unitPrice == 120 ether, "current revision");
        require(first.revision == 1 && first.unitPrice == 100 ether, "historical revision");
        require(first.assetRef == current.assetRef, "asset identity changed");
    }

    function testRevisionCannotResetFiniteQuantity() public {
        (, ListingRegistry420 listings,,) = _deploy();
        bytes32 listingId = keccak256("listing-quantity"); _createFixedListing(listings, listingId);
        vm.prank(SELLER); vm.expectRevert(ListingRegistry420.QuantityImmutable.selector);
        listings.reviseListing(listingId, bytes32(0), POLICY, FIXED, ADAPTER, QUOTE, 100 ether, 6, 0);
    }

    function testInactivePolicyCannotPublishListing() public {
        (MarketPolicyRegistry420 policy, ListingRegistry420 listings,,) = _deploy();
        policy.setPolicy(POLICY, bytes32(0), bytes32(0), 0, false);
        vm.prank(SELLER); vm.expectRevert(ListingRegistry420.InactivePolicy.selector);
        listings.createListing(keccak256("listing-disabled"), bytes32(0), SERVICE, keccak256("service-offer"), bytes32(0), POLICY, FIXED, ADAPTER, QUOTE, 1 ether, 1, 0);
    }

    function testInventoryReservationPreventsOversell() public {
        (, ListingRegistry420 listings, InventoryReservation420 inventory, OrderRegistry420 orders) = _deploy();
        bytes32 listingId = keccak256("listing-stock"); _createFixedListing(listings, listingId);
        vm.prank(BUYER); orders.createOrder(keccak256("order-a"), listingId, 1, 4, QUOTE, 400 ether);
        require(inventory.available(listingId) == 1, "available mismatch");
        vm.prank(BUYER2); vm.expectRevert(InventoryReservation420.InsufficientAvailableInventory.selector);
        orders.createOrder(keccak256("order-b"), listingId, 1, 2, QUOTE, 200 ether);
        require(inventory.conserved(listingId), "inventory not conserved");
    }

    function testCancellationReleasesInventory() public {
        (, ListingRegistry420 listings, InventoryReservation420 inventory, OrderRegistry420 orders) = _deploy();
        bytes32 listingId = keccak256("listing-release"); bytes32 orderId = keccak256("order-release"); _createFixedListing(listings, listingId);
        vm.prank(BUYER); orders.createOrder(orderId, listingId, 1, 3, QUOTE, 300 ether);
        require(inventory.available(listingId) == 2, "reserve failed");
        vm.prank(BUYER); orders.cancelOrder(orderId);
        require(inventory.available(listingId) == 5, "release failed");
        (uint256 original, uint256 reserved, uint256 sold, uint256 released,) = inventory.inventory(listingId);
        require(original == 5 && reserved == 0 && sold == 0 && released == 3, "release accounting");
        require(inventory.conserved(listingId), "inventory not conserved");
    }

    function testCompletionConsumesInventory() public {
        (, ListingRegistry420 listings, InventoryReservation420 inventory, OrderRegistry420 orders) = _deploy();
        bytes32 listingId = keccak256("listing-consume"); bytes32 orderId = keccak256("order-consume"); _createFixedListing(listings, listingId);
        vm.prank(BUYER); orders.createOrder(orderId, listingId, 1, 2, QUOTE, 200 ether);
        vm.prank(SETTLEMENT); orders.recordPayment(orderId, keccak256("payment"));
        vm.prank(SELLER); orders.recordFulfillment(orderId, keccak256("proof"));
        vm.prank(BUYER); orders.completeOrder(orderId);
        require(inventory.available(listingId) == 3, "sold availability");
        (uint256 original, uint256 reserved, uint256 sold,,) = inventory.inventory(listingId);
        require(original == 5 && reserved == 0 && sold == 2, "consume accounting");
        require(inventory.conserved(listingId), "inventory not conserved");
    }

    function testOrderLifecycleUsesAuthorizedSettlementReporter() public {
        (, ListingRegistry420 listings,, OrderRegistry420 orders) = _deploy();
        bytes32 listingId = keccak256("listing-order"); bytes32 orderId = keccak256("order-1"); _createFixedListing(listings, listingId);
        vm.prank(BUYER); orders.createOrder(orderId, listingId, 1, 2, QUOTE, 200 ether);
        vm.prank(BUYER); vm.expectRevert(OrderRegistry420.UnauthorizedSettlementReporter.selector); orders.recordPayment(orderId, keccak256("fake-payment"));
        vm.prank(SETTLEMENT); orders.recordPayment(orderId, keccak256("420pay-payment"));
        vm.prank(SELLER); orders.recordFulfillment(orderId, keccak256("carrier-or-delivery-proof"));
        vm.prank(BUYER); orders.completeOrder(orderId);
        require(orders.orderStatus(orderId) == OrderRegistry420.Status.COMPLETED, "not completed");
    }

    function testDisputeCanOnlyRefundThroughSettlementAdapter() public {
        (, ListingRegistry420 listings, InventoryReservation420 inventory, OrderRegistry420 orders) = _deploy();
        bytes32 listingId = keccak256("listing-dispute"); bytes32 orderId = keccak256("order-dispute"); _createFixedListing(listings, listingId);
        vm.prank(BUYER); orders.createOrder(orderId, listingId, 1, 1, QUOTE, 100 ether);
        vm.prank(SETTLEMENT); orders.recordPayment(orderId, keccak256("payment"));
        vm.prank(BUYER); orders.disputeOrder(orderId, keccak256("dispute-manifest"));
        vm.prank(SELLER); vm.expectRevert(OrderRegistry420.UnauthorizedSettlementReporter.selector); orders.recordRefund(orderId, keccak256("fake-refund"));
        vm.prank(SETTLEMENT); orders.recordRefund(orderId, keccak256("420pay-refund"));
        require(inventory.available(listingId) == 5, "refund did not release");
        require(orders.orderStatus(orderId) == OrderRegistry420.Status.REFUNDED, "not refunded");
    }
}
