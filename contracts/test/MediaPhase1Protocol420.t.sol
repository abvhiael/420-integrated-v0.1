// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/media/MediaIds420.sol";
import "../src/media/MediaCapabilityRegistry420.sol";
import "../src/media/MediaOperatorRegistry420.sol";
import "../src/media/MediaSLA420.sol";
import "../src/media/MediaStreamRegistry420.sol";
import "../src/media/MediaSettlement420.sol";
import "../src/media/MediaJobMarket420.sol";

interface VmMedia420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract MediaPhase1Protocol420Test {
    VmMedia420 constant vm = VmMedia420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant REQUESTER = address(0xA11CE);
    address constant OPERATOR = address(0xB0B);
    address constant BENEFICIARY = address(0xBEEF);
    address constant REPORTER = address(0xCAFE);
    address constant VAULT = address(0xA017);
    address constant PAYOUT = address(0x5E771E);
    address constant ATTACKER = address(0xBAD);

    bytes32 constant OPERATOR_ID = keccak256("media-operator-1");
    bytes32 constant SLA_ID = keccak256("media-sla-low-latency-v1");
    bytes32 constant STREAM_ID = keccak256("media-stream-1");
    bytes32 constant JOB_ID = keccak256("media-job-1");
    bytes32 constant STAKE_REF = keccak256("stake-ref");

    MediaCapabilityRegistry420 capabilities;
    MediaOperatorRegistry420 operators;
    MediaSLA420 sla;
    MediaStreamRegistry420 streams;
    MediaSettlement420 settlement;
    MediaJobMarket420 jobs;

    function setUp() public {
        capabilities = new MediaCapabilityRegistry420(address(this));
        operators = new MediaOperatorRegistry420(address(this));
        sla = new MediaSLA420(address(this));
        streams = new MediaStreamRegistry420(address(this));
        settlement = new MediaSettlement420(address(this));
        jobs = new MediaJobMarket420(address(this));

        capabilities.registerCapability(MediaIds420.CAP_TRANSCODE_H264, keccak256("h264-capability"));
        operators.bindCapabilityRegistry(address(capabilities));
        sla.registerPolicy(SLA_ID, 2_000, 10_000, 9_900, keccak256("low-latency-policy"));
        sla.setReporter(REPORTER, true);

        jobs.bindDependencies(address(operators), address(sla), address(settlement));
        settlement.bindJobMarket(address(jobs));
        settlement.bindVaultAdapter(VAULT);
        settlement.bindPayoutAdapter(PAYOUT);

        vm.prank(OPERATOR);
        operators.registerOperator(OPERATOR_ID, OPERATOR, BENEFICIARY, keccak256("operator-metadata"), bytes32(0), STAKE_REF);
        vm.prank(OPERATOR);
        operators.setCapability(OPERATOR_ID, MediaIds420.CAP_TRANSCODE_H264, true);
        vm.prank(OPERATOR);
        operators.activate(OPERATOR_ID);
    }

    function testHappyPathSlaPassSettlesToBoundBeneficiary() public {
        _createAndAccept(JOB_ID, SLA_ID);
        _fund(JOB_ID, 42 ether);

        vm.prank(OPERATOR);
        jobs.markRunning(JOB_ID);
        vm.prank(OPERATOR);
        jobs.commitResult(JOB_ID, keccak256("output-manifest"));

        vm.prank(REPORTER);
        sla.report(JOB_ID, MediaIds420.SLA_PASS, keccak256("sla-evidence"));
        jobs.finalize(JOB_ID, keccak256("resolution"));

        vm.prank(PAYOUT);
        jobsStatusBeforeReleaseMustBeVerified();
        vm.prank(PAYOUT);
        settlement.release(JOB_ID, BENEFICIARY);

        (,,,,,,,,,,,, MediaJobMarket420.Status status) = jobs.jobs(JOB_ID);
        require(status == MediaJobMarket420.Status.SETTLED, "job not settled");
        (,,,,,,, MediaSettlement420.SettlementState settlementState) = settlement.settlements(JOB_ID);
        require(settlementState == MediaSettlement420.SettlementState.CLOSED, "settlement not closed");
    }

    function jobsStatusBeforeReleaseMustBeVerified() public view {
        (,,,,,,,,,,,, MediaJobMarket420.Status status) = jobs.jobs(JOB_ID);
        require(status == MediaJobMarket420.Status.VERIFIED, "job not verified");
    }

