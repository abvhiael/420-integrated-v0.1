// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../sports-5d4/SportsFundedTickets420.t.sol";
import "../../src/bet/sports/SportsOracleOutcomeGate420.sol";
import "../../src/oracle/OracleRouter420.sol";
import "../../src/oracle/OracleFeedRegistry420.sol";
import "../../src/oracle/OracleProviderRegistry420.sol";
import "../../src/oracle/OracleRiskPolicy420.sol";

/// @notice Real production OracleRouter420 / registry / risk-policy integration.
contract SportsRealOracleRouterIntegration420Test is SportsFundedTickets420Test {
    bytes32 constant PROVIDER_A = keccak256("sports-publisher-1");
    bytes32 constant PROVIDER_B = keccak256("sports-publisher-2");
    bytes32 constant PROVIDER_C = keccak256("sports-publisher-3");
    address constant A = address(0xFA01);
    address constant B = address(0xFA02);
    address constant C = address(0xFA03);
    OracleProviderRegistry420 providers;
    OracleFeedRegistry420 feeds;
    OracleRiskPolicy420 risk;
    OracleRouter420 router;
    SportsOracleOutcomeGate420 gate;
    bytes32 feed;

    function _configureRealRouter() internal {
        providers = new OracleProviderRegistry420(address(this));
        providers.setProvider(PROVIDER_A, A, keccak256("independent-a-fixture"), bytes32(0), true);
        providers.setProvider(PROVIDER_B, B, keccak256("independent-b-fixture"), bytes32(0), true);
        providers.setProvider(PROVIDER_C, C, keccak256("independent-c-fixture"), bytes32(0), true);
        feeds = new OracleFeedRegistry420(address(this), address(providers));
        risk = new OracleRiskPolicy420(address(this));
        router = new OracleRouter420(address(this), address(providers), address(feeds), address(risk));
        gate = new SportsOracleOutcomeGate420(address(router), address(vault), 300, 9000, 2);
        feed = gate.feedFor(market);
        feeds.setFeed(feed, OracleIds420.FEED_OUTCOME, OracleIds420.AGGREGATION_QUORUM_EQUAL,
            300, 0, 2, keccak256("sports-match-result"), true);
        feeds.setSource(feed, PROVIDER_A, true);
        feeds.setSource(feed, PROVIDER_B, true);
        feeds.setSource(feed, PROVIDER_C, true);
        risk.setPolicy(feed, 9000, 10000, false);
        _grant(CONTROL, vault.BIND_ORACLE(), vault.scope(market));
        _call(CONTROL, address(vault), abi.encodeCall(vault.bindOracle, (market, address(gate))));
        _call(CONTROL, address(vault),
            abi.encodeCall(vault.bindRiskGroup, (market, vault.correlationGroupFor(market), 1000)));
        _grant(CONTROL, vault.BIND_ORACLE(), vault.scope(bytes32(0)));
        _grant(CONTROL, vault.SET_ASSET_RISK(), vault.scope(bytes32(0)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 5000)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.enableOracleOnlyFunding, ()));
        _grant(address(gate), vault.RESOLVE(), vault.scope(market));
    }

    function _ticket() internal returns (bytes32 id) {
        _configureRealRouter();
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        id = _fund(500);
        vm.warp(markets.get(market).config.cutoff + 1);
        _certifyWinner();
    }

    function _report(address publisher, bytes32 provider, bytes32 observation, bytes32 resultHash) internal {
        vm.prank(publisher);
        router.submitObservation(feed, provider, observation, 0, resultHash,
            keccak256(abi.encode("source-payload", provider, resultHash)),
            uint64(block.timestamp), 9500);
    }

    function _winner() internal view returns (bytes32) {
        SportsOutcomeCertification420.Result memory r = cert.result(market);
        return gate.commitment(market, r.selection, r.evidence);
    }

    function _twoHonest() internal {
        bytes32 resultHash = _winner();
        _report(A, PROVIDER_A, keccak256("A-1"), resultHash);
        _report(B, PROVIDER_B, keccak256("B-1"), resultHash);
    }

    function _reject(bytes32 id) internal {
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "oracle bypass");
        require(uint256(vault.get(id).state) == 1, "ticket changed despite oracle rejection");
    }

    function testRealRouterRequiresQuorumThenSettles() public {
        bytes32 id = _ticket();
        _report(A, PROVIDER_A, keccak256("A-1"), _winner());
        _reject(id);
        _report(B, PROVIDER_B, keccak256("B-1"), _winner());
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        gate.settle(id, true);
        require(vault.credit(PLAYER, address(token)) == 925, "real router payout");
        require(vault.riskGroupOutstanding(vault.correlationGroupFor(market)) == 0, "exposure not closed");
    }

    function testRealRouterRejectsRevokedProvider() public {
        bytes32 id = _ticket();
        _twoHonest();
        providers.setProvider(PROVIDER_B, B, keccak256("revoked"), bytes32(0), false);
        _reject(id);
    }

    function testRealRouterCircuitBreakerAndRecovery() public {
        bytes32 id = _ticket();
        _twoHonest();
        risk.setPolicy(feed, 9000, 10000, true);
        _reject(id);
        risk.setPolicy(feed, 9000, 10000, false);
        gate.settle(id, true);
        require(vault.credit(PLAYER, address(token)) == 925, "safe recovery");
    }

    function testRealRouterExpiryAndRefundRecovery() public {
        bytes32 id = _ticket();
        _twoHonest();
        vm.warp(block.timestamp + 301);
        _reject(id);
        vm.warp(markets.get(market).config.cutoff + 4 days);
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500, "timeout refund");
        require(vault.riskGroupOutstanding(vault.correlationGroupFor(market)) == 0, "refund exposure");
    }

    function testRealRouterConflictingPublishersReject() public {
        bytes32 id = _ticket();
        _report(A, PROVIDER_A, keccak256("A-1"), _winner());
        _report(B, PROVIDER_B, keccak256("B-1"), keccak256("invalid-winner"));
        _reject(id);
    }

    function testRealRouterReplayAndWrongProviderReject() public {
        bytes32 id = _ticket();
        _report(A, PROVIDER_A, keccak256("A-1"), _winner());
        vm.prank(B);
        (bool ok,) = address(router).call(abi.encodeCall(router.submitObservation,
            (feed, PROVIDER_B, keccak256("A-1"), int256(0), _winner(), bytes32(0),
             uint64(block.timestamp), uint16(9500))));
        require(!ok, "replayed observation");
        vm.prank(C);
        (ok,) = address(router).call(abi.encodeCall(router.submitObservation,
            (feed, PROVIDER_B, keccak256("forged"), int256(0), _winner(), bytes32(0),
             uint64(block.timestamp), uint16(9500))));
        require(!ok, "provider spoof");
        _reject(id);
    }

    function testFuzzTwoMarketCorrelatedExposureLimit(uint16 a, uint16 b) public {
        uint256 firstStake = 100 + uint256(a) % 301;
        uint256 secondStake = 100 + uint256(b) % 301;
        bytes32 spreadTemplate = _newTemplate(_templateConfig(SportsTypes420.Kind.SPREAD));
        bytes32 second = _newMarket(_marketConfig(spreadTemplate, -7));
        _grant(CONTROL, vault.BIND_ORACLE(), vault.scope(market));
        _grant(CONTROL, vault.BIND_ORACLE(), vault.scope(second));
        bytes32 group = vault.correlationGroupFor(market);
        _call(CONTROL, address(vault), abi.encodeCall(vault.bindRiskGroup, (market, group, 500)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.bindRiskGroup, (second, group, 500)));
        _grant(CONTROL, acceptance.CONFIGURE(), acceptance.scope(second));
        _call(CONTROL, address(acceptance), abi.encodeCall(
            acceptance.configure, (second, SportsBetAcceptance420.Risk(
                100, 1000, 2000, 1200, 1500, true
            ))
        ));
        _grant(signer, odds.SIGN(), odds.scope(second));
        _submit(_quote(1));
        SportsOddsIngestion420.Odds memory q = _quote(1);
        q.marketId = second;
        q.termsHash = markets.get(second).termsHash;
        q.quoteEpoch = markets.get(second).quoteEpoch;
        _submit(q);
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (second, 2000)));
        bytes32 firstTicket = _fund(firstStake);
        uint256 firstProfit = vault.get(firstTicket).profit;
        require(vault.riskGroupOutstanding(group) == firstProfit, "first market exposure lost");
        SportsBetAcceptance420.Offer memory secondOffer = _offer(secondStake);
        secondOffer.marketId = second;
        bytes32[] memory secondSelections = markets.selections(second);
        secondOffer.selection = secondSelections[0];
        (SportsOddsIngestion420.Latest memory latest,) = odds.current(second);
        secondOffer.quoteDigest = latest.digest;
        secondOffer.nonce = keccak256("second-market-nonce");
        vm.prank(PLAYER);
        (bool ok, bytes memory returned) = address(vault).call(abi.encodeCall(vault.fund, (secondOffer)));
        uint256 secondProfit = (secondStake * 1_850_000 / 1_000_000) - secondStake;
        if (firstProfit + secondProfit > 500) {
            require(!ok, "correlated exposure cap bypassed");
            require(vault.riskGroupOutstanding(group) == firstProfit, "failed ticket changed group");
        } else {
            require(ok, "safe correlated funding rejected");
            bytes32 secondTicket = abi.decode(returned, (bytes32));
            require(vault.get(secondTicket).profit == secondProfit, "incorrect profit");
            require(vault.riskGroupOutstanding(group) == firstProfit + secondProfit,
                "cross-market exposure not conserved");
        }
        require(vault.assetLiability(address(token)) ==
            vault.assetCollateral(address(token)) + vault.assetPendingStake(address(token))
                + vault.assetPlayerCredit(address(token)), "nominal token obligations");
    }
}
