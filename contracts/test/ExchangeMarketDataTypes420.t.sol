// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeMarketDataTypes420.sol";

contract ExchangeMarketDataTypes420Harness {
    using ExchangeMarketDataTypes420 for ExchangeMarketDataTypes420.Provenance;

    function recordId(ExchangeMarketDataTypes420.Provenance calldata p) external pure returns (bytes32) {
        return ExchangeMarketDataTypes420.recordId(p);
    }

    function subjectId(ExchangeMarketDataTypes420.SubjectKind kind, bytes32 canonicalId) external pure returns (bytes32) {
        return ExchangeMarketDataTypes420.subjectId(kind, canonicalId);
    }

    function derivedId(
        ExchangeMarketDataTypes420.Domain domain,
        bytes32 subject,
        bytes32 sourceSetHash,
        uint32 aggregationVersion,
        uint64 windowStart,
        uint64 windowEnd
    ) external pure returns (bytes32) {
        return ExchangeMarketDataTypes420.derivedId(
            domain, subject, sourceSetHash, aggregationVersion, windowStart, windowEnd
        );
    }
}

contract ExchangeMarketDataTypes420Test {
    ExchangeMarketDataTypes420Harness private harness;

    constructor() {
        harness = new ExchangeMarketDataTypes420Harness();
    }

    function testRecordIdentityIsStableForSameCanonicalLog() public view {
        ExchangeMarketDataTypes420.Provenance memory p = _provenance(bytes32(uint256(11)), bytes32(uint256(22)), 7);
        bytes32 a = harness.recordId(p);
        bytes32 b = harness.recordId(p);
        require(a != bytes32(0), "zero record id");
        require(a == b, "record id unstable");
    }

    function testReorgReplacementCannotCollide() public view {
        ExchangeMarketDataTypes420.Provenance memory canonical = _provenance(bytes32(uint256(11)), bytes32(uint256(22)), 7);
        ExchangeMarketDataTypes420.Provenance memory replacement = _provenance(bytes32(uint256(12)), bytes32(uint256(22)), 7);
        require(harness.recordId(canonical) != harness.recordId(replacement), "reorg collision");
    }

    function testTransactionOrLogChangeCannotCollide() public view {
        ExchangeMarketDataTypes420.Provenance memory a = _provenance(bytes32(uint256(11)), bytes32(uint256(22)), 7);
        ExchangeMarketDataTypes420.Provenance memory b = _provenance(bytes32(uint256(11)), bytes32(uint256(23)), 7);
        ExchangeMarketDataTypes420.Provenance memory c = _provenance(bytes32(uint256(11)), bytes32(uint256(22)), 8);
        require(harness.recordId(a) != harness.recordId(b), "transaction collision");
        require(harness.recordId(a) != harness.recordId(c), "log collision");
    }

    function testCanonicalSubjectKindsAreDomainSeparated() public view {
        bytes32 canonical = keccak256("shared-canonical-id");
        bytes32 market = harness.subjectId(ExchangeMarketDataTypes420.SubjectKind.MARKET, canonical);
        bytes32 asset = harness.subjectId(ExchangeMarketDataTypes420.SubjectKind.ASSET, canonical);
        bytes32 route = harness.subjectId(ExchangeMarketDataTypes420.SubjectKind.ROUTE, canonical);
        bytes32 adapter = harness.subjectId(ExchangeMarketDataTypes420.SubjectKind.ADAPTER, canonical);
        bytes32 order = harness.subjectId(ExchangeMarketDataTypes420.SubjectKind.ORDER, canonical);
        require(market != asset && market != route && market != adapter && market != order, "market collision");
        require(asset != route && asset != adapter && asset != order, "asset collision");
        require(route != adapter && route != order, "route collision");
        require(adapter != order, "adapter collision");
    }

    function testDerivedIdentityBindsAggregationVersion() public view {
        bytes32 subject = harness.subjectId(ExchangeMarketDataTypes420.SubjectKind.MARKET, keccak256("market"));
        bytes32 sources = keccak256("source-record-set");
        bytes32 v1 = harness.derivedId(ExchangeMarketDataTypes420.Domain.TRADE, subject, sources, 1, 100, 200);
        bytes32 v2 = harness.derivedId(ExchangeMarketDataTypes420.Domain.TRADE, subject, sources, 2, 100, 200);
        require(v1 != v2, "aggregation version collision");
    }

    function testDerivedIdentityBindsSourceSetAndWindow() public view {
        bytes32 subject = harness.subjectId(ExchangeMarketDataTypes420.SubjectKind.MARKET, keccak256("market"));
        bytes32 a = harness.derivedId(
            ExchangeMarketDataTypes420.Domain.TRADE, subject, keccak256("sources-a"), 1, 100, 200
        );
        bytes32 b = harness.derivedId(
            ExchangeMarketDataTypes420.Domain.TRADE, subject, keccak256("sources-b"), 1, 100, 200
        );
        bytes32 c = harness.derivedId(
            ExchangeMarketDataTypes420.Domain.TRADE, subject, keccak256("sources-a"), 1, 200, 300
        );
        require(a != b, "source set collision");
        require(a != c, "window collision");
    }

    function testInvalidProvenanceFailsClosed() public {
        ExchangeMarketDataTypes420.Provenance memory p = ExchangeMarketDataTypes420.Provenance({
            chainId: 0,
            blockNumber: 1,
            blockHash: bytes32(uint256(1)),
            transactionHash: bytes32(uint256(2)),
            logIndex: 0
        });
        (bool ok,) = address(harness).call(abi.encodeWithSelector(harness.recordId.selector, p));
        require(!ok, "zero chain accepted");

        p.chainId = block.chainid;
        p.blockHash = bytes32(0);
        (ok,) = address(harness).call(abi.encodeWithSelector(harness.recordId.selector, p));
        require(!ok, "zero block hash accepted");

        p.blockHash = bytes32(uint256(1));
        p.transactionHash = bytes32(0);
        (ok,) = address(harness).call(abi.encodeWithSelector(harness.recordId.selector, p));
        require(!ok, "zero tx hash accepted");
    }

    function testInvalidDerivedEnvelopeInputsFailClosed() public {
        bytes32 subject = harness.subjectId(ExchangeMarketDataTypes420.SubjectKind.MARKET, keccak256("market"));
        bytes32 sources = keccak256("sources");

        (bool ok,) = address(harness).call(
            abi.encodeWithSelector(
                harness.derivedId.selector,
                ExchangeMarketDataTypes420.Domain.TRADE,
                subject,
                sources,
                uint32(0),
                uint64(100),
                uint64(200)
            )
        );
        require(!ok, "zero aggregation version accepted");

        (ok,) = address(harness).call(
            abi.encodeWithSelector(
                harness.derivedId.selector,
                ExchangeMarketDataTypes420.Domain.TRADE,
                subject,
                sources,
                uint32(1),
                uint64(200),
                uint64(200)
            )
        );
        require(!ok, "empty window accepted");
    }

    function _provenance(bytes32 blockHash, bytes32 transactionHash, uint32 logIndex)
        private
        view
        returns (ExchangeMarketDataTypes420.Provenance memory)
    {
        return ExchangeMarketDataTypes420.Provenance({
            chainId: block.chainid,
            blockNumber: 420,
            blockHash: blockHash,
            transactionHash: transactionHash,
            logIndex: logIndex
        });
    }
}
