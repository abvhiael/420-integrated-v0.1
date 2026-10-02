// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifiedEntitlement420.sol";
import "../src/compute/ComputeVerifierDisputeSlashRecipientResolver420.sol";
import "../src/compute/CMPVaultAuthorization420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultIds420.sol";

interface VmVerifiedEntitlement420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address account, uint256 amount) external;
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}


contract ReentrantCMPBeneficiary420 {
    AssetVault420 public vault;
    ComputeVerifiedEntitlement420 public entitlements;
    bytes32 public jobId;
    bytes32 public obligationId;
    uint64 public revision;
    bool public attempted;
    bool public reentrantVaultClaimSucceeded;
    bool public reentrantSettlementSucceeded;

    function configure(AssetVault420 vault_, ComputeVerifiedEntitlement420 entitlements_,
        bytes32 jobId_, bytes32 obligationId_, uint64 revision_) external
    {
        vault = vault_;
        entitlements = entitlements_;
        jobId = jobId_;
        obligationId = obligationId_;
        revision = revision_;
    }

    function claimProvider() external {
        entitlements.claimProvider(jobId, revision);
    }

    receive() external payable {
        attempted = true;
        (reentrantVaultClaimSucceeded,) = address(vault).call(
            abi.encodeCall(vault.claim, (keccak256("cmp/reentrant/direct-vault"), obligationId))
        );
        (reentrantSettlementSucceeded,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimProvider, (jobId, revision))
        );
    }
}


contract RejectingCMPBeneficiary420 {
    ComputeVerifiedEntitlement420 public entitlements;
    bytes32 public jobId;
    uint64 public revision;

    function configure(ComputeVerifiedEntitlement420 entitlements_, bytes32 jobId_, uint64 revision_) external {
        entitlements = entitlements_;
        jobId = jobId_;
        revision = revision_;
    }

    function claimProvider() external {
        entitlements.claimProvider(jobId, revision);
    }

    receive() external payable {
        revert("reject native payout");
    }
}

