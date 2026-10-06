// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/media/MediaIds420.sol";
import "../src/media/MediaCapabilityRegistry420.sol";
import "../src/media/MediaOperatorRegistry420.sol";
import "../src/media/MediaSLA420.sol";
import "../src/media/MediaSettlement420.sol";
import "../src/media/MediaJobMarket420.sol";
import "../src/media/MediaPayComputeAdapter420.sol";
import "../src/compute/ICompute420.sol";

interface VmMediaPayCompute420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract MockMediaPay420 {
    struct Payment {
        bytes32 invoiceId;
        address payer;
        address merchant;
        address inputAsset;
        uint256 inputAmount;
        address settlementAsset;
        uint256 settlementAmount;
        bytes32 quoteId;
        uint256 payerNonce;
        bytes32 receiptHash;
        uint256 tipAmount;
        uint256 refundedAmount;
        uint8 status;
    }
    mapping(bytes32 => Payment) public payments;

    function set(bytes32 id, Payment memory p) external { payments[id] = p; }
}

contract MockMediaComputeJob420 {
    mapping(bytes32 => IMediaComputeJob420.Job) private _jobs;
    function set(bytes32 id, IMediaComputeJob420.Job memory j) external { _jobs[id] = j; }
    function job(bytes32 id) external view returns (IMediaComputeJob420.Job memory) { return _jobs[id]; }
}

contract MockMediaComputeFunding420 {
    mapping(bytes32 => IMediaComputeFunding420.Credit) private _credits;
    mapping(bytes32 => bool) public fundedOk;
    function set(bytes32 id, IMediaComputeFunding420.Credit memory c, bool ok) external {
        _credits[id] = c; fundedOk[id] = ok;
    }
    function credit(bytes32 id) external view returns (IMediaComputeFunding420.Credit memory) { return _credits[id]; }
    function funded(bytes32 id, address, bytes32) external view returns (bool) { return fundedOk[id]; }
}

contract MockMediaComputeMatch420 {
    mapping(bytes32 => IMediaComputeMatch420.Match) private _matches;
    mapping(bytes32 => IMediaComputeMatch420.PriceReservation) private _prices;
    mapping(bytes32 => bytes32) public priceReservationForJob;
    function set(
        bytes32 jobId,
        bytes32 matchId,
        bytes32 priceRef,
        IMediaComputeMatch420.Match memory m,
        IMediaComputeMatch420.PriceReservation memory p
    ) external {
        _matches[matchId] = m; _prices[priceRef] = p; priceReservationForJob[jobId] = priceRef;
    }
    function getMatch(bytes32 id) external view returns (IMediaComputeMatch420.Match memory) { return _matches[id]; }
    function priceReservation(bytes32 id) external view returns (IMediaComputeMatch420.PriceReservation memory) {
        return _prices[id];
    }
}

contract MockMediaComputeProvider420 {
    mapping(bytes32 => IMediaComputeProvider420.Provider) private _providers;
    function set(bytes32 id, IMediaComputeProvider420.Provider memory p) external { _providers[id] = p; }
    function provider(bytes32 id) external view returns (IMediaComputeProvider420.Provider memory) { return _providers[id]; }
}

contract MockMediaComputeEntitlement420 {
    mapping(bytes32 => bytes32) public entitlementForJob;
    mapping(bytes32 => IMediaComputeEntitlement420.Entitlement) private _entitlements;
    mapping(bytes32 => IMediaComputeEntitlement420.PayerRefund) private _refunds;
    mapping(bytes32 => bool) public settledOk;
    mapping(bytes32 => bool) public refundedOk;

    function setEntitlement(
        bytes32 jobId,
        bytes32 ref,
        IMediaComputeEntitlement420.Entitlement memory e,
        bool ok
    ) external {
        entitlementForJob[jobId] = ref; _entitlements[ref] = e; settledOk[jobId] = ok;
    }
    function setRefund(bytes32 jobId, IMediaComputeEntitlement420.PayerRefund memory r, bool ok) external {
        _refunds[jobId] = r; refundedOk[jobId] = ok;
    }
    function entitlement(bytes32 ref) external view returns (IMediaComputeEntitlement420.Entitlement memory) {
        return _entitlements[ref];
    }
    function settled(bytes32 jobId, bytes32, bytes32) external view returns (bool) { return settledOk[jobId]; }
    function refunded(bytes32 jobId, bytes32) external view returns (bool) { return refundedOk[jobId]; }
    function payerRefund(bytes32 jobId) external view returns (IMediaComputeEntitlement420.PayerRefund memory) {
        return _refunds[jobId];
    }
}

