// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeMarketSnapshot420.sol";
import "../src/exchange/ExchangeMarketDataTypes420.sol";

contract ExchangeMarketSnapshot420Test {
    ExchangeMarketSnapshot420 private snapshots;
    bytes32 private market;

    constructor() {
        snapshots = new ExchangeMarketSnapshot420();
        market = ExchangeMarketDataTypes420.subjectId(
            ExchangeMarketDataTypes420.SubjectKind.MARKET,
            keccak256("420/USD")
        );
    }

    function testSnapshotApplyAndReplayAreDeterministic() public {
        ExchangeMarketSnapshot420.SnapshotInput memory s = _snapshot(100, 200, keccak256("sources-a"));
        require(snapshots.applySnapshot(s), "insert");
        require(!snapshots.applySnapshot(s), "replay inserted");
        ExchangeMarketSnapshot420.Snapshot memory latest = snapshots.latest(market);
        require(latest.windowEnd == 200, "window");
        require(latest.close == 104, "close");
        require(latest.settlementHealthy, "health");
    }

    function testConflictingPayloadUnderSameDerivationFailsClosed() public {
        ExchangeMarketSnapshot420.SnapshotInput memory s = _snapshot(100, 200, keccak256("sources-b"));
        require(snapshots.applySnapshot(s), "insert");
        s.close = 103;
        (bool ok,) = address(snapshots).call(abi.encodeWithSelector(snapshots.applySnapshot.selector, s));
        require(!ok, "conflict accepted");
    }

    function testLaterWindowBecomesLatest() public {
        ExchangeMarketSnapshot420.SnapshotInput memory a = _snapshot(100, 200, keccak256("sources-c"));
        ExchangeMarketSnapshot420.SnapshotInput memory b = _snapshot(200, 300, keccak256("sources-d"));
        require(snapshots.applySnapshot(a), "a");
        require(snapshots.applySnapshot(b), "b");
        ExchangeMarketSnapshot420.Snapshot memory latest = snapshots.latest(market);
        require(latest.windowStart == 200 && latest.windowEnd == 300, "latest");
    }

    function testOlderWindowCannotReplaceLatest() public {
        ExchangeMarketSnapshot420.SnapshotInput memory a = _snapshot(200, 300, keccak256("sources-e"));
        ExchangeMarketSnapshot420.SnapshotInput memory b = _snapshot(100, 200, keccak256("sources-f"));
        require(snapshots.applySnapshot(a), "a");
        (bool ok,) = address(snapshots).call(abi.encodeWithSelector(snapshots.applySnapshot.selector, b));
        require(!ok, "stale accepted");
    }

    function testReorgReplacementSameWindowGetsDistinctSnapshotId() public {
        ExchangeMarketSnapshot420.SnapshotInput memory a = _snapshot(100, 200, keccak256("canonical-a"));
        ExchangeMarketSnapshot420.SnapshotInput memory b = _snapshot(100, 200, keccak256("canonical-b"));
        require(snapshots.applySnapshot(a), "a");
        bytes32 firstId = snapshots.latestSnapshotId(market);
        b.close = 103;
        b.high = 106;
        require(snapshots.applySnapshot(b), "b");
        bytes32 secondId = snapshots.latestSnapshotId(market);
        require(firstId != secondId, "reorg id collision");
        require(snapshots.exists(firstId), "old derivation lost");
        require(snapshots.exists(secondId), "replacement missing");
    }

    function testInvalidCrossedBookFailsClosed() public {
        ExchangeMarketSnapshot420.SnapshotInput memory s = _snapshot(100, 200, keccak256("sources-g"));
        s.bestBid = 110;
        s.bestAsk = 109;
        (bool ok,) = address(snapshots).call(abi.encodeWithSelector(snapshots.applySnapshot.selector, s));
        require(!ok, "crossed book accepted");
    }

    function testInvalidOhlcvFailsClosed() public {
        ExchangeMarketSnapshot420.SnapshotInput memory s = _snapshot(100, 200, keccak256("sources-h"));
        s.high = 90;
        (bool ok,) = address(snapshots).call(abi.encodeWithSelector(snapshots.applySnapshot.selector, s));
        require(!ok, "invalid OHLCV accepted");
    }

    function testNoTradeRequiresZeroTradeDerivedFields() public {
        ExchangeMarketSnapshot420.SnapshotInput memory s = _snapshot(100, 200, keccak256("sources-i"));
        s.hasTrade = false;
        s.lastTradePrice = 0;
        s.open = 0;
        s.high = 0;
        s.low = 0;
        s.close = 0;
        s.baseVolume = 0;
        s.quoteVolume = 0;
        require(snapshots.applySnapshot(s), "no-trade snapshot rejected");
    }

    function testBidAskCanBeUnavailableButMustBeZeroed() public {
        ExchangeMarketSnapshot420.SnapshotInput memory s = _snapshot(100, 200, keccak256("sources-j"));
        s.hasBidAsk = false;
        s.bestBid = 0;
        s.bestAsk = 0;
        require(snapshots.applySnapshot(s), "no-book snapshot rejected");
    }

    function _snapshot(uint64 start, uint64 end, bytes32 sourceSet)
        private
        view
        returns (ExchangeMarketSnapshot420.SnapshotInput memory)
    {
        return ExchangeMarketSnapshot420.SnapshotInput({
            marketSubjectId: market,
            sourceSetHash: sourceSet,
            aggregationVersion: 1,
            windowStart: start,
            windowEnd: end,
            marketConfigHash: keccak256("config-v1"),
            marketStatusHash: keccak256("ACTIVE"),
            hasBidAsk: true,
            bestBid: 103,
            bestAsk: 105,
            hasTrade: true,
            lastTradePrice: 104,
            open: 100,
            high: 106,
            low: 98,
            close: 104,
            baseVolume: 420 ether,
            quoteVolume: 42000 ether,
            liquidity: 84000 ether,
            routeHealthHash: keccak256("route-healthy"),
            settlementHealthy: true
        });
    }
}
