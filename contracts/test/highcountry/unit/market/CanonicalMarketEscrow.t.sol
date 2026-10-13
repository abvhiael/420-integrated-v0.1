// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {bindRetainedR04Emergency,retainedR04AuthorizationRoot} from "../../mocks/R04EmergencyFixture.sol";
import { InventoryRegistry } from "../../../../src/highcountry/inventory/InventoryRegistry.sol";
import { ResourceLedger } from "../../../../src/highcountry/inventory/ResourceLedger.sol";
import { CanonicalMarketEscrow } from "../../../../src/highcountry/market/CanonicalMarketEscrow.sol";

contract MarketEscrowProductStub { }

contract MarketSeller {
    function approve(
        InventoryRegistry inv,
        address op,
        bool enabled
    ) external {
        inv.setInventoryOperator(op, enabled);
        inv.setMarketTransferOperator(op, enabled);
    }

    function open(
        CanonicalMarketEscrow market,
        bytes32 id,
        bytes32 asset,
        uint256 qty,
        uint64 deadline
    ) external {
        market.list(id, asset, qty, deadline);
    }

    function releaseDirect(
        InventoryRegistry inv,
        bytes32 op,
        bytes32 asset,
        uint256 quantity
    ) external {
        inv.release(op, asset, quantity);
    }

    function cancel(
        CanonicalMarketEscrow market,
        bytes32 id
    ) external {
        market.cancel(id);
    }
}

contract CanonicalMarketEscrowR048Test {
    InventoryRegistry inv;
    ResourceLedger ledger;
    CanonicalMarketEscrow market;
    MarketSeller seller;
    bytes32 constant ASSET = keccak256("market-test-asset");
    bytes32 constant LISTING = keccak256("market-test-listing");
    address constant BUYER = address(0xA123);

    function setUp() public {
        inv = new InventoryRegistry(address(new MarketEscrowProductStub()));
        ledger = inv.ledger();
        inv.registerResource(ASSET, InventoryRegistry.Unit.COUNT);
        inv.setIssuer(address(this), true);
        seller = new MarketSeller();
        market = new CanonicalMarketEscrow(retainedR04AuthorizationRoot(), address(inv), address(this));
        bindRetainedR04Emergency(address(market));
        seller.approve(inv, address(market), true);
        inv.acquire(bytes32(uint256(100)), ASSET, address(seller), 10);
    }

    function testSellerLockSettlementConservationAndReplay() public {
        seller.open(market, LISTING, ASSET, 6, uint64(block.timestamp + 500));
        ResourceLedger.Balance memory oldBalance = ledger.balance(ASSET, address(seller));
        require(oldBalance.available == 4 && oldBalance.reserved == 6, "incorrect reservation");
        bytes32 transfer = market.settle(LISTING, BUYER);
        require(transfer == market.transferOperation(LISTING, BUYER), "transfer id mismatch");
        ResourceLedger.Balance memory sellerBalance = ledger.balance(ASSET, address(seller));
        ResourceLedger.Balance memory buyerBalance = ledger.balance(ASSET, BUYER);
        require(sellerBalance.available == 4 && sellerBalance.reserved == 0, "seller double-spend");
        require(buyerBalance.available == 6, "buyer did not receive");
        require(ledger.issued(ASSET) == 10 && ledger.consumed(ASSET) == 0, "supply conserved");
        (bool duplicate,) = address(market).call(abi.encodeCall(market.settle, (LISTING, BUYER)));
        require(!duplicate, "duplicate settlement");
        (bool refund,) = address(seller).call(abi.encodeCall(seller.cancel, (market, LISTING)));
        require(!refund, "sold item refunded");
    }

    function testOwnerCancellationAndOneTimeListingIdentity() public {
        seller.open(market, LISTING, ASSET, 3, uint64(block.timestamp + 100));
        seller.cancel(market, LISTING);
        ResourceLedger.Balance memory b = ledger.balance(ASSET, address(seller));
        require(b.available == 10 && b.reserved == 0, "refund mismatch");
        (bool again,) = address(seller)
            .call(abi.encodeCall(seller.open, (market, LISTING, ASSET, uint256(3), uint64(block.timestamp + 100))));
        require(!again, "relisted consumed identity");
    }

    function testUnapprovedOperatorAndRevocationFailClosed() public {
        seller.approve(inv, address(market), false);
        (bool unauthorized,) = address(seller)
            .call(abi.encodeCall(seller.open, (market, LISTING, ASSET, uint256(2), uint64(block.timestamp + 100))));
        require(!unauthorized, "unapproved reservation");
        seller.approve(inv, address(market), true);
        seller.open(market, LISTING, ASSET, 2, uint64(block.timestamp + 100));
        seller.approve(inv, address(market), false);
        (bool blocked,) = address(market).call(abi.encodeCall(market.settle, (LISTING, BUYER)));
        require(!blocked, "revoked custody settled");
        require(market.listing(LISTING).status == CanonicalMarketEscrow.Status.Active, "rollback failed");
    }

    function testRevokedSellerCanCloseAndManuallyRecoverReservedStock() public {
        seller.open(market, LISTING, ASSET, 2, uint64(block.timestamp + 100));
        seller.approve(inv, address(market), false);
        seller.cancel(market, LISTING);
        require(market.listing(LISTING).status == CanonicalMarketEscrow.Status.Cancelled, "closure stranded");
        ResourceLedger.Balance memory locked = ledger.balance(ASSET, address(seller));
        require(locked.reserved == 2, "unexpected automatic release");
        seller.releaseDirect(inv, bytes32(uint256(501)), ASSET, 2);
        ResourceLedger.Balance memory restored = ledger.balance(ASSET, address(seller));
        require(restored.reserved == 0 && restored.available == 10, "manual recovery failed");
        (bool sold,) = address(market).call(abi.encodeCall(market.settle, (LISTING, BUYER)));
        require(!sold, "closed escrow sold");
    }

    function testSelfTradeAndCallerScope() public {
        seller.open(market, LISTING, ASSET, 2, uint64(block.timestamp + 100));
        (bool self,) = address(market).call(abi.encodeCall(market.settle, (LISTING, address(seller))));
        require(!self, "self trade");
        (bool wrongCancel,) = address(market).call(abi.encodeCall(market.cancel, (LISTING)));
        require(!wrongCancel, "foreign cancellation");
    }
}