    function testSlaFailureBecomesRefundableAndRefunded() public {
        bytes32 jobId = keccak256("failed-job");
        _createAndAccept(jobId, SLA_ID);
        _fund(jobId, 21 ether);

        vm.prank(OPERATOR);
        jobs.markRunning(jobId);
        vm.prank(OPERATOR);
        jobs.commitResult(jobId, keccak256("failed-output"));
        vm.prank(REPORTER);
        sla.report(jobId, MediaIds420.SLA_FAIL, keccak256("failure-evidence"));

        jobs.finalize(jobId, keccak256("failure-resolution"));
        (,,,,,,, MediaSettlement420.SettlementState stateBefore) = settlement.settlements(jobId);
        require(stateBefore == MediaSettlement420.SettlementState.REFUNDABLE, "not refundable");

        vm.prank(PAYOUT);
        settlement.refund(jobId);
        (,,,,,,,,,,,, MediaJobMarket420.Status status) = jobs.jobs(jobId);
        require(status == MediaJobMarket420.Status.REFUNDED, "job not refunded");
    }

    function testFundingCannotRedirectOperatorBeneficiary() public {
        _createAndAccept(JOB_ID, SLA_ID);
        vm.prank(VAULT);
        vm.expectRevert(MediaSettlement420.SettlementTermsMismatch.selector);
        settlement.confirmVaultFunding(
            JOB_ID,
            REQUESTER,
            OPERATOR_ID,
            ATTACKER,
            keccak256("vault-ref"),
            keccak256("funding-ref"),
            42 ether
        );
    }

    function testUnacceptedJobCannotBeFunded() public {
        vm.prank(REQUESTER);
        jobs.createJob(
            JOB_ID,
            STREAM_ID,
            MediaIds420.KIND_TRANSCODE,
            MediaIds420.CAP_TRANSCODE_H264,
            SLA_ID,
            keccak256("input"),
            42 ether,
            uint64(block.timestamp + 1 days)
        );

        vm.prank(VAULT);
        vm.expectRevert(MediaSettlement420.SettlementTermsMismatch.selector);
        settlement.confirmVaultFunding(
            JOB_ID,
            REQUESTER,
            OPERATOR_ID,
            BENEFICIARY,
            keccak256("vault-ref"),
            keccak256("funding-ref"),
            42 ether
        );
    }

    function testCapabilityDeprecationFailClosesNewAcceptance() public {
        capabilities.setActive(MediaIds420.CAP_TRANSCODE_H264, false);
        require(!operators.isOperationalFor(OPERATOR_ID, MediaIds420.CAP_TRANSCODE_H264), "operator should fail closed");

        vm.prank(REQUESTER);
        jobs.createJob(
            JOB_ID,
            STREAM_ID,
            MediaIds420.KIND_TRANSCODE,
            MediaIds420.CAP_TRANSCODE_H264,
            SLA_ID,
            keccak256("input"),
            42 ether,
            uint64(block.timestamp + 1 days)
        );
        vm.prank(OPERATOR);
        vm.expectRevert(MediaJobMarket420.InvalidOperator.selector);
        jobs.acceptJob(JOB_ID, OPERATOR_ID);
    }

    function testOnlyControllerCanMutateCanonicalStream() public {
        vm.prank(REQUESTER);
        streams.registerStream(STREAM_ID, REQUESTER, REQUESTER, keccak256("stream-metadata"));

        vm.prank(ATTACKER);
        vm.expectRevert(MediaStreamRegistry420.NotController.selector);
        streams.updateMetadata(STREAM_ID, keccak256("hijack"));
    }

    function testOnlyAuthorizedReporterCanSubmitSlaEvidence() public {
        vm.prank(ATTACKER);
        vm.expectRevert(MediaSLA420.InvalidReporter.selector);
        sla.report(JOB_ID, MediaIds420.SLA_PASS, keccak256("fake-evidence"));
    }

    function testExpiredFundedJobBecomesRefundable() public {
        bytes32 jobId = keccak256("expired-job");
        _createAndAccept(jobId, SLA_ID);
        _fund(jobId, 10 ether);
        vm.warp(block.timestamp + 2 days);
        jobs.expire(jobId);
        (,,,,,,, MediaSettlement420.SettlementState settlementState) = settlement.settlements(jobId);
        require(settlementState == MediaSettlement420.SettlementState.REFUNDABLE, "expiry did not refund");
    }

    function _createAndAccept(bytes32 jobId, bytes32 slaId) private {
        vm.prank(REQUESTER);
        jobs.createJob(
            jobId,
            STREAM_ID,
            MediaIds420.KIND_TRANSCODE,
            MediaIds420.CAP_TRANSCODE_H264,
            slaId,
            keccak256(abi.encode(jobId, "input")),
            100 ether,
            uint64(block.timestamp + 1 days)
        );
        vm.prank(OPERATOR);
        jobs.acceptJob(jobId, OPERATOR_ID);
    }

    function _fund(bytes32 jobId, uint256 amount) private {
        vm.prank(VAULT);
        settlement.confirmVaultFunding(
            jobId,
            REQUESTER,
            OPERATOR_ID,
            BENEFICIARY,
            keccak256(abi.encode(jobId, "vault")),
            keccak256(abi.encode(jobId, "funding")),
            amount
        );
    }
}
