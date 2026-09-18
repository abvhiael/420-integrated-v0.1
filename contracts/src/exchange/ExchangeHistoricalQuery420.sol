// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Executable reference model for the V13.4 historical query API.
/// @dev Read-model only. It indexes references to canonical records and grants no protocol authority.
contract ExchangeHistoricalQuery420 {
    uint16 public constant SCHEMA_MAJOR = 13;
    uint16 public constant SCHEMA_MINOR = 4;
    uint16 public constant MAX_PAGE_SIZE = 100;

    enum HistoryKind {
        TRADE,
        FILL,
        ORDER,
        CANCELLATION,
        LIQUIDITY,
        BRIDGE_DEPOSIT,
        BRIDGE_WITHDRAWAL,
        ROUTE_STATE,
        FEE_ROUTING
    }

    struct HistoricalRecord {
        bytes32 recordId;
        HistoryKind kind;
        bytes32 subjectId;
        uint256 chainId;
        uint64 blockNumber;
        bytes32 transactionHash;
        uint32 logIndex;
        bool active;
    }

    struct Query {
        HistoryKind kind;
        bytes32 subjectId;
        bool subjectFiltered;
        bool activeOnly;
    }

    struct Page {
        HistoricalRecord[] records;
        bytes32 nextCursor;
        bool hasMore;
    }

    HistoricalRecord[] private _history;
    mapping(bytes32 => uint256) private _positionPlusOne;

    error InvalidRecord();
    error DuplicateRecord();
    error UnknownRecord();
    error InvalidPageSize();
    error InvalidCursor();

    event HistoricalRecordAdded(bytes32 indexed recordId, HistoryKind indexed kind, bytes32 indexed subjectId);
    event HistoricalRecordActivitySet(bytes32 indexed recordId, bool active);

    function append(HistoricalRecord calldata record_) external returns (uint256 position) {
        if (
            record_.recordId == bytes32(0) ||
            record_.subjectId == bytes32(0) ||
            record_.chainId == 0 ||
            record_.transactionHash == bytes32(0)
        ) revert InvalidRecord();
        if (_positionPlusOne[record_.recordId] != 0) revert DuplicateRecord();

        _history.push(record_);
        position = _history.length - 1;
        _positionPlusOne[record_.recordId] = position + 1;
        emit HistoricalRecordAdded(record_.recordId, record_.kind, record_.subjectId);
    }

    function setActive(bytes32 recordId, bool active) external {
        uint256 posPlusOne = _positionPlusOne[recordId];
        if (posPlusOne == 0) revert UnknownRecord();
        _history[posPlusOne - 1].active = active;
        emit HistoricalRecordActivitySet(recordId, active);
    }

    function query(Query calldata q, uint16 limit, bytes32 cursor) external view returns (Page memory page) {
        if (limit == 0 || limit > MAX_PAGE_SIZE) revert InvalidPageSize();

        uint256 start = _decodeCursor(q, cursor);
        HistoricalRecord[] memory buffer = new HistoricalRecord[](limit);
        uint256 found;
        uint256 i = start;

        while (i < _history.length && found < limit) {
            HistoricalRecord storage candidate = _history[i];
            if (_matches(candidate, q)) {
                buffer[found] = candidate;
                found++;
            }
            i++;
        }

        HistoricalRecord[] memory records = new HistoricalRecord[](found);
        for (uint256 j = 0; j < found; j++) {
            records[j] = buffer[j];
        }

        bool hasMore = _hasMatchingFrom(i, q);
        page.records = records;
        page.hasMore = hasMore;
        page.nextCursor = hasMore ? _encodeCursor(q, i) : bytes32(0);
    }

    function count() external view returns (uint256) {
        return _history.length;
    }

    function get(bytes32 recordId) external view returns (HistoricalRecord memory) {
        uint256 posPlusOne = _positionPlusOne[recordId];
        if (posPlusOne == 0) revert UnknownRecord();
        return _history[posPlusOne - 1];
    }

    function cursorFor(Query calldata q, uint256 position) external pure returns (bytes32) {
        return _encodeCursor(q, position);
    }

    function _matches(HistoricalRecord storage record_, Query calldata q) private view returns (bool) {
        if (record_.kind != q.kind) return false;
        if (q.subjectFiltered && record_.subjectId != q.subjectId) return false;
        if (q.activeOnly && !record_.active) return false;
        return true;
    }

    function _hasMatchingFrom(uint256 start, Query calldata q) private view returns (bool) {
        for (uint256 i = start; i < _history.length; i++) {
            if (_matches(_history[i], q)) return true;
        }
        return false;
    }

    function _queryHash(Query calldata q) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                SCHEMA_MAJOR,
                SCHEMA_MINOR,
                q.kind,
                q.subjectId,
                q.subjectFiltered,
                q.activeOnly
            )
        );
    }

    function _encodeCursor(Query calldata q, uint256 position) private pure returns (bytes32) {
        if (position > type(uint128).max) revert InvalidCursor();
        uint128 tag = uint128(uint256(_queryHash(q)));
        return bytes32((uint256(tag) << 128) | position);
    }

    function _decodeCursor(Query calldata q, bytes32 cursor) private view returns (uint256 position) {
        if (cursor == bytes32(0)) return 0;

        uint256 raw = uint256(cursor);
        uint128 tag = uint128(raw >> 128);
        uint128 expected = uint128(uint256(_queryHash(q)));
        if (tag != expected) revert InvalidCursor();

        position = uint128(raw);
        if (position > _history.length) revert InvalidCursor();
    }
}
