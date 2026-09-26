// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifiedEntitlement420.sol";
import "../src/compute/CMPVaultAuthorization420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultIds420.sol";

interface VmVerifiedEntitlement420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address account, uint256 amount) external;
    function prank(address caller) external;
}

contract ComputeVerifiedEntitlement420Test {
    VmVerifiedEntitlement420 private constant vm =
        VmVerifiedEntitlement420(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant OWNER_A_KEY = 0xA11CE;
    uint256 private constant PAYER_A_KEY = 0xBEEF;
    uint256 private constant OWNER_B_KEY = 0xA11CF;
    uint256 private constant PAYER_B_KEY = 0xCAFE;
    uint256 private constant VERIFIER_KEY = 0xC0DE;

    address private constant OPERATOR = address(0xC0FFEE);
    address private constant BENEFICIARY = address(0xFEE1);
    address private constant NEW_BENEFICIARY = address(0xFEE2);
    address private constant SETTLER = address(0x5151);
    address private constant GOV = address(0x420);
    address private constant ATTESTOR = address(0x1002);
    address private constant SELECTOR = address(0x1003);

    bytes32 private constant VAULT_ID = keccak256("cmp/verified-entitlement/vault/v1");
    bytes32 private constant MANIFEST = keccak256("cmp-verified-entitlement-manifest");
    bytes32 private constant PRICING_POLICY = keccak256("cmp/fixed/native-420/v1");

    CapabilityRegistry420 private caps;
    ComputeAuthorization420 private auth;
    CMPVaultAuthorization420 private vaultPolicy;
    VaultRegistry420 private vaultRegistry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;
    ComputeJobSignedRequestAuthority420 private requests;
    ComputeEscrowFunding420 private funding;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeOfferRegistry420 private offers;
    ComputeAcceptedPriceMatch420 private matches;
    ComputeJobMatchedWorkerEvidence420 private workers;
    ComputeVerifierIndependencePolicy420 private policy;
    ComputeJobIntegerProfileVerification420 private verification;
    ComputeVerifiedEntitlement420 private entitlements;
    ComputeJobRegistry420 private jobs;

    address private ownerA;
    address private payerA;
    address private ownerB;
    address private payerB;
    address private verifier;
    bytes32 private providerId;
    bytes32 private resourceId;
    bytes32 private offerId;
    uint64[4] private values;
    uint256 private grantNonce;

    function setUp() public {
        ownerA = vm.addr(OWNER_A_KEY);
        payerA = vm.addr(PAYER_A_KEY);
        ownerB = vm.addr(OWNER_B_KEY);
        payerB = vm.addr(PAYER_B_KEY);
        verifier = vm.addr(VERIFIER_KEY);
        vm.deal(payerA, 50 ether);
        vm.deal(payerB, 50 ether);
        values = [uint64(3), uint64(4), uint64(5), uint64(12)];

        caps = new CapabilityRegistry420();
        auth = new ComputeAuthorization420(address(caps));
        caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        caps.registerProtocolComponent(auth.COMPONENT_COMPUTE(), address(this));

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
        matches = new ComputeAcceptedPriceMatch420(address(resources), address(auth),
            address(funding), address(offers));
        workers = new ComputeJobMatchedWorkerEvidence420(address(matches), address(auth));
        policy = new ComputeVerifierIndependencePolicy420(GOV, ATTESTOR, SELECTOR);
        verification = new ComputeJobIntegerProfileVerification420(
            address(matches), address(auth), address(policy));
        entitlements = new ComputeVerifiedEntitlement420(
            address(matches), address(auth), address(verification));
        jobs = new ComputeJobRegistry420(address(requests), address(funding), address(matches),
            address(workers), address(verification), address(entitlements));

        funding.bindJobs(address(jobs));
        matches.bindJobs(address(jobs));
        workers.bindJobs(address(jobs));
        verification.bindJobs(address(jobs));
        verification.setApprovedProfile(verification.PROFILE_ID(), true);
        entitlements.bindJobs(address(jobs));

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
        bytes32 nodeId = nodes.register(providerId, MANIFEST, keccak256("endpoint"),
            uint64(block.timestamp + 3 days));
        vm.prank(OPERATOR);
        nodes.activate(nodeId);
        bytes32 cls = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(nodeId, cls, MANIFEST, keccak256("runtime"),
            keccak256("capability"), 16);
        vm.prank(OPERATOR);
        resources.activate(resourceId);
        vm.prank(OPERATOR);
        offerId = offers.publish(resourceId, PRICING_POLICY, 1, 3 ether,
            uint64(block.timestamp + 12 hours));

        _attest(ownerA, keccak256("owner-a"));
        _attest(payerA, keccak256("payer-a"));
        _attest(ownerB, keccak256("owner-b"));
        _attest(payerB, keccak256("payer-b"));
        _attest(OPERATOR, keccak256("operator"));
        _attest(verifier, keccak256("verifier"));
    }

    function _grantVault(address principal, bytes32 action) private {
        caps.createGrant(keccak256(abi.encode("vault", principal, action, grantNonce++)), principal,
            VaultIds420.COMPONENT_VAULT, action, vaultPolicy.scopeForVault(VAULT_ID),
            0, 0, 0, 0, 0);
    }

    function _grant(address actor, bytes32 jobId, bytes32 action, uint256 amount) private {
        caps.createGrant(keccak256(abi.encode("compute", actor, jobId, action, grantNonce++)), actor,
            auth.COMPONENT_COMPUTE(), action, auth.scopeJob(jobId),
            amount, 0, 0, 0, 0);
    }

    function _attest(address account, bytes32 controller) private {
        vm.prank(ATTESTOR);
        policy.attest(account, controller, keccak256(abi.encode("reviewed", account)),
            uint64(block.timestamp + 2 days));
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _resultJob(uint256 nonce, uint256 ownerKey, uint256 payerKey,
        uint256 fundedAmount, uint256 output) private returns (bytes32 id, bytes32 receipt)
    {
        address owner = vm.addr(ownerKey);
        address payer = vm.addr(payerKey);
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({
                owner: owner,
                payer: payer,
                manifestHash: MANIFEST,
                workloadType: verification.WORKLOAD_TYPE(),
                inputCommitment: verification.inputHash(values),
                outputSchemaCommitment: verification.OUTPUT_SCHEMA(),
                deadline: uint64(block.timestamp + 1 days),
                authorizationExpiry: uint64(block.timestamp + 2 days),
                maxSpend: 5 ether,
                nonce: nonce
            });
        bytes32 digest = requests.authorizationDigest(a);
        bytes memory ownerSig = _signature(ownerKey, digest);
        bytes memory payerSig = _signature(payerKey, digest);
        vm.prank(owner);
        bytes32 requestId = requests.registerSignedRequest(a, ownerSig, payerSig);

        vm.prank(owner);
        id = jobs.createJob(requestId, requestId, MANIFEST, a.workloadType,
            a.inputCommitment, a.outputSchemaCommitment, a.deadline);
        vm.prank(payer);
        funding.fund{value: fundedAmount}(id);
        vm.prank(owner);
        jobs.recordFunding(id, 1, id);
        vm.prank(owner);
        bytes32 matchId = matches.propose(id, resourceId, offerId);
        vm.prank(owner);
        jobs.recordMatch(id, 2, matchId);

        _grant(OPERATOR, id, auth.ACTION_ACCEPT_MATCH(), 3 ether);
        vm.prank(OPERATOR);
        matches.acceptMatch(id, 3);
        _grant(OPERATOR, id, auth.ACTION_EXECUTE_ATTEMPT(), 0);
        _grant(OPERATOR, id, auth.ACTION_SUBMIT_RECEIPT(), 0);
        vm.prank(OPERATOR);
        workers.acceptAssignment(id, resourceId, 4);

        receipt = keccak256(abi.encode("receipt", nonce));
        vm.prank(OPERATOR);
        bytes32 result = workers.commitResult(id, receipt, verification.outputHash(output));
        vm.prank(OPERATOR);
        jobs.recordResult(id, 5, result);

        _grant(verifier, id, auth.ACTION_VERIFY_RESULT(), 0);
        vm.prank(SELECTOR);
        policy.appoint(id, verifier, verification.PROFILE_ID(), owner, payer, OPERATOR,
            keccak256(abi.encode("appointment", nonce)), uint64(block.timestamp + 1 days));
    }

    function _verify(bytes32 id, bytes32 receipt, uint256 nonce, uint256 output, bool approved)
        private returns (bytes32 decisionRef)
    {
        ComputeJobRegistry420.Job memory j = jobs.job(id);
        ComputeJobIndependentVerification420.Verdict memory v =
            ComputeJobIndependentVerification420.Verdict({
                jobId: id,
                requestId: j.requestId,
                manifestHash: j.manifestHash,
                matchId: j.matchId,
                assignmentRef: j.assignmentRef,
                resultCommitment: j.resultCommitment,
                verifier: verifier,
                profileId: verification.PROFILE_ID(),
                approved: approved,
                expectedRevision: j.revision,
                expiry: uint64(block.timestamp + 1 hours),
                nonce: nonce
            });
        decisionRef = verification.verdictDigest(v);
        bytes memory sig = _signature(VERIFIER_KEY, decisionRef);
        verification.submitEvaluatedVerdict(v, sig, values, output, receipt);
    }

    function _verifiedJob(uint256 nonce, uint256 ownerKey, uint256 payerKey, uint256 fundedAmount)
        private returns (bytes32 id)
    {
        bytes32 receipt;
        (id, receipt) = _resultJob(nonce, ownerKey, payerKey, fundedAmount, 194);
        _verify(id, receipt, nonce, 194, true);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED,
            "verified fixture failed");
    }

    function _finalize(bytes32 id, uint256 amount) private returns (bytes32 ref) {
        _grant(SETTLER, id, auth.ACTION_SETTLE(), amount);
        uint64 revision = jobs.job(id).revision;
        vm.prank(SETTLER);
        ref = entitlements.finalizeVerifiedEarning(id, revision);
    }

    function testVerifiedFixedPriceCreatesOneImmutableEntitlementWithoutVaultMovement() public {
        bytes32 id = _verifiedJob(1, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        uint256 beforeBalance = address(vault).balance;
        uint256 beforeReserved = accounting.getAccounting(VAULT_ID, address(0)).reserved;
        bytes32 ref = _finalize(id, 3 ether);

        ComputeVerifiedEntitlement420.Entitlement memory e = entitlements.entitlement(ref);
        require(e.exists && e.jobId == id && e.payer == payerA
            && e.providerId == providerId && e.resourceId == resourceId
            && e.beneficiary == BENEFICIARY && e.acceptedAmount == 3 ether
            && e.earnedAmount == 3 ether && e.fundedAmount == 4 ether
            && e.payerMaximum == 5 ether && e.pricingPolicyId == PRICING_POLICY
            && e.verificationRef == jobs.job(id).verificationRef,
            "verified entitlement snapshot incorrect");
        require(entitlements.totalVerifiedEarned() == 3 ether
            && jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED
            && address(vault).balance == beforeBalance
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == beforeReserved
            && !entitlements.settled(id, e.verificationRef, ref),
            "entitlement moved funds or falsely settled job");
    }

    function testFailedVerificationCannotCreateProviderEarning() public {
        (bytes32 id, bytes32 receipt) = _resultJob(2, OWNER_A_KEY, PAYER_A_KEY, 4 ether, 195);
        _verify(id, receipt, 2, 195, false);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.FAILED,
            "negative objective verdict not recorded");
        _grant(SETTLER, id, auth.ACTION_SETTLE(), 3 ether);
        uint64 revision = jobs.job(id).revision;
        vm.prank(SETTLER);
        (bool ok,) = address(entitlements).call(
            abi.encodeCall(entitlements.finalizeVerifiedEarning, (id, revision)));
        require(!ok && entitlements.entitlementForJob(id) == bytes32(0)
            && entitlements.totalVerifiedEarned() == 0 && funding.totalFunded() == 4 ether,
            "failed verification created earnings");
    }

    function testMissingOrUnderLimitSettlementAuthorityCannotFinalize() public {
        bytes32 id = _verifiedJob(3, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        vm.prank(SETTLER);
        (bool ok,) = address(entitlements).call(
            abi.encodeCall(entitlements.finalizeVerifiedEarning, (id, uint64(7))));
        require(!ok && entitlements.entitlementForJob(id) == bytes32(0),
            "ungranted settlement caller finalized earning");

        _grant(SETTLER, id, auth.ACTION_SETTLE(), 2 ether);
        vm.prank(SETTLER);
        (ok,) = address(entitlements).call(
            abi.encodeCall(entitlements.finalizeVerifiedEarning, (id, uint64(7))));
        require(!ok && entitlements.entitlementForJob(id) == bytes32(0),
            "under-limit settlement grant admitted full earning");

        _finalize(id, 3 ether);
        require(entitlements.entitlementForJob(id) != bytes32(0),
            "exact settlement authority failed");
    }

    function testReplayAndCrossJobEntitlementReuseFailClosed() public {
        bytes32 first = _verifiedJob(4, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        bytes32 second = _verifiedJob(5, OWNER_B_KEY, PAYER_B_KEY, 4 ether);
        bytes32 firstRef = _finalize(first, 3 ether);

        _grant(SETTLER, first, auth.ACTION_SETTLE(), 3 ether);
        vm.prank(SETTLER);
        (bool ok,) = address(entitlements).call(
            abi.encodeCall(entitlements.finalizeVerifiedEarning, (first, uint64(7))));
        require(!ok && entitlements.totalVerifiedEarned() == 3 ether,
            "duplicate entitlement finalized");

        ComputeVerifiedEntitlement420.Entitlement memory e = entitlements.entitlement(firstRef);
        require(!entitlements.verifiedEntitlement(
            second, jobs.job(second).verificationRef, firstRef, e.beneficiary, e.earnedAmount),
            "cross-job entitlement evidence reused");
    }

    function testTwoPayersRemainConservedWhileIndependentEarningsAccrue() public {
        bytes32 first = _verifiedJob(6, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        bytes32 second = _verifiedJob(7, OWNER_B_KEY, PAYER_B_KEY, 4 ether);
        bytes32 firstRef = _finalize(first, 3 ether);
        bytes32 secondRef = _finalize(second, 3 ether);

        ComputeVerifiedEntitlement420.Entitlement memory a = entitlements.entitlement(firstRef);
        ComputeVerifiedEntitlement420.Entitlement memory b = entitlements.entitlement(secondRef);
        require(a.payer == payerA && b.payer == payerB && firstRef != secondRef
            && a.earnedAmount == 3 ether && b.earnedAmount == 3 ether
            && entitlements.totalVerifiedEarned() == 6 ether,
            "two-payer earnings not isolated");
        require(funding.totalFunded() == 8 ether && address(vault).balance == 8 ether
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == 8 ether
            && accounting.freeBalance(VAULT_ID, address(0)) == 0,
            "earnings ledger consumed or shared payer custody");
    }

    function testRevokedVerificationProfileBlocksEconomicFinalizationUntilRestored() public {
        bytes32 id = _verifiedJob(8, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        _grant(SETTLER, id, auth.ACTION_SETTLE(), 3 ether);
        verification.setApprovedProfile(verification.PROFILE_ID(), false);
        vm.prank(SETTLER);
        (bool ok,) = address(entitlements).call(
            abi.encodeCall(entitlements.finalizeVerifiedEarning, (id, uint64(7))));
        require(!ok && entitlements.entitlementForJob(id) == bytes32(0)
            && entitlements.totalVerifiedEarned() == 0,
            "revoked verification profile created earnings");

        verification.setApprovedProfile(verification.PROFILE_ID(), true);
        vm.prank(SETTLER);
        entitlements.finalizeVerifiedEarning(id, 7);
        require(entitlements.entitlementForJob(id) != bytes32(0),
            "restored qualified profile could not finalize earning");
    }

    function testWithdrawnVerifierIdentityBlocksEconomicFinalization() public {
        bytes32 id = _verifiedJob(9, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        _grant(SETTLER, id, auth.ACTION_SETTLE(), 3 ether);
        vm.prank(ATTESTOR);
        policy.withdraw(verifier);
        vm.prank(SETTLER);
        (bool ok,) = address(entitlements).call(
            abi.encodeCall(entitlements.finalizeVerifiedEarning, (id, uint64(7))));
        require(!ok && entitlements.entitlementForJob(id) == bytes32(0)
            && funding.totalFunded() == 4 ether,
            "stale verifier identity created economic entitlement");
    }

    function testAcceptedBeneficiaryCannotBeRedirectedAfterVerification() public {
        bytes32 id = _verifiedJob(10, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        vm.prank(OPERATOR);
        providers.update(providerId, keccak256("provider-v2"), keccak256("security-v2"),
            NEW_BENEFICIARY);
        bytes32 ref = _finalize(id, 3 ether);
        ComputeVerifiedEntitlement420.Entitlement memory e = entitlements.entitlement(ref);
        require(e.beneficiary == BENEFICIARY && e.beneficiary != NEW_BENEFICIARY
            && e.earnedAmount == 3 ether, "provider revision redirected earned beneficiary");
    }
}
