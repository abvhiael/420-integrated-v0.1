// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeMarketDataTypes420.sol";

/// @notice Executable reference state machine for the V13 deterministic read indexer.
/// @dev This contract is a qualification oracle for indexer behavior only. It has no protocol execution authority.
contract ExchangeDeterministicIndexer420 {
    using ExchangeMarketDataTypes420 for ExchangeMarketDataTypes420.Provenance;

    uint64 public constant MAX_ROLLBACK_BLOCKS = 256;

    struct StoredRecord {
        ExchangeMarketDataTypes420.RecordEnvelope envelope;
        bool exists;
    }

    struct Checkpoint {
        uint64 canonicalBlock;
        bytes32 canonicalBlockHash;
        uint64 finalizedBlock;
        bytes32 finalizedBlockHash;
    }

    mapping(bytes32 => StoredRecord) private _records;
    mapping(uint256 => Checkpoint) public checkpoints;
    mapping(uint256 => mapping(uint64 => bytes32)) public canonicalBlockHash;

    error RecordMismatch();
    error BlockConflict();
    error InvalidCheckpoint();
    error FinalizedRollback();
    error RollbackTooDeep();
    error UnknownRecord();

    event RecordIngested(bytes32 indexed recordId, uint256 indexed chainId, uint64 indexed blockNumber);
    event RecordCanonicalitySet(bytes32 indexed recordId, ExchangeMarketDataTypes420.Canonicality canonicality);
    event CanonicalCheckpointSet(uint256 indexed chainId, uint64 blockNumber, bytes32 blockHash);
    event FinalizedCheckpointSet(uint256 indexed chainId, uint64 blockNumber, bytes32 blockHash);
    event RolledBack(uint256 indexed chainId, uint64 fromBlock, uint64 toBlock);

    function ingest(ExchangeMarketDataTypes420.RecordEnvelope calldata incoming) external returns (bool inserted) {
        bytes32 expected = incoming.provenance.recordId();
        if (incoming.recordId != expected || incoming.subjectId == bytes32(0) || incoming.payloadHash == bytes32(0)) {
            revert RecordMismatch();
        }

        StoredRecord storage current = _records[incoming.recordId];
        if (current.exists) {
            if (_fingerprint(current.envelope) != _fingerprint(incoming)) revert RecordMismatch();
            return false;
        }

        bytes32 knownBlockHash = canonicalBlockHash[incoming.provenance.chainId][incoming.provenance.blockNumber];
        if (
            knownBlockHash != bytes32(0) &&
            incoming.canonicality != ExchangeMarketDataTypes420.Canonicality.ORPHANED &&
            knownBlockHash != incoming.provenance.blockHash
        ) revert BlockConflict();

        _records[incoming.recordId] = StoredRecord({envelope: incoming, exists: true});
        emit RecordIngested(incoming.recordId, incoming.provenance.chainId, incoming.provenance.blockNumber);
        return true;
    }

    function setCanonical(bytes32 recordId_) external {
        StoredRecord storage record = _requireRecord(recordId_);
        uint256 chainId = record.envelope.provenance.chainId;
        uint64 blockNumber = record.envelope.provenance.blockNumber;
        bytes32 blockHash = record.envelope.provenance.blockHash;

        bytes32 known = canonicalBlockHash[chainId][blockNumber];
        if (known != bytes32(0) && known != blockHash) revert BlockConflict();

        canonicalBlockHash[chainId][blockNumber] = blockHash;
        record.envelope.canonicality = ExchangeMarketDataTypes420.Canonicality.CANONICAL;
        emit RecordCanonicalitySet(recordId_, ExchangeMarketDataTypes420.Canonicality.CANONICAL);
    }

    function setCanonicalCheckpoint(uint256 chainId, uint64 blockNumber, bytes32 blockHash) external {
        if (chainId == 0 || blockHash == bytes32(0)) revert InvalidCheckpoint();
        Checkpoint storage cp = checkpoints[chainId];
        if (blockNumber < cp.canonicalBlock || blockNumber < cp.finalizedBlock) revert InvalidCheckpoint();

        bytes32 known = canonicalBlockHash[chainId][blockNumber];
        if (known != bytes32(0) && known != blockHash) revert BlockConflict();
        canonicalBlockHash[chainId][blockNumber] = blockHash;
        cp.canonicalBlock = blockNumber;
        cp.canonicalBlockHash = blockHash;
        emit CanonicalCheckpointSet(chainId, blockNumber, blockHash);
    }

    function setFinalizedCheckpoint(uint256 chainId, uint64 blockNumber, bytes32 blockHash) external {
        if (chainId == 0 || blockHash == bytes32(0)) revert InvalidCheckpoint();
        Checkpoint storage cp = checkpoints[chainId];
        if (blockNumber < cp.finalizedBlock || blockNumber > cp.canonicalBlock) revert InvalidCheckpoint();
        if (canonicalBlockHash[chainId][blockNumber] != blockHash) revert BlockConflict();

        cp.finalizedBlock = blockNumber;
        cp.finalizedBlockHash = blockHash;
        emit FinalizedCheckpointSet(chainId, blockNumber, blockHash);
    }

    function rollbackTo(uint256 chainId, uint64 ancestorBlock, bytes32 ancestorHash) external {
        Checkpoint storage cp = checkpoints[chainId];
        uint64 fromBlock = cp.canonicalBlock;
        if (ancestorBlock < cp.finalizedBlock) revert FinalizedRollback();
        if (ancestorBlock > fromBlock) revert InvalidCheckpoint();
        if (fromBlock - ancestorBlock > MAX_ROLLBACK_BLOCKS) revert RollbackTooDeep();
        if (canonicalBlockHash[chainId][ancestorBlock] != ancestorHash) revert BlockConflict();

        for (uint64 blockNumber = fromBlock; blockNumber > ancestorBlock; blockNumber--) {
            delete canonicalBlockHash[chainId][blockNumber];
        }

        cp.canonicalBlock = ancestorBlock;
        cp.canonicalBlockHash = ancestorHash;
        emit RolledBack(chainId, fromBlock, ancestorBlock);
    }

    function markOrphaned(bytes32 recordId_) external {
        StoredRecord storage record = _requireRecord(recordId_);
        if (record.envelope.provenance.blockNumber <= checkpoints[record.envelope.provenance.chainId].finalizedBlock) {
            revert FinalizedRollback();
        }
        record.envelope.canonicality = ExchangeMarketDataTypes420.Canonicality.ORPHANED;
        emit RecordCanonicalitySet(recordId_, ExchangeMarketDataTypes420.Canonicality.ORPHANED);
    }

    function markFinalized(bytes32 recordId_) external {
        StoredRecord storage record = _requireRecord(recordId_);
        Checkpoint memory cp = checkpoints[record.envelope.provenance.chainId];
        if (
            record.envelope.canonicality != ExchangeMarketDataTypes420.Canonicality.CANONICAL ||
            record.envelope.provenance.blockNumber > cp.finalizedBlock
        ) revert InvalidCheckpoint();
        record.envelope.canonicality = ExchangeMarketDataTypes420.Canonicality.FINALIZED;
        emit RecordCanonicalitySet(recordId_, ExchangeMarketDataTypes420.Canonicality.FINALIZED);
    }

    function record(bytes32 recordId_) external view returns (ExchangeMarketDataTypes420.RecordEnvelope memory) {
        return _requireRecord(recordId_).envelope;
    }

    function exists(bytes32 recordId_) external view returns (bool) {
        return _records[recordId_].exists;
    }

    function _requireRecord(bytes32 recordId_) private view returns (StoredRecord storage record_) {
        record_ = _records[recordId_];
        if (!record_.exists) revert UnknownRecord();
    }

    function _fingerprint(ExchangeMarketDataTypes420.RecordEnvelope memory e) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                e.recordId,
                e.domain,
                e.subjectId,
                e.provenance.chainId,
                e.provenance.blockNumber,
                e.provenance.blockHash,
                e.provenance.transactionHash,
                e.provenance.logIndex,
                e.observedAt,
                e.payloadHash
            )
        );
    }
}
