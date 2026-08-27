// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./OracleIds420.sol";

interface IOracleProviderRegistry420 {
    function providerActive(bytes32 providerId) external view returns (bool);
}

/// @notice Canonical registry of oracle feeds, freshness policy, aggregation policy, and sources.
/// @dev Source sets are bounded so reads remain predictably executable on chain.
contract OracleFeedRegistry420 is SystemAccess, I420System {
    uint8 public constant MAX_SOURCES = 16;
    uint32 public constant MAX_HEARTBEAT = 30 days;

    struct Feed {
        bytes32 feedType;
        bytes32 aggregationMode;
        bytes32 metadataHash;
        uint32 heartbeat;
        uint32 revision;
        uint8 decimals;
        uint8 minSources;
        bool active;
    }

    struct Source {
        uint32 epoch;
        bool configured;
        bool active;
    }

    IOracleProviderRegistry420 public immutable providerRegistry;

    mapping(bytes32 => Feed) public feeds;
    mapping(bytes32 => mapping(bytes32 => Source)) public sources;
    mapping(bytes32 => bytes32[]) private _sourceIds;

    error InvalidFeedId();
    error InvalidFeedType();
    error InvalidAggregationMode();
    error InvalidHeartbeat();
    error InvalidDecimals();
    error InvalidMinSources();
    error InvalidProvider();
    error TooManySources();

    event FeedSet(
        bytes32 indexed feedId,
        bytes32 indexed feedType,
        bytes32 indexed aggregationMode,
        uint32 heartbeat,
        uint32 revision,
        uint8 decimals,
        uint8 minSources,
        bytes32 metadataHash,
        bool active
    );
    event FeedSourceSet(bytes32 indexed feedId, bytes32 indexed providerId, uint32 epoch, bool active);

    constructor(address timelock_, address providerRegistry_) SystemAccess(timelock_) {
        if (providerRegistry_ == address(0)) revert ZeroAddress();
        providerRegistry = IOracleProviderRegistry420(providerRegistry_);
    }

    function systemName() external pure returns (string memory) { return "OracleFeedRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setFeed(
        bytes32 feedId,
        bytes32 feedType,
        bytes32 aggregationMode,
        uint32 heartbeat,
        uint8 decimals,
        uint8 minSources,
        bytes32 metadataHash,
        bool active
    ) external onlyGovernance {
        if (feedId == bytes32(0)) revert InvalidFeedId();
        if (!_validFeedType(feedType)) revert InvalidFeedType();
        if (!_validAggregation(aggregationMode)) revert InvalidAggregationMode();
        if (heartbeat == 0 || heartbeat > MAX_HEARTBEAT) revert InvalidHeartbeat();
        if (decimals > 36) revert InvalidDecimals();
        if (minSources == 0 || minSources > MAX_SOURCES) revert InvalidMinSources();

        uint32 revision = feeds[feedId].revision + 1;
        feeds[feedId] = Feed({
            feedType: feedType,
            aggregationMode: aggregationMode,
            metadataHash: metadataHash,
            heartbeat: heartbeat,
            revision: revision,
            decimals: decimals,
            minSources: minSources,
            active: active
        });
        emit FeedSet(feedId, feedType, aggregationMode, heartbeat, revision, decimals, minSources, metadataHash, active);
    }

    function setSource(bytes32 feedId, bytes32 providerId, bool active) external onlyGovernance {
        if (feeds[feedId].feedType == bytes32(0)) revert InvalidFeedId();
        if (active && !providerRegistry.providerActive(providerId)) revert InvalidProvider();

        Source storage source = sources[feedId][providerId];
        if (!source.configured) {
            if (_sourceIds[feedId].length >= MAX_SOURCES) revert TooManySources();
            source.configured = true;
            _sourceIds[feedId].push(providerId);
        }
        if (active && !source.active) ++source.epoch;
        source.active = active;
        emit FeedSourceSet(feedId, providerId, source.epoch, active);
    }

    function feedRevision(bytes32 feedId) external view returns (uint32) {
        return feeds[feedId].revision;
    }

    function sourceCount(bytes32 feedId) external view returns (uint256) {
        return _sourceIds[feedId].length;
    }

    function sourceAt(bytes32 feedId, uint256 index) external view returns (bytes32) {
        return _sourceIds[feedId][index];
    }

    function sourceEpoch(bytes32 feedId, bytes32 providerId) external view returns (uint32) {
        return sources[feedId][providerId].epoch;
    }

    function sourceActive(bytes32 feedId, bytes32 providerId) external view returns (bool) {
        return sources[feedId][providerId].active && providerRegistry.providerActive(providerId);
    }

    function _validFeedType(bytes32 feedType) private pure returns (bool) {
        return feedType == OracleIds420.FEED_PRICE
            || feedType == OracleIds420.FEED_PROOF_OF_RESERVE
            || feedType == OracleIds420.FEED_OUTCOME
            || feedType == OracleIds420.FEED_EXTERNAL_API
            || feedType == OracleIds420.FEED_AUTOMATION
            || feedType == OracleIds420.FEED_COMPUTATION;
    }

    function _validAggregation(bytes32 aggregationMode) private pure returns (bool) {
        return aggregationMode == OracleIds420.AGGREGATION_MEDIAN_NUMERIC
            || aggregationMode == OracleIds420.AGGREGATION_QUORUM_EQUAL;
    }
}
