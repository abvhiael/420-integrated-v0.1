// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeAcceptedPriceMatch420.sol";
import "../src/compute/CMPVaultAuthorization420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultIds420.sol";

interface VmAcceptedPrice420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address account, uint256 amount) external;
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

contract AcceptedPriceDeny420 is IComputeJobWorkerEvidence420,
    IComputeJobVerificationEvidence420, IComputeJobSettlementEvidence420
{
    function authorizedAssignment(bytes32, bytes32, address, bytes32) external pure returns (bool) { return false; }
    function committedResult(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function verified(bytes32, bytes32, address, bytes32, bool) external pure returns (bool) { return false; }
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract ComputeAcceptedPriceMatch420Test {
    VmAcceptedPrice420 private constant vm =
        VmAcceptedPrice420(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant PAYER_KEY = 0xBEEF;
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant BENEFICIARY = address(0xFEE1);
    address private constant NEW_BENEFICIARY = address(0xFEE2);
    address private constant GOV = address(0x420);
    bytes32 private constant VAULT_ID = keccak256("cmp/accepted-price/vault/v1");
    bytes32 private constant MANIFEST = keccak256("cmp-priced-manifest");
    bytes32 private constant WORKLOAD = keccak256("gpu");
    bytes32 private constant INPUT = keccak256("input");
    bytes32 private constant OUTPUT = keccak256("output");
    bytes32 private constant PRICING_POLICY = keccak256("cmp/fixed/native-420/v1");

    CapabilityRegistry420 private caps;
    CMPVaultAuthorization420 private vaultPolicy;
    VaultRegistry420 private vaultRegistry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;

    ComputeJobSignedRequestAuthority420 private requests;
    ComputeEscrowFunding420 private funding;
    ComputeAuthorization420 private computeAuth;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeOfferRegistry420 private offers;
    ComputeAcceptedPriceMatch420 private matches;
    ComputeJobRegistry420 private jobs;

    address private owner;
    address private payer;
    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;
    uint256 private grantNonce;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        payer = vm.addr(PAYER_KEY);
        vm.deal(payer, 50 ether);
        vm.deal(address(this), 50 ether);

        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));

        computeAuth = new ComputeAuthorization420(address(caps));
        caps.registerProtocolComponent(computeAuth.COMPONENT_COMPUTE(), address(this));

        vaultPolicy = new CMPVaultAuthorization420(address(caps), VAULT_ID);
        VaultPolicyRegistry420 policies = new VaultPolicyRegistry420(address(this));
        vaultRegistry = new VaultRegistry420(address(vaultPolicy), address(policies));
        accounting = new VaultAccounting420(address(vaultRegistry));
        policies.setPolicy(keccak256("auth"), VaultIds420.POLICY_AUTHORIZATION,
            keccak256("cmp-auth"), bytes32(0), true);
        policies.setPolicy(keccak256("asset"), VaultIds420.POLICY_ASSET,
            keccak256("native"), bytes32(0), true);
        policies.setPolicy(keccak256("release"), VaultIds420.POLICY_RELEASE,
            keccak256("payer-exit"), bytes32(0), true);
        policies.setPolicy(keccak256("account"), VaultIds420.POLICY_ACCOUNTING,
            keccak256("account"), bytes32(0), true);
        vault = new AssetVault420(VAULT_ID, address(vaultRegistry), address(vaultPolicy),
            address(accounting), address(this));
        vaultRegistry.registerVault(VAULT_ID, address(vault), VaultIds420.VAULT_ESCROW,
            keccak256("auth"), keccak256("asset"), keccak256("release"), keccak256("account"),
            bytes32(0), bytes32(0), bytes32(0));

        requests = new ComputeJobSignedRequestAuthority420();
        funding = new ComputeEscrowFunding420(address(requests), address(vault));

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        offers = new ComputeOfferRegistry420(address(resources));
        matches = new ComputeAcceptedPriceMatch420(address(resources), address(computeAuth),
            address(funding), address(offers));
        AcceptedPriceDeny420 denied = new AcceptedPriceDeny420();
        jobs = new ComputeJobRegistry420(address(requests), address(funding), address(matches),
            address(denied), address(denied), address(denied));

        funding.bindJobs(address(jobs));
        matches.bindJobs(address(jobs));

        vaultPolicy.bindVault(address(vault));
        vaultPolicy.bindFunding(address(funding));
        _grantVault(address(funding), VaultIds420.ACTION_CREATE_OBLIGATION);
        _grantVault(address(funding), VaultIds420.ACTION_RELEASE_OBLIGATION);
        vaultPolicy.seal();

        vm.prank(OPERATOR);
        providerId = providers.register(MANIFEST, keccak256("security"), BENEFICIARY);
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        nodeId = nodes.register(providerId, MANIFEST, keccak256("endpoint"),
            uint64(block.timestamp + 3 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);
        bytes32 cls = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(nodeId, cls, MANIFEST, keccak256("runtime"),
            keccak256("capability"), 16);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
    }

    function _grantVault(address principal, bytes32 action) private {
        caps.createGrant(keccak256(abi.encode("vault-grant", principal, action, grantNonce++)),
            principal, VaultIds420.COMPONENT_VAULT, action, vaultPolicy.scopeForVault(VAULT_ID),
            0, 0, 0, 0, 0);
    }

    function _grantAccept(bytes32 jobId, uint256 perCallLimit) private {
        caps.createGrant(keccak256(abi.encode("accept-grant", jobId, grantNonce++)),
            OPERATOR, computeAuth.COMPONENT_COMPUTE(), computeAuth.ACTION_ACCEPT_MATCH(),
            computeAuth.scopeJob(jobId), perCallLimit, 0, 0, 0, 0);
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _job(uint256 nonce, uint256 maximumSpend) private returns (bytes32 id) {
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({
                owner: owner, payer: payer, manifestHash: MANIFEST, workloadType: WORKLOAD,
                inputCommitment: INPUT, outputSchemaCommitment: OUTPUT,
                deadline: uint64(block.timestamp + 1 days),
                authorizationExpiry: uint64(block.timestamp + 2 days),
                maxSpend: maximumSpend, nonce: nonce
            });
        bytes32 digest = requests.authorizationDigest(a);
        bytes memory ownerSig = _signature(OWNER_KEY, digest);
        bytes memory payerSig = _signature(PAYER_KEY, digest);
        vm.prank(owner);
        bytes32 requestId = requests.registerSignedRequest(a, ownerSig, payerSig);
        vm.prank(owner);
        id = jobs.createJob(requestId, requestId, MANIFEST, WORKLOAD, INPUT, OUTPUT, a.deadline);
    }

    function _fund(bytes32 jobId, uint256 amount) private {
        vm.prank(payer);
        funding.fund{value: amount}(jobId);
        vm.prank(owner);
        jobs.recordFunding(jobId, 1, jobId);
    }

    function _offer(uint256 price) private returns (bytes32 offerId) {
        vm.prank(OPERATOR);
        offerId = offers.publish(resourceId, PRICING_POLICY, 1, price,
            uint64(block.timestamp + 12 hours));
    }

    function _propose(bytes32 jobId, bytes32 offerId) private returns (bytes32 matchId) {
        vm.prank(owner);
        matchId = matches.propose(jobId, resourceId, offerId);
        vm.prank(owner);
        jobs.recordMatch(jobId, 2, matchId);
    }

    function _accept(bytes32 jobId, uint256 limit) private returns (bytes32 acceptanceRef) {
        _grantAccept(jobId, limit);
        vm.prank(OPERATOR);
        acceptanceRef = matches.acceptMatch(jobId, 3);
    }

    function testExactQuoteReservesOnlyWithinSignedAndActuallyFundedCredit() public {
        bytes32 id = _job(1, 5 ether);
        _fund(id, 4 ether);
        bytes32 offerId = _offer(3 ether);
        bytes32 matchId = _propose(id, offerId);
        bytes32 acceptanceRef = _accept(id, 3 ether);

        bytes32 priceRef = matches.priceReservationForJob(id);
        ComputeAcceptedPriceMatch420.PriceReservation memory p = matches.priceReservation(priceRef);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.ACCEPTED
            && matches.accepted(id, matchId, acceptanceRef), "priced acceptance missing");
        require(p.jobId == id && p.matchId == matchId && p.offerId == offerId
            && p.owner == owner && p.payer == payer && p.providerId == providerId
            && p.resourceId == resourceId && p.beneficiary == BENEFICIARY,
            "accepted identities not frozen");
        require(p.acceptedAmount == 3 ether && p.fundedAmount == 4 ether
            && p.payerMaximum == 5 ether && p.pricingPolicyId == PRICING_POLICY
            && p.pricingVersion == 1, "wrong spending bounds");
        require(funding.totalFunded() == 4 ether
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == 4 ether
            && address(vault).balance == 4 ether, "acceptance moved or fabricated Vault funds");
    }

    function testQuoteAboveActualJobCreditFailsEvenWithDonorSurplus() public {
        bytes32 id = _job(2, 5 ether);
        _fund(id, 2 ether);
        vault.depositNative{value: 5 ether}();
        bytes32 offerId = _offer(3 ether);
        _propose(id, offerId);
        _grantAccept(id, 3 ether);
        vm.prank(OPERATOR);
        (bool ok,) = address(matches).call(abi.encodeCall(matches.acceptMatch, (id, uint64(3))));
        require(!ok && jobs.job(id).status == ComputeJobRegistry420.Status.MATCHED
            && matches.priceReservationForJob(id) == bytes32(0)
            && funding.totalFunded() == 2 ether
            && accounting.freeBalance(VAULT_ID, address(0)) == 5 ether,
            "donor surplus satisfied another payer price");
    }

    function testQuoteAboveSignedMaximumFailsWithoutReservation() public {
        bytes32 id = _job(3, 2 ether);
        _fund(id, 2 ether);
        bytes32 offerId = _offer(3 ether);
        _propose(id, offerId);
        _grantAccept(id, 3 ether);
        vm.prank(OPERATOR);
        (bool ok,) = address(matches).call(abi.encodeCall(matches.acceptMatch, (id, uint64(3))));
        require(!ok && matches.priceReservationForJob(id) == bytes32(0)
            && jobs.job(id).status == ComputeJobRegistry420.Status.MATCHED,
            "signed payer ceiling bypassed");
    }

    function testAcceptanceCapabilityAmountLimitFailsClosedThenExactLimitSucceeds() public {
        bytes32 id = _job(4, 5 ether);
        _fund(id, 4 ether);
        bytes32 offerId = _offer(3 ether);
        _propose(id, offerId);
        _grantAccept(id, 2 ether);
        vm.prank(OPERATOR);
        (bool ok,) = address(matches).call(abi.encodeCall(matches.acceptMatch, (id, uint64(3))));
        require(!ok && matches.priceReservationForJob(id) == bytes32(0),
            "under-limit acceptance capability admitted price");
        _grantAccept(id, 3 ether);
        vm.prank(OPERATOR);
        matches.acceptMatch(id, 3);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.ACCEPTED,
            "exact bounded acceptance failed");
    }

    function testCancelledOfferAndStaleResourceCannotConsumePriceReservation() public {
        bytes32 cancelledJob = _job(5, 5 ether);
        _fund(cancelledJob, 4 ether);
        bytes32 cancelledOffer = _offer(3 ether);
        _propose(cancelledJob, cancelledOffer);
        vm.prank(OPERATOR);
        offers.cancel(cancelledOffer);
        _grantAccept(cancelledJob, 3 ether);
        vm.prank(OPERATOR);
        (bool ok,) = address(matches).call(abi.encodeCall(matches.acceptMatch, (cancelledJob, uint64(3))));
        require(!ok && matches.priceReservationForJob(cancelledJob) == bytes32(0),
            "cancelled offer consumed reservation");

        bytes32 staleJob = _job(6, 5 ether);
        _fund(staleJob, 4 ether);
        bytes32 staleOffer = _offer(3 ether);
        _propose(staleJob, staleOffer);
        vm.prank(OPERATOR);
        resources.update(resourceId, MANIFEST, keccak256("runtime-v2"), keccak256("cap-v2"), 16);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
        _grantAccept(staleJob, 3 ether);
        vm.prank(OPERATOR);
        (ok,) = address(matches).call(abi.encodeCall(matches.acceptMatch, (staleJob, uint64(3))));
        require(!ok && matches.priceReservationForJob(staleJob) == bytes32(0),
            "stale offer/resource revision consumed reservation");
    }

    function testAcceptedBeneficiaryAndPriceRemainFrozenAfterProviderRevision() public {
        bytes32 id = _job(7, 5 ether);
        _fund(id, 4 ether);
        bytes32 offerId = _offer(3 ether);
        bytes32 matchId = _propose(id, offerId);
        bytes32 acceptanceRef = _accept(id, 3 ether);
        bytes32 priceRef = matches.priceReservationForJob(id);

        vm.prank(OPERATOR);
        providers.update(providerId, keccak256("manifest-v2"), keccak256("security-v2"), NEW_BENEFICIARY);

        ComputeAcceptedPriceMatch420.PriceReservation memory p = matches.priceReservation(priceRef);
        require(p.beneficiary == BENEFICIARY && p.acceptedAmount == 3 ether
            && matches.accepted(id, matchId, acceptanceRef),
            "later provider revision rewrote accepted economics");

        vm.prank(OPERATOR);
        (bool ok,) = address(matches).call(abi.encodeCall(matches.acceptMatch, (id, uint64(4))));
        require(!ok && matches.priceReservationForJob(id) == priceRef,
            "accepted job created second price reservation");
    }

    function testWrongOfferResourceAndCrossJobEvidenceFailClosed() public {
        bytes32 id = _job(8, 5 ether);
        _fund(id, 4 ether);
        bytes32 offerId = _offer(3 ether);
        vm.prank(owner);
        (bool ok,) = address(matches).call(
            abi.encodeCall(matches.propose, (id, keccak256("wrong-resource"), offerId)));
        require(!ok && matches.matchForJob(id) == bytes32(0), "wrong resource accepted offer");

        bytes32 first = _job(9, 5 ether);
        _fund(first, 4 ether);
        bytes32 firstOffer = _offer(3 ether);
        bytes32 firstMatch = _propose(first, firstOffer);
        bytes32 firstAcceptance = _accept(first, 3 ether);
        bytes32 second = _job(10, 5 ether);
        _fund(second, 4 ether);
        require(!matches.accepted(second, firstMatch, firstAcceptance),
            "accepted price/match evidence reused across jobs");
    }
}