contract MockMediaComputeRouter420 is ICompute420 {
    bytes32 public override componentGraphHash;
    address public override jobRegistry;
    address public override fundingAdapter;
    address public override matchRegistry;
    address public override workerEvidence;
    address public override verificationRouter;
    address public override disputeResolver;
    address public override settlementAdapter;
    address public override providerRegistry;
    address public override nodeRegistry;
    address public override resourceRegistry;
    address public override offerRegistry;

    constructor(
        bytes32 graph,
        address jobs_,
        address funding_,
        address matches_,
        address entitlements_,
        address providers_
    ) {
        componentGraphHash = graph;
        jobRegistry = jobs_;
        fundingAdapter = funding_;
        matchRegistry = matches_;
        settlementAdapter = entitlements_;
        providerRegistry = providers_;
        workerEvidence = address(this);
        verificationRouter = address(this);
        disputeResolver = address(this);
        nodeRegistry = address(this);
        resourceRegistry = address(this);
        offerRegistry = address(this);
    }

    function setGraph(bytes32 graph) external { componentGraphHash = graph; }
}

contract MediaPhase1PayCompute420Test {
    VmMediaPayCompute420 constant vm =
        VmMediaPayCompute420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant REQUESTER = address(0xA11CE);
    address constant OPERATOR = address(0xB0B);
    address constant BENEFICIARY = address(0xBEEF);
    address constant ATTACKER = address(0xBAD);

    bytes32 constant OPERATOR_ID = keccak256("media-pay-compute-operator");
    bytes32 constant PROVIDER_ID = keccak256("compute-provider");
    bytes32 constant RESOURCE_ID = keccak256("compute-resource");
    bytes32 constant GRAPH = keccak256("compute-graph-v1");
    bytes32 constant PAYMENT_ID = keccak256("pay-payment");
    bytes32 constant COMPUTE_JOB_ID = keccak256("compute-job");
    bytes32 constant COMPUTE_MATCH_ID = keccak256("compute-match");
    bytes32 constant PRICE_REF = keccak256("price-ref");
    bytes32 constant ENTITLEMENT_REF = keccak256("entitlement");
    bytes32 constant STAKE_REF = keccak256("stake-ref");

    MediaCapabilityRegistry420 capabilities;
    MediaOperatorRegistry420 operators;
    MediaSLA420 sla;
    MediaSettlement420 settlement;
    MediaJobMarket420 jobs;
    MediaPayComputeAdapter420 adapter;

    MockMediaPay420 pay;
    MockMediaComputeJob420 computeJobs;
    MockMediaComputeFunding420 funding;
    MockMediaComputeMatch420 matches;
    MockMediaComputeEntitlement420 entitlements;
    MockMediaComputeProvider420 providers;
    MockMediaComputeRouter420 router;

    function setUp() public {
        capabilities = new MediaCapabilityRegistry420(address(this));
        operators = new MediaOperatorRegistry420(address(this));
        sla = new MediaSLA420(address(this));
        settlement = new MediaSettlement420(address(this));
        jobs = new MediaJobMarket420(address(this));

        capabilities.registerCapability(MediaIds420.CAP_TRANSCODE_H264, keccak256("h264"));
        operators.bindCapabilityRegistry(address(capabilities));
        jobs.bindDependencies(address(operators), address(sla), address(settlement));
        settlement.bindJobMarket(address(jobs));

        vm.prank(OPERATOR);
        operators.registerOperator(
            OPERATOR_ID, OPERATOR, BENEFICIARY, keccak256("metadata"), PROVIDER_ID, STAKE_REF
        );
        vm.prank(OPERATOR);
        operators.setCapability(OPERATOR_ID, MediaIds420.CAP_TRANSCODE_H264, true);
        vm.prank(OPERATOR);
        operators.activate(OPERATOR_ID);

        pay = new MockMediaPay420();
        computeJobs = new MockMediaComputeJob420();
        funding = new MockMediaComputeFunding420();
        matches = new MockMediaComputeMatch420();
        entitlements = new MockMediaComputeEntitlement420();
        providers = new MockMediaComputeProvider420();
        router = new MockMediaComputeRouter420(
            GRAPH, address(computeJobs), address(funding), address(matches), address(entitlements), address(providers)
        );

        adapter = new MediaPayComputeAdapter420(
            address(settlement), address(jobs), address(operators), address(pay), address(router)
        );
        settlement.bindVaultAdapter(address(adapter));
        settlement.bindPayoutAdapter(address(adapter));
    }

    function testPaySettlementBindsExactPayerBeneficiaryAndIsReplaySafe() public {
        bytes32 mediaJob = keccak256("pay-media-job");
        _createAndAccept(mediaJob);
        _setPay(PAYMENT_ID, REQUESTER, BENEFICIARY, 42 ether, 0, 5);

        adapter.bindPayFunding(mediaJob, PAYMENT_ID);
        _completeMediaSuccess(mediaJob);
        adapter.observePaySettlement(mediaJob);

        require(settlement.settledAmounts(mediaJob) == 42 ether, "pay settled amount");
        require(settlement.canonicalSettlementRefs(mediaJob) == PAYMENT_ID, "pay ref");
        (,,,,,,,,,,,, MediaJobMarket420.Status status) = jobs.jobs(mediaJob);
        require(status == MediaJobMarket420.Status.SETTLED, "pay media not settled");

        bytes32 secondJob = keccak256("pay-replay-job");
        _createAndAccept(secondJob);
        vm.expectRevert(MediaPayComputeAdapter420.Replay.selector);
        adapter.bindPayFunding(secondJob, PAYMENT_ID);
    }

    function testPayBeneficiaryMismatchFailsClosed() public {
        bytes32 mediaJob = keccak256("pay-bad-beneficiary");
        _createAndAccept(mediaJob);
        _setPay(PAYMENT_ID, REQUESTER, ATTACKER, 42 ether, 0, 5);
        vm.expectRevert(MediaPayComputeAdapter420.EvidenceMismatch.selector);
        adapter.bindPayFunding(mediaJob, PAYMENT_ID);
    }

    function testPayRefundRequiresCanonicalRefundEvidence() public {
        bytes32 mediaJob = keccak256("pay-refund-job");
        _createAndAccept(mediaJob);
        _setPay(PAYMENT_ID, REQUESTER, BENEFICIARY, 21 ether, 0, 5);
        adapter.bindPayFunding(mediaJob, PAYMENT_ID);

        vm.warp(block.timestamp + 2 days);
        jobs.expire(mediaJob);

        _setPay(PAYMENT_ID, REQUESTER, BENEFICIARY, 21 ether, 21 ether, 6);
        adapter.observePayRefund(mediaJob);
        require(settlement.canonicalRefundRefs(mediaJob) == PAYMENT_ID, "pay refund ref");
        (,,,,,,,,,,,, MediaJobMarket420.Status status) = jobs.jobs(mediaJob);
        require(status == MediaJobMarket420.Status.REFUNDED, "pay media not refunded");
    }

    function testComputeBindingRequiresCanonicalProviderOperatorBeneficiaryAndGraph() public {
        bytes32 mediaJob = keccak256("compute-media-job");
        _createAndAccept(mediaJob);
        _setComputeAccepted(60 ether, 60 ether);

        adapter.bindComputeFunding(mediaJob, COMPUTE_JOB_ID, GRAPH);
        (, bytes32 ref, bytes32 graph, bytes32 providerId, bytes32 resourceId,, address beneficiary, uint256 ceiling,) =
            adapter.binding(mediaJob);
        require(ref == COMPUTE_JOB_ID && graph == GRAPH, "compute binding ref");
        require(providerId == PROVIDER_ID && resourceId == RESOURCE_ID, "compute identity");
        require(beneficiary == BENEFICIARY && ceiling == 60 ether, "compute economics");

        bytes32 other = keccak256("compute-graph-fail");
        _createAndAccept(other);
        vm.expectRevert(MediaPayComputeAdapter420.EvidenceMismatch.selector);
        adapter.bindComputeFunding(other, COMPUTE_JOB_ID, keccak256("wrong-graph"));
    }

    function testComputeSettlementRecordsActualEarnedAmountNotFundingCeiling() public {
        bytes32 mediaJob = keccak256("compute-settle-job");
        _createAndAccept(mediaJob);
        _setComputeAccepted(80 ether, 80 ether);
        adapter.bindComputeFunding(mediaJob, COMPUTE_JOB_ID, GRAPH);
        _completeMediaSuccess(mediaJob);

        IMediaComputeJob420.Job memory j = computeJobs.job(COMPUTE_JOB_ID);
        j.status = 8;
        j.verificationRef = keccak256("verification");
        j.settlementRef = keccak256("compute-payout");
        computeJobs.set(COMPUTE_JOB_ID, j);

        IMediaComputeEntitlement420.Entitlement memory e;
        e.jobId = COMPUTE_JOB_ID;
        e.requestId = j.requestId;
        e.matchId = COMPUTE_MATCH_ID;
        e.verificationRef = j.verificationRef;
        e.payer = REQUESTER;
        e.providerId = PROVIDER_ID;
        e.resourceId = RESOURCE_ID;
        e.beneficiary = BENEFICIARY;
        e.acceptedAmount = 80 ether;
        e.earnedAmount = 55 ether;
        e.fundedAmount = 80 ether;
        e.payerMaximum = 100 ether;
        e.exists = true;
        entitlements.setEntitlement(COMPUTE_JOB_ID, ENTITLEMENT_REF, e, true);

        adapter.observeComputeSettlement(mediaJob);
        require(settlement.settledAmounts(mediaJob) == 55 ether, "earned amount overstated");
        require(settlement.canonicalSettlementRefs(mediaJob) == j.settlementRef, "compute payout ref");
    }

    function testComputeTerminalRefundRequiresPaidCanonicalPayerRefund() public {
        bytes32 mediaJob = keccak256("compute-refund-job");
        _createAndAccept(mediaJob);
        _setComputeAccepted(40 ether, 50 ether);
        adapter.bindComputeFunding(mediaJob, COMPUTE_JOB_ID, GRAPH);

        vm.warp(block.timestamp + 2 days);
        jobs.expire(mediaJob);

        IMediaComputeJob420.Job memory j = computeJobs.job(COMPUTE_JOB_ID);
        j.status = 13;
        j.settlementRef = keccak256("compute-refund");
        computeJobs.set(COMPUTE_JOB_ID, j);

        IMediaComputeEntitlement420.PayerRefund memory pr;
        pr.jobId = COMPUTE_JOB_ID;
        pr.payoutRef = j.settlementRef;
        pr.payer = REQUESTER;
        pr.amount = 50 ether;
        pr.claimable = true;
        pr.paid = true;
        entitlements.setRefund(COMPUTE_JOB_ID, pr, true);

        adapter.observeComputeRefund(mediaJob);
        require(settlement.canonicalRefundRefs(mediaJob) == j.settlementRef, "compute refund ref");
        (,,,,,,,,,,,, MediaJobMarket420.Status status) = jobs.jobs(mediaJob);
        require(status == MediaJobMarket420.Status.REFUNDED, "compute media not refunded");
    }

    function testComputeProviderMismatchFailsClosed() public {
        bytes32 mediaJob = keccak256("compute-provider-mismatch");
        _createAndAccept(mediaJob);
        _setComputeAccepted(30 ether, 30 ether);

        IMediaComputeProvider420.Provider memory p = providers.provider(PROVIDER_ID);
        p.settlementAccount = ATTACKER;
        providers.set(PROVIDER_ID, p);

        vm.expectRevert(MediaPayComputeAdapter420.EvidenceMismatch.selector);
        adapter.bindComputeFunding(mediaJob, COMPUTE_JOB_ID, GRAPH);
    }

    function _createAndAccept(bytes32 mediaJob) private {
        vm.prank(REQUESTER);
        jobs.createJob(
            mediaJob,
            bytes32(0),
            MediaIds420.KIND_TRANSCODE,
            MediaIds420.CAP_TRANSCODE_H264,
            bytes32(0),
            keccak256(abi.encode(mediaJob, "input")),
            100 ether,
            uint64(block.timestamp + 1 days)
        );
        vm.prank(OPERATOR);
        jobs.acceptJob(mediaJob, OPERATOR_ID);
    }

    function _completeMediaSuccess(bytes32 mediaJob) private {
        vm.prank(OPERATOR);
        jobs.markRunning(mediaJob);
        vm.prank(OPERATOR);
        jobs.commitResult(mediaJob, keccak256(abi.encode(mediaJob, "output")));
        vm.prank(REQUESTER);
        jobs.finalize(mediaJob, keccak256(abi.encode(mediaJob, "resolution")));
    }

    function _setPay(
        bytes32 id,
        address payer,
        address merchant,
        uint256 amount,
        uint256 refunded,
        uint8 status
    ) private {
        MockMediaPay420.Payment memory p;
        p.invoiceId = keccak256("invoice");
        p.payer = payer;
        p.merchant = merchant;
        p.inputAsset = address(0);
        p.inputAmount = amount;
        p.settlementAsset = address(0);
        p.settlementAmount = amount;
        p.receiptHash = keccak256("receipt");
        p.refundedAmount = refunded;
        p.status = status;
        pay.set(id, p);
    }

    function _setComputeAccepted(uint256 accepted, uint256 deposited) private {
        IMediaComputeJob420.Job memory j;
        j.owner = REQUESTER;
        j.requestId = keccak256("compute-request");
        j.requestCommitment = j.requestId;
        j.manifestHash = keccak256("manifest");
        j.workloadType = keccak256("transcode");
        j.inputCommitment = keccak256("input");
        j.outputSchemaCommitment = keccak256("output-schema");
        j.matchId = COMPUTE_MATCH_ID;
        j.fundingRef = COMPUTE_JOB_ID;
        j.acceptanceRef = keccak256("acceptance");
        j.deadline = uint64(block.timestamp + 1 days);
        j.revision = 4;
        j.status = 4;
        computeJobs.set(COMPUTE_JOB_ID, j);

        IMediaComputeFunding420.Credit memory c;
        c.requestId = j.requestId;
        c.owner = REQUESTER;
        c.payer = REQUESTER;
        c.deposited = deposited;
        c.maximumSpend = 100 ether;
        c.deadline = j.deadline;
        c.obligationId = keccak256("vault-obligation");
        c.exists = true;
        funding.set(COMPUTE_JOB_ID, c, true);

        IMediaComputeMatch420.Match memory m;
        m.jobId = COMPUTE_JOB_ID;
        m.requestId = j.requestId;
        m.manifestHash = j.manifestHash;
        m.offerId = keccak256("offer");
        m.resourceId = RESOURCE_ID;
        m.providerId = PROVIDER_ID;
        m.nodeId = keccak256("node");
        m.resourceRevision = 1;
        m.owner = REQUESTER;
        m.operator = OPERATOR;
        m.priceReservationRef = PRICE_REF;
        m.acceptanceRef = j.acceptanceRef;
        m.exists = true;

        IMediaComputeMatch420.PriceReservation memory p;
        p.jobId = COMPUTE_JOB_ID;
        p.matchId = COMPUTE_MATCH_ID;
        p.offerId = m.offerId;
        p.requestId = j.requestId;
        p.owner = REQUESTER;
        p.payer = REQUESTER;
        p.providerId = PROVIDER_ID;
        p.resourceId = RESOURCE_ID;
        p.resourceRevision = 1;
        p.beneficiary = BENEFICIARY;
        p.acceptedAmount = accepted;
        p.fundedAmount = deposited;
        p.payerMaximum = 100 ether;
        p.exists = true;
        matches.set(COMPUTE_JOB_ID, COMPUTE_MATCH_ID, PRICE_REF, m, p);

        IMediaComputeProvider420.Provider memory provider;
        provider.registrant = OPERATOR;
        provider.operator = OPERATOR;
        provider.settlementAccount = BENEFICIARY;
        provider.revision = 1;
        provider.status = 2;
        providers.set(PROVIDER_ID, provider);
    }
}
