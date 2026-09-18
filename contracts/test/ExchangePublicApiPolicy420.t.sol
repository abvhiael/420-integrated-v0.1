// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangePublicApiPolicy420.sol";

contract ExchangePublicApiPolicy420Test {
    ExchangePublicApiPolicy420 private api;

    constructor() {
        api = new ExchangePublicApiPolicy420();
    }

    function testVersionNegotiationAcceptsCurrentAndOlderMinor() public view {
        ExchangePublicApiPolicy420.VersionRequest memory current =
            ExchangePublicApiPolicy420.VersionRequest({major: 13, minor: 6});
        ExchangePublicApiPolicy420.VersionRequest memory selected = api.negotiate(current);
        require(selected.major == 13 && selected.minor == 6, "current");

        ExchangePublicApiPolicy420.VersionRequest memory older =
            ExchangePublicApiPolicy420.VersionRequest({major: 13, minor: 4});
        selected = api.negotiate(older);
        require(selected.minor == 4, "older minor");
    }

    function testUnsupportedVersionFailsClosed() public {
        ExchangePublicApiPolicy420.VersionRequest memory future =
            ExchangePublicApiPolicy420.VersionRequest({major: 13, minor: 7});
        (bool futureOk,) = address(api).call(abi.encodeWithSelector(api.negotiate.selector, future));
        require(!futureOk, "future minor accepted");

        ExchangePublicApiPolicy420.VersionRequest memory wrongMajor =
            ExchangePublicApiPolicy420.VersionRequest({major: 14, minor: 0});
        (bool majorOk,) = address(api).call(abi.encodeWithSelector(api.negotiate.selector, wrongMajor));
        require(!majorOk, "wrong major accepted");
    }

    function testQueryBoundsAcceptMaximums() public view {
        ExchangePublicApiPolicy420.QueryEnvelope memory q =
            ExchangePublicApiPolicy420.QueryEnvelope({pageSize: 100, filterCount: 8, encodedBytes: 2048});
        api.validateQuery(q);
    }

    function testMalformedAndOversizeQueriesFailClosed() public {
        _expectQueryFailure(0, 0, 0);
        _expectQueryFailure(101, 0, 100);
        _expectQueryFailure(100, 9, 100);
        _expectQueryFailure(100, 8, 2049);
    }

    function testRateLimitAllowsWindowCapacityThenRejects() public {
        bytes32 client = keccak256("client-a");
        uint32 remaining;
        for (uint32 i = 0; i < 120; i++) {
            remaining = api.consume(client, 1000);
        }
        require(remaining == 0, "remaining");
        (bool ok,) = address(api).call(abi.encodeWithSelector(api.consume.selector, client, uint64(1000)));
        require(!ok, "limit not enforced");
    }

    function testRateLimitResetsAtNextWindow() public {
        bytes32 client = keccak256("client-b");
        for (uint32 i = 0; i < 120; i++) {
            api.consume(client, 1000);
        }
        uint32 remaining = api.consume(client, 1060);
        require(remaining == 119, "window reset");
    }

    function testRateLimitRejectsTimeRegression() public {
        bytes32 client = keccak256("client-c");
        api.consume(client, 1000);
        (bool ok,) = address(api).call(abi.encodeWithSelector(api.consume.selector, client, uint64(999)));
        require(!ok, "time regression accepted");
    }

    function testCachePolicyDistinguishesObservedCanonicalFinalized() public view {
        ExchangePublicApiPolicy420.CachePolicy memory observed = api.cachePolicy(false, false);
        require(!observed.cacheable && observed.maxAge == 0, "observed");

        ExchangePublicApiPolicy420.CachePolicy memory canonical = api.cachePolicy(true, false);
        require(canonical.cacheable && canonical.maxAge == 5 && canonical.staleWhileRevalidate == 30, "canonical");

        ExchangePublicApiPolicy420.CachePolicy memory finalized = api.cachePolicy(true, true);
        require(finalized.cacheable && finalized.maxAge == 30 && finalized.staleWhileRevalidate == 60, "finalized");
    }

    function testFreshnessBoundaryAndStaleFailure() public view {
        require(api.assertFresh(100, 130, 30) == 30, "boundary");
        (bool ok,) = address(api).staticcall(
            abi.encodeWithSelector(api.assertFresh.selector, uint64(100), uint64(131), uint32(30))
        );
        require(!ok, "stale accepted");
    }

    function testErrorContractIsStableAndDeterministic() public view {
        ExchangePublicApiPolicy420.ApiError memory a =
            api.errorContract(ExchangePublicApiPolicy420.ErrorCode.RATE_LIMITED);
        ExchangePublicApiPolicy420.ApiError memory b =
            api.errorContract(ExchangePublicApiPolicy420.ErrorCode.RATE_LIMITED);

        require(a.httpStatus == 429, "status");
        require(a.stableId != bytes32(0), "stable id");
        require(a.stableId == b.stableId, "drift");

        ExchangePublicApiPolicy420.ApiError memory stale =
            api.errorContract(ExchangePublicApiPolicy420.ErrorCode.STALE_DATA);
        require(stale.httpStatus == 503, "stale status");
        require(stale.stableId != a.stableId, "error collision");
    }

    function _expectQueryFailure(uint16 pageSize, uint16 filters, uint16 encodedBytes) private {
        ExchangePublicApiPolicy420.QueryEnvelope memory q =
            ExchangePublicApiPolicy420.QueryEnvelope({
                pageSize: pageSize,
                filterCount: filters,
                encodedBytes: encodedBytes
            });
        (bool ok,) = address(api).call(abi.encodeWithSelector(api.validateQuery.selector, q));
        require(!ok, "query accepted");
    }
}
