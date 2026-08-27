// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/trust/TrustIds420.sol";
import "../src/trust/TrustIssuerRegistry420.sol";
import "../src/trust/TrustPolicyRegistry420.sol";
import "../src/trust/TrustSignalRegistry420.sol";
import "../src/trust/TrustAggregator420.sol";

interface VmTrust420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract Trust420Test {
    VmTrust420 internal constant vm = VmTrust420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant MARKET_OPERATOR = address(0x4201);
    address internal constant OTHER_OPERATOR = address(0x4202);
    address internal constant ROTATED_OPERATOR = address(0x4203);

    bytes32 internal constant MARKET_ISSUER = keccak256("420-market-order-registry");
    bytes32 internal constant OTHER_ISSUER = keccak256("other-issuer");
    bytes32 internal constant SUBJECT = keccak256("merchant-1");
    bytes32 internal constant FULFILLED_COUNT = keccak256("420/TRUST/METRIC/MARKET/FULFILLED_ORDERS/COUNT/V1");
    bytes32 internal constant DISPUTE_COUNT = keccak256("420/TRUST/METRIC/MARKET/DISPUTES/COUNT/V1");

    struct Suite {
        TrustIssuerRegistry420 issuers;
        TrustPolicyRegistry420 policy;
        TrustSignalRegistry420 signals;
        TrustAggregator420 aggregator;
    }

    function _deploy() private returns (Suite memory suite) {
        suite.issuers = new TrustIssuerRegistry420(address(this));
        suite.policy = new TrustPolicyRegistry420(address(this));
        suite.signals = new TrustSignalRegistry420(address(suite.issuers), address(suite.policy));
        suite.aggregator = new TrustAggregator420(address(suite.signals), address(suite.policy));

        suite.issuers.setIssuer(MARKET_ISSUER, MARKET_OPERATOR, keccak256("market-meta"), true);
        suite.issuers.setIssuer(OTHER_ISSUER, OTHER_OPERATOR, keccak256("other-meta"), true);
        suite.policy.setMetric(
            FULFILLED_COUNT,
            TrustIds420.DOMAIN_MARKET,
            TrustIds420.UNIT_COUNT,
            keccak256("fulfilled-v1"),
            true
        );
        suite.policy.setMetric(
            DISPUTE_COUNT,
            TrustIds420.DOMAIN_MARKET,
            TrustIds420.UNIT_COUNT,
            keccak256("dispute-v1"),
            true
        );
        suite.policy.setIssuerAuthorization(FULFILLED_COUNT, MARKET_ISSUER, true);
        suite.policy.setIssuerAuthorization(DISPUTE_COUNT, MARKET_ISSUER, true);
        vm.warp(1_000);
    }

    function _input(bytes32 signalId, bytes32 metricId, bytes32 evidenceRef, int256 value)
        private
        pure
        returns (TrustSignalRegistry420.SignalInput memory)
    {
        return TrustSignalRegistry420.SignalInput({
            signalId: signalId,
            subjectType: TrustIds420.SUBJECT_PROTOCOL_ENTITY,
            subjectId: SUBJECT,
            metricId: metricId,
            issuerId: MARKET_ISSUER,
            value: value,
            evidenceRef: evidenceRef,
            occurredAt: 990
        });
    }

    function testAuthorizedSignalUpdatesOnlyExactMetric() public {
        Suite memory suite = _deploy();
        vm.prank(MARKET_OPERATOR);
        suite.signals.submitSignal(_input(keccak256("s1"), FULFILLED_COUNT, keccak256("order-1"), 1));

        TrustAggregator420.MetricRead memory fulfilled = suite.aggregator.readMetric(
            TrustIds420.SUBJECT_PROTOCOL_ENTITY, SUBJECT, FULFILLED_COUNT
        );
        TrustAggregator420.MetricRead memory disputes = suite.aggregator.readMetric(
            TrustIds420.SUBJECT_PROTOCOL_ENTITY, SUBJECT, DISPUTE_COUNT
        );
        require(fulfilled.total == 1 && fulfilled.activeSignals == 1, "fulfilled aggregate");
        require(disputes.total == 0 && disputes.activeSignals == 0, "cross metric contamination");
        require(fulfilled.domainId == TrustIds420.DOMAIN_MARKET, "domain");
        require(fulfilled.unitId == TrustIds420.UNIT_COUNT, "unit");
    }

