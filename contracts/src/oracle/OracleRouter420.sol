// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./OracleIds420.sol";

interface IOracleProviderRegistry420Router {
    function isAuthorizedOperator(bytes32 providerId, address operator) external view returns (bool);
    function providerEpoch(bytes32 providerId) external view returns (uint32);
}

interface IOracleFeedRegistry420Router {
    function feedTypeOf(bytes32 feedId) external view returns (bytes32);
    function aggregationModeOf(bytes32 feedId) external view returns (bytes32);
    function heartbeatOf(bytes32 feedId) external view returns (uint32);
    function decimalsOf(bytes32 feedId) external view returns (uint8);
    function minSourcesOf(bytes32 feedId) external view returns (uint8);
    function feedActive(bytes32 feedId) external view returns (bool);
    function feedRevision(bytes32 feedId) external view returns (uint32);
    function sourceCount(bytes32 feedId) external view returns (uint256);
    function sourceAt(bytes32 feedId, uint256 index) external view returns (bytes32);
    function sourceEpoch(bytes32 feedId, bytes32 providerId) external view returns (uint32);
    function sourceActive(bytes32 feedId, bytes32 providerId) external view returns (bool);
}

/// @notice Provider-neutral observation router for canonical 420Oracle feeds.
/// @dev The router never pulls arbitrary external contracts and never treats transaction submission
/// as valid data. Reads fail closed unless a configured quorum of authorized, fresh sources exists.
contract OracleRouter420 is SystemAccess, I420System {
    struct Observation {
        int256 numericValue;
        bytes32 resultHash;
        bytes32 dataHash;
        bytes32 observationId;
        uint64 observedAt;
        uint32 feedRevision;
        uint32 providerEpoch;
        uint32 sourceEpoch;
        uint16 confidenceBps;
    }

    IOracleProviderRegistry420Router public immutable providerRegistry;
    IOracleFeedRegistry420Router public immutable feedRegistry;

    mapping(bytes32 => mapping(bytes32 => Observation)) public latest;
    mapping(bytes32 => bool) public observationUsed;

    error InvalidFeed();
    error InactiveFeed();
    error UnauthorizedProvider();
    error InvalidObservation();
    error ObservationReplay();
    error ObservationNotNewer();
    error WrongAggregationMode();
    error InsufficientFreshSources();
    error AmbiguousQuorum();

    event ObservationSubmitted(
        bytes32 indexed feedId,
        bytes32 indexed providerId,
        bytes32 indexed observationId,
        int256 numericValue,
        bytes32 resultHash,
        bytes32 dataHash,
        uint64 observedAt,
        uint32 feedRevision,
        uint32 providerEpoch,
        uint32 sourceEpoch,
        uint16 confidenceBps
    );

    constructor(address timelock_, address providerRegistry_, address feedRegistry_) SystemAccess(timelock_) {
        if (providerRegistry_ == address(0) || feedRegistry_ == address(0)) revert ZeroAddress();
        providerRegistry = IOracleProviderRegistry420Router(providerRegistry_);
        feedRegistry = IOracleFeedRegistry420Router(feedRegistry_);
    }

    function systemName() external pure returns (string memory) { return "OracleRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function submitObservation(
        bytes32 feedId,
        bytes32 providerId,
        bytes32 observationId,
        int256 numericValue,
        bytes32 resultHash,
        bytes32 dataHash,
        uint64 observedAt,
        uint16 confidenceBps
    ) external {
        if (feedRegistry.feedTypeOf(feedId) == bytes32(0)) revert InvalidFeed();
        if (!feedRegistry.feedActive(feedId)) revert InactiveFeed();
        if (!providerRegistry.isAuthorizedOperator(providerId, msg.sender)) revert UnauthorizedProvider();
        if (!feedRegistry.sourceActive(feedId, providerId)) revert UnauthorizedProvider();
        if (observationId == bytes32(0) || observedAt == 0 || observedAt > block.timestamp || confidenceBps > 10_000) {
            revert InvalidObservation();
        }
        if (observationUsed[observationId]) revert ObservationReplay();
        if (observedAt <= latest[feedId][providerId].observedAt) revert ObservationNotNewer();

        uint32 currentFeedRevision = feedRegistry.feedRevision(feedId);
        uint32 currentProviderEpoch = providerRegistry.providerEpoch(providerId);
        uint32 currentSourceEpoch = feedRegistry.sourceEpoch(feedId, providerId);

        observationUsed[observationId] = true;
        latest[feedId][providerId] = Observation({
            numericValue: numericValue,
            resultHash: resultHash,
            dataHash: dataHash,
            observationId: observationId,
            observedAt: observedAt,
            feedRevision: currentFeedRevision,
            providerEpoch: currentProviderEpoch,
            sourceEpoch: currentSourceEpoch,
            confidenceBps: confidenceBps
        });

        emit ObservationSubmitted(
            feedId,
            providerId,
            observationId,
            numericValue,
            resultHash,
            dataHash,
            observedAt,
            currentFeedRevision,
            currentProviderEpoch,
            currentSourceEpoch,
            confidenceBps
        );
    }

    function readNumeric(bytes32 feedId)
        external
        view
        returns (int256 value, uint64 updatedAt, uint8 decimals, uint256 freshSources)
    {
        if (!feedRegistry.feedActive(feedId)) revert InactiveFeed();
        if (feedRegistry.aggregationModeOf(feedId) != OracleIds420.AGGREGATION_MEDIAN_NUMERIC) {
            revert WrongAggregationMode();
        }

        uint32 heartbeat = feedRegistry.heartbeatOf(feedId);
        uint8 minSources = feedRegistry.minSourcesOf(feedId);
        uint32 currentFeedRevision = feedRegistry.feedRevision(feedId);
        int256[16] memory values;
        uint64 oldest = type(uint64).max;
        uint256 totalSources = feedRegistry.sourceCount(feedId);

        for (uint256 i = 0; i < totalSources; ++i) {
            bytes32 providerId = feedRegistry.sourceAt(feedId, i);
            if (!feedRegistry.sourceActive(feedId, providerId)) continue;
            Observation memory obs = latest[feedId][providerId];
            if (!_eligible(feedId, providerId, obs, heartbeat, currentFeedRevision)) continue;
            values[freshSources] = obs.numericValue;
            ++freshSources;
            if (obs.observedAt < oldest) oldest = obs.observedAt;
        }

        if (freshSources < minSources) revert InsufficientFreshSources();
        _sort(values, freshSources);
        value = values[freshSources / 2];
        updatedAt = oldest;
        decimals = feedRegistry.decimalsOf(feedId);
    }

    function readResult(bytes32 feedId)
        external
        view
        returns (bytes32 resultHash, uint64 updatedAt, uint256 agreeingSources)
    {
        if (!feedRegistry.feedActive(feedId)) revert InactiveFeed();
        if (feedRegistry.aggregationModeOf(feedId) != OracleIds420.AGGREGATION_QUORUM_EQUAL) {
            revert WrongAggregationMode();
        }

        uint32 heartbeat = feedRegistry.heartbeatOf(feedId);
        uint8 minSources = feedRegistry.minSourcesOf(feedId);
        uint32 currentFeedRevision = feedRegistry.feedRevision(feedId);
        bytes32[16] memory results;
        uint64[16] memory times;
        uint256 freshCount;
        uint256 totalSources = feedRegistry.sourceCount(feedId);

        for (uint256 i = 0; i < totalSources; ++i) {
            bytes32 providerId = feedRegistry.sourceAt(feedId, i);
            if (!feedRegistry.sourceActive(feedId, providerId)) continue;
            Observation memory obs = latest[feedId][providerId];
            if (!_eligible(feedId, providerId, obs, heartbeat, currentFeedRevision) || obs.resultHash == bytes32(0)) continue;
            results[freshCount] = obs.resultHash;
            times[freshCount] = obs.observedAt;
            ++freshCount;
        }
        if (freshCount < minSources) revert InsufficientFreshSources();

        bytes32 winner;
        uint256 winnerCount;
        uint64 winnerOldest;
        for (uint256 i = 0; i < freshCount; ++i) {
            uint256 count;
            uint64 oldest = type(uint64).max;
            for (uint256 j = 0; j < freshCount; ++j) {
                if (results[j] == results[i]) {
                    ++count;
                    if (times[j] < oldest) oldest = times[j];
                }
            }
            if (count >= minSources) {
                if (winner == bytes32(0)) {
                    winner = results[i];
                    winnerCount = count;
                    winnerOldest = oldest;
                } else if (winner != results[i]) {
                    revert AmbiguousQuorum();
                }
            }
        }

        if (winner == bytes32(0)) revert InsufficientFreshSources();
        return (winner, winnerOldest, winnerCount);
    }

    function _eligible(
        bytes32 feedId,
        bytes32 providerId,
        Observation memory obs,
        uint32 heartbeat,
        uint32 currentFeedRevision
    ) private view returns (bool) {
        if (!_fresh(obs.observedAt, heartbeat)) return false;
        if (obs.feedRevision != currentFeedRevision) return false;
        if (obs.providerEpoch != providerRegistry.providerEpoch(providerId)) return false;
        if (obs.sourceEpoch != feedRegistry.sourceEpoch(feedId, providerId)) return false;
        return true;
    }

    function _fresh(uint64 observedAt, uint32 heartbeat) private view returns (bool) {
        return observedAt != 0 && observedAt <= block.timestamp && block.timestamp - observedAt <= heartbeat;
    }

    function _sort(int256[16] memory values, uint256 count) private pure {
        for (uint256 i = 1; i < count; ++i) {
            int256 key = values[i];
            uint256 j = i;
            while (j > 0 && values[j - 1] > key) {
                values[j] = values[j - 1];
                --j;
            }
            values[j] = key;
        }
    }
}
