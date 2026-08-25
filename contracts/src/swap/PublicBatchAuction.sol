// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

contract PublicBatchAuction is GenesisResidentAccess420 {
    struct Auction {
        uint64 opensAt;
        uint64 closesAt;
        uint256 inventory420;
        uint256 clearingPrice;
        bool settled;
    }

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public quoteBids;

    event AuctionOpened(uint256 indexed auctionId, uint256 inventory420, uint64 opensAt, uint64 closesAt);
    event Bid(uint256 indexed auctionId, address indexed bidder, uint256 quoteAmount);
    event Settled(uint256 indexed auctionId, uint256 clearingPrice);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return SwapIds420.PUBLIC_BATCH_AUCTION; }

    function open(uint256 auctionId, uint256 inventory420, uint64 opensAt, uint64 closesAt) external {
        _requireGenesisGovernance(SwapIds420.ACTION_CONFIGURE);
        _requireOperational(
            SwapIds420.ACTION_CONFIGURE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(inventory420 > 0, "inventory");
        require(opensAt >= block.timestamp && closesAt > opensAt && auctions[auctionId].closesAt == 0, "invalid");
        auctions[auctionId] = Auction(opensAt, closesAt, inventory420, 0, false);
        emit AuctionOpened(auctionId, inventory420, opensAt, closesAt);
    }

    function recordBid(uint256 auctionId, address bidder, uint256 quoteAmount) external {
        _requireGenesisGovernance(SwapIds420.ACTION_BID);
        _requireOperational(
            SwapIds420.ACTION_BID,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        Auction memory a = auctions[auctionId];
        require(a.closesAt != 0 && block.timestamp >= a.opensAt && block.timestamp <= a.closesAt, "closed");
        require(bidder != address(0) && quoteAmount > 0, "bid");
        quoteBids[auctionId][bidder] += quoteAmount;
        emit Bid(auctionId, bidder, quoteAmount);
    }

    function settle(uint256 auctionId, uint256 clearingPrice) external {
        _requireGenesisGovernance(SwapIds420.ACTION_SETTLE_AUCTION);
        _requireOperational(
            SwapIds420.ACTION_SETTLE_AUCTION,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.NONE
        );
        Auction storage a = auctions[auctionId];
        require(!a.settled && a.closesAt != 0 && block.timestamp >= a.closesAt, "invalid");
        require(clearingPrice > 0, "price");
        a.settled = true;
        a.clearingPrice = clearingPrice;
        emit Settled(auctionId, clearingPrice);
    }
}
