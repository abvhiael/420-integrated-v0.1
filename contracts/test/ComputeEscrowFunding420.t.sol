// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeEscrowFunding420.sol";
import "../src/compute/ComputeJobPayerCustody420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultIds420.sol";
import "./Vault420.t.sol";

interface VmEscrowFunding420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address account, uint256 balance) external;
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

contract EscrowFundingDeny420 is IComputeJobMatchEvidence420, IComputeJobWorkerEvidence420,
    IComputeJobVerificationEvidence420, IComputeJobSettlementEvidence420 {
    function matched(bytes32, bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function accepted(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function authorizedAssignment(bytes32, bytes32, address, bytes32) external pure returns (bool) { return false; }
    function committedResult(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function verified(bytes32, bytes32, address, bytes32, bool) external pure returns (bool) { return false; }
    function settled(bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract ComputeEscrowFunding420Test {
    VmEscrowFunding420 private constant vm = VmEscrowFunding420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant OWNER_A_KEY = 0xA11CE;
    uint256 private constant PAYER_A_KEY = 0xBEEF;
    uint256 private constant OWNER_B_KEY = 0xA11CF;
    uint256 private constant PAYER_B_KEY = 0xCAFE;
    uint256 private constant ATTACKER_KEY = 0xBAD;
    bytes32 private constant VAULT_ID = keccak256("cmp/vault/funding/1");
    bytes32 private constant AUTH_POLICY = keccak256("cmp/vault/policy/auth");
    bytes32 private constant ASSET_POLICY = keccak256("cmp/vault/policy/asset");
    bytes32 private constant RELEASE_POLICY = keccak256("cmp/vault/policy/release");
    bytes32 private constant ACCOUNTING_POLICY = keccak256("cmp/vault/policy/accounting");

    MockCapabilityRegistryVault420 private caps;
    VaultAuthorization420 private auth;
    VaultPolicyRegistry420 private policies;
    VaultRegistry420 private registry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;
    ComputeJobSignedRequestAuthority420 private requests;
    ComputeEscrowFunding420 private funding;
    ComputeJobRegistry420 private jobs;
    address private ownerA;
    address private payerA;
    address private ownerB;
    address private payerB;
    address private attacker;

    function setUp() public {
        ownerA = vm.addr(OWNER_A_KEY);
        payerA = vm.addr(PAYER_A_KEY);
        ownerB = vm.addr(OWNER_B_KEY);
        payerB = vm.addr(PAYER_B_KEY);
        attacker = vm.addr(ATTACKER_KEY);
        vm.deal(payerA, 100 ether);
        vm.deal(payerB, 100 ether);
        vm.deal(attacker, 100 ether);
        caps = new MockCapabilityRegistryVault420();
        auth = new VaultAuthorization420(address(caps));
        policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth), address(policies));
        accounting = new VaultAccounting420(address(registry));
        policies.setPolicy(AUTH_POLICY, VaultIds420.POLICY_AUTHORIZATION, keccak256("auth-v1"), bytes32(0), true);
        policies.setPolicy(ASSET_POLICY, VaultIds420.POLICY_ASSET, keccak256("native-v1"), bytes32(0), true);
        policies.setPolicy(RELEASE_POLICY, VaultIds420.POLICY_RELEASE, keccak256("release-v1"), bytes32(0), true);
        policies.setPolicy(ACCOUNTING_POLICY, VaultIds420.POLICY_ACCOUNTING, keccak256("accounting-v1"), bytes32(0), true);
        vault = new AssetVault420(VAULT_ID, address(registry), address(auth), address(accounting), address(this));
        registry.registerVault(VAULT_ID, address(vault), VaultIds420.VAULT_ESCROW,
            AUTH_POLICY, ASSET_POLICY, RELEASE_POLICY, ACCOUNTING_POLICY, bytes32(0), bytes32(0), bytes32(0));
        requests = new ComputeJobSignedRequestAuthority420();
        funding = new ComputeEscrowFunding420(address(requests), address(vault));
        EscrowFundingDeny420 denied = new EscrowFundingDeny420();
        jobs = new ComputeJobRegistry420(address(requests), address(funding), address(denied),
            address(denied), address(denied), address(denied));
        funding.bindJobs(address(jobs));
        caps.setAllowed(address(funding), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION, auth.scopeForVault(VAULT_ID), true);
    }

    function _signature(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _job(uint256 nonce, uint256 maximum, uint256 ownerKey, uint256 payerKey)
        private returns (bytes32 jobId) {
        address owner = vm.addr(ownerKey);
        address payer = vm.addr(payerKey);
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({
                owner: owner, payer: payer, manifestHash: keccak256("manifest"),
                workloadType: keccak256("gpu"), inputCommitment: keccak256("inputs"),
                outputSchemaCommitment: keccak256("output"),
                deadline: uint64(block.timestamp + 1 days),
                authorizationExpiry: uint64(block.timestamp + 2 days),
                maxSpend: maximum, nonce: nonce
            });
        bytes32 digest = requests.authorizationDigest(a);
        bytes memory ownerSignature = _signature(ownerKey, digest);
        bytes memory payerSignature = _signature(payerKey, digest);
        vm.prank(owner);
        bytes32 requestId = requests.registerSignedRequest(a, ownerSignature, payerSignature);
        vm.prank(owner);
        jobId = jobs.createJob(requestId, requestId, a.manifestHash, a.workloadType,
            a.inputCommitment, a.outputSchemaCommitment, a.deadline);
    }

    function _fund(bytes32 jobId, address payer, uint256 amount) private {
        vm.prank(payer);
        bytes32 ref = funding.fund{value: amount}(jobId);
        require(ref == jobId, "wrong funding ref");
    }

    function testTwoPayersReceiveDistinctRealVaultBackedSafetyObligations() public {
        bytes32 first = _job(1, 10 ether, OWNER_A_KEY, PAYER_A_KEY);
        bytes32 second = _job(2, 12 ether, OWNER_B_KEY, PAYER_B_KEY);
        uint256 beforeA = payerA.balance;
        uint256 beforeB = payerB.balance;
        _fund(first, payerA, 3 ether);
        _fund(second, payerB, 5 ether);
        ComputeEscrowFunding420.Credit memory ca = funding.credit(first);
        ComputeEscrowFunding420.Credit memory cb = funding.credit(second);
        VaultAccounting420.Obligation memory oa = accounting.getObligation(ca.obligationId);
        VaultAccounting420.Obligation memory ob = accounting.getObligation(cb.obligationId);
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));
        require(ca.payer == payerA && cb.payer == payerB && ca.owner == ownerA && cb.owner == ownerB,
            "wrong payer or owner");
        require(ca.obligationId != cb.obligationId && oa.beneficiary == payerA && ob.beneficiary == payerB
            && oa.state == 1 && ob.state == 1 && oa.amount == 3 ether && ob.amount == 5 ether,
            "separate payer safety obligations missing");
        require(payerA.balance == beforeA - 3 ether && payerB.balance == beforeB - 5 ether,
            "payer transfer not real");
        require(address(vault).balance == 8 ether && address(funding).balance == 0
            && a.recordedBalance == 8 ether && a.reserved == 8 ether && a.claimable == 0
            && accounting.freeBalance(VAULT_ID, address(0)) == 0 && funding.totalFunded() == 8 ether,
            "Vault backing or segregation incorrect");
        require(funding.funded(first, ownerA, first) && funding.funded(second, ownerB, second)
            && !funding.funded(first, ownerB, first) && !funding.funded(second, ownerB, first),
            "cross-owner or cross-job funding admitted");
        vm.prank(ownerA);
        jobs.recordFunding(first, 1, first);
        vm.prank(ownerB);
        jobs.recordFunding(second, 1, second);
        require(jobs.job(first).status == ComputeJobRegistry420.Status.FUNDED
            && jobs.job(second).status == ComputeJobRegistry420.Status.FUNDED,
            "registry funding proof did not bind");
    }

    function testWrongPayerOverCapZeroAndDuplicateFundingRevertWithoutVaultMutation() public {
        bytes32 id = _job(3, 4 ether, OWNER_A_KEY, PAYER_A_KEY);
        vm.prank(attacker);
        (bool ok,) = address(funding).call{value: 1 ether}(abi.encodeCall(funding.fund, (id)));
        require(!ok && address(vault).balance == 0, "wrong payer funded job");
        vm.prank(payerA);
        (ok,) = address(funding).call(abi.encodeCall(funding.fund, (id)));
        require(!ok && address(vault).balance == 0, "zero funding accepted");
        vm.prank(payerA);
        (ok,) = address(funding).call{value: 4 ether + 1}(abi.encodeCall(funding.fund, (id)));
        require(!ok && address(vault).balance == 0, "over-cap funds retained");
        _fund(id, payerA, 4 ether);
        vm.prank(payerA);
        (ok,) = address(funding).call{value: 1 ether}(abi.encodeCall(funding.fund, (id)));
        require(!ok && address(vault).balance == 4 ether && funding.totalFunded() == 4 ether,
            "duplicate reservation charged payer");
    }

    function testWithoutScopedVaultCreatePermissionFundingRevertsAtomically() public {
        bytes32 id = _job(4, 3 ether, OWNER_A_KEY, PAYER_A_KEY);
        caps.setAllowed(address(funding), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION, auth.scopeForVault(VAULT_ID), false);
        uint256 before = payerA.balance;
        vm.prank(payerA);
        (bool ok,) = address(funding).call{value: 2 ether}(abi.encodeCall(funding.fund, (id)));
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));
        require(!ok && payerA.balance == before && address(vault).balance == 0
            && a.recordedBalance == 0 && a.reserved == 0 && funding.totalFunded() == 0,
            "failed safety obligation stranded funds");
    }

    function testOutsiderCannotReleaseCancelClaimOrWithdrawPayerSafetyDeposit() public {
        bytes32 id = _job(5, 3 ether, OWNER_A_KEY, PAYER_A_KEY);
        _fund(id, payerA, 2 ether);
        bytes32 obligationId = funding.credit(id).obligationId;
        vm.prank(attacker);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.releaseObligation, (keccak256("release"), obligationId)));
        require(!ok, "outsider released safety deposit");
        vm.prank(attacker);
        (ok,) = address(vault).call(abi.encodeCall(vault.cancelObligation, (keccak256("cancel"), obligationId)));
        require(!ok, "outsider cancelled safety deposit");
        vm.prank(payerA);
        (ok,) = address(vault).call(abi.encodeCall(vault.claim, (keccak256("claim"), obligationId)));
        require(!ok, "payer prematurely claimed pending safety deposit");
        vm.prank(attacker);
        (ok,) = address(vault).call(abi.encodeCall(vault.withdraw, (keccak256("withdraw"), address(0), attacker, 1 ether)));
        require(!ok && address(vault).balance == 2 ether
            && accounting.getObligation(obligationId).state == 1,
            "funding became externally spendable");
    }

    function testExpiredUnboundAndWrongFundingReferenceFailClosed() public {
        bytes32 id = _job(6, 3 ether, OWNER_A_KEY, PAYER_A_KEY);
        require(!funding.funded(id, ownerA, id), "unfunded job recognized");
        vm.warp(uint256(jobs.job(id).deadline) + 1);
        vm.prank(payerA);
        (bool ok,) = address(funding).call{value: 1 ether}(abi.encodeCall(funding.fund, (id)));
        require(!ok && address(vault).balance == 0, "expired job funded");
        ComputeEscrowFunding420 unbound = new ComputeEscrowFunding420(address(requests), address(vault));
        vm.prank(payerA);
        (ok,) = address(unbound).call{value: 1 ether}(abi.encodeCall(unbound.fund, (id)));
        require(!ok && address(unbound).balance == 0, "unbound adapter accepted funds");
    }

    function testRefundInvalidatesFundingEvidenceAndReplayFailsClosed() public {
        bytes32 id = _job(7, 5 ether, OWNER_A_KEY, PAYER_A_KEY);
        _fund(id, payerA, 3 ether);
        require(funding.funded(id, ownerA, id), "funding evidence missing before refund");

        caps.setAllowed(address(funding), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, auth.scopeForVault(VAULT_ID), true);
        vm.warp(uint256(jobs.job(id).deadline) + 1);

        bytes32 obligationId = funding.refundExpiredUnmatched(id);
        require(obligationId == funding.credit(id).obligationId, "wrong refunded obligation");
        require(!funding.funded(id, ownerA, id), "refunded credit remained fundable");
        require(funding.totalFunded() == 0, "refunded credit remained reserved aggregate");

        (bool ok,) = address(funding).call(abi.encodeCall(funding.refundExpiredUnmatched, (id)));
        require(!ok, "refund replay accepted");

        VaultAccounting420.Obligation memory o = accounting.getObligation(obligationId);
        require(o.state == 2 && o.beneficiary == payerA && o.amount == 3 ether,
            "refund did not preserve exact payer claim");
    }

    function testWrongOwnerJobAndFundingReferenceCannotReuseCredit() public {
        bytes32 first = _job(8, 6 ether, OWNER_A_KEY, PAYER_A_KEY);
        bytes32 second = _job(9, 6 ether, OWNER_B_KEY, PAYER_B_KEY);
        _fund(first, payerA, 2 ether);

        require(funding.funded(first, ownerA, first), "canonical funding proof missing");
        require(!funding.funded(first, ownerB, first), "wrong owner reused funding proof");
        require(!funding.funded(second, ownerB, first), "cross-job funding proof reused");
        require(!funding.funded(first, ownerA, second), "wrong funding reference accepted");
        require(!funding.funded(first, ownerA, bytes32(0)), "zero funding reference accepted");

        vm.prank(ownerB);
        (bool ok,) = address(jobs).call(abi.encodeCall(jobs.recordFunding, (second, uint64(1), first)));
        require(!ok && jobs.job(second).status == ComputeJobRegistry420.Status.CREATED,
            "registry accepted foreign funding proof");
    }

    function testUnsolicitedVaultSurplusCannotFabricateJobCredit() public {
        bytes32 id = _job(10, 4 ether, OWNER_A_KEY, PAYER_A_KEY);
        vm.prank(attacker);
        vault.depositNative{value: 7 ether}();

        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));
        require(address(vault).balance == 7 ether && a.recordedBalance == 7 ether
            && a.reserved == 0 && accounting.freeBalance(VAULT_ID, address(0)) == 7 ether,
            "donor surplus fixture invalid");
        require(funding.totalFunded() == 0 && !funding.funded(id, ownerA, id),
            "unattributed Vault surplus fabricated payer credit");

        vm.prank(ownerA);
        (bool ok,) = address(jobs).call(abi.encodeCall(jobs.recordFunding, (id, uint64(1), id)));
        require(!ok && jobs.job(id).status == ComputeJobRegistry420.Status.CREATED,
            "registry admitted donor balance as funding evidence");
    }

    function testLegacyCustodyBalanceIsNeverImportedAsVaultFunding() public {
        bytes32 id = _job(11, 4 ether, OWNER_A_KEY, PAYER_A_KEY);
        ComputeJobPayerCustody420 legacy = new ComputeJobPayerCustody420(address(requests));
        vm.deal(address(legacy), 9 ether);

        require(address(legacy).balance == 9 ether, "legacy balance fixture missing");
        require(address(vault).balance == 0 && funding.totalFunded() == 0,
            "legacy custody balance migrated into CMP Vault");
        ComputeEscrowFunding420.Credit memory cr = funding.credit(id);
        require(!cr.exists && !funding.funded(id, ownerA, id),
            "legacy custody balance fabricated current credit");
    }

}