contract EscrowSlashEvidenceAdapter420 {}

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
    address private constant ADJUDICATOR_A = address(0xAD01);
    address private constant ADJUDICATOR_B = address(0xAD02);
    address private constant OUTSIDER = address(0xBAD1);

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
    ComputeDisputeResolution420 private disputes;
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
        offers = new ComputeOfferRegistry420(address(resources), address(computeAuth));
        matches = new ComputeAcceptedPriceMatch420(address(resources), address(auth),
            address(funding), address(offers));
        workers = new ComputeJobMatchedWorkerEvidence420(address(matches), address(auth));
        policy = new ComputeVerifierIndependencePolicy420(GOV, ATTESTOR, SELECTOR);
        verification = new ComputeJobIntegerProfileVerification420(
            address(matches), address(auth), address(policy));
        disputes = new ComputeDisputeResolution420(
            address(matches), address(auth), address(policy));
        entitlements = new ComputeVerifiedEntitlement420(
            address(matches), address(auth), address(verification), address(disputes));
        jobs = new ComputeJobRegistry420(address(requests), address(funding), address(matches),
            address(workers), address(verification), address(entitlements));

        funding.bindJobs(address(jobs));
        matches.bindJobs(address(jobs));
        workers.bindJobs(address(jobs));
        verification.bindJobs(address(jobs));
        verification.setApprovedProfile(verification.PROFILE_ID(), true);
        entitlements.bindJobs(address(jobs));
        disputes.bindEntitlements(address(entitlements));
        disputes.bindJobs(address(jobs));
        funding.bindSettlement(address(entitlements));

        vaultPolicy.bindVault(address(vault));
        vaultPolicy.bindFunding(address(funding));
        vaultPolicy.bindSettlement(address(entitlements));
        _grantVault(address(funding), VaultIds420.ACTION_CREATE_OBLIGATION);
        _grantVault(address(funding), VaultIds420.ACTION_RELEASE_OBLIGATION);
        _grantVault(address(funding), VaultIds420.ACTION_CANCEL_OBLIGATION);
        _grantVault(address(entitlements), VaultIds420.ACTION_RELEASE_OBLIGATION);
        _grantVault(address(entitlements), VaultIds420.ACTION_CLAIM);
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
        _attest(ADJUDICATOR_A, keccak256("adjudicator-a"));
        _attest(ADJUDICATOR_B, keccak256("adjudicator-b"));
        _attest(OUTSIDER, keccak256("outsider"));
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

    function _acceptedJob(uint256 nonce, uint256 ownerKey, uint256 payerKey,
        uint256 fundedAmount) private returns (bytes32 id)
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
        require(jobs.job(id).status == ComputeJobRegistry420.Status.ACCEPTED,
            "accepted fixture failed");
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
        (bool assignmentOk,) = address(workers).call(
            abi.encodeCall(workers.acceptAssignment, (id, resourceId, uint64(4))));
        require(assignmentOk, "stage: worker assignment");

        receipt = keccak256(abi.encode("receipt", nonce));
        bytes32 outputHash = verification.outputHash(output);
        vm.prank(OPERATOR);
        (bool commitOk, bytes memory commitData) = address(workers).call(
            abi.encodeCall(workers.commitResult, (id, receipt, outputHash)));
        require(commitOk, "stage: worker result commit");
        bytes32 result = abi.decode(commitData, (bytes32));

        vm.prank(OPERATOR);
        (bool recordOk,) = address(jobs).call(
            abi.encodeCall(jobs.recordResult, (id, uint64(5), result)));
        require(recordOk, "stage: canonical result record");

        _grant(verifier, id, auth.ACTION_VERIFY_RESULT(), 0);
        bytes32 profileId = verification.PROFILE_ID();
        vm.prank(SELECTOR);
        (bool appointmentOk,) = address(policy).call(
            abi.encodeCall(policy.appoint, (
                id, verifier, profileId, owner, payer, OPERATOR,
                keccak256(abi.encode("appointment", nonce)), uint64(block.timestamp + 1 days)
            )));
        require(appointmentOk, "stage: verifier appointment");
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
        (bool verificationOk,) = address(verification).call(
            abi.encodeCall(verification.submitEvaluatedVerdict,
                (v, sig, values, output, receipt)));
        require(verificationOk, "stage: objective verification");
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

    function testNegativeVerificationCannotCreateProviderEarning() public {
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

    function _makeClaimable(bytes32 id) private returns (ComputeVerifiedEntitlement420.ProviderClaim memory pc) {
        _finalize(id, 3 ether);
        uint64 revision = jobs.job(id).revision;
        vm.prank(SETTLER);
        entitlements.createProviderClaim(id, revision);
        pc = entitlements.providerClaim(id);
    }

    function _matureProviderClaim(bytes32 id) private {
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = entitlements.providerClaim(id);
        vm.warp(uint256(pc.createdAt) + uint256(matches.CHALLENGE_WINDOW()) + 1);
        require(disputes.providerReleaseAllowed(id), "stage: provider release finality");
        bytes32 vaultScope = vaultPolicy.scopeForVault(VAULT_ID);
        require(caps.isAuthorized(address(entitlements), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, vaultScope, 0),
            "stage: settlement release grant");
        require(caps.isAuthorized(address(entitlements), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CLAIM, vaultScope, 3 ether),
            "stage: settlement claim grant");
    }

    function _grantAdjudicator(address actor, bytes32 id) private {
        _grant(actor, id, auth.ACTION_ADJUDICATE(), 0);
        require(auth.isAuthorized(actor, auth.ACTION_ADJUDICATE(), auth.scopeJob(id), 0),
            "stage: adjudicator capability");
    }

    function _openPayerDispute(bytes32 id, bytes32 salt) private returns (bytes32 disputeId) {
        address payer = funding.credit(id).payer;
        uint64 revision = jobs.job(id).revision;
        vm.prank(payer);
        disputeId = disputes.openDispute(
            id, revision, keccak256(abi.encode("ground", salt)),
            keccak256(abi.encode("evidence", salt))
        );
    }

    function testProviderClaimSplitsSafetyIntoClaimableProviderAndPendingPayerResidual() public {
        bytes32 id = _verifiedJob(11, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        bytes32 safety = funding.credit(id).obligationId;
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);

        ComputeEscrowFunding420.Credit memory credit = funding.credit(id);
        VaultAccounting420.Obligation memory original = accounting.getObligation(safety);
        VaultAccounting420.Obligation memory provider = accounting.getObligation(pc.providerObligationId);
        VaultAccounting420.Obligation memory residual = accounting.getObligation(pc.payerResidualObligationId);
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));

        require(credit.allocated && credit.earnedAllocated == 3 ether
            && credit.providerObligationId == pc.providerObligationId
            && credit.payerResidualObligationId == pc.payerResidualObligationId,
            "funding split not recorded");
        require(original.state == 4 && provider.state == 1 && residual.state == 1,
            "liability states incorrect");
        require(provider.beneficiary == BENEFICIARY && provider.amount == 3 ether
            && residual.beneficiary == payerA && residual.amount == 1 ether,
            "split beneficiaries or amounts incorrect");
        require(a.recordedBalance == 4 ether && a.reserved == 4 ether
            && a.claimable == 0 && address(vault).balance == 4 ether
            && jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED,
            "pending claim moved funds or settled early");
    }

    function testProviderClaimPaysExactBeneficiaryAndSettlesJob() public {
        bytes32 id = _verifiedJob(12, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        _matureProviderClaim(id);
        uint256 before = BENEFICIARY.balance;
        uint64 revision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        bytes32 payoutRef = entitlements.claimProvider(id, revision);

        VaultAccounting420.Obligation memory provider = accounting.getObligation(pc.providerObligationId);
        VaultAccounting420.Obligation memory residual = accounting.getObligation(pc.payerResidualObligationId);
        require(BENEFICIARY.balance == before + 3 ether && provider.state == 3
            && residual.state == 1 && residual.beneficiary == payerA && residual.amount == 1 ether,
            "provider payout or payer residual incorrect");
        require(jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED
            && jobs.job(id).settlementRef == payoutRef
            && entitlements.totalProviderPaid() == 3 ether
            && address(vault).balance == 1 ether,
            "job not settled on actual payout");
    }

    function testWrongBeneficiaryAndReplayCannotDoublePay() public {
        bytes32 id = _verifiedJob(13, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        uint64 revision = jobs.job(id).revision;
        uint256 beforeVault = address(vault).balance;

        vm.prank(NEW_BENEFICIARY);
        (bool wrong,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimProvider, (id, revision)));
        require(!wrong && address(vault).balance == beforeVault
            && accounting.getObligation(pc.providerObligationId).state == 1,
            "wrong beneficiary consumed provider claim");

        _matureProviderClaim(id);
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(id, revision);
        uint256 paidBalance = BENEFICIARY.balance;
        vm.prank(BENEFICIARY);
        (bool replay,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimProvider, (id, uint64(8))));
        require(!replay && BENEFICIARY.balance == paidBalance
            && entitlements.totalProviderPaid() == 3 ether,
            "provider claim replay paid twice");
    }

    function testRevokedProfileBlocksClaimCreationAndPayout() public {
        bytes32 id = _verifiedJob(14, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        _finalize(id, 3 ether);
        verification.setApprovedProfile(verification.PROFILE_ID(), false);
        vm.prank(SETTLER);
        (bool createOk,) = address(entitlements).call(
            abi.encodeCall(entitlements.createProviderClaim, (id, uint64(7))));
        require(!createOk && !funding.credit(id).allocated,
            "revoked profile allowed liability split");

        verification.setApprovedProfile(verification.PROFILE_ID(), true);
        vm.prank(SETTLER);
        entitlements.createProviderClaim(id, 7);
        verification.setApprovedProfile(verification.PROFILE_ID(), false);
        vm.prank(BENEFICIARY);
        (bool payoutOk,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimProvider, (id, uint64(7))));
        require(!payoutOk && accounting.getObligation(
            entitlements.providerClaim(id).providerObligationId).state == 1,
            "revoked profile allowed external payout");
    }

    function testTwoPayerPayoutIsolationPreservesOtherBacking() public {
        bytes32 first = _verifiedJob(15, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        bytes32 second = _verifiedJob(16, OWNER_B_KEY, PAYER_B_KEY, 4 ether);
        _makeClaimable(first);
        bytes32 secondSafety = funding.credit(second).obligationId;
        _matureProviderClaim(first);
        uint64 revision = jobs.job(first).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(first, revision);

        require(accounting.getObligation(secondSafety).state == 1
            && funding.funded(second, ownerB, second)
            && address(vault).balance == 5 ether
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == 5 ether,
            "first provider payout consumed second payer backing");
    }

    function testMissingSettlementReleaseGrantCannotEscapePendingHold() public {
        bytes32 id = _verifiedJob(17, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        _matureProviderClaim(id);
        bytes32 scope = vaultPolicy.scopeForVault(VAULT_ID);
        bytes32 grantId = caps.activeGrantId(address(entitlements), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, scope);
        caps.revokeGrant(grantId);

        uint64 blockedRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        (bool ok,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimProvider, (id, blockedRevision)));
        require(!ok && !entitlements.providerClaim(id).paid
            && accounting.getObligation(pc.providerObligationId).state == 1
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == 4 ether
            && accounting.getAccounting(VAULT_ID, address(0)).claimable == 0
            && address(vault).balance == 4 ether,
            "missing release authority escaped pending provider hold");
    }

    function testExactFundedPayoutCreatesNoResidual() public {
        bytes32 id = _verifiedJob(18, OWNER_A_KEY, PAYER_A_KEY, 3 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        require(pc.payerResidualObligationId == bytes32(0),
            "exact funded job created payer residual");
        _matureProviderClaim(id);
        uint64 revision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(id, revision);
        require(address(vault).balance == 0
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == 0
            && accounting.getAccounting(VAULT_ID, address(0)).claimable == 0
            && jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED,
            "exact funded payout left liability");
    }

    function testSettledUnderBudgetResidualRefundPaysOriginalPayerWithoutReopeningJob() public {
        bytes32 id = _verifiedJob(19, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        _makeClaimable(id);
        _matureProviderClaim(id);
        uint64 providerRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(id, providerRevision);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED,
            "provider settlement missing");

        uint256 payerBefore = payerA.balance;
        entitlements.createSettledResidualRefundClaim(id);
        ComputeVerifiedEntitlement420.PayerRefund memory refund = entitlements.payerRefund(id);
        require(refund.residual && refund.payer == payerA && refund.amount == 1 ether
            && accounting.getObligation(refund.obligationId).state == 1,
            "residual refund not claimable");

        uint64 settledRevision = jobs.job(id).revision;
        vm.prank(payerA);
        entitlements.claimPayerRefund(id, settledRevision);
        require(payerA.balance == payerBefore + 1 ether
            && jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED
            && address(vault).balance == 0
            && entitlements.totalPayerRefundPaid() == 1 ether,
            "settled residual refund reopened job or paid wrong amount");
    }

    function testNegativeVerificationRefundsFullPayerAndTransitionsRefunded() public {
        (bytes32 id, bytes32 receipt) = _resultJob(20, OWNER_A_KEY, PAYER_A_KEY, 4 ether, 195);
        _verify(id, receipt, 20, 195, false);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.FAILED,
            "failed fixture missing");
        uint256 payerBefore = payerA.balance;
        entitlements.createTerminalRefundClaim(id);
        ComputeVerifiedEntitlement420.PayerRefund memory refund = entitlements.payerRefund(id);
        require(!refund.residual && refund.payer == payerA && refund.amount == 4 ether
            && accounting.getObligation(refund.obligationId).state == 1
            && entitlements.totalProviderPaid() == 0,
            "failed job refund claim incorrect");

        uint64 revision = jobs.job(id).revision;
        vm.prank(payerA);
        entitlements.claimPayerRefund(id, revision);
        require(payerA.balance == payerBefore + 4 ether
            && jobs.job(id).status == ComputeJobRegistry420.Status.REFUNDED
            && address(vault).balance == 0,
            "failed job did not refund payer exactly");
    }

    function testRequesterCancellationBeforeRunningRefundsAndOutsiderCannotCancel() public {
        bytes32 id = _acceptedJob(21, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        vm.prank(NEW_BENEFICIARY);
        (bool outsider,) = address(jobs).call(
            abi.encodeCall(jobs.recordCancellation, (id, uint64(4))));
        require(!outsider && jobs.job(id).status == ComputeJobRegistry420.Status.ACCEPTED,
            "outsider cancelled payer job");

        vm.prank(ownerA);
        jobs.recordCancellation(id, 4);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.CANCELLED,
            "owner cancellation failed");
        entitlements.createTerminalRefundClaim(id);
        uint64 revision = jobs.job(id).revision;
        uint256 before = payerA.balance;
        vm.prank(payerA);
        entitlements.claimPayerRefund(id, revision);
        require(payerA.balance == before + 4 ether
            && jobs.job(id).status == ComputeJobRegistry420.Status.REFUNDED,
            "cancelled job refund failed");
    }

    function testAcceptedExpiryIsPermissionlessDeadlineProvenAndRefundable() public {
        bytes32 id = _acceptedJob(22, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        vm.prank(NEW_BENEFICIARY);
        (bool early,) = address(jobs).call(
            abi.encodeCall(jobs.recordExpiry, (id, uint64(4))));
        require(!early && jobs.job(id).status == ComputeJobRegistry420.Status.ACCEPTED,
            "early expiry admitted");

        vm.warp(uint256(jobs.job(id).deadline) + 1);
        vm.prank(NEW_BENEFICIARY);
        jobs.recordExpiry(id, 4);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.EXPIRED,
            "permissionless deadline expiry failed");

        entitlements.createTerminalRefundClaim(id);
        uint64 revision = jobs.job(id).revision;
        uint256 before = payerA.balance;
        vm.prank(payerA);
        entitlements.claimPayerRefund(id, revision);
        require(payerA.balance == before + 4 ether
            && jobs.job(id).status == ComputeJobRegistry420.Status.REFUNDED,
            "expired accepted job refund failed");
    }

    function testWrongPayerAndRefundReplayCannotDoublePay() public {
        bytes32 id = _acceptedJob(23, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        vm.prank(ownerA);
        jobs.recordCancellation(id, 4);
        entitlements.createTerminalRefundClaim(id);
        uint64 revision = jobs.job(id).revision;

        vm.prank(payerB);
        (bool wrong,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimPayerRefund, (id, revision)));
        require(!wrong && address(vault).balance == 4 ether,
            "wrong payer consumed refund");

        vm.prank(payerA);
        entitlements.claimPayerRefund(id, revision);
        uint256 paid = payerA.balance;
        vm.prank(payerA);
        (bool replay,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimPayerRefund, (id, uint64(revision + 1))));
        require(!replay && payerA.balance == paid
            && entitlements.totalPayerRefundPaid() == 4 ether,
            "refund replay paid twice");
    }

    function testTwoPayerTerminalRefundIsolationPreservesOtherSafetyObligation() public {
        bytes32 first = _acceptedJob(24, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        bytes32 second = _acceptedJob(25, OWNER_B_KEY, PAYER_B_KEY, 4 ether);
        bytes32 secondSafety = funding.credit(second).obligationId;
        vm.prank(ownerA);
        jobs.recordCancellation(first, 4);
        entitlements.createTerminalRefundClaim(first);
        uint64 revision = jobs.job(first).revision;
        vm.prank(payerA);
        entitlements.claimPayerRefund(first, revision);

        require(accounting.getObligation(secondSafety).state == 1
            && funding.funded(second, ownerB, second)
            && address(vault).balance == 4 ether
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == 4 ether,
            "first refund consumed second payer backing");
    }

    function testRunningJobCannotBeCancelledOrExpiredByRefundPath() public {
        (bytes32 id,) = _resultJob(26, OWNER_A_KEY, PAYER_A_KEY, 4 ether, 194);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.RESULT_COMMITTED,
            "result fixture missing");
        vm.prank(ownerA);
        (bool cancelOk,) = address(jobs).call(
            abi.encodeCall(jobs.recordCancellation, (id, uint64(6))));
        require(!cancelOk, "post-execution cancellation admitted");

        vm.warp(uint256(jobs.job(id).deadline) + 1);
        (bool expiryOk,) = address(jobs).call(
            abi.encodeCall(jobs.recordExpiry, (id, uint64(6))));
        require(!expiryOk, "post-result expiry preempted verification");
    }

    function testProviderCannotBypassChallengeGateThroughDirectVaultClaim() public {
        bytes32 id = _verifiedJob(27, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        require(accounting.getObligation(pc.providerObligationId).state == 1
            && accounting.getAccounting(VAULT_ID, address(0)).claimable == 0,
            "provider obligation escaped pending state");

        vm.prank(BENEFICIARY);
        (bool directOk,) = address(vault).call(
            abi.encodeCall(vault.claim, (keccak256("direct-bypass"), pc.providerObligationId)));
        require(!directOk && accounting.getObligation(pc.providerObligationId).state == 1,
            "beneficiary bypassed dispute gate through Vault");

        uint64 earlyRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        (bool earlyOk,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimProvider, (id, earlyRevision)));
        require(!earlyOk && !entitlements.providerClaim(id).paid
            && jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED,
            "provider paid before challenge window finality");
    }

    function testTimelyPayerChallengeHoldsSpecificProviderLiabilityUntilProviderWinFinality() public {
        bytes32 id = _verifiedJob(28, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        bytes32 originalVerificationRef = jobs.job(id).verificationRef;
        address originalVerifier = jobs.job(id).verifier;
        bytes32 disputeId = _openPayerDispute(id, keccak256("provider-win"));

        ComputeDisputeResolution420.VerificationReview memory review =
            disputes.verificationReview(disputeId);
        (
            bytes32 holdDisputeId,
            bool verifierHold,
            bytes32 heldVerificationRef,
            address heldVerifier,
            ,
            ,
        ) = disputes.verificationHoldForJob(id);

        require(jobs.job(id).status == ComputeJobRegistry420.Status.DISPUTED
            && disputes.activeHold(id) && verifierHold
            && holdDisputeId == disputeId
            && review.disputeId == disputeId && review.jobId == id
            && review.verificationRef == originalVerificationRef
            && review.verifier == originalVerifier
            && heldVerificationRef == originalVerificationRef
            && heldVerifier == originalVerifier
            && review.holdActive && !review.finalDisposition
            && !review.adverseToOriginalVerification
            && accounting.getObligation(pc.providerObligationId).state == 1,
            "timely challenge did not expose immutable held verification provenance");

        vm.prank(BENEFICIARY);
        disputes.respond(disputeId, keccak256("provider-response"));
        _grantAdjudicator(ADJUDICATOR_A, id);
        vm.prank(ADJUDICATOR_A);
        disputes.decide(disputeId, true, keccak256("provider-wins"));
        ComputeDisputeResolution420.DisputeCase memory dc = disputes.caseOf(disputeId);
        vm.warp(uint256(dc.appealDeadline) + 1);
        disputes.finalize(disputeId);

        require(jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED
            && !disputes.activeHold(id) && disputes.providerReleaseAllowed(id)
            && accounting.getObligation(pc.providerObligationId).state == 1,
            "provider-win finality changed liability before payout");

        uint256 before = BENEFICIARY.balance;
        uint64 providerWinRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(id, providerWinRevision);
        require(BENEFICIARY.balance == before + 3 ether
            && jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED
            && accounting.getObligation(pc.providerObligationId).state == 3,
            "final provider win did not settle exact held earning");
    }


    function testObjectiveVerifierSlashResolverUsesCanonicalEscrowPayerWithoutMutatingEscrow() public {
        bytes32 id = _verifiedJob(60, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        _makeClaimable(id);

        uint64 revision = jobs.job(id).revision;
        bytes32 objectiveGround = disputes.OBJECTIVE_VERIFIER_ERROR_GROUND();
        vm.prank(payerA);
        bytes32 disputeId = disputes.openDispute(
            id,
            revision,
            objectiveGround,
            keccak256("cmp-1.5.10/objective-verifier-error")
        );

        vm.prank(BENEFICIARY);
        disputes.respond(disputeId, keccak256("cmp-1.5.10/provider-response"));
        _grantAdjudicator(ADJUDICATOR_A, id);
        vm.prank(ADJUDICATOR_A);
        disputes.decide(disputeId, false, keccak256("cmp-1.5.10/payer-wins"));
        ComputeDisputeResolution420.DisputeCase memory dc = disputes.caseOf(disputeId);
        vm.warp(uint256(dc.appealDeadline) + 1);
        disputes.finalize(disputeId);

        ComputeDisputeResolution420.VerificationReview memory review =
            disputes.verificationReview(disputeId);
        require(
            review.finalDisposition
                && review.adverseToOriginalVerification
                && !review.providerWins
                && review.verifier == verifier,
            "objective adverse dispute not finalized"
        );

        EscrowSlashEvidenceAdapter420 evidenceAdapter =
            new EscrowSlashEvidenceAdapter420();
        ComputeVerifierDisputeSlashRecipientResolver420 resolver =
            new ComputeVerifierDisputeSlashRecipientResolver420(
                address(disputes), address(evidenceAdapter)
            );

        require(
            resolver.canonicalEntitlements() == address(entitlements)
                && resolver.canonicalEntitlementsCodeHash() == address(entitlements).codehash,
            "resolver not bound to canonical escrow entitlements"
        );

        uint256 vaultBalanceBefore = address(vault).balance;
        VaultAccounting420.AssetAccounting memory accountingBefore =
            accounting.getAccounting(VAULT_ID, address(0));
        ComputeVerifiedEntitlement420.PayerRefund memory refundBefore =
            entitlements.payerRefund(id);

        IComputeSlashRecipientResolver420.Recipients memory recipients =
            resolver.resolve(
                bytes32(0),
                disputeId,
                address(evidenceAdapter),
                bytes32(0),
                verifier
            );

        VaultAccounting420.AssetAccounting memory accountingAfter =
            accounting.getAccounting(VAULT_ID, address(0));
        ComputeVerifiedEntitlement420.PayerRefund memory refundAfter =
            entitlements.payerRefund(id);

        require(recipients.harmedPayer == payerA, "canonical harmed payer not resolved");
        require(recipients.challenger == payerA, "canonical challenger not resolved");
        require(recipients.replacementWorker == address(0), "replacement worker invented");
        require(address(vault).balance == vaultBalanceBefore, "resolver debited payer escrow");
        require(
            accountingAfter.recordedBalance == accountingBefore.recordedBalance
                && accountingAfter.reserved == accountingBefore.reserved
                && accountingAfter.claimable == accountingBefore.claimable
                && accountingAfter.released == accountingBefore.released,
            "resolver mutated escrow accounting"
        );
        require(
            refundAfter.obligationId == refundBefore.obligationId
                && refundAfter.payer == refundBefore.payer
                && refundAfter.amount == refundBefore.amount
                && refundAfter.claimable == refundBefore.claimable
                && refundAfter.paid == refundBefore.paid,
            "slash recipient resolution rewrote payer refund state"
        );
    }

    function testPayerWinReallocatesOnlyContestedJobToFullOriginalPayerRefund() public {
        bytes32 id = _verifiedJob(29, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        bytes32 disputeId = _openPayerDispute(id, keccak256("payer-win"));

        vm.prank(BENEFICIARY);
        disputes.respond(disputeId, keccak256("provider-response"));
        _grantAdjudicator(ADJUDICATOR_A, id);
        vm.prank(ADJUDICATOR_A);
        disputes.decide(disputeId, false, keccak256("payer-wins"));
        ComputeDisputeResolution420.DisputeCase memory dc = disputes.caseOf(disputeId);
        vm.warp(uint256(dc.appealDeadline) + 1);
        disputes.finalize(disputeId);

        ComputeDisputeResolution420.VerificationReview memory adverseReview =
            disputes.verificationReview(disputeId);
        require(!adverseReview.holdActive && adverseReview.finalDisposition
            && !adverseReview.providerWins && adverseReview.adverseToOriginalVerification
            && adverseReview.resolutionRef != bytes32(0)
            && adverseReview.verificationRef != bytes32(0)
            && adverseReview.verifier == verifier,
            "payer-win finality did not expose bounded adverse verification disposition");

        ComputeVerifiedEntitlement420.PayerRefund memory refund = entitlements.payerRefund(id);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.FAILED
            && accounting.getObligation(pc.providerObligationId).state == 4
            && accounting.getObligation(pc.payerResidualObligationId).state == 4
            && refund.payer == payerA && refund.amount == 4 ether
            && accounting.getObligation(refund.obligationId).state == 1,
            "payer-win resolution did not preserve exact payer-backed liability");

        uint256 before = payerA.balance;
        uint64 payerWinRevision = jobs.job(id).revision;
        vm.prank(payerA);
        entitlements.claimPayerRefund(id, payerWinRevision);
        require(payerA.balance == before + 4 ether
            && jobs.job(id).status == ComputeJobRegistry420.Status.REFUNDED
            && address(vault).balance == 0,
            "payer-win refund did not transfer exact original payer balance");
    }

    function testAppealUsesDifferentIndependentAdjudicatorAndOverturnsUnreleasedDecision() public {
        bytes32 id = _verifiedJob(30, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        bytes32 disputeId = _openPayerDispute(id, keccak256("appeal"));

        vm.prank(BENEFICIARY);
        disputes.respond(disputeId, keccak256("provider-response"));
        _grantAdjudicator(ADJUDICATOR_A, id);
        _grantAdjudicator(ADJUDICATOR_B, id);
        vm.prank(ADJUDICATOR_A);
        disputes.decide(disputeId, false, keccak256("initial-payer-win"));

        vm.prank(BENEFICIARY);
        disputes.appeal(disputeId, keccak256("provider-appeal"));
        vm.prank(ADJUDICATOR_A);
        (bool sameOk,) = address(disputes).call(
            abi.encodeCall(disputes.decideAppeal,
                (disputeId, true, keccak256("same-adjudicator"))));
        require(!sameOk, "initial adjudicator decided own appeal");

        vm.prank(ADJUDICATOR_B);
        disputes.decideAppeal(disputeId, true, keccak256("appeal-provider-win"));

        ComputeDisputeResolution420.VerificationReview memory appealedReview =
            disputes.verificationReview(disputeId);
        require(appealedReview.holdActive && appealedReview.appealed
            && appealedReview.appealResolved
            && appealedReview.initialAdjudicator == ADJUDICATOR_A
            && appealedReview.appealAdjudicator == ADJUDICATOR_B
            && appealedReview.appealCommitment != bytes32(0)
            && appealedReview.appealDecisionCommitment != bytes32(0)
            && !appealedReview.finalDisposition,
            "appeal chronology not exposed while hold remains active");

        disputes.finalize(disputeId);
        ComputeDisputeResolution420.VerificationReview memory finalReview =
            disputes.verificationReview(disputeId);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED
            && accounting.getObligation(pc.providerObligationId).state == 1
            && disputes.providerReleaseAllowed(id)
            && !finalReview.holdActive && finalReview.finalDisposition
            && finalReview.providerWins && !finalReview.adverseToOriginalVerification,
            "appeal did not preserve final verifier-facing disposition");

        uint64 appealWinRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(id, appealWinRevision);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED
            && entitlements.totalProviderPaid() == 3 ether,
            "appeal-final provider entitlement did not settle once");
    }

    function testUnauthorizedOrInterestedAdjudicatorCannotResolveHeldCase() public {
        bytes32 id = _verifiedJob(31, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        bytes32 disputeId = _openPayerDispute(id, keccak256("bad-adjudicator"));
        vm.prank(BENEFICIARY);
        disputes.respond(disputeId, keccak256("response"));

        vm.prank(OUTSIDER);
        (bool outsiderOk,) = address(disputes).call(
            abi.encodeCall(disputes.decide,
                (disputeId, true, keccak256("unauthorized"))));
        require(!outsiderOk, "ungranted adjudicator resolved case");

        _grantAdjudicator(OPERATOR, id);
        vm.prank(OPERATOR);
        (bool interestedOk,) = address(disputes).call(
            abi.encodeCall(disputes.decide,
                (disputeId, true, keccak256("interested"))));
        require(!interestedOk && disputes.activeHold(id)
            && jobs.job(id).status == ComputeJobRegistry420.Status.DISPUTED
            && accounting.getObligation(pc.providerObligationId).state == 1,
            "provider-controlled adjudicator escaped independence gate");
    }

    function testExpiredChallengeCannotReopenAndUnchallengedClaimSettlesAfterWindow() public {
        bytes32 id = _verifiedJob(32, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        _makeClaimable(id);
        _matureProviderClaim(id);

        uint64 lateRevision = jobs.job(id).revision;
        vm.prank(payerA);
        (bool lateOk,) = address(disputes).call(
            abi.encodeCall(disputes.openDispute, (
                id, lateRevision, keccak256("late-ground"), keccak256("late-evidence")
            )));
        require(!lateOk && disputes.disputeForJob(id) == bytes32(0),
            "expired challenge opened a case");

        uint64 unchallengedRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(id, unchallengedRevision);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED,
            "unchallenged final claim did not settle");
    }

    function testDisputeTimeoutFailsClosedToPayerInsteadOfAutomaticProviderPayment() public {
        bytes32 id = _verifiedJob(33, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        bytes32 disputeId = _openPayerDispute(id, keccak256("timeout"));
        ComputeDisputeResolution420.DisputeCase memory dc = disputes.caseOf(disputeId);
        vm.warp(uint256(dc.decisionDeadline) + 1);
        disputes.timeout(disputeId);

        ComputeVerifiedEntitlement420.PayerRefund memory refund = entitlements.payerRefund(id);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.FAILED
            && !entitlements.providerClaim(id).paid
            && accounting.getObligation(pc.providerObligationId).state == 4
            && refund.payer == payerA && refund.amount == 4 ether
            && accounting.getObligation(refund.obligationId).state == 1,
            "timeout defaulted to provider or lost payer backing");
    }

    function testWithdrawnChallengeReleasesSamePendingProviderEntitlementWithoutDuplication() public {
        bytes32 id = _verifiedJob(34, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        bytes32 disputeId = _openPayerDispute(id, keccak256("withdraw"));
        vm.prank(payerA);
        disputes.withdraw(disputeId);

        require(jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED
            && disputes.providerReleaseAllowed(id)
            && accounting.getObligation(pc.providerObligationId).state == 1,
            "withdrawal did not release original held entitlement");
        uint64 withdrawnRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(id, withdrawnRevision);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED
            && entitlements.totalProviderPaid() == 3 ether,
            "withdrawn case duplicated or lost provider entitlement");
    }

    function testDisputeAndPayerWinRemainIsolatedAcrossTwoPayers() public {
        bytes32 first = _verifiedJob(35, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        bytes32 second = _verifiedJob(36, OWNER_B_KEY, PAYER_B_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory firstPc = _makeClaimable(first);
        ComputeVerifiedEntitlement420.ProviderClaim memory secondPc = _makeClaimable(second);
        bytes32 disputeId = _openPayerDispute(first, keccak256("two-payer"));

        vm.prank(BENEFICIARY);
        disputes.respond(disputeId, keccak256("response"));
        _grantAdjudicator(ADJUDICATOR_A, first);
        vm.prank(ADJUDICATOR_A);
        disputes.decide(disputeId, false, keccak256("payer-a-win"));
        ComputeDisputeResolution420.DisputeCase memory dc = disputes.caseOf(disputeId);
        vm.warp(uint256(dc.appealDeadline) + 1);
        disputes.finalize(disputeId);

        require(accounting.getObligation(firstPc.providerObligationId).state == 4
            && accounting.getObligation(secondPc.providerObligationId).state == 1
            && jobs.job(second).status == ComputeJobRegistry420.Status.VERIFIED
            && !disputes.activeHold(second)
            && address(vault).balance == 8 ether
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == 8 ether,
            "first payer dispute consumed or held second payer backing");
    }



    function testVerificationReviewHookPreservesOriginalVerdictThroughAppealAndFinalAdverseDisposition() public {
        bytes32 id = _verifiedJob(50, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        _makeClaimable(id);
        ComputeJobRegistry420.Job memory original = jobs.job(id);
        bytes32 groundsSalt = keccak256("verification-integrity");
        bytes32 grounds = keccak256(abi.encode("ground", groundsSalt));
        bytes32 disputeId = _openPayerDispute(id, groundsSalt);

        ComputeDisputeResolution420.VerificationReview memory opened =
            disputes.verificationReview(disputeId);
        require(
            opened.jobId == id
                && opened.verificationRef == original.verificationRef
                && opened.resultCommitment == original.resultCommitment
                && opened.verifier == original.verifier
                && opened.groundsCode == grounds
                && opened.holdActive
                && !opened.finalDisposition
                && !opened.adverseToOriginalVerification,
            "opened review lost original verifier decision"
        );

        (
            bytes32 heldDispute,
            bool held,
            bytes32 heldVerificationRef,
            address heldVerifier,
            bytes32 heldPolicyId,
            uint32 heldPolicyRevision,
            bytes32 heldPolicyCommitment
        ) = disputes.verificationHoldForJob(id);
        require(
            heldDispute == disputeId && held
                && heldVerificationRef == original.verificationRef
                && heldVerifier == original.verifier
                && heldPolicyId == original.verificationPolicyId
                && heldPolicyRevision == original.verificationPolicyRevision
                && heldPolicyCommitment == original.verificationPolicyCommitment,
            "job hold hook drifted from original verification"
        );

        vm.prank(BENEFICIARY);
        disputes.respond(disputeId, keccak256("provider-response"));
        _grantAdjudicator(ADJUDICATOR_A, id);
        _grantAdjudicator(ADJUDICATOR_B, id);

        vm.prank(ADJUDICATOR_A);
        disputes.decide(disputeId, true, keccak256("initial-provider-win"));
        vm.prank(payerA);
        disputes.appeal(disputeId, keccak256("payer-appeal"));

        ComputeDisputeResolution420.VerificationReview memory appealed =
            disputes.verificationReview(disputeId);
        require(
            appealed.status == ComputeDisputeResolution420.CaseStatus.APPEALED
                && appealed.appealed && !appealed.appealResolved
                && appealed.holdActive && !appealed.finalDisposition
                && appealed.initialAdjudicator == ADJUDICATOR_A
                && appealed.verificationRef == original.verificationRef,
            "appeal hook rewrote verdict or dropped hold"
        );

        vm.prank(ADJUDICATOR_B);
        disputes.decideAppeal(disputeId, false, keccak256("appeal-payer-win"));
        disputes.finalize(disputeId);

        ComputeDisputeResolution420.VerificationReview memory finalReview =
            disputes.verificationReview(disputeId);
        require(
            finalReview.status == ComputeDisputeResolution420.CaseStatus.FINAL
                && finalReview.finalDisposition
                && finalReview.adverseToOriginalVerification
                && !finalReview.providerWins
                && !finalReview.holdActive
                && finalReview.appealResolved
                && finalReview.appealAdjudicator == ADJUDICATOR_B
                && finalReview.resolutionRef != bytes32(0)
                && finalReview.verificationRef == original.verificationRef
                && finalReview.resultCommitment == original.resultCommitment
                && finalReview.verifier == original.verifier,
            "final verifier review disposition incorrect"
        );

        (, bool finalHold, bytes32 finalVerificationRef,,,,) =
            disputes.verificationHoldForJob(id);
        require(
            !finalHold && finalVerificationRef == original.verificationRef,
            "finality erased verifier provenance or retained hold"
        );
    }

    function testWithdrawnVerificationChallengeIsFinalButNotAdverseVerifierDisposition() public {
        bytes32 id = _verifiedJob(51, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        _makeClaimable(id);
        ComputeJobRegistry420.Job memory original = jobs.job(id);
        bytes32 disputeId = _openPayerDispute(id, keccak256("withdraw-verifier-review"));

        vm.prank(payerA);
        disputes.withdraw(disputeId);

        ComputeDisputeResolution420.VerificationReview memory review =
            disputes.verificationReview(disputeId);
        require(
            review.status == ComputeDisputeResolution420.CaseStatus.WITHDRAWN
                && review.finalDisposition
                && review.providerWins
                && !review.adverseToOriginalVerification
                && !review.holdActive
                && review.verificationRef == original.verificationRef
                && review.resultCommitment == original.resultCommitment,
            "withdrawn challenge fabricated adverse verifier disposition"
        );
    }

    function _assertNativeSolvent() private view {
        VaultAccounting420.AssetAccounting memory a =
            accounting.getAccounting(VAULT_ID, address(0));
        require(a.recordedBalance == address(vault).balance,
            "recorded/native balance mismatch");
        require(a.reserved + a.claimable <= a.recordedBalance,
            "encumbered liabilities exceed recorded balance");
    }

    function testHostileGrantsCannotExpandSealedCMPVaultAuthority() public {
        bytes32 id = _verifiedJob(40, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        bytes32 scope = vaultPolicy.scopeForVault(VAULT_ID);

        _grantVault(OUTSIDER, VaultIds420.ACTION_CREATE_OBLIGATION);
        _grantVault(OUTSIDER, VaultIds420.ACTION_RELEASE_OBLIGATION);
        _grantVault(OUTSIDER, VaultIds420.ACTION_CANCEL_OBLIGATION);
        _grantVault(OUTSIDER, VaultIds420.ACTION_WITHDRAW);
        _grantVault(OUTSIDER, VaultIds420.ACTION_CLAIM);
        caps.createGrant(keccak256(abi.encode("rogue-route", grantNonce++)), OUTSIDER,
            VaultIds420.COMPONENT_VAULT, VaultIds420.ACTION_WITHDRAW,
            vaultPolicy.scopeForRoute(VAULT_ID, address(0), OUTSIDER, VaultIds420.ACTION_WITHDRAW),
            0, 0, 0, 0, 0);

        require(caps.isAuthorized(OUTSIDER, VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, scope, 0),
            "hostile release grant not installed");

        vm.deal(OUTSIDER, 1 ether);
        vm.prank(OUTSIDER);
        vault.depositNative{value: 1 ether}();
        _assertNativeSolvent();

        vm.prank(OUTSIDER);
        (bool createOk,) = address(vault).call(abi.encodeCall(vault.createObligation, (
            keccak256("rogue-create"), keccak256("rogue-obligation"), address(0),
            OUTSIDER, 1 ether, keccak256("rogue"), id
        )));
        vm.prank(OUTSIDER);
        (bool releaseOk,) = address(vault).call(
            abi.encodeCall(vault.releaseObligation,
                (keccak256("rogue-release"), pc.providerObligationId)));
        vm.prank(OUTSIDER);
        (bool cancelOk,) = address(vault).call(
            abi.encodeCall(vault.cancelObligation,
                (keccak256("rogue-cancel"), pc.providerObligationId)));
        vm.prank(OUTSIDER);
        (bool withdrawOk,) = address(vault).call(
            abi.encodeCall(vault.withdraw,
                (keccak256("rogue-withdraw"), address(0), OUTSIDER, 1 ether)));

        require(!createOk && !releaseOk && !cancelOk && !withdrawOk,
            "sealed CMP policy admitted hostile grant expansion");
        require(accounting.getObligation(pc.providerObligationId).state == 1
            && accounting.freeBalance(VAULT_ID, address(0)) == 1 ether,
            "hostile grant mutated payer liability or donor surplus");
        _assertNativeSolvent();
    }

    function testDonorSurplusCannotBackOrIncreaseJobSpecificLiability() public {
        vm.deal(OUTSIDER, 5 ether);
        vm.prank(OUTSIDER);
        vault.depositNative{value: 5 ether}();
        require(accounting.freeBalance(VAULT_ID, address(0)) == 5 ether,
            "donor surplus not recorded as free");

        bytes32 id = _verifiedJob(41, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        bytes32 ref = _finalize(id, 3 ether);
        ComputeVerifiedEntitlement420.Entitlement memory e = entitlements.entitlement(ref);
        require(e.fundedAmount == 4 ether && e.earnedAmount == 3 ether
            && funding.credit(id).deposited == 4 ether,
            "donor surplus enlarged authenticated payer credit");
        uint64 donorClaimRevision = jobs.job(id).revision;
        vm.prank(SETTLER);
        entitlements.createProviderClaim(id, donorClaimRevision);
        require(accounting.freeBalance(VAULT_ID, address(0)) == 5 ether,
            "liability split consumed donor surplus");
        _assertNativeSolvent();
    }

    function testFrozenVaultBlocksPayoutWithoutMutatingHeldLiabilityThenRecovers() public {
        bytes32 id = _verifiedJob(42, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        _matureProviderClaim(id);

        _grantVault(address(this), VaultIds420.ACTION_FREEZE);
        _grantVault(address(this), VaultIds420.ACTION_UNFREEZE);
        vaultRegistry.setState(VAULT_ID, VaultRegistry420.VaultState.FROZEN);

        uint256 beforeVault = address(vault).balance;
        uint64 frozenRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        (bool frozenOk,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimProvider, (id, frozenRevision)));
        require(!frozenOk && !entitlements.providerClaim(id).paid
            && accounting.getObligation(pc.providerObligationId).state == 1
            && jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED
            && address(vault).balance == beforeVault,
            "frozen payout mutated held liability");

        vaultRegistry.setState(VAULT_ID, VaultRegistry420.VaultState.ACTIVE);
        uint64 unfrozenRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(id, unfrozenRevision);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED
            && accounting.getObligation(pc.providerObligationId).state == 3,
            "unfreeze did not restore lawful payout");
        _assertNativeSolvent();
    }

    function testWindingDownAllowsExistingSettlementButCannotCloseWithLiability() public {
        bytes32 id = _verifiedJob(43, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        _matureProviderClaim(id);

        _grantVault(address(this), VaultIds420.ACTION_BEGIN_WIND_DOWN);
        _grantVault(address(this), VaultIds420.ACTION_CLOSE);
        vaultRegistry.setState(VAULT_ID, VaultRegistry420.VaultState.WINDING_DOWN);

        (bool closeEarly,) = address(vaultRegistry).call(
            abi.encodeCall(vaultRegistry.setState,
                (VAULT_ID, VaultRegistry420.VaultState.CLOSED)));
        require(!closeEarly && accounting.getObligation(pc.providerObligationId).state == 1,
            "vault closed with pending CMP liability");

        uint64 windingRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(id, windingRevision);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED
            && accounting.getObligation(pc.providerObligationId).state == 3
            && vaultRegistry.vaultState(VAULT_ID) == VaultRegistry420.VaultState.WINDING_DOWN,
            "winding-down settlement failed or changed lifecycle");

        (bool closeResidual,) = address(vaultRegistry).call(
            abi.encodeCall(vaultRegistry.setState,
                (VAULT_ID, VaultRegistry420.VaultState.CLOSED)));
        require(!closeResidual,
            "vault closed while payer residual remained reserved");
        _assertNativeSolvent();
    }

    function testReentrantBeneficiaryCannotDoubleClaimOrReenterSettlement() public {
        ReentrantCMPBeneficiary420 attacker = new ReentrantCMPBeneficiary420();
        vm.prank(OPERATOR);
        providers.update(providerId, keccak256("provider-reentrant"),
            keccak256("security-reentrant"), address(attacker));
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        offerId = offers.publish(resourceId, PRICING_POLICY, 1, 3 ether,
            uint64(block.timestamp + 12 hours));

        bytes32 id = _verifiedJob(44, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        require(pc.beneficiary == address(attacker),
            "accepted beneficiary did not freeze callback contract");
        _matureProviderClaim(id);

        attacker.configure(vault, entitlements, id, pc.providerObligationId,
            jobs.job(id).revision);
        uint256 before = address(attacker).balance;
        attacker.claimProvider();

        require(attacker.attempted()
            && !attacker.reentrantVaultClaimSucceeded()
            && !attacker.reentrantSettlementSucceeded(),
            "reentrant callback escaped Vault or settlement lock");
        require(address(attacker).balance == before + 3 ether
            && entitlements.totalProviderPaid() == 3 ether
            && accounting.getObligation(pc.providerObligationId).state == 3
            && jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED,
            "outer payout was not exactly once");
        _assertNativeSolvent();
    }


    function testRejectedNativeProviderTransferRollsBackSettlementAndAccounting() public {
        RejectingCMPBeneficiary420 rejector = new RejectingCMPBeneficiary420();
        vm.prank(OPERATOR);
        providers.update(providerId, keccak256("provider-rejecting"),
            keccak256("security-rejecting"), address(rejector));
        vm.prank(GOV);
        providers.activate(providerId);
        vm.prank(OPERATOR);
        offerId = offers.publish(resourceId, PRICING_POLICY, 1, 3 ether,
            uint64(block.timestamp + 12 hours));

        bytes32 id = _verifiedJob(47, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        require(pc.beneficiary == address(rejector),
            "accepted beneficiary did not freeze rejecting contract");
        _matureProviderClaim(id);

        rejector.configure(entitlements, id, jobs.job(id).revision);
        uint256 beforeVault = address(vault).balance;
        VaultAccounting420.AssetAccounting memory beforeA =
            accounting.getAccounting(VAULT_ID, address(0));

        (bool ok,) = address(rejector).call(
            abi.encodeCall(rejector.claimProvider, ())
        );
        VaultAccounting420.AssetAccounting memory afterA =
            accounting.getAccounting(VAULT_ID, address(0));

        require(!ok && !entitlements.providerClaim(id).paid
            && jobs.job(id).status == ComputeJobRegistry420.Status.VERIFIED
            && accounting.getObligation(pc.providerObligationId).state == 1
            && address(vault).balance == beforeVault
            && afterA.recordedBalance == beforeA.recordedBalance
            && afterA.reserved == beforeA.reserved
            && afterA.claimable == beforeA.claimable
            && afterA.released == beforeA.released,
            "failed native transfer did not fully roll back settlement");
        _assertNativeSolvent();
    }

    function testTwoPayerMixedSettlementAndRefundRemainExactlySolvent() public {
        bytes32 paidJob = _verifiedJob(45, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        bytes32 refundJob = _acceptedJob(46, OWNER_B_KEY, PAYER_B_KEY, 4 ether);
        _makeClaimable(paidJob);
        _matureProviderClaim(paidJob);

        vm.prank(ownerB);
        jobs.recordCancellation(refundJob, 4);
        entitlements.createTerminalRefundClaim(refundJob);

        uint64 paidRevision = jobs.job(paidJob).revision;
        uint64 refundRevision = jobs.job(refundJob).revision;
        vm.prank(BENEFICIARY);
        entitlements.claimProvider(paidJob, paidRevision);
        vm.prank(payerB);
        entitlements.claimPayerRefund(refundJob, refundRevision);

        VaultAccounting420.AssetAccounting memory a =
            accounting.getAccounting(VAULT_ID, address(0));
        require(jobs.job(paidJob).status == ComputeJobRegistry420.Status.SETTLED
            && jobs.job(refundJob).status == ComputeJobRegistry420.Status.REFUNDED
            && address(vault).balance == 1 ether
            && a.recordedBalance == 1 ether && a.reserved == 1 ether
            && a.claimable == 0 && accounting.freeBalance(VAULT_ID, address(0)) == 0,
            "mixed payer terminal paths violated exact solvency");
        _assertNativeSolvent();
    }


    function testE2ERealFundedVerifiedSettledAndResidualRefundTranscript() public {
        uint256 providerBefore = BENEFICIARY.balance;
        uint256 payerBefore = payerA.balance;

        bytes32 id = _verifiedJob(50, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeJobRegistry420.Job memory verifiedJob = jobs.job(id);
        ComputeEscrowFunding420.Credit memory fundedCredit = funding.credit(id);
        VaultAccounting420.AssetAccounting memory verifiedAccounting =
            accounting.getAccounting(VAULT_ID, address(0));
        require(verifiedJob.status == ComputeJobRegistry420.Status.VERIFIED
            && verifiedJob.matchId != bytes32(0)
            && verifiedJob.assignmentRef != bytes32(0)
            && verifiedJob.resultCommitment != bytes32(0)
            && verifiedJob.verificationRef != bytes32(0)
            && fundedCredit.payer == payerA
            && fundedCredit.deposited == 4 ether
            && address(vault).balance == 4 ether
            && verifiedAccounting.recordedBalance == 4 ether
            && verifiedAccounting.reserved == 4 ether
            && verifiedAccounting.claimable == 0,
            "e2e success path did not reach backed VERIFIED state");

        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        require(accounting.getObligation(pc.providerObligationId).state == 1
            && accounting.getObligation(pc.payerResidualObligationId).state == 1
            && accounting.getObligation(pc.providerObligationId).beneficiary == BENEFICIARY
            && accounting.getObligation(pc.payerResidualObligationId).beneficiary == payerA,
            "e2e success path did not freeze provider and payer liabilities");

        _matureProviderClaim(id);
        uint64 providerRevision = jobs.job(id).revision;
        vm.prank(BENEFICIARY);
        bytes32 payoutRef = entitlements.claimProvider(id, providerRevision);
        require(payoutRef != bytes32(0)
            && jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED
            && accounting.getObligation(pc.providerObligationId).state == 3
            && accounting.getObligation(pc.payerResidualObligationId).state == 1
            && BENEFICIARY.balance == providerBefore + 3 ether
            && address(vault).balance == 1 ether,
            "e2e provider payout transcript incorrect");

        entitlements.createSettledResidualRefundClaim(id);
        uint64 residualRevision = jobs.job(id).revision;
        vm.prank(payerA);
        bytes32 residualPayout = entitlements.claimPayerRefund(id, residualRevision);
        VaultAccounting420.AssetAccounting memory finalAccounting =
            accounting.getAccounting(VAULT_ID, address(0));
        require(residualPayout != bytes32(0)
            && jobs.job(id).status == ComputeJobRegistry420.Status.SETTLED
            && accounting.getObligation(pc.payerResidualObligationId).state == 3
            && payerA.balance == payerBefore - 4 ether + 1 ether
            && address(vault).balance == 0
            && finalAccounting.recordedBalance == 0
            && finalAccounting.reserved == 0
            && finalAccounting.claimable == 0
            && entitlements.totalProviderPaid() == 3 ether
            && entitlements.totalPayerRefundPaid() == 1 ether,
            "e2e residual refund did not close exact liabilities");

        vm.prank(BENEFICIARY);
        (bool providerReplay,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimProvider, (id, providerRevision)));
        vm.prank(payerA);
        (bool refundReplay,) = address(entitlements).call(
            abi.encodeCall(entitlements.claimPayerRefund, (id, residualRevision)));
        require(!providerReplay && !refundReplay && address(vault).balance == 0,
            "e2e terminal payout replay changed custody");
    }

    function testE2ERealNegativeVerificationToFullOriginalPayerRefundTranscript() public {
        uint256 payerBefore = payerA.balance;
        (bytes32 id, bytes32 receipt) =
            _resultJob(51, OWNER_A_KEY, PAYER_A_KEY, 4 ether, 195);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.RESULT_COMMITTED
            && address(vault).balance == 4 ether
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == 4 ether,
            "e2e failure path not fully funded before verification");

        _verify(id, receipt, 51, 195, false);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.FAILED
            && entitlements.entitlementForJob(id) == bytes32(0)
            && entitlements.totalProviderPaid() == 0,
            "negative verification created economic success");

        entitlements.createTerminalRefundClaim(id);
        ComputeVerifiedEntitlement420.PayerRefund memory pr = entitlements.payerRefund(id);
        require(pr.payer == payerA && pr.amount == 4 ether
            && accounting.getObligation(pr.obligationId).state == 1,
            "failed job did not preserve original-payer refund liability");

        uint64 revision = jobs.job(id).revision;
        vm.prank(payerA);
        bytes32 refundPayout = entitlements.claimPayerRefund(id, revision);
        VaultAccounting420.AssetAccounting memory a =
            accounting.getAccounting(VAULT_ID, address(0));
        require(refundPayout != bytes32(0)
            && jobs.job(id).status == ComputeJobRegistry420.Status.REFUNDED
            && payerA.balance == payerBefore
            && accounting.getObligation(pr.obligationId).state == 3
            && address(vault).balance == 0
            && a.recordedBalance == 0 && a.reserved == 0 && a.claimable == 0
            && entitlements.totalProviderPaid() == 0
            && entitlements.totalPayerRefundPaid() == 4 ether,
            "e2e failed-verification refund transcript incorrect");
    }

    function testE2ERealAcceptedCancellationToOriginalPayerRefundTranscript() public {
        uint256 payerBefore = payerA.balance;
        bytes32 id = _acceptedJob(52, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeJobRegistry420.Job memory accepted = jobs.job(id);
        require(accepted.status == ComputeJobRegistry420.Status.ACCEPTED
            && accepted.assignmentRef == bytes32(0)
            && accepted.resultCommitment == bytes32(0)
            && accepted.verificationRef == bytes32(0)
            && address(vault).balance == 4 ether
            && accounting.getAccounting(VAULT_ID, address(0)).reserved == 4 ether,
            "e2e cancellation fixture already crossed execution boundary");

        vm.prank(ownerA);
        jobs.recordCancellation(id, accepted.revision);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.CANCELLED,
            "requester cancellation not recorded");

        entitlements.createTerminalRefundClaim(id);
        ComputeVerifiedEntitlement420.PayerRefund memory pr = entitlements.payerRefund(id);
        uint64 refundRevision = jobs.job(id).revision;
        vm.prank(payerA);
        entitlements.claimPayerRefund(id, refundRevision);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.REFUNDED
            && payerA.balance == payerBefore
            && accounting.getObligation(pr.obligationId).state == 3
            && address(vault).balance == 0
            && accounting.getAccounting(VAULT_ID, address(0)).recordedBalance == 0,
            "e2e cancelled job did not refund exact original payer");

        uint64 terminalRevision = jobs.job(id).revision;
        vm.prank(ownerA);
        (bool reopen,) = address(jobs).call(
            abi.encodeCall(jobs.recordFunding, (id, terminalRevision, id)));
        require(!reopen && jobs.job(id).status == ComputeJobRegistry420.Status.REFUNDED,
            "e2e terminal cancellation/refund reopened");
    }

    function testE2ERealDisputedProviderClaimPayerWinAndRefundTranscript() public {
        uint256 payerBefore = payerA.balance;
        bytes32 id = _verifiedJob(53, OWNER_A_KEY, PAYER_A_KEY, 4 ether);
        ComputeVerifiedEntitlement420.ProviderClaim memory pc = _makeClaimable(id);
        bytes32 disputeId = _openPayerDispute(id, keccak256("e2e-payer-win"));
        require(jobs.job(id).status == ComputeJobRegistry420.Status.DISPUTED
            && disputes.activeHold(id)
            && accounting.getObligation(pc.providerObligationId).state == 1,
            "e2e dispute did not hold provider liability");

        vm.prank(BENEFICIARY);
        disputes.respond(disputeId, keccak256("e2e-provider-response"));
        _grantAdjudicator(ADJUDICATOR_A, id);
        vm.prank(ADJUDICATOR_A);
        disputes.decide(disputeId, false, keccak256("e2e-payer-decision"));
        ComputeDisputeResolution420.DisputeCase memory dc = disputes.caseOf(disputeId);
        vm.warp(uint256(dc.appealDeadline) + 1);
        disputes.finalize(disputeId);

        ComputeVerifiedEntitlement420.PayerRefund memory pr = entitlements.payerRefund(id);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.FAILED
            && accounting.getObligation(pc.providerObligationId).state == 4
            && accounting.getObligation(pc.payerResidualObligationId).state == 4
            && pr.payer == payerA && pr.amount == 4 ether
            && accounting.getObligation(pr.obligationId).state == 1
            && entitlements.totalProviderPaid() == 0,
            "e2e payer-win dispute did not reallocate exact liability");

        uint64 refundRevision = jobs.job(id).revision;
        vm.prank(payerA);
        entitlements.claimPayerRefund(id, refundRevision);
        require(jobs.job(id).status == ComputeJobRegistry420.Status.REFUNDED
            && payerA.balance == payerBefore
            && accounting.getObligation(pr.obligationId).state == 3
            && address(vault).balance == 0
            && accounting.getAccounting(VAULT_ID, address(0)).recordedBalance == 0
            && entitlements.totalPayerRefundPaid() == 4 ether,
            "e2e dispute refund did not finish exact payer path");
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
