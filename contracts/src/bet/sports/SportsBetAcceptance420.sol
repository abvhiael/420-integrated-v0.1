// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SportsOddsIngestion420.sol";

/// @notice 5D.4 atomic bet-admission and liability ledger. No token transfers:
/// admission is disabled until a separately qualified custody/settlement adapter is bound.
/// @dev This records an irrevocable economic offer, not a funded or payable wager.
contract SportsBetAcceptance420 is SportsAuthority420 {
    SportsOddsIngestion420 public immutable odds;
    SportsMarketRegistry420 public immutable markets;
    bytes32 public constant CONFIGURE = keccak256("BET_SPORT_RISK_CONFIGURE");
    bytes32 public constant ADMIT = keccak256("BET_SPORT_ADMISSION_ADAPTER");
    uint256 public constant SCALE = 1_000_000;

    struct Risk {
        uint128 minStake;
        uint128 maxStake;
        uint256 maxMarketLiability;
        uint256 maxSelectionLiability;
        uint256 maxPlayerStake;
        bool active;
    }
    struct Ticket {
        address player;
        bytes32 marketId;
        bytes32 quoteDigest;
        bytes32 termsHash;
        bytes32 selection;
        uint256 stake;
        uint256 grossReturn;
        uint256 profitLiability;
        uint64 quoteEpoch;
        uint64 sequence;
        bytes32 fundingReceipt;
    }
    struct Offer {
        bytes32 marketId;
        bytes32 selection;
        bytes32 quoteDigest;
        uint256 stake;
        uint256 minGrossReturn;
        uint256 maxGrossReturn;
        uint64 expiry;
        bytes32 nonce;
        bytes32 fundingReceipt;
    }
    mapping(bytes32 => Risk) public risk;
    mapping(bytes32 => Ticket) private tickets;
    mapping(bytes32 => bool) public spent;
    mapping(bytes32 => uint256) public marketLiability;
    mapping(bytes32 => mapping(bytes32 => uint256)) public selectionLiability;
    mapping(bytes32 => mapping(address => uint256)) public playerStake;
    mapping(bytes32 => uint256) public receiptUsed;

    event RiskConfigured(bytes32 indexed marketId, uint128 minStake, uint128 maxStake, uint256 marketCap, uint256 selectionCap, uint256 playerCap, bool active);
    event OfferAdmitted(bytes32 indexed ticketId, bytes32 indexed marketId, address indexed player, bytes32 quoteDigest, bytes32 selection, uint256 stake, uint256 grossReturn, uint256 liability, bytes32 fundingReceipt);
    error Disabled();

    constructor(address auth, address odds_) SportsAuthority420(auth) {
        if (odds_.code.length == 0) revert Invalid();
        odds = SportsOddsIngestion420(odds_);
        markets = odds.markets();
        if (address(odds.authorization()) != auth) revert Invalid();
    }

    function scope(bytes32 id) public view override returns (bytes32) {
        return markets.scope(id);
    }

    function configure(bytes32 marketId, Risk calldata config) external {
        _auth(CONFIGURE, marketId);
        markets.get(marketId);
        if (config.active && (config.minStake == 0 || config.maxStake < config.minStake
            || config.maxMarketLiability == 0 || config.maxSelectionLiability == 0
            || config.maxPlayerStake < config.minStake)) revert Invalid();
        risk[marketId] = config;
        emit RiskConfigured(marketId, config.minStake, config.maxStake,
            config.maxMarketLiability, config.maxSelectionLiability, config.maxPlayerStake, config.active);
    }

    /// @notice Read-only quote preview; never promises execution or funding.
    function preview(Offer calldata offer, address player)
        external view returns (uint256 gross, uint256 liability, bool admissible)
    {
        (gross, liability, admissible) = _evaluate(offer, player);
    }

    /// @notice Fail-closed until independent funding validation and settlement are qualified.
    /// No signatures or receipts supplied by callers may impersonate secured funds.
    function accept(Offer calldata, address) external pure returns (bytes32) {
        revert Disabled();
    }

    function ticket(bytes32 id) external view returns (Ticket memory) {
        if (tickets[id].player == address(0)) revert Missing();
        return tickets[id];
    }

    function _evaluate(Offer calldata offer, address player)
        private view returns (uint256 gross, uint256 liability, bool ok)
    {
        if (player == address(0) || offer.nonce == 0 || offer.fundingReceipt == 0 ||
            offer.quoteDigest == 0 || offer.expiry < block.timestamp) return (0, 0, false);
        if (!markets.eligible(offer.marketId)) return (0, 0, false);
        Risk memory r = risk[offer.marketId];
        if (!r.active || offer.stake < r.minStake || offer.stake > r.maxStake) return (0, 0, false);
        (SportsOddsIngestion420.Latest memory q, bool usable) = odds.current(offer.marketId);
        if (!usable || q.digest != offer.quoteDigest) return (0, 0, false);
        bytes32[] memory selections = markets.selections(offer.marketId);
        uint256 price;
        for (uint256 i; i < selections.length; ++i) {
            if (selections[i] == offer.selection) { price = q.prices[i]; break; }
        }
        if (price == 0) return (0, 0, false);
        if (offer.stake > type(uint256).max / price) return (0, 0, false);
        gross = offer.stake * price / SCALE;
        if (gross < offer.stake || gross < offer.minGrossReturn || gross > offer.maxGrossReturn) return (0, 0, false);
        liability = gross - offer.stake;
        if (marketLiability[offer.marketId] + liability > r.maxMarketLiability ||
            selectionLiability[offer.marketId][offer.selection] + liability > r.maxSelectionLiability ||
            playerStake[offer.marketId][player] + offer.stake > r.maxPlayerStake) return (0, 0, false);
        return (gross, liability, true);
    }
}