    function testUnauthorizedOperatorCannotIssue() public {
        Suite memory suite = _deploy();
        vm.prank(OTHER_OPERATOR);
        vm.expectRevert(TrustSignalRegistry420.UnauthorizedIssuer.selector);
        suite.signals.submitSignal(_input(keccak256("bad"), FULFILLED_COUNT, keccak256("order-bad"), 1));
    }

    function testIssuerMustBeAuthorizedForMetric() public {
        Suite memory suite = _deploy();
        suite.policy.setIssuerAuthorization(FULFILLED_COUNT, MARKET_ISSUER, false);
        vm.prank(MARKET_OPERATOR);
        vm.expectRevert(TrustSignalRegistry420.UnauthorizedMetricIssuer.selector);
        suite.signals.submitSignal(_input(keccak256("bad-metric"), FULFILLED_COUNT, keccak256("order-2"), 1));
    }

    function testSignalIdCannotReplay() public {
        Suite memory suite = _deploy();
        bytes32 signalId = keccak256("same-signal");
        vm.prank(MARKET_OPERATOR);
        suite.signals.submitSignal(_input(signalId, FULFILLED_COUNT, keccak256("order-3"), 1));
        vm.prank(MARKET_OPERATOR);
        vm.expectRevert(TrustSignalRegistry420.SignalAlreadyExists.selector);
        suite.signals.submitSignal(_input(signalId, FULFILLED_COUNT, keccak256("order-4"), 1));
    }

    function testEvidenceTupleCannotReplay() public {
        Suite memory suite = _deploy();
        bytes32 evidence = keccak256("order-5");
        vm.prank(MARKET_OPERATOR);
        suite.signals.submitSignal(_input(keccak256("first"), FULFILLED_COUNT, evidence, 1));
        vm.prank(MARKET_OPERATOR);
        vm.expectRevert(TrustSignalRegistry420.EvidenceReplay.selector);
        suite.signals.submitSignal(_input(keccak256("second"), FULFILLED_COUNT, evidence, 1));
    }

    function testCorrectionPreservesHistoryAndConservesAggregate() public {
        Suite memory suite = _deploy();
        bytes32 first = keccak256("incorrect-signal");
        bytes32 corrected = keccak256("corrected-signal");
        vm.prank(MARKET_OPERATOR);
        suite.signals.submitSignal(_input(first, FULFILLED_COUNT, keccak256("evidence-a"), 5));

        vm.prank(MARKET_OPERATOR);
        suite.signals.correctSignal(first, corrected, 2, keccak256("correction-evidence"), 995);

        TrustSignalRegistry420.Signal memory oldSignal = suite.signals.getSignal(first);
        TrustSignalRegistry420.Signal memory newSignal = suite.signals.getSignal(corrected);
        TrustSignalRegistry420.Aggregate memory aggregate = suite.signals.getAggregate(
            TrustIds420.SUBJECT_PROTOCOL_ENTITY, SUBJECT, FULFILLED_COUNT
        );

        require(oldSignal.value == 5, "old evidence rewritten");
        require(oldSignal.state == TrustSignalRegistry420.SignalState.SUPERSEDED, "old state");
        require(newSignal.value == 2 && newSignal.correctionOf == first, "replacement");
        require(suite.signals.supersededBy(first) == corrected, "successor");
        require(aggregate.total == 2 && aggregate.activeSignals == 1, "aggregate conservation");
    }

