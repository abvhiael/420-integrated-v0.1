// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SportsMarketRegistry420.sol";

/// @notice Non-custodial, fail-closed signed odds ingestion. No stake, settlement or payout functions.
/// @dev Every accepted quote is tied to the current immutable market terms and quote epoch.
contract SportsOddsIngestion420 is SportsAuthority420 {
    bytes32 public constant SIGN = keccak256("BET_SPORT_ODDS_SIGN");
    bytes32 public constant INVALIDATE = keccak256("BET_SPORT_ODDS_INVALIDATE");
    bytes32 public constant TYPEHASH = keccak256(
        "Odds(bytes32 marketId,bytes32 termsHash,uint64 quoteEpoch,uint64 sequence,uint64 observedAt,uint64 validUntil,bytes32 sourceDigest,bytes32 evidenceDigest,uint32[] prices)"
    );
    uint256 private constant HALF_SECP256K1_N =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    SportsMarketRegistry420 public immutable markets;

    struct Odds {
        bytes32 marketId;
        bytes32 termsHash;
        uint64 quoteEpoch;
        uint64 sequence;
        uint64 observedAt;
        uint64 validUntil;
        bytes32 sourceDigest;
        bytes32 evidenceDigest;
        uint32[] prices; // Decimal gross returns, 1_000_000 = 1.0. No floating-point conversions.
    }
    struct Latest {
        bytes32 digest;
        bytes32 priorDigest;
        bytes32 sourceDigest;
        bytes32 evidenceDigest;
        address signer;
        uint64 sequence;
        uint64 observedAt;
        uint64 validUntil;
        uint64 quoteEpoch;
        uint32[] prices;
    }
    mapping(bytes32 => Latest) private latest;
    mapping(bytes32 => bool) public invalidated;
    event OddsAccepted(
        bytes32 indexed marketId, bytes32 indexed digest, bytes32 indexed priorDigest,
        address signer, uint64 sequence, uint64 observedAt, uint64 validUntil,
        bytes32 sourceDigest, bytes32 evidenceDigest
    );
    event OddsInvalidated(bytes32 indexed marketId, bytes32 indexed digest, address actor);

    constructor(address authorization_, address markets_) SportsAuthority420(authorization_) {
        if (markets_.code.length == 0) revert Invalid();
        markets = SportsMarketRegistry420(markets_);
        if (address(markets.authorization()) != authorization_) revert Invalid();
    }

    function scope(bytes32 id) public view override returns (bytes32) {
        return markets.scope(id);
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("420Bet Sports Odds"), keccak256("1"), block.chainid, address(this)
        ));
    }

    function digest(Odds calldata q) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            TYPEHASH, q.marketId, q.termsHash, q.quoteEpoch, q.sequence,
            q.observedAt, q.validUntil, q.sourceDigest, q.evidenceDigest,
            keccak256(abi.encodePacked(q.prices))
        ));
        return keccak256(abi.encodePacked(bytes2(0x1901), domainSeparator(), structHash));
    }

    /// @notice Permissionless relay. Signer MUST have the current scoped SIGN capability.
    /// @dev Source observation and evidence commitments must be independently verified off-chain.
    function ingest(Odds calldata q, bytes calldata signature) external returns (bytes32 d) {
        if (!markets.eligible(q.marketId)) revert State();
        SportsMarketRegistry420.Record memory m = markets.get(q.marketId);
        if (m.termsHash != q.termsHash || m.quoteEpoch != q.quoteEpoch) revert Invalid();
        if (q.sourceDigest == bytes32(0) || q.evidenceDigest == bytes32(0)) revert Invalid();
        if (q.sequence == 0 || q.observedAt == 0 || q.observedAt > block.timestamp) revert Invalid();
        if (q.validUntil <= block.timestamp || q.validUntil <= q.observedAt ||
            q.validUntil > m.config.cutoff) revert Invalid();
        SportsCompetitionRegistry420.Record memory c =
            markets.competitions().get(markets.eventsRegistry().competitionOf(m.config.eventId));
        if (q.sourceDigest != keccak256(abi.encode(c.config.provider, c.config.feed, c.config.sourcePolicy)))
            revert Invalid();
        if (block.timestamp - q.observedAt > c.config.maxSourceAge) revert Invalid();
        bytes32[] memory selections_ = markets.selections(q.marketId);
        if (q.prices.length != selections_.length) revert Invalid();
        for (uint256 i; i < q.prices.length; ++i) {
            if (q.prices[i] < 1_010_000 || q.prices[i] > 1_000_000_000) revert Invalid();
        }
        d = digest(q);
        address signer = _recover(d, signature);
        if (!authorization.isAuthorized(signer, SIGN, scope(q.marketId), 0)) revert Unauthorized();
        Latest storage old = latest[q.marketId];
        if (q.sequence <= old.sequence) revert Conflict();
        // A suspended/reopened market cannot reuse quotes from an earlier epoch.
        bytes32 prior = old.digest;
        delete old.prices;
        old.digest = d;
        old.priorDigest = prior;
        old.sourceDigest = q.sourceDigest;
        old.evidenceDigest = q.evidenceDigest;
        old.signer = signer;
        old.sequence = q.sequence;
        old.observedAt = q.observedAt;
        old.validUntil = q.validUntil;
        old.quoteEpoch = q.quoteEpoch;
        for (uint256 i; i < q.prices.length; ++i) old.prices.push(q.prices[i]);
        invalidated[q.marketId] = false;
        emit OddsAccepted(q.marketId, d, prior, signer, q.sequence,
            q.observedAt, q.validUntil, q.sourceDigest, q.evidenceDigest);
    }

    function invalidate(bytes32 marketId) external {
        _auth(INVALIDATE, marketId);
        Latest storage q = latest[marketId];
        if (q.digest == bytes32(0) || invalidated[marketId]) revert State();
        invalidated[marketId] = true;
        emit OddsInvalidated(marketId, q.digest, msg.sender);
    }

    /// @notice Quote view is not a wager authorization. Future ticket admission must recheck atomically.
    function current(bytes32 marketId) external view returns (Latest memory quote, bool usable) {
        quote = latest[marketId];
        usable = quote.digest != bytes32(0) && !invalidated[marketId]
            && block.timestamp < quote.validUntil && markets.eligible(marketId)
            && markets.get(marketId).quoteEpoch == quote.quoteEpoch
            && authorization.isAuthorized(quote.signer, SIGN, scope(marketId), 0);
    }

    function _recover(bytes32 d, bytes calldata signature) private pure returns (address signer) {
        if (signature.length != 65) revert Invalid();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if ((v != 27 && v != 28) || uint256(s) == 0 ||
            uint256(s) > HALF_SECP256K1_N || r == bytes32(0)) revert Invalid();
        signer = ecrecover(d, v, r, s);
        if (signer == address(0)) revert Invalid();
    }
}
