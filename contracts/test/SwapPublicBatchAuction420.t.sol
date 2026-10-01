// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/swap/PublicBatchAuction.sol";
import "../src/swap/ApprovedQuoteAssetRegistry.sol";
import "./helpers/GenesisMocks420.sol";

interface VmPublicBatchAuction420 {
    function prank(address) external;
    function warp(uint256) external;
    function deal(address account, uint256 newBalance) external;
}

contract MockAuctionQuote420 {
    string public constant name = "Mock USD";
    string public constant symbol = "mUSD";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public feeOnTransfer;

    function setFeeOnTransfer(bool enabled) external { feeOnTransfer = enabled; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        uint256 received = feeOnTransfer && amount != 0 ? amount - 1 : amount;
        balanceOf[to] += received;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        uint256 received = feeOnTransfer && amount != 0 ? amount - 1 : amount;
        balanceOf[to] += received;
        return true;
    }
}

contract AuctionUnauthorizedCaller420 {
    function settle(PublicBatchAuction auction, uint256 auctionId, uint256 price) external {
        auction.settle(auctionId, price);
    }

    function cancel(PublicBatchAuction auction, uint256 auctionId) external {
        auction.cancel(auctionId, keccak256("unauthorized"));
    }
}

contract SwapPublicBatchAuction420Test {
    VmPublicBatchAuction420 internal constant vm =
        VmPublicBatchAuction420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant PROCEEDS = address(0xFEE);

    uint256 internal constant AUCTION_ID = 1;
    uint64 internal constant OPEN_AT = 1_010;
    uint64 internal constant CLOSE_AT = 1_110;

    struct Suite {
        GenesisMockEnvironment420 env;
        ApprovedQuoteAssetRegistry quoteRegistry;
        PublicBatchAuction auction;
        MockAuctionQuote420 quote;
    }

    function _deploy(bool makeCanonical) internal returns (Suite memory s) {
        vm.warp(1_000);
        s.env = new GenesisMockEnvironment420();
        s.quote = new MockAuctionQuote420();
        s.quoteRegistry = new ApprovedQuoteAssetRegistry(
            address(this), address(s.env.registry()), keccak256("quote-registry")
        );
        s.auction = new PublicBatchAuction(
            address(this), address(s.env.registry()), keccak256("public-batch-auction")
        );

        s.env.registerResident(address(s.quoteRegistry), s.quoteRegistry.componentId());
        s.env.registerResident(address(s.auction), s.auction.componentId());
        s.env.setSettlementAsset(address(s.quote), keccak256("mock-usd"), true);

        s.quoteRegistry.setApproved(
            address(s.quote),
            bytes3("USD"),
            ApprovedQuoteAssetRegistry.Status.APPROVED,
            keccak256("mock-usd-metadata")
        );
        if (makeCanonical) s.quoteRegistry.setCanonical(bytes3("USD"), address(s.quote));

        vm.deal(address(s.auction), 100_000 ether);

        s.quote.mint(ALICE, 10_000_000e6);
        s.quote.mint(BOB, 10_000_000e6);
        vm.prank(ALICE);
        s.quote.approve(address(s.auction), type(uint256).max);
        vm.prank(BOB);
        s.quote.approve(address(s.auction), type(uint256).max);
    }

    function _open(Suite memory s, uint256 inventory420) internal {
        s.auction.open(AUCTION_ID, inventory420, address(s.quote), PROCEEDS, OPEN_AT, CLOSE_AT);
    }

    function _bid(PublicBatchAuction auction, address bidder, uint256 amount) internal {
        vm.prank(bidder);
        auction.bid(AUCTION_ID, amount);
    }

    function _claim(PublicBatchAuction auction, address bidder)
        internal returns (uint256 native420, uint256 spent, uint256 refund)
    {
        vm.prank(bidder);
        return auction.claim(AUCTION_ID);
    }

    function testOpenRequiresCanonicalQuoteAndPreFundedBoundedInventory() public {
        Suite memory nonCanonical = _deploy(false);
        (bool canonicalOk,) = address(nonCanonical.auction).call(
            abi.encodeWithSelector(
                nonCanonical.auction.open.selector,
                AUCTION_ID,
                1_000 ether,
                address(nonCanonical.quote),
                PROCEEDS,
                OPEN_AT,
                CLOSE_AT
            )
        );
        require(!canonicalOk, "noncanonical quote accepted");

        Suite memory s = _deploy(true);
        vm.deal(address(s.auction), 50 ether);
        (bool unfundedOk,) = address(s.auction).call(
            abi.encodeWithSelector(
                s.auction.open.selector,
                AUCTION_ID,
                100 ether,
                address(s.quote),
                PROCEEDS,
                OPEN_AT,
                CLOSE_AT
            )
        );
        require(!unfundedOk, "unfunded inventory accepted");

        vm.deal(address(s.auction), 200_000 ether);
        (bool overCapOk,) = address(s.auction).call(
            abi.encodeWithSelector(
                s.auction.open.selector,
                AUCTION_ID,
                s.auction.MAX_DAILY_INVENTORY() + 1,
                address(s.quote),
                PROCEEDS,
                OPEN_AT,
                CLOSE_AT
            )
        );
        require(!overCapOk, "daily inventory cap bypassed");

        _open(s, 1_000 ether);
        require(s.auction.reserved420() == 1_000 ether, "inventory not reserved");
    }

    function testPublicBidEscrowsExactQuoteAndAccumulatesWithoutDuplicateBidder() public {
        Suite memory s = _deploy(true);
        _open(s, 1_000 ether);
        vm.warp(OPEN_AT);

        uint256 beforeBalance = s.quote.balanceOf(ALICE);
        _bid(s.auction, ALICE, 100e6);
        _bid(s.auction, ALICE, 50e6);

        require(s.quote.balanceOf(ALICE) == beforeBalance - 150e6, "quote not escrowed");
        require(s.quote.balanceOf(address(s.auction)) == 150e6, "auction quote balance");
        require(s.auction.quoteBids(AUCTION_ID, ALICE) == 150e6, "bid accounting");
        (
            ,,,,, uint256 totalQuoteBid,,, uint32 bidderCount,,,,,
        ) = s.auction.auctions(AUCTION_ID);
        require(totalQuoteBid == 150e6 && bidderCount == 1, "aggregate accounting");
    }

    function testUnderSubscribedSettlementPaysAtClearingPriceAndReleasesUnsoldInventory() public {
        Suite memory s = _deploy(true);
        _open(s, 1_000 ether);
        vm.warp(OPEN_AT);
        _bid(s.auction, ALICE, 400e6);
        _bid(s.auction, BOB, 200e6);

        vm.warp(CLOSE_AT);
        s.auction.settle(AUCTION_ID, 2e18);

        (
            ,,, uint256 clearingPriceE18,,, uint256 totalQuoteBid, uint256 totalFill420,
            uint256 remainingFill420,,, bool settled,, bool oversubscribed
        ) = s.auction.auctions(AUCTION_ID);
        require(settled && !oversubscribed, "settlement mode");
        require(clearingPriceE18 == 2e18 && totalQuoteBid == 600e6, "settlement inputs");
        require(totalFill420 == 300 ether && remainingFill420 == 300 ether, "fill");
        require(s.auction.reserved420() == 300 ether, "unsold not released");

        uint256 aliceNativeBefore = ALICE.balance;
        (uint256 aliceFill, uint256 aliceSpent, uint256 aliceRefund) = _claim(s.auction, ALICE);
        require(aliceFill == 200 ether && aliceSpent == 400e6 && aliceRefund == 0, "alice claim");
        require(ALICE.balance == aliceNativeBefore + 200 ether, "alice native");
        require(s.quote.balanceOf(PROCEEDS) == 400e6, "alice proceeds");

        (uint256 bobFill, uint256 bobSpent, uint256 bobRefund) = _claim(s.auction, BOB);
        require(bobFill == 100 ether && bobSpent == 200e6 && bobRefund == 0, "bob claim");
        require(s.quote.balanceOf(PROCEEDS) == 600e6, "total proceeds");
        require(s.auction.reserved420() == 0, "reservation not closed");
        require(s.quote.balanceOf(address(s.auction)) == 0, "quote stranded");
    }

    function testOversubscribedSettlementProRataFillsAndRefundsExcess() public {
        Suite memory s = _deploy(true);
        _open(s, 100 ether);
        vm.warp(OPEN_AT);
        _bid(s.auction, ALICE, 150e6);
        _bid(s.auction, BOB, 150e6);

        vm.warp(CLOSE_AT);
        s.auction.settle(AUCTION_ID, 2e18);

        (,,,,,,, uint256 totalFill420, uint256 remainingFill420,,,,,, bool oversubscribed) =
            s.auction.auctions(AUCTION_ID);
        require(oversubscribed, "not oversubscribed");
        require(totalFill420 == 100 ether && remainingFill420 == 100 ether, "inventory fill");

        uint256 aliceQuoteBefore = s.quote.balanceOf(ALICE);
        (uint256 aliceFill, uint256 aliceSpent, uint256 aliceRefund) = _claim(s.auction, ALICE);
        require(aliceFill == 50 ether, "alice pro rata fill");
        require(aliceSpent == 100e6 && aliceRefund == 50e6, "alice quote split");
        require(s.quote.balanceOf(ALICE) == aliceQuoteBefore + 50e6, "alice refund");

        (uint256 bobFill, uint256 bobSpent, uint256 bobRefund) = _claim(s.auction, BOB);
        require(bobFill == 50 ether, "bob pro rata fill");
        require(bobSpent == 100e6 && bobRefund == 50e6, "bob quote split");
        require(s.quote.balanceOf(PROCEEDS) == 200e6, "oversub proceeds");
        require(s.quote.balanceOf(address(s.auction)) == 0, "escrow not reconciled");
        require(s.auction.reserved420() == 0, "native reservation not reconciled");
    }

    function testCancellationReleasesInventoryAndPreservesFullBidRefund() public {
        Suite memory s = _deploy(true);
        _open(s, 500 ether);
        vm.warp(OPEN_AT);
        _bid(s.auction, ALICE, 250e6);

        uint256 aliceBefore = s.quote.balanceOf(ALICE);
        s.auction.cancel(AUCTION_ID, keccak256("incident"));
        require(s.auction.reserved420() == 0, "cancelled inventory reserved");

        (uint256 nativeFill, uint256 spent, uint256 refund) = _claim(s.auction, ALICE);
        require(nativeFill == 0 && spent == 0 && refund == 250e6, "cancel refund");
        require(s.quote.balanceOf(ALICE) == aliceBefore + 250e6, "refund not returned");
        require(s.quote.balanceOf(PROCEEDS) == 0, "cancelled proceeds moved");
    }

    function testBidTimingReplayAndSettlementOrderingFailClosed() public {
        Suite memory s = _deploy(true);
        _open(s, 500 ether);

        (bool earlyBidOk,) = address(s.auction).call(
            abi.encodeWithSelector(s.auction.bid.selector, AUCTION_ID, 1e6)
        );
        require(!earlyBidOk, "early bid accepted");

        vm.warp(OPEN_AT);
        _bid(s.auction, ALICE, 100e6);

        (bool earlySettleOk,) = address(s.auction).call(
            abi.encodeWithSelector(s.auction.settle.selector, AUCTION_ID, 2e18)
        );
        require(!earlySettleOk, "early settlement accepted");

        vm.warp(CLOSE_AT);
        vm.prank(BOB);
        (bool lateBidOk,) = address(s.auction).call(
            abi.encodeWithSelector(s.auction.bid.selector, AUCTION_ID, 1e6)
        );
        require(!lateBidOk, "late bid accepted");

        s.auction.settle(AUCTION_ID, 2e18);
        _claim(s.auction, ALICE);

        vm.prank(ALICE);
        (bool replayOk,) = address(s.auction).call(
            abi.encodeWithSelector(s.auction.claim.selector, AUCTION_ID)
        );
        require(!replayOk, "claim replay accepted");

        (bool secondSettleOk,) = address(s.auction).call(
            abi.encodeWithSelector(s.auction.settle.selector, AUCTION_ID, 2e18)
        );
        require(!secondSettleOk, "second settlement accepted");
    }

    function testFeeOnTransferQuoteRejectedWithoutAccountingMutation() public {
        Suite memory s = _deploy(true);
        _open(s, 500 ether);
        vm.warp(OPEN_AT);
        s.quote.setFeeOnTransfer(true);

        vm.prank(ALICE);
        (bool ok,) = address(s.auction).call(
            abi.encodeWithSelector(s.auction.bid.selector, AUCTION_ID, 100e6)
        );
        require(!ok, "fee-on-transfer bid accepted");
        require(s.auction.quoteBids(AUCTION_ID, ALICE) == 0, "failed bid recorded");
        require(s.quote.balanceOf(address(s.auction)) == 0, "failed escrow retained");
    }

    function testClaimsRemainAvailableDuringLocalPauseButNewBidsFailClosed() public {
        Suite memory s = _deploy(true);
        _open(s, 500 ether);
        vm.warp(OPEN_AT);
        _bid(s.auction, ALICE, 100e6);

        s.env.pause().setPaused(true);
        vm.prank(BOB);
        (bool pausedBidOk,) = address(s.auction).call(
            abi.encodeWithSelector(s.auction.bid.selector, AUCTION_ID, 50e6)
        );
        require(!pausedBidOk, "paused bid accepted");

        vm.warp(CLOSE_AT);
        s.auction.settle(AUCTION_ID, 2e18);

        vm.prank(ALICE);
        (bool claimOk,) = address(s.auction).call(
            abi.encodeWithSelector(s.auction.claim.selector, AUCTION_ID)
        );
        require(claimOk, "safe paused claim blocked");
    }

    function testGovernanceAuthorityRequiredForSettlementAndCancellation() public {
        Suite memory s = _deploy(true);
        _open(s, 500 ether);
        vm.warp(OPEN_AT);
        _bid(s.auction, ALICE, 100e6);
        vm.warp(CLOSE_AT);

        AuctionUnauthorizedCaller420 attacker = new AuctionUnauthorizedCaller420();

        (bool settleOk,) = address(attacker).call(
            abi.encodeWithSelector(attacker.settle.selector, s.auction, AUCTION_ID, 2e18)
        );
        require(!settleOk, "unauthorized settlement accepted");

        (bool cancelOk,) = address(attacker).call(
            abi.encodeWithSelector(attacker.cancel.selector, s.auction, AUCTION_ID)
        );
        require(!cancelOk, "unauthorized cancellation accepted");
    }
}
