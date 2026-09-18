// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeLiveMarketData420.sol";

contract ExchangeLiveMarketData420Test {
    ExchangeLiveMarketData420 private stream;
    bytes32 private constant MARKET = keccak256("MARKET-A");

    constructor() {
        stream = new ExchangeLiveMarketData420();
    }

    function testSequenceNumbersAreStrictlyOrdered() public {
        uint64 a = _data(bytes32(uint256(1)), 100, 10, 11);
        uint64 b = _data(bytes32(uint256(2)), 101, 12, 13);
        require(a == 1 && b == 2, "sequence");
        require(stream.latestSequence() == 2, "latest");
    }

    function testResumeCursorContinuesAfterDeliveredSequence() public {
        _data(bytes32(uint256(11)), 100, 10, 11);
        _data(bytes32(uint256(12)), 101, 12, 13);
        _data(bytes32(uint256(13)), 102, 14, 15);

        ExchangeLiveMarketData420.ResumePage memory p1 = stream.resume(bytes32(0), 2);
        require(p1.events.length == 2, "p1");
        require(p1.events[0].sequence == 1 && p1.events[1].sequence == 2, "p1 seq");
        require(p1.hasMore, "p1 more");

        ExchangeLiveMarketData420.ResumePage memory p2 = stream.resume(p1.nextCursor, 2);
        require(p2.events.length == 1, "p2");
        require(p2.events[0].sequence == 3, "p2 seq");
        require(!p2.hasMore, "p2 more");
    }

    function testHeartbeatCarriesFreshnessWithoutInventingRecord() public {
        uint64 seq = stream.append(
            ExchangeLiveMarketData420.EventKind.HEARTBEAT,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            105,
            20,
            21,
            bytes32(0)
        );
        require(seq == 1, "heartbeat sequence");
        ExchangeLiveMarketData420.StreamEvent memory e = stream.eventAt(1);
        require(e.kind == ExchangeLiveMarketData420.EventKind.HEARTBEAT, "kind");
        require(e.recordId == bytes32(0), "record");
        require(stream.freshness(25) == 4, "freshness");
    }

    function testReorgNotificationReferencesAffectedRecord() public {
        bytes32 affected = bytes32(uint256(21));
        uint64 seq = stream.append(
            ExchangeLiveMarketData420.EventKind.REORG,
            MARKET,
            bytes32(0),
            affected,
            bytes32(0),
            110,
            30,
            31,
            keccak256("reorg")
        );
        ExchangeLiveMarketData420.StreamEvent memory e = stream.eventAt(seq);
        require(e.affectedRecordId == affected, "affected");
        require(e.replacementRecordId == bytes32(0), "replacement");
    }

    function testReplacementReferencesBothOldAndNewRecords() public {
        bytes32 oldId = bytes32(uint256(31));
        bytes32 newId = bytes32(uint256(32));
        uint64 seq = stream.append(
            ExchangeLiveMarketData420.EventKind.REPLACEMENT,
            MARKET,
            bytes32(0),
            oldId,
            newId,
            111,
            32,
            33,
            keccak256("replacement")
        );
        ExchangeLiveMarketData420.StreamEvent memory e = stream.eventAt(seq);
        require(e.affectedRecordId == oldId && e.replacementRecordId == newId, "replacement refs");
    }

    function testMalformedReplacementFailsClosed() public {
        (bool ok,) = address(stream).call(
            abi.encodeWithSelector(
                stream.append.selector,
                ExchangeLiveMarketData420.EventKind.REPLACEMENT,
                MARKET,
                bytes32(0),
                bytes32(uint256(41)),
                bytes32(uint256(41)),
                uint64(120),
                uint64(40),
                uint64(41),
                keccak256("bad")
            )
        );
        require(!ok, "same-id replacement accepted");
    }

    function testEmissionTimeCannotRegress() public {
        _data(bytes32(uint256(51)), 100, 50, 60);
        (bool ok,) = address(stream).call(
            abi.encodeWithSelector(
                stream.append.selector,
                ExchangeLiveMarketData420.EventKind.DATA,
                MARKET,
                bytes32(uint256(52)),
                bytes32(0),
                bytes32(0),
                uint64(101),
                uint64(51),
                uint64(59),
                keccak256("payload")
            )
        );
        require(!ok, "time regression accepted");
    }

    function testResumePageIsBounded() public {
        (bool zeroOk,) = address(stream).call(
            abi.encodeWithSelector(stream.resume.selector, bytes32(0), uint16(0))
        );
        require(!zeroOk, "zero page");

        (bool largeOk,) = address(stream).call(
            abi.encodeWithSelector(stream.resume.selector, bytes32(0), uint16(101))
        );
        require(!largeOk, "oversize page");
    }

    function testFutureCursorFailsClosed() public {
        bytes32 future = stream.cursorFor(10);
        (bool ok,) = address(stream).call(
            abi.encodeWithSelector(stream.resume.selector, future, uint16(10))
        );
        require(!ok, "future cursor accepted");
    }

    function _data(bytes32 id, uint64 head, uint64 observedAt, uint64 emittedAt) private returns (uint64) {
        return stream.append(
            ExchangeLiveMarketData420.EventKind.DATA,
            MARKET,
            id,
            bytes32(0),
            bytes32(0),
            head,
            observedAt,
            emittedAt,
            keccak256(abi.encode(id, head))
        );
    }
}
