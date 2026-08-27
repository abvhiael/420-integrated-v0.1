// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "../interfaces/IOracle420.sol";
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

interface IOracleRiskPolicy420Router {
    function policy(bytes32 feedId)
        external view
        returns (uint16 minConfidenceBps, uint16 maxDeviationBps, bool halted, bool configured);
}

/// @notice Provider-neutral observation router for canonical 420Oracle feeds.
/// @dev Reads fail closed on stale data, insufficient quorum, low confidence, configured circuit breaks,
/// or excessive numeric source deviation. Ordinary feeds never synthesize randomness.
contract OracleRouter420 is SystemAccess, I420System, IOracle420 {
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

    struct RiskConfig {
        uint16 minConfidenceBps;
        uint16 maxDeviationBps;
        bool configured;
    }

    struct NumericCollection {
        int256[16] values;
        uint256 count;
        uint64 oldest;
        uint16 conservativeConfidence;
    }

    struct ResultCollection {
        bytes32[16] results;
        uint64[16] times;
        uint16[16] confidences;
        uint256 count;
    }

    IOracleProviderRegistry420Router public immutable providerRegistry;
    IOracleFeedRegistry420Router public immutable feedRegistry;
    IOracleRiskPolicy420Router public immutable riskPolicy;

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
    error CircuitBreakerActive();
    error ConfidenceTooLow();
    error ExcessiveDeviation();

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

    constructor(address timelock_, address providerRegistry_, address feedRegistry_, address riskPolicy_)
        SystemAccess(timelock_)
    {
        if (providerRegistry_ == address(0) || feedRegistry_ == address(0) || riskPolicy_ == address(0)) {
            revert ZeroAddress();
        }
        providerRegistry = IOracleProviderRegistry420Router(providerRegistry_);
        feedRegistry = IOracleFeedRegistry420Router(feedRegistry_);
        riskPolicy = IOracleRiskPolicy420Router(riskPolicy_);
    }

    function systemName() external pure returns (string memory) { return "OracleRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

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
        if (
            observationId == bytes32(0) || observedAt == 0 || observedAt > block.timestamp
                || confidenceBps > 10_000 || numericValue == type(int256).min
        ) revert InvalidObservation();
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
            feedId, providerId, observationId, numericValue, resultHash, dataHash, observedAt,
            currentFeedRevision, currentProviderEpoch, currentSourceEpoch, confidenceBps
        );
    }

    function readNumeric(bytes32 feedId) external view returns (NumericRead memory out) {
        _requireMode(feedId, OracleIds420.AGGREGATION_MEDIAN_NUMERIC);
        RiskConfig memory risk = _risk(feedId);
        NumericCollection memory collected = _collectNumeric(feedId, risk);

        if (collected.count < feedRegistry.minSourcesOf(feedId)) revert InsufficientFreshSources();
        _sort(collected.values, collected.count);

        int256 median = collected.values[collected.count / 2];
        uint16 spreadBps = _spreadBps(collected.values[0], collected.values[collected.count - 1], median);
        _enforceNumericRisk(risk, collected.conservativeConfidence, spreadBps);

        out = NumericRead({
            value: median,
            updatedAt: collected.oldest,
            decimals: feedRegistry.decimalsOf(feedId),
            confidenceBps: collected.conservativeConfidence,
            spreadBps: spreadBps,
            sourceCount: uint16(collected.count)
        });
    }

    function readResult(bytes32 feedId) external view returns (ResultRead memory out) {
        _requireMode(feedId, OracleIds420.AGGREGATION_QUORUM_EQUAL);
        RiskConfig memory risk = _risk(feedId);
        ResultCollection memory collected = _collectResults(feedId, risk);
        uint8 minSources = feedRegistry.minSourcesOf(feedId);
        if (collected.count < minSources) revert InsufficientFreshSources();

        (bytes32 winner, uint64 winnerOldest, uint16 winnerConfidence, uint256 winnerCount) =
            _selectResultQuorum(collected, minSources);
        if (winner == bytes32(0)) revert InsufficientFreshSources();
        if (risk.configured && winnerConfidence < risk.minConfidenceBps) revert ConfidenceTooLow();

        out = ResultRead({
            resultHash: winner,
            updatedAt: winnerOldest,
            agreeingSources: uint16(winnerCount),
            confidenceBps: winnerConfidence
        });
    }

    function _requireMode(bytes32 feedId, bytes32 requiredMode) private view {
        if (!feedRegistry.feedActive(feedId)) revert InactiveFeed();
        if (feedRegistry.aggregationModeOf(feedId) != requiredMode) revert WrongAggregationMode();
    }

    function _risk(bytes32 feedId) private view returns (RiskConfig memory risk) {
        (uint16 minConfidenceBps, uint16 maxDeviationBps, bool halted, bool configured) = riskPolicy.policy(feedId);
        if (halted) revert CircuitBreakerActive();
        risk = RiskConfig({
            minConfidenceBps: minConfidenceBps,
            maxDeviationBps: maxDeviationBps,
            configured: configured
        });
    }

    function _collectNumeric(bytes32 feedId, RiskConfig memory risk)
        private view returns (NumericCollection memory collected)
    {
        uint32 heartbeat = feedRegistry.heartbeatOf(feedId);
        uint32 currentFeedRevision = feedRegistry.feedRevision(feedId);
        uint256 totalSources = feedRegistry.sourceCount(feedId);
        collected.oldest = type(uint64).max;
        collected.conservativeConfidence = 10_000;

        for (uint256 i = 0; i < totalSources; ++i) {
            bytes32 providerId = feedRegistry.sourceAt(feedId, i);
            if (!feedRegistry.sourceActive(feedId, providerId)) continue;
            Observation memory obs = latest[feedId][providerId];
            if (!_eligible(feedId, providerId, obs, heartbeat, currentFeedRevision)) continue;
            if (risk.configured && obs.confidenceBps < risk.minConfidenceBps) continue;

            collected.values[collected.count] = obs.numericValue;
            ++collected.count;
            if (obs.observedAt < collected.oldest) collected.oldest = obs.observedAt;
            if (obs.confidenceBps < collected.conservativeConfidence) {
                collected.conservativeConfidence = obs.confidenceBps;
            }
        }
    }

    function _collectResults(bytes32 feedId, RiskConfig memory risk)
        private view returns (ResultCollection memory collected)
    {
        uint32 heartbeat = feedRegistry.heartbeatOf(feedId);
        uint32 currentFeedRevision = feedRegistry.feedRevision(feedId);
        uint256 totalSources = feedRegistry.sourceCount(feedId);

        for (uint256 i = 0; i < totalSources; ++i) {
            bytes32 providerId = feedRegistry.sourceAt(feedId, i);
            if (!feedRegistry.sourceActive(feedId, providerId)) continue;
            Observation memory obs = latest[feedId][providerId];
            if (!_eligible(feedId, providerId, obs, heartbeat, currentFeedRevision)) continue;
            if (obs.resultHash == bytes32(0)) continue;
            if (risk.configured && obs.confidenceBps < risk.minConfidenceBps) continue;

            collected.results[collected.count] = obs.resultHash;
            collected.times[collected.count] = obs.observedAt;
            collected.confidences[collected.count] = obs.confidenceBps;
            ++collected.count;
        }
    }

    function _selectResultQuorum(ResultCollection memory collected, uint8 minSources)
        private pure returns (bytes32 winner, uint64 winnerOldest, uint16 winnerConfidence, uint256 winnerCount)
    {
        winnerConfidence = 10_000;
        for (uint256 i = 0; i < collected.count; ++i) {
            (uint256 count, uint64 oldest, uint16 confidence) = _countResult(collected, collected.results[i]);
            if (count < minSources) continue;

            if (winner == bytes32(0)) {
                winner = collected.results[i];
                winnerCount = count;
                winnerOldest = oldest;
                winnerConfidence = confidence;
            } else if (winner != collected.results[i]) {
                revert AmbiguousQuorum();
            }
        }
    }

    function _countResult(ResultCollection memory collected, bytes32 candidate)
        private pure returns (uint256 count, uint64 oldest, uint16 conservativeConfidence)
    {
        oldest = type(uint64).max;
        conservativeConfidence = 10_000;
        for (uint256 j = 0; j < collected.count; ++j) {
            if (collected.results[j] != candidate) continue;
            ++count;
            if (collected.times[j] < oldest) oldest = collected.times[j];
            if (collected.confidences[j] < conservativeConfidence) {
                conservativeConfidence = collected.confidences[j];
            }
        }
    }

    function _enforceNumericRisk(RiskConfig memory risk, uint16 confidenceBps, uint16 spreadBps) private pure {
        if (!risk.configured) return;
        if (risk.maxDeviationBps != 0 && spreadBps > risk.maxDeviationBps) revert ExcessiveDeviation();
        if (confidenceBps < risk.minConfidenceBps) revert ConfidenceTooLow();
    }

    function _eligible(bytes32 feedId, bytes32 providerId, Observation memory obs, uint32 heartbeat, uint32 currentFeedRevision)
        private view returns (bool)
    {
        if (!_fresh(obs.observedAt, heartbeat)) return false;
        if (obs.feedRevision != currentFeedRevision) return false;
        if (obs.providerEpoch != providerRegistry.providerEpoch(providerId)) return false;
        if (obs.sourceEpoch != feedRegistry.sourceEpoch(feedId, providerId)) return false;
        return true;
    }

    function _fresh(uint64 observedAt, uint32 heartbeat) private view returns (bool) {
        return observedAt != 0 && observedAt <= block.timestamp && block.timestamp - observedAt <= heartbeat;
    }

    function _spreadBps(int256 low, int256 high, int256 median) private pure returns (uint16) {
        uint256 denominator = _abs(median);
        uint256 distance = _distance(low, high);
        if (distance == 0) return 0;
        if (denominator == 0 || distance >= denominator) return 10_000;
        if (denominator < 10_000) return uint16((distance * 10_000) / denominator);
        uint256 unit = denominator / 10_000;
        uint256 bps = distance / unit;
        if (bps > 10_000) bps = 10_000;
        return uint16(bps);
    }

    function _distance(int256 low, int256 high) private pure returns (uint256) {
        if ((low < 0) == (high < 0)) {
            uint256 a = _abs(low);
            uint256 b = _abs(high);
            return a > b ? a - b : b - a;
        }
        return _abs(low) + _abs(high);
    }

    function _abs(int256 value) private pure returns (uint256) {
        return value < 0 ? uint256(-value) : uint256(value);
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
