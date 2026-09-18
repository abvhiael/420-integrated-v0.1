// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeDeterministicIndexer420.sol";
import "../src/exchange/ExchangeMarketDataTypes420.sol";

contract ExchangeDeterministicIndexer420Test {
    ExchangeDeterministicIndexer420 private indexer;

    constructor() {
        indexer = new ExchangeDeterministicIndexer420();
    }

    function testIdempotentReplayReturnsFalseWithoutMutation() public {
        ExchangeMarketDataTypes420.RecordEnvelope memory e = _record(100, bytes32(uint256(0xA1)), bytes32(uint256(0xB1)), 0);
        require(indexer.ingest(e), "first insert");
        require(!indexer.ingest(e), "replay inserted");
        ExchangeMarketDataTypes420.RecordEnvelope memory stored = indexer.record(e.recordId);
        require(stored.payloadHash == e.payloadHash, "payload drift");
    }

    function testConflictingReplayFailsClosed() public {
        ExchangeMarketDataTypes420.RecordEnvelope memory e = _record(101, bytes32(uint256(0xA2)), bytes32(uint256(0xB2)), 0);
        require(indexer.ingest(e), "insert");
        e.payloadHash = bytes32(uint256(0xDEAD));
        (bool ok,) = address(indexer).call(abi.encodeWithSelector(indexer.ingest.selector, e));
        require(!ok, "conflicting replay accepted");
    }

    function testCanonicalCheckpointIsMonotonic() public {
        bytes32 h100 = bytes32(uint256(0xC100));
        bytes32 h101 = bytes32(uint256(0xC101));
        indexer.setCanonicalCheckpoint(420, 100, h100);
        indexer.setCanonicalCheckpoint(420, 101, h101);
        (uint64 canonicalBlock, bytes32 canonicalHash,,) = indexer.checkpoints(420);
        require(canonicalBlock == 101 && canonicalHash == h101, "checkpoint");
        (bool ok,) = address(indexer).call(
            abi.encodeWithSelector(indexer.setCanonicalCheckpoint.selector, uint256(420), uint64(99), bytes32(uint256(0xC099)))
        );
        require(!ok, "checkpoint regressed");
    }

    function testBoundedRollbackRestoresAncestorAndAllowsReplacement() public {
        bytes32 h100 = bytes32(uint256(0xD100));
        bytes32 h101 = bytes32(uint256(0xD101));
        bytes32 h102 = bytes32(uint256(0xD102));
        bytes32 h102b = bytes32(uint256(0xE102));
        indexer.setCanonicalCheckpoint(420, 100, h100);
        indexer.setCanonicalCheckpoint(420, 101, h101);
        indexer.setCanonicalCheckpoint(420, 102, h102);
        indexer.rollbackTo(420, 101, h101);
        indexer.setCanonicalCheckpoint(420, 102, h102b);
        (uint64 canonicalBlock, bytes32 canonicalHash,,) = indexer.checkpoints(420);
        require(canonicalBlock == 102 && canonicalHash == h102b, "replacement checkpoint");
    }

    function testRollbackCannotCrossFinalizedHead() public {
        bytes32 h100 = bytes32(uint256(0xF100));
        bytes32 h101 = bytes32(uint256(0xF101));
        indexer.setCanonicalCheckpoint(420, 100, h100);
        indexer.setCanonicalCheckpoint(420, 101, h101);
        indexer.setFinalizedCheckpoint(420, 100, h100);
        (bool ok,) = address(indexer).call(
            abi.encodeWithSelector(indexer.rollbackTo.selector, uint256(420), uint64(99), bytes32(uint256(0xF099)))
        );
        require(!ok, "finalized rollback accepted");
    }

    function testRollbackDepthBound() public {
        bytes32 h1 = bytes32(uint256(0x1));
        bytes32 h300 = bytes32(uint256(0x300));
        indexer.setCanonicalCheckpoint(420, 1, h1);
        indexer.setCanonicalCheckpoint(420, 300, h300);
        (bool ok,) = address(indexer).call(
            abi.encodeWithSelector(indexer.rollbackTo.selector, uint256(420), uint64(1), h1)
        );
        require(!ok, "deep rollback accepted");
    }

    function testCanonicalAndFinalizedRecordLifecycle() public {
        bytes32 blockHash = bytes32(uint256(0xABC));
        ExchangeMarketDataTypes420.RecordEnvelope memory e = _record(120, blockHash, bytes32(uint256(0xDEF)), 7);
        require(indexer.ingest(e), "insert");
        indexer.setCanonical(e.recordId);
        indexer.setCanonicalCheckpoint(420, 120, blockHash);
        indexer.setFinalizedCheckpoint(420, 120, blockHash);
        indexer.markFinalized(e.recordId);
        ExchangeMarketDataTypes420.RecordEnvelope memory stored = indexer.record(e.recordId);
        require(stored.canonicality == ExchangeMarketDataTypes420.Canonicality.FINALIZED, "not finalized");
    }

    function testOrphanedRecordCannotBeFinalized() public {
        ExchangeMarketDataTypes420.RecordEnvelope memory e = _record(130, bytes32(uint256(0xAAA)), bytes32(uint256(0xBBB)), 9);
        require(indexer.ingest(e), "insert");
        indexer.markOrphaned(e.recordId);
        (bool ok,) = address(indexer).call(abi.encodeWithSelector(indexer.markFinalized.selector, e.recordId));
        require(!ok, "orphan finalized");
    }

    function _record(uint64 blockNumber, bytes32 blockHash, bytes32 txHash, uint32 logIndex)
        private
        pure
        returns (ExchangeMarketDataTypes420.RecordEnvelope memory)
    {
        ExchangeMarketDataTypes420.Provenance memory p = ExchangeMarketDataTypes420.Provenance({
            chainId: 420,
            blockNumber: blockNumber,
            blockHash: blockHash,
            transactionHash: txHash,
            logIndex: logIndex
        });
        bytes32 subject = ExchangeMarketDataTypes420.subjectId(
            ExchangeMarketDataTypes420.SubjectKind.MARKET,
            keccak256("420/USD")
        );
        return ExchangeMarketDataTypes420.envelope(
            ExchangeMarketDataTypes420.Domain.TRADE,
            subject,
            p,
            ExchangeMarketDataTypes420.Canonicality.OBSERVED,
            1,
            keccak256(abi.encode(blockNumber, blockHash, txHash, logIndex))
        );
    }
}
