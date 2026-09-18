// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Executable reference policy for the V13.6 public API hardening layer.
/// @dev Read-surface policy only. It grants no execution, custody, mint, burn or settlement authority.
contract ExchangePublicApiPolicy420 {
    uint16 public constant API_MAJOR = 13;
    uint16 public constant API_MINOR = 6;

    uint16 public constant MAX_PAGE_SIZE = 100;
    uint16 public constant MAX_FILTERS = 8;
    uint16 public constant MAX_QUERY_BYTES = 2048;
    uint32 public constant RATE_LIMIT_WINDOW_SECONDS = 60;
    uint32 public constant RATE_LIMIT_MAX_REQUESTS = 120;
    uint32 public constant DEFAULT_CACHE_MAX_AGE = 5;
    uint32 public constant MAX_STALE_SECONDS = 30;

    enum ErrorCode {
        NONE,
        UNSUPPORTED_VERSION,
        MALFORMED_QUERY,
        REQUEST_TOO_LARGE,
        PAGE_LIMIT_EXCEEDED,
        TOO_MANY_FILTERS,
        RATE_LIMITED,
        STALE_DATA
    }

    struct VersionRequest {
        uint16 major;
        uint16 minor;
    }

    struct QueryEnvelope {
        uint16 pageSize;
        uint16 filterCount;
        uint16 encodedBytes;
    }

    struct RateState {
        uint64 windowStart;
        uint32 requests;
    }

    struct ApiError {
        ErrorCode code;
        uint16 httpStatus;
        bytes32 stableId;
    }

    struct CachePolicy {
        uint32 maxAge;
        uint32 staleWhileRevalidate;
        bool cacheable;
    }

    mapping(bytes32 => RateState) public rateState;

    error UnsupportedVersion();
    error MalformedQuery();
    error RequestTooLarge();
    error PageLimitExceeded();
    error TooManyFilters();
    error RateLimited();
    error StaleData();

    function negotiate(VersionRequest calldata requested) external pure returns (VersionRequest memory selected) {
        if (requested.major != API_MAJOR || requested.minor > API_MINOR) revert UnsupportedVersion();
        return VersionRequest({major: API_MAJOR, minor: requested.minor});
    }

    function validateQuery(QueryEnvelope calldata query) external pure {
        if (query.encodedBytes == 0) revert MalformedQuery();
        if (query.encodedBytes > MAX_QUERY_BYTES) revert RequestTooLarge();
        if (query.pageSize == 0) revert MalformedQuery();
        if (query.pageSize > MAX_PAGE_SIZE) revert PageLimitExceeded();
        if (query.filterCount > MAX_FILTERS) revert TooManyFilters();
    }

    function consume(bytes32 clientKey, uint64 nowTimestamp) external returns (uint32 remaining) {
        if (clientKey == bytes32(0) || nowTimestamp == 0) revert MalformedQuery();

        RateState storage state = rateState[clientKey];
        if (state.windowStart == 0 || nowTimestamp >= state.windowStart + RATE_LIMIT_WINDOW_SECONDS) {
            state.windowStart = nowTimestamp;
            state.requests = 0;
        } else if (nowTimestamp < state.windowStart) {
            revert MalformedQuery();
        }

        if (state.requests >= RATE_LIMIT_MAX_REQUESTS) revert RateLimited();
        state.requests += 1;
        return RATE_LIMIT_MAX_REQUESTS - state.requests;
    }

    function cachePolicy(bool canonical, bool finalized) external pure returns (CachePolicy memory policy) {
        if (finalized) {
            return CachePolicy({maxAge: 30, staleWhileRevalidate: 60, cacheable: true});
        }
        if (canonical) {
            return CachePolicy({
                maxAge: DEFAULT_CACHE_MAX_AGE,
                staleWhileRevalidate: MAX_STALE_SECONDS,
                cacheable: true
            });
        }
        return CachePolicy({maxAge: 0, staleWhileRevalidate: 0, cacheable: false});
    }

    function assertFresh(uint64 sourceTimestamp, uint64 nowTimestamp, uint32 maxAge) external pure returns (uint64 age) {
        if (sourceTimestamp == 0 || nowTimestamp < sourceTimestamp || maxAge > MAX_STALE_SECONDS) {
            revert MalformedQuery();
        }
        age = nowTimestamp - sourceTimestamp;
        if (age > maxAge) revert StaleData();
    }

    function errorContract(ErrorCode code) external pure returns (ApiError memory e) {
        if (code == ErrorCode.NONE) return ApiError({code: code, httpStatus: 200, stableId: bytes32(0)});

        uint16 status;
        if (code == ErrorCode.UNSUPPORTED_VERSION) status = 406;
        else if (
            code == ErrorCode.MALFORMED_QUERY ||
            code == ErrorCode.REQUEST_TOO_LARGE ||
            code == ErrorCode.PAGE_LIMIT_EXCEEDED ||
            code == ErrorCode.TOO_MANY_FILTERS
        ) status = 400;
        else if (code == ErrorCode.RATE_LIMITED) status = 429;
        else if (code == ErrorCode.STALE_DATA) status = 503;
        else revert MalformedQuery();

        e = ApiError({
            code: code,
            httpStatus: status,
            stableId: keccak256(abi.encode(API_MAJOR, API_MINOR, code))
        });
    }
}