    function testRevocationRemovesSignalExactlyOnce() public {
        Suite memory suite = _deploy();
        bytes32 signalId = keccak256("revocable");
        vm.prank(MARKET_OPERATOR);
        suite.signals.submitSignal(_input(signalId, FULFILLED_COUNT, keccak256("rev-evidence"), 3));

        vm.prank(MARKET_OPERATOR);
        suite.signals.revokeSignal(signalId, keccak256("invalid-source-record"));
        TrustSignalRegistry420.Aggregate memory aggregate = suite.signals.getAggregate(
            TrustIds420.SUBJECT_PROTOCOL_ENTITY, SUBJECT, FULFILLED_COUNT
        );
        require(aggregate.total == 0 && aggregate.activeSignals == 0, "revocation conservation");

        vm.prank(MARKET_OPERATOR);
        vm.expectRevert(TrustSignalRegistry420.SignalNotActive.selector);
        suite.signals.revokeSignal(signalId, keccak256("again"));
    }

    function testDisabledIssuerCannotIssueButCanRevokeOwnHistory() public {
        Suite memory suite = _deploy();
        bytes32 signalId = keccak256("before-disable");
        vm.prank(MARKET_OPERATOR);
        suite.signals.submitSignal(_input(signalId, FULFILLED_COUNT, keccak256("before-disable-evidence"), 1));

        suite.issuers.setIssuer(MARKET_ISSUER, MARKET_OPERATOR, keccak256("market-meta"), false);
        vm.prank(MARKET_OPERATOR);
        vm.expectRevert(TrustSignalRegistry420.UnauthorizedIssuer.selector);
        suite.signals.submitSignal(_input(keccak256("after-disable"), FULFILLED_COUNT, keccak256("after-disable-evidence"), 1));

        vm.prank(MARKET_OPERATOR);
        suite.signals.revokeSignal(signalId, keccak256("issuer-correction"));
        TrustSignalRegistry420.Signal memory signal = suite.signals.getSignal(signalId);
        require(signal.state == TrustSignalRegistry420.SignalState.REVOKED, "revoke while inactive");
    }

    function testOperatorRotationInvalidatesOldOperatorForMutations() public {
        Suite memory suite = _deploy();
        bytes32 signalId = keccak256("rotated");
        vm.prank(MARKET_OPERATOR);
        suite.signals.submitSignal(_input(signalId, FULFILLED_COUNT, keccak256("rotation-evidence"), 1));
        suite.issuers.setIssuer(MARKET_ISSUER, ROTATED_OPERATOR, keccak256("market-meta"), true);

        vm.prank(MARKET_OPERATOR);
        vm.expectRevert(TrustSignalRegistry420.UnauthorizedIssuer.selector);
        suite.signals.revokeSignal(signalId, keccak256("old-operator"));

        vm.prank(ROTATED_OPERATOR);
        suite.signals.revokeSignal(signalId, keccak256("new-operator"));
    }

    function testMetricSemanticIdentityCannotChange() public {
        Suite memory suite = _deploy();
        vm.expectRevert(TrustPolicyRegistry420.MetricSemanticChange.selector);
        suite.policy.setMetric(
            FULFILLED_COUNT,
            TrustIds420.DOMAIN_ORACLE,
            TrustIds420.UNIT_COUNT,
            keccak256("wrong-domain"),
            true
        );
    }

    function testInactiveMetricBlocksNewSignalsWithoutErasingHistory() public {
        Suite memory suite = _deploy();
        bytes32 signalId = keccak256("historical");
        vm.prank(MARKET_OPERATOR);
        suite.signals.submitSignal(_input(signalId, FULFILLED_COUNT, keccak256("historical-evidence"), 4));

        suite.policy.setMetric(
            FULFILLED_COUNT,
            TrustIds420.DOMAIN_MARKET,
            TrustIds420.UNIT_COUNT,
            keccak256("fulfilled-v2-disabled"),
            false
        );
        vm.prank(MARKET_OPERATOR);
        vm.expectRevert(TrustSignalRegistry420.InactiveMetric.selector);
        suite.signals.submitSignal(_input(keccak256("blocked"), FULFILLED_COUNT, keccak256("blocked-evidence"), 1));

        TrustSignalRegistry420.Signal memory historical = suite.signals.getSignal(signalId);
        require(historical.value == 4 && historical.metricRevision == 1, "history changed");
    }
}
