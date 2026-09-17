// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical read-only schema primitives for 420Exchange V13 market data.
/// @dev These types create no execution, custody, mint, burn or settlement authority.
library ExchangeMarketDataTypes420 {
    uint16 internal constant SCHEMA_MAJOR = 13;
    uint16 internal constant SCHEMA_MINOR = 1;

    enum Domain {
        MARKET,
        TRADE,
        ORDER,
        LIQUIDITY,
        BRIDGE,
        FEE
    }

    enum Canonicality {
        OBSERVED,
        CANONICAL,
        ORPHANED,
        FINALIZED
    }

    enum SubjectKind {
        MARKET,
        ASSET,
        ROUTE,
        ADAPTER,
        ORDER
    }

    struct Provenance {
        uint256 chainId;
        uint64 blockNumber;
        bytes32 blockHash;
        bytes32 transactionHash;
        uint32 logIndex;
    }

    struct RecordEnvelope {
        bytes32 recordId;
        Domain domain;
        bytes32 subjectId;
        Provenance provenance;
        Canonicality canonicality;
        uint64 observedAt;
        bytes32 payloadHash;
    }

    struct DerivedEnvelope {
        bytes32 derivedId;
        Domain domain;
        bytes32 subjectId;
        bytes32 sourceSetHash;
        uint32 aggregationVersion;
        uint64 windowStart;
        uint64 windowEnd;
        bytes32 payloadHash;
    }

    error InvalidProvenance();
    error InvalidSubject();
    error InvalidPayload();
    error InvalidAggregation();

    function recordId(Provenance memory p) internal pure returns (bytes32) {
        validateProvenance(p);
        return keccak256(abi.encode(p.chainId, p.blockHash, p.transactionHash, p.logIndex));
    }

    function subjectId(SubjectKind kind, bytes32 canonicalId) internal pure returns (bytes32) {
        if (canonicalId == bytes32(0)) revert InvalidSubject();
        return keccak256(abi.encode(SCHEMA_MAJOR, SCHEMA_MINOR, kind, canonicalId));
    }

    function derivedId(
        Domain domain,
        bytes32 subject,
        bytes32 sourceSetHash,
        uint32 aggregationVersion,
        uint64 windowStart,
        uint64 windowEnd
    ) internal pure returns (bytes32) {
        if (subject == bytes32(0) || sourceSetHash == bytes32(0)) revert InvalidSubject();
        if (aggregationVersion == 0 || windowEnd <= windowStart) revert InvalidAggregation();
        return keccak256(
            abi.encode(
                SCHEMA_MAJOR,
                SCHEMA_MINOR,
                domain,
                subject,
                sourceSetHash,
                aggregationVersion,
                windowStart,
                windowEnd
            )
        );
    }

    function envelope(
        Domain domain,
        bytes32 subject,
        Provenance memory p,
        Canonicality canonicality,
        uint64 observedAt,
        bytes32 payloadHash
    ) internal pure returns (RecordEnvelope memory e) {
        if (subject == bytes32(0)) revert InvalidSubject();
        if (payloadHash == bytes32(0)) revert InvalidPayload();
        e = RecordEnvelope({
            recordId: recordId(p),
            domain: domain,
            subjectId: subject,
            provenance: p,
            canonicality: canonicality,
            observedAt: observedAt,
            payloadHash: payloadHash
        });
    }

    function validateProvenance(Provenance memory p) internal pure {
        if (
            p.chainId == 0 ||
            p.blockHash == bytes32(0) ||
            p.transactionHash == bytes32(0)
        ) revert InvalidProvenance();
    }
}
