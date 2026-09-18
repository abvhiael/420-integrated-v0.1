// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeHistoricalQuery420.sol";

contract ExchangeHistoricalQuery420Test {
    ExchangeHistoricalQuery420 private history;
    bytes32 private constant MARKET_A = keccak256("MARKET-A");
    bytes32 private constant MARKET_B = keccak256("MARKET-B");

    constructor() {
        history = new ExchangeHistoricalQuery420();
    }

    function testBoundedCursorPaginationIsStable() public {
        _append(bytes32(uint256(1)), ExchangeHistoricalQuery420.HistoryKind.TRADE, MARKET_A, 100, 1, true);
        _append(bytes32(uint256(2)), ExchangeHistoricalQuery420.HistoryKind.TRADE, MARKET_A, 101, 2, true);
        _append(bytes32(uint256(3)), ExchangeHistoricalQuery420.HistoryKind.TRADE, MARKET_A, 102, 3, true);

        ExchangeHistoricalQuery420.Query memory q = _query(
            ExchangeHistoricalQuery420.HistoryKind.TRADE,
            MARKET_A,
            true,
            true
        );

        ExchangeHistoricalQuery420.Page memory p1 = history.query(q, 2, bytes32(0));
        require(p1.records.length == 2, "p1 size");
        require(p1.records[0].recordId == bytes32(uint256(1)), "p1 first");
        require(p1.records[1].recordId == bytes32(uint256(2)), "p1 second");
        require(p1.hasMore && p1.nextCursor != bytes32(0), "p1 cursor");

        ExchangeHistoricalQuery420.Page memory p2 = history.query(q, 2, p1.nextCursor);
        require(p2.records.length == 1, "p2 size");
        require(p2.records[0].recordId == bytes32(uint256(3)), "p2 record");
        require(!p2.hasMore && p2.nextCursor == bytes32(0), "p2 terminal");
    }

    function testCursorCannotBeReusedAcrossFilters() public {
        _append(bytes32(uint256(11)), ExchangeHistoricalQuery420.HistoryKind.TRADE, MARKET_A, 100, 1, true);
        _append(bytes32(uint256(12)), ExchangeHistoricalQuery420.HistoryKind.TRADE, MARKET_A, 101, 2, true);

        ExchangeHistoricalQuery420.Query memory a = _query(
            ExchangeHistoricalQuery420.HistoryKind.TRADE,
            MARKET_A,
            true,
            true
        );
        ExchangeHistoricalQuery420.Page memory p = history.query(a, 1, bytes32(0));
        require(p.nextCursor != bytes32(0), "cursor");

        ExchangeHistoricalQuery420.Query memory b = _query(
            ExchangeHistoricalQuery420.HistoryKind.TRADE,
            MARKET_B,
            true,
            true
        );
        (bool ok,) = address(history).call(
            abi.encodeWithSelector(history.query.selector, b, uint16(1), p.nextCursor)
        );
        require(!ok, "cross-filter cursor accepted");
    }

    function testActiveOnlyExcludesOrphanedRecords() public {
        _append(bytes32(uint256(21)), ExchangeHistoricalQuery420.HistoryKind.BRIDGE_DEPOSIT, MARKET_A, 100, 1, true);
        _append(bytes32(uint256(22)), ExchangeHistoricalQuery420.HistoryKind.BRIDGE_DEPOSIT, MARKET_A, 101, 2, true);
        history.setActive(bytes32(uint256(21)), false);

        ExchangeHistoricalQuery420.Query memory q = _query(
            ExchangeHistoricalQuery420.HistoryKind.BRIDGE_DEPOSIT,
            bytes32(0),
            false,
            true
        );
        ExchangeHistoricalQuery420.Page memory p = history.query(q, 10, bytes32(0));
        require(p.records.length == 1, "active count");
        require(p.records[0].recordId == bytes32(uint256(22)), "active record");
    }

    function testInactiveHistoryRemainsAddressable() public {
        _append(bytes32(uint256(31)), ExchangeHistoricalQuery420.HistoryKind.ORDER, MARKET_A, 100, 1, true);
        history.setActive(bytes32(uint256(31)), false);
        ExchangeHistoricalQuery420.HistoricalRecord memory r = history.get(bytes32(uint256(31)));
        require(!r.active, "still active");
    }

    function testKindAndSubjectFiltersAreDeterministic() public {
        _append(bytes32(uint256(41)), ExchangeHistoricalQuery420.HistoryKind.TRADE, MARKET_A, 100, 1, true);
        _append(bytes32(uint256(42)), ExchangeHistoricalQuery420.HistoryKind.FILL, MARKET_A, 101, 2, true);
        _append(bytes32(uint256(43)), ExchangeHistoricalQuery420.HistoryKind.TRADE, MARKET_B, 102, 3, true);

        ExchangeHistoricalQuery420.Query memory q = _query(
            ExchangeHistoricalQuery420.HistoryKind.TRADE,
            MARKET_A,
            true,
            true
        );
        ExchangeHistoricalQuery420.Page memory p = history.query(q, 10, bytes32(0));
        require(p.records.length == 1, "filter count");
        require(p.records[0].recordId == bytes32(uint256(41)), "filter result");
    }

    function testAllHistoryClassesCanBeIndexed() public {
        for (uint8 i = 0; i < 9; i++) {
            _append(
                bytes32(uint256(100 + i)),
                ExchangeHistoricalQuery420.HistoryKind(i),
                MARKET_A,
                uint64(100 + i),
                uint32(i),
                true
            );
        }
        require(history.count() == 9, "history classes");
    }

    function testDuplicateRecordFailsClosed() public {
        _append(bytes32(uint256(61)), ExchangeHistoricalQuery420.HistoryKind.FEE_ROUTING, MARKET_A, 100, 1, true);
        ExchangeHistoricalQuery420.HistoricalRecord memory r = _record(
            bytes32(uint256(61)),
            ExchangeHistoricalQuery420.HistoryKind.FEE_ROUTING,
            MARKET_A,
            101,
            2,
            true
        );
        (bool ok,) = address(history).call(abi.encodeWithSelector(history.append.selector, r));
        require(!ok, "duplicate accepted");
    }

    function testPageBoundsFailClosed() public {
        ExchangeHistoricalQuery420.Query memory q = _query(
            ExchangeHistoricalQuery420.HistoryKind.TRADE,
            bytes32(0),
            false,
            true
        );
        (bool zeroOk,) = address(history).call(
            abi.encodeWithSelector(history.query.selector, q, uint16(0), bytes32(0))
        );
        require(!zeroOk, "zero page accepted");

        (bool largeOk,) = address(history).call(
            abi.encodeWithSelector(history.query.selector, q, uint16(101), bytes32(0))
        );
        require(!largeOk, "oversize page accepted");
    }

    function _append(
        bytes32 id,
        ExchangeHistoricalQuery420.HistoryKind kind,
        bytes32 subject,
        uint64 blockNumber,
        uint32 logIndex,
        bool active
    ) private {
        history.append(_record(id, kind, subject, blockNumber, logIndex, active));
    }

    function _record(
        bytes32 id,
        ExchangeHistoricalQuery420.HistoryKind kind,
        bytes32 subject,
        uint64 blockNumber,
        uint32 logIndex,
        bool active
    ) private pure returns (ExchangeHistoricalQuery420.HistoricalRecord memory) {
        return ExchangeHistoricalQuery420.HistoricalRecord({
            recordId: id,
            kind: kind,
            subjectId: subject,
            chainId: 420,
            blockNumber: blockNumber,
            transactionHash: keccak256(abi.encode(id, blockNumber)),
            logIndex: logIndex,
            active: active
        });
    }

    function _query(
        ExchangeHistoricalQuery420.HistoryKind kind,
        bytes32 subject,
        bool subjectFiltered,
        bool activeOnly
    ) private pure returns (ExchangeHistoricalQuery420.Query memory) {
        return ExchangeHistoricalQuery420.Query({
            kind: kind,
            subjectId: subject,
            subjectFiltered: subjectFiltered,
            activeOnly: activeOnly
        });
    }
}
