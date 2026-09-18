// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeMarketDataTypes420.sol";

/// @notice Executable reference projection for deterministic V13.3 market snapshots.
/// @dev Read-model only: no execution, custody, mint, burn, settlement or protocol configuration authority.
contract ExchangeMarketSnapshot420 {
    struct SnapshotInput {
        bytes32 marketSubjectId;
        bytes32 sourceSetHash;
        uint32 aggregationVersion;
        uint64 windowStart;
        uint64 windowEnd;
        bytes32 marketConfigHash;
        bytes32 marketStatusHash;
        bool hasBidAsk;
        uint256 bestBid;
        uint256 bestAsk;
        bool hasTrade;
        uint256 lastTradePrice;
        uint256 open;
        uint256 high;
        uint256 low;
        uint256 close;
        uint256 baseVolume;
        uint256 quoteVolume;
        uint256 liquidity;
        bytes32 routeHealthHash;
        bool settlementHealthy;
    }

    struct Snapshot {
        bytes32 snapshotId;
        bytes32 marketSubjectId;
        bytes32 sourceSetHash;
        uint32 aggregationVersion;
        uint64 windowStart;
        uint64 windowEnd;
        bytes32 payloadHash;
        bytes32 marketConfigHash;
        bytes32 marketStatusHash;
        bool hasBidAsk;
        uint256 bestBid;
        uint256 bestAsk;
        bool hasTrade;
        uint256 lastTradePrice;
        uint256 open;
        uint256 high;
        uint256 low;
        uint256 close;
        uint256 baseVolume;
        uint256 quoteVolume;
        uint256 liquidity;
        bytes32 routeHealthHash;
        bool settlementHealthy;
    }

    mapping(bytes32 => Snapshot) private _snapshots;
    mapping(bytes32 => bool) private _exists;
    mapping(bytes32 => bytes32) public latestSnapshotId;

    error InvalidSnapshot();
    error SnapshotConflict();
    error StaleSnapshot();
    error UnknownSnapshot();

    event SnapshotApplied(
        bytes32 indexed marketSubjectId,
        bytes32 indexed snapshotId,
        uint64 windowEnd,
        bytes32 sourceSetHash
    );

    function applySnapshot(SnapshotInput calldata input) external returns (bool inserted) {
        _validate(input);

        bytes32 id = ExchangeMarketDataTypes420.derivedId(
            ExchangeMarketDataTypes420.Domain.MARKET,
            input.marketSubjectId,
            input.sourceSetHash,
            input.aggregationVersion,
            input.windowStart,
            input.windowEnd
        );
        bytes32 payloadHash = _payloadHash(input);

        if (_exists[id]) {
            if (_snapshots[id].payloadHash != payloadHash) revert SnapshotConflict();
            return false;
        }

        bytes32 previousId = latestSnapshotId[input.marketSubjectId];
        if (previousId != bytes32(0)) {
            Snapshot storage previous = _snapshots[previousId];
            if (input.windowEnd < previous.windowEnd) revert StaleSnapshot();
        }

        _snapshots[id] = Snapshot({
            snapshotId: id,
            marketSubjectId: input.marketSubjectId,
            sourceSetHash: input.sourceSetHash,
            aggregationVersion: input.aggregationVersion,
            windowStart: input.windowStart,
            windowEnd: input.windowEnd,
            payloadHash: payloadHash,
            marketConfigHash: input.marketConfigHash,
            marketStatusHash: input.marketStatusHash,
            hasBidAsk: input.hasBidAsk,
            bestBid: input.bestBid,
            bestAsk: input.bestAsk,
            hasTrade: input.hasTrade,
            lastTradePrice: input.lastTradePrice,
            open: input.open,
            high: input.high,
            low: input.low,
            close: input.close,
            baseVolume: input.baseVolume,
            quoteVolume: input.quoteVolume,
            liquidity: input.liquidity,
            routeHealthHash: input.routeHealthHash,
            settlementHealthy: input.settlementHealthy
        });
        _exists[id] = true;
        latestSnapshotId[input.marketSubjectId] = id;

        emit SnapshotApplied(input.marketSubjectId, id, input.windowEnd, input.sourceSetHash);
        return true;
    }

    function snapshot(bytes32 snapshotId_) external view returns (Snapshot memory) {
        if (!_exists[snapshotId_]) revert UnknownSnapshot();
        return _snapshots[snapshotId_];
    }

    function latest(bytes32 marketSubjectId) external view returns (Snapshot memory) {
        bytes32 id = latestSnapshotId[marketSubjectId];
        if (id == bytes32(0)) revert UnknownSnapshot();
        return _snapshots[id];
    }

    function exists(bytes32 snapshotId_) external view returns (bool) {
        return _exists[snapshotId_];
    }

    function _validate(SnapshotInput calldata input) private pure {
        if (
            input.marketSubjectId == bytes32(0) ||
            input.sourceSetHash == bytes32(0) ||
            input.aggregationVersion == 0 ||
            input.windowEnd <= input.windowStart ||
            input.marketConfigHash == bytes32(0) ||
            input.marketStatusHash == bytes32(0) ||
            input.routeHealthHash == bytes32(0)
        ) revert InvalidSnapshot();

        if (input.hasBidAsk) {
            if (input.bestBid == 0 || input.bestAsk == 0 || input.bestBid > input.bestAsk) revert InvalidSnapshot();
        } else if (input.bestBid != 0 || input.bestAsk != 0) {
            revert InvalidSnapshot();
        }

        if (input.hasTrade) {
            if (
                input.lastTradePrice == 0 ||
                input.open == 0 ||
                input.high == 0 ||
                input.low == 0 ||
                input.close == 0 ||
                input.high < input.low ||
                input.high < input.open ||
                input.high < input.close ||
                input.low > input.open ||
                input.low > input.close
            ) revert InvalidSnapshot();
        } else if (
            input.lastTradePrice != 0 ||
            input.open != 0 ||
            input.high != 0 ||
            input.low != 0 ||
            input.close != 0 ||
            input.baseVolume != 0 ||
            input.quoteVolume != 0
        ) {
            revert InvalidSnapshot();
        }
    }

    function _payloadHash(SnapshotInput calldata input) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                input.marketConfigHash,
                input.marketStatusHash,
                input.hasBidAsk,
                input.bestBid,
                input.bestAsk,
                input.hasTrade,
                input.lastTradePrice,
                input.open,
                input.high,
                input.low,
                input.close,
                input.baseVolume,
                input.quoteVolume,
                input.liquidity,
                input.routeHealthHash,
                input.settlementHealthy
            )
        );
    }
}
