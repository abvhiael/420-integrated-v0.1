// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

interface IERC20PublicBatchAuction420 {
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IApprovedQuoteAssetRegistryAuction420 {
    function quoteAssets(address asset)
        external view
        returns (uint8 status, bytes3 currency, bytes32 metadataHash);
}

/// @notice Daily public-distribution batch auction for native $420.
/// @dev Native inventory is pre-funded into this contract (normally from PublicDistributionVault)
///      before governance opens an auction. Bidders escrow the canonical approved quote asset.
///      Governance retains the repository's existing clearing-price authority; fills/refunds are
///      deterministic and claim-based so settlement never loops over an unbounded bidder set.
contract PublicBatchAuction is GenesisResidentAccess420 {
    uint256 public constant PRICE_SCALE = 1e18;
    uint256 public constant MAX_DAILY_INVENTORY = 100_000 ether;
    uint8 public constant CANONICAL_QUOTE_STATUS = 2;
    uint8 public constant MAX_TOKEN_DECIMALS = 36;

    struct Auction {
        uint64 opensAt;
        uint64 closesAt;
        uint256 inventory420;
        uint256 clearingPriceE18;
        address quoteAsset;
        address proceedsRecipient;
        uint256 totalQuoteBid;
        uint256 totalFill420;
        uint256 remainingFill420;
        uint32 bidderCount;
        uint32 claimedCount;
        bool settled;
        bool cancelled;
        bool oversubscribed;
    }

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public quoteBids;
    mapping(uint256 => mapping(address => bool)) public hasBid;
    mapping(uint256 => mapping(address => bool)) public claimed;

    uint256 public reserved420;
    uint256 private _entered;

    error InvalidAuction();
    error InvalidInventory();
    error InvalidQuoteAsset();
    error InvalidRecipient();
    error AuctionClosed();
    error AuctionNotClosed();
    error AuctionFinalized();
    error InvalidBid();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();
    error UnsupportedTokenBehavior();
    error InvalidTokenDecimals();
    error MathOverflow();
    error NativeTransferFailed();
    error Reentrancy();

    event AuctionOpened(
        uint256 indexed auctionId,
        uint256 inventory420,
        address indexed quoteAsset,
        address indexed proceedsRecipient,
        uint64 opensAt,
        uint64 closesAt
    );
    event Bid(uint256 indexed auctionId, address indexed bidder, uint256 quoteAmount, uint256 bidderTotal);
    event Settled(
        uint256 indexed auctionId,
        uint256 clearingPriceE18,
        uint256 totalQuoteBid,
        uint256 totalFill420,
        bool oversubscribed
    );
    event AuctionCancelled(uint256 indexed auctionId, bytes32 indexed reasonHash);
    event Claimed(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 native420Amount,
        uint256 quoteSpent,
        uint256 quoteRefund
    );

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    receive() external payable {}

    function componentId() public pure override returns (bytes32) { return SwapIds420.PUBLIC_BATCH_AUCTION; }

    /// @notice Open one pre-funded public auction using a canonical quote asset.
    function open(
        uint256 auctionId,
        uint256 inventory420,
        address quoteAsset,
        address proceedsRecipient,
        uint64 opensAt,
        uint64 closesAt
    ) external {
        _requireGenesisGovernance(SwapIds420.ACTION_CONFIGURE);
        _requireOperational(
            SwapIds420.ACTION_CONFIGURE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );

        if (auctions[auctionId].closesAt != 0 || closesAt <= opensAt || opensAt < block.timestamp) {
            revert InvalidAuction();
        }
        if (inventory420 == 0 || inventory420 > MAX_DAILY_INVENTORY) revert InvalidInventory();
        if (proceedsRecipient == address(0) || proceedsRecipient == address(this)) revert InvalidRecipient();

        _requireCanonicalQuote(quoteAsset);

        uint256 balance = address(this).balance;
        if (balance < reserved420 || balance - reserved420 < inventory420) revert InvalidInventory();

        reserved420 += inventory420;
        auctions[auctionId] = Auction({
            opensAt: opensAt,
            closesAt: closesAt,
            inventory420: inventory420,
            clearingPriceE18: 0,
            quoteAsset: quoteAsset,
            proceedsRecipient: proceedsRecipient,
            totalQuoteBid: 0,
            totalFill420: 0,
            remainingFill420: 0,
            bidderCount: 0,
            claimedCount: 0,
            settled: false,
            cancelled: false,
            oversubscribed: false
        });

        emit AuctionOpened(auctionId, inventory420, quoteAsset, proceedsRecipient, opensAt, closesAt);
    }

    /// @notice Escrow quote currency into an open public batch auction.
    function bid(uint256 auctionId, uint256 quoteAmount) external nonReentrant {
        _requireOperational(
            SwapIds420.ACTION_BID,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );

        Auction storage a = auctions[auctionId];
        if (
            a.closesAt == 0 || a.settled || a.cancelled || block.timestamp < a.opensAt
                || block.timestamp >= a.closesAt
        ) revert AuctionClosed();
        if (quoteAmount == 0) revert InvalidBid();

        _pullExact(a.quoteAsset, msg.sender, quoteAmount);

        if (!hasBid[auctionId][msg.sender]) {
            hasBid[auctionId][msg.sender] = true;
            if (a.bidderCount == type(uint32).max) revert MathOverflow();
            ++a.bidderCount;
        }

        quoteBids[auctionId][msg.sender] += quoteAmount;
        a.totalQuoteBid += quoteAmount;
        emit Bid(auctionId, msg.sender, quoteAmount, quoteBids[auctionId][msg.sender]);
    }

    /// @notice Finalize the auction using the governance-approved clearing price.
    /// @param clearingPriceE18 Quote units per one native 420, normalized to 1e18.
    function settle(uint256 auctionId, uint256 clearingPriceE18) external {
        _requireGenesisGovernance(SwapIds420.ACTION_SETTLE_AUCTION);
        _requireOperational(
            SwapIds420.ACTION_SETTLE_AUCTION,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.NONE
        );

        Auction storage a = auctions[auctionId];
        if (a.closesAt == 0 || a.settled || a.cancelled) revert AuctionFinalized();
        if (block.timestamp < a.closesAt) revert AuctionNotClosed();
        if (clearingPriceE18 == 0 || a.totalQuoteBid == 0) revert InvalidBid();

        uint8 quoteDecimals = _tokenDecimals(a.quoteAsset);
        uint256 normalizedTotalQuote = _normalizeQuote(a.totalQuoteBid, quoteDecimals);
        uint256 fullDemand420 = _mulDivBounded(normalizedTotalQuote, PRICE_SCALE, clearingPriceE18);
        if (fullDemand420 == 0) revert InvalidBid();

        uint256 totalFill420 = fullDemand420;
        bool oversubscribed;
        if (totalFill420 > a.inventory420) {
            totalFill420 = a.inventory420;
            oversubscribed = true;
        }

        uint256 unsold = a.inventory420 - totalFill420;
        if (unsold != 0) reserved420 -= unsold;

        a.clearingPriceE18 = clearingPriceE18;
        a.totalFill420 = totalFill420;
        a.remainingFill420 = totalFill420;
        a.oversubscribed = oversubscribed;
        a.settled = true;

        emit Settled(auctionId, clearingPriceE18, a.totalQuoteBid, totalFill420, oversubscribed);
    }

    /// @notice Cancel an unsettled auction and make every escrowed bid fully refundable.
    /// @dev Governance may use this during incident recovery, including while shared safety is paused.
    function cancel(uint256 auctionId, bytes32 reasonHash) external {
        _requireGenesisGovernance(SwapIds420.ACTION_SETTLE_AUCTION);
        _requireOperational(
            SwapIds420.ACTION_SETTLE_AUCTION,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.NONE
        );

        Auction storage a = auctions[auctionId];
        if (a.closesAt == 0 || a.settled || a.cancelled) revert AuctionFinalized();

        a.cancelled = true;
        reserved420 -= a.inventory420;
        emit AuctionCancelled(auctionId, reasonHash);
    }

    /// @notice Claim native 420 fill plus any unspent quote refund.
    /// @dev Claims are pull-based and remain available while the system is paused.
    function claim(uint256 auctionId) external nonReentrant returns (uint256 native420Amount, uint256 quoteSpent, uint256 quoteRefund) {
        _requireOperational(
            SwapIds420.ACTION_SETTLE_AUCTION,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.OUTBOUND
        );

        Auction storage a = auctions[auctionId];
        uint256 bidAmount = quoteBids[auctionId][msg.sender];
        if (bidAmount == 0) revert NothingToClaim();
        if (claimed[auctionId][msg.sender]) revert AlreadyClaimed();
        if (!a.settled && !a.cancelled) revert AuctionNotClosed();

        claimed[auctionId][msg.sender] = true;
        ++a.claimedCount;

        if (a.cancelled) {
            quoteRefund = bidAmount;
        } else {
            uint8 quoteDecimals = _tokenDecimals(a.quoteAsset);
            if (a.oversubscribed) {
                native420Amount = _mulDivBounded(a.inventory420, bidAmount, a.totalQuoteBid);
            } else {
                uint256 normalizedBid = _normalizeQuote(bidAmount, quoteDecimals);
                native420Amount = _mulDivBounded(normalizedBid, PRICE_SCALE, a.clearingPriceE18);
            }

            if (native420Amount > a.remainingFill420) native420Amount = a.remainingFill420;
            uint256 normalizedCost = _mulDivBounded(native420Amount, a.clearingPriceE18, PRICE_SCALE);
            quoteSpent = _denormalizeQuote(normalizedCost, quoteDecimals);
            if (quoteSpent > bidAmount) quoteSpent = bidAmount;
            quoteRefund = bidAmount - quoteSpent;

            if (native420Amount != 0) {
                a.remainingFill420 -= native420Amount;
                reserved420 -= native420Amount;
            }
        }

        if (a.claimedCount == a.bidderCount && a.settled && a.remainingFill420 != 0) {
            reserved420 -= a.remainingFill420;
            a.remainingFill420 = 0;
        }

        if (quoteSpent != 0) _pushExact(a.quoteAsset, a.proceedsRecipient, quoteSpent);
        if (quoteRefund != 0) _pushExact(a.quoteAsset, msg.sender, quoteRefund);
        if (native420Amount != 0) {
            (bool ok,) = payable(msg.sender).call{value: native420Amount}("");
            if (!ok) revert NativeTransferFailed();
        }

        emit Claimed(auctionId, msg.sender, native420Amount, quoteSpent, quoteRefund);
    }

    function freeInventory420() external view returns (uint256) {
        uint256 balance = address(this).balance;
        return balance > reserved420 ? balance - reserved420 : 0;
    }

    function _requireCanonicalQuote(address quoteAsset) private view {
        if (quoteAsset == address(0) || quoteAsset.code.length == 0) revert InvalidQuoteAsset();
        address quoteRegistry = _resolveRequired(SwapIds420.APPROVED_QUOTE_ASSET_REGISTRY);
        (uint8 status,,) = IApprovedQuoteAssetRegistryAuction420(quoteRegistry).quoteAssets(quoteAsset);
        if (status != CANONICAL_QUOTE_STATUS) revert InvalidQuoteAsset();
        _tokenDecimals(quoteAsset);
    }

    function _tokenDecimals(address token) private view returns (uint8 decimals_) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(IERC20PublicBatchAuction420.decimals.selector));
        if (!ok || data.length != 32) revert InvalidTokenDecimals();
        uint256 decoded = abi.decode(data, (uint256));
        if (decoded > MAX_TOKEN_DECIMALS) revert InvalidTokenDecimals();
        decimals_ = uint8(decoded);
    }

    function _normalizeQuote(uint256 rawAmount, uint8 decimals_) private pure returns (uint256 normalized) {
        if (decimals_ == 18) return rawAmount;
        if (decimals_ < 18) {
            uint256 factor = 10 ** uint256(18 - decimals_);
            if (rawAmount > type(uint256).max / factor) revert MathOverflow();
            return rawAmount * factor;
        }
        normalized = rawAmount / (10 ** uint256(decimals_ - 18));
    }

    function _denormalizeQuote(uint256 normalized, uint8 decimals_) private pure returns (uint256 rawAmount) {
        if (decimals_ == 18) return normalized;
        if (decimals_ < 18) return normalized / (10 ** uint256(18 - decimals_));
        uint256 factor = 10 ** uint256(decimals_ - 18);
        if (normalized > type(uint256).max / factor) revert MathOverflow();
        rawAmount = normalized * factor;
    }

    function _mulDivBounded(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
        if (denominator == 0) revert MathOverflow();
        if (x == 0 || y == 0) return 0;
        if (x > type(uint256).max / y) revert MathOverflow();
        return (x * y) / denominator;
    }

    function _pullExact(address token, address from, uint256 amount) private {
        uint256 contractBefore = IERC20PublicBatchAuction420(token).balanceOf(address(this));
        if (!IERC20PublicBatchAuction420(token).transferFrom(from, address(this), amount)) revert TransferFailed();
        uint256 contractAfter = IERC20PublicBatchAuction420(token).balanceOf(address(this));
        if (contractAfter != contractBefore + amount) revert UnsupportedTokenBehavior();
    }

    function _pushExact(address token, address to, uint256 amount) private {
        uint256 contractBefore = IERC20PublicBatchAuction420(token).balanceOf(address(this));
        uint256 recipientBefore = IERC20PublicBatchAuction420(token).balanceOf(to);
        if (!IERC20PublicBatchAuction420(token).transfer(to, amount)) revert TransferFailed();
        uint256 contractAfter = IERC20PublicBatchAuction420(token).balanceOf(address(this));
        uint256 recipientAfter = IERC20PublicBatchAuction420(token).balanceOf(to);
        if (contractAfter + amount != contractBefore || recipientAfter != recipientBefore + amount) {
            revert UnsupportedTokenBehavior();
        }
    }
}
