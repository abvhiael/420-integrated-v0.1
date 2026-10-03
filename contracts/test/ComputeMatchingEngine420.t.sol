// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeMatch420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface VmMatching420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address actor) external;
}

contract ComputeMatchingEngine420Test {
    VmMatching420 private constant vm =
        VmMatching420(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant BENEFICIARY = address(0xFEE1);
    address private constant SCHEDULER_A = address(0x5A);
    address private constant SCHEDULER_B = address(0x5B);
    address private constant OUTSIDER = address(0xBAD);

    bytes32 private constant MANIFEST = keccak256("cmp-2.3/manifest");
    bytes32 private constant WORKLOAD = keccak256("cmp-2.3/workload");
    bytes32 private constant INPUT = keccak256("cmp-2.3/input");
    bytes32 private constant OUTPUT = keccak256("cmp-2.3/output");
    bytes32 private constant HARDWARE = keccak256("cmp-2.3/hardware");
    bytes32 private constant RUNTIME = keccak256("cmp-2.3/runtime");
    bytes32 private constant CAPABILITY = keccak256("cmp-2.3/capability");
    bytes32 private constant JURISDICTION = keccak256("CA-SK");
    bytes32 private constant PRICING = keccak256("cmp/fixed/native-420/v1");

    address private owner;
    address private payer;

    CapabilityRegistry420 private caps;
    ComputeAuthorization420 private auth;
    ComputeJobSignedRequestAuthority420 private signedRequests;
    ComputeRequestRegistry420 private requests;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeOfferRegistry420 private offers;
    ComputeMatch420 private matches;

    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;
    uint256 private requestNonce;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        payer = vm.addr(PAYER_KEY);

        caps = new CapabilityRegistry420();
        auth = new ComputeAuthorization420(address(caps));
        caps.registerProtocolComponent(auth.COMPONENT_COMPUTE(), address(this));

        signedRequests = new ComputeJobSignedRequestAuthority420();
        requests = new ComputeRequestRegistry420(address(signedRequests), address(auth));

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        offers = new ComputeOfferRegistry420(address(resources), address(auth));
        matches = new ComputeMatch420(address(requests), address(offers), address(auth));

        vm.prank(OPERATOR);
        providerId = providers.register(MANIFEST, keccak256("security"), BENEFICIARY);
        vm.prank(GOV);
        providers.activate(providerId);

        vm.prank(OPERATOR);
        nodeId = nodes.register(
            providerId,
            MANIFEST,
            keccak256("cmp-2.3/endpoint"),
            uint64(block.timestamp + 7 days)
        );
        vm.prank(OPERATOR);
        nodes.activate(nodeId);

        vm.prank(OPERATOR);
        resourceId = resources.register(
            nodeId,
            resources.GPU_INFERENCE(),
            HARDWARE,
            RUNTIME,
            CAPABILITY,
            32
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _request(uint256 maximumPrice) private returns (bytes32 requestId) {
        requestNonce++;
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({
                owner: owner,
                payer: payer,
                manifestHash: MANIFEST,
                workloadType: WORKLOAD,
                inputCommitment: INPUT,
                outputSchemaCommitment: OUTPUT,
                deadline: uint64(block.timestamp + 2 days),
                authorizationExpiry: uint64(block.timestamp + 3 days),
                maxSpend: maximumPrice,
                nonce: requestNonce
            });
        bytes32 digest = signedRequests.authorizationDigest(a);
        bytes memory ownerSig = _signature(OWNER_KEY, digest);
        bytes memory payerSig = _signature(PAYER_KEY, digest);
        vm.prank(owner);
        bytes32 signedId = signedRequests.registerSignedRequest(a, ownerSig, payerSig);

        ComputeRequestRegistry420.Terms memory t = _terms(maximumPrice);
        vm.prank(owner);
        requestId = requests.createRequest(signedId, t);
    }

    function _terms(uint256 maximumPrice)
        private view returns (ComputeRequestRegistry420.Terms memory t)
    {
        ComputeRequestRegistry420.PolicyRef memory generic =
            ComputeRequestRegistry420.PolicyRef(
                keccak256("cmp-2.3/generic-policy"),
                1,
                keccak256("cmp-2.3/generic-policy/commitment")
            );
        ComputeRequestRegistry420.PolicyRef memory pricing =
            ComputeRequestRegistry420.PolicyRef(
                PRICING,
                1,
                keccak256("cmp-2.3/pricing/commitment")
            );
        t = ComputeRequestRegistry420.Terms({
            resourceClass: resources.GPU_INFERENCE(),
            runtimeHash: RUNTIME,
            capabilityHash: CAPABILITY,
            verification: generic,
            privacy: generic,
            jurisdictionHash: JURISDICTION,
            dataAccessHash: keccak256("cmp-2.3/data-access"),
            partitionPlanHash: keccak256("cmp-2.3/partition-plan"),
            partitionCount: 2,
            replicationFactor: 2,
            capacityUnits: 4,
            pricing: pricing,
            sla: generic,
            deadline: uint64(block.timestamp + 2 days),
            expiresAt: uint64(block.timestamp + 1 days),
            maximumPrice: maximumPrice,
            fundingReference: bytes32(0)
        });
    }

    function _offer(uint256 price) private returns (bytes32 offerId) {
        vm.prank(OPERATOR);
        offerId = offers.publishWorkerOffer(
            resourceId,
            JURISDICTION,
            uint64(block.timestamp),
            uint64(block.timestamp + 2 days),
            PRICING,
            1,
            price
        );
    }

    function _propose(address scheduler, bytes32 requestId, bytes32 offerId)
        private returns (bytes32 proposalId)
    {
        vm.prank(scheduler);
        proposalId = matches.propose(requestId, offerId);
    }

    function _try(address actor, bytes memory callData) private returns (bool ok) {
        vm.prank(actor);
        (ok,) = address(matches).call(callData);
    }

    function testReplaceableSchedulersCanProposeButDoNotOwnAuthority() public {
        bytes32 requestId = _request(5 ether);
        bytes32 offerId = _offer(3 ether);

        bytes32 first = _propose(SCHEDULER_A, requestId, offerId);
        bytes32 second = _propose(SCHEDULER_B, requestId, offerId);

        require(first != second, "replaceable proposals collided");
        require(matches.proposal(first).scheduler == SCHEDULER_A, "scheduler A not recorded");
        require(matches.proposal(second).scheduler == SCHEDULER_B, "scheduler B not recorded");
        require(matches.proposalEligible(first) && matches.proposalEligible(second), "eligible proposal rejected");

        require(
            !_try(
                SCHEDULER_A,
                abi.encodeCall(matches.accept, (first, uint64(1), uint64(1)))
            ),
            "scheduler gained acceptance authority"
        );
        require(matches.acceptedForRequest(requestId) == bytes32(0), "failed scheduler acceptance mutated state");
    }

    function testOwnerAcceptsOneProposalAndImmutableSnapshotWins() public {
        bytes32 requestId = _request(5 ether);
        bytes32 offerId = _offer(3 ether);
        bytes32 first = _propose(SCHEDULER_A, requestId, offerId);
        bytes32 second = _propose(SCHEDULER_B, requestId, offerId);

        vm.prank(owner);
        bytes32 matchId = matches.accept(first, 1, 1);

        ComputeMatch420.AcceptedMatch memory m = matches.acceptedMatch(matchId);
        require(m.requestId == requestId && m.offerId == offerId && m.proposalId == first, "identity snapshot");
        require(m.owner == owner && m.payer == payer && m.providerId == providerId, "party snapshot");
        require(m.nodeId == nodeId && m.resourceId == resourceId && m.operator == OPERATOR, "resource snapshot");
        require(m.settlementAccount == BENEFICIARY && m.fixedPrice == 3 ether, "economic snapshot");
        require(m.runtimeProfileHash == RUNTIME && m.capabilityHash == CAPABILITY
            && m.jurisdictionHash == JURISDICTION, "compatibility snapshot");
        require(m.requestRevision == 1 && m.offerRevision == 1, "revision snapshot");
        require(matches.commitment(matchId) != bytes32(0), "missing immutable match commitment");
        require(!matches.proposalEligible(second), "second proposal remained eligible after acceptance");

        require(
            !_try(owner, abi.encodeCall(matches.accept, (second, uint64(1), uint64(1)))),
            "request accepted twice"
        );
        require(matches.acceptedForRequest(requestId) == matchId, "accepted match overwritten");
    }

    function testRequestRevisionMakesSchedulerProposalStale() public {
        bytes32 requestId = _request(5 ether);
        bytes32 offerId = _offer(3 ether);
        bytes32 proposalId = _propose(SCHEDULER_A, requestId, offerId);

        ComputeRequestRegistry420.Terms memory t = _terms(4 ether);
        vm.prank(owner);
        requests.updateRequest(requestId, 1, t);

        require(!matches.proposalEligible(proposalId), "stale request proposal remained eligible");
        require(
            !_try(owner, abi.encodeCall(matches.accept, (proposalId, uint64(1), uint64(1)))),
            "stale request proposal accepted"
        );
        require(matches.acceptedForRequest(requestId) == bytes32(0), "stale request acceptance mutated state");
    }

    function testOfferRevisionMakesSchedulerProposalStale() public {
        bytes32 requestId = _request(5 ether);
        bytes32 offerId = _offer(3 ether);
        bytes32 proposalId = _propose(SCHEDULER_A, requestId, offerId);

        vm.prank(OPERATOR);
        offers.updateOffer(
            offerId,
            JURISDICTION,
            uint64(block.timestamp),
            uint64(block.timestamp + 2 days),
            PRICING,
            1,
            4 ether
        );

        require(!matches.proposalEligible(proposalId), "stale offer proposal remained eligible");
        require(
            !_try(owner, abi.encodeCall(matches.accept, (proposalId, uint64(1), uint64(1)))),
            "stale offer proposal accepted"
        );
    }

    function testContractRejectsIncompatiblePriceWithoutAllocatingProposal() public {
        bytes32 requestId = _request(2 ether);
        bytes32 offerId = _offer(3 ether);

        require(
            !_try(SCHEDULER_A, abi.encodeCall(matches.propose, (requestId, offerId))),
            "over-budget scheduler proposal admitted"
        );
        require(matches.nextProposalSerial() == 0, "failed proposal consumed serial");
    }

    function testContractRejectsResourceDriftAndPreservesFailedAcceptanceAtomicity() public {
        bytes32 requestId = _request(5 ether);
        bytes32 offerId = _offer(3 ether);
        bytes32 proposalId = _propose(SCHEDULER_A, requestId, offerId);

        vm.prank(OPERATOR);
        resources.update(
            resourceId,
            HARDWARE,
            keccak256("cmp-2.3/runtime-v2"),
            CAPABILITY,
            32
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);

        require(!offers.isEffective(offerId), "drifted offer remained effective");
        require(!matches.proposalEligible(proposalId), "drifted resource proposal remained eligible");
        require(
            !_try(owner, abi.encodeCall(matches.accept, (proposalId, uint64(1), uint64(1)))),
            "drifted proposal accepted"
        );
        require(matches.acceptedForRequest(requestId) == bytes32(0), "failed acceptance mutated state");
    }
}
