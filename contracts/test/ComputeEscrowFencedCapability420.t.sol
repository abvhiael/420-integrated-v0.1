// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/CMPVaultAuthorization420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultIds420.sol";
import "./ComputeEscrowFunding420.t.sol";

interface VmFencedCMP420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address account, uint256 amount) external;
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

/// @notice Real capability registry, sealed CMP authorization, real Vault and signed payer exits.
contract ComputeEscrowFencedCapability420Test {
    VmFencedCMP420 private constant vm = VmFencedCMP420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant ID = keccak256("cmp/dedicated/vault/authorization/v1");
    uint256 private constant OWNER_A = 0xA11CE;
    uint256 private constant PAYER_A = 0xBEEF;
    uint256 private constant OWNER_B = 0xA11CF;
    uint256 private constant PAYER_B = 0xCAFE;
    CapabilityRegistry420 private caps;
    CMPVaultAuthorization420 private policy;
    VaultRegistry420 private registry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;
    ComputeJobSignedRequestAuthority420 private requests;
    ComputeEscrowFunding420 private funding;
    ComputeJobRegistry420 private jobs;
    address private payerA;
    address private payerB;
    address private rogue;
    uint256 private nextGrantNonce;

    function setUp() public {
        payerA = vm.addr(PAYER_A);
        payerB = vm.addr(PAYER_B);
        rogue = vm.addr(0xBAD);
        vm.deal(payerA, 12 ether);
        vm.deal(payerB, 12 ether);
        vm.deal(rogue, 12 ether);
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        policy = new CMPVaultAuthorization420(address(caps), ID);
        VaultPolicyRegistry420 policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(policy), address(policies));
        accounting = new VaultAccounting420(address(registry));
        policies.setPolicy(keccak256("auth"), VaultIds420.POLICY_AUTHORIZATION, keccak256("cmp-restricted-auth"), bytes32(0), true);
        policies.setPolicy(keccak256("asset"), VaultIds420.POLICY_ASSET, keccak256("native-only-v1"), bytes32(0), true);
        policies.setPolicy(keccak256("release"), VaultIds420.POLICY_RELEASE, keccak256("payer-exit-only"), bytes32(0), true);
        policies.setPolicy(keccak256("account"), VaultIds420.POLICY_ACCOUNTING, keccak256("vault-accounting-v1"), bytes32(0), true);
        vault = new AssetVault420(ID, address(registry), address(policy), address(accounting), address(this));
        registry.registerVault(ID, address(vault), VaultIds420.VAULT_ESCROW,
            keccak256("auth"), keccak256("asset"), keccak256("release"), keccak256("account"),
            bytes32(0), bytes32(0), bytes32(0));
        requests = new ComputeJobSignedRequestAuthority420();
        funding = new ComputeEscrowFunding420(address(requests), address(vault));
        EscrowFundingDeny420 denied = new EscrowFundingDeny420();
        jobs = new ComputeJobRegistry420(address(requests), address(funding), address(denied),
            address(denied), address(denied), address(denied));
        funding.bindJobs(address(jobs));
        policy.bindVault(address(vault));
        policy.bindFunding(address(funding));
        _grant(address(funding), VaultIds420.ACTION_CREATE_OBLIGATION);
        _grant(address(funding), VaultIds420.ACTION_RELEASE_OBLIGATION);
        policy.seal();
    }

    function _grant(address principal, bytes32 action) private {
        // A revoked grant ID remains permanently consumed in the real CapabilityRegistry420.
        // Re-authorizing the same principal/action must use a fresh globally unique ID.
        caps.createGrant(keccak256(abi.encode("fenced-grant", principal, action, nextGrantNonce++)), principal,
            VaultIds420.COMPONENT_VAULT, action, policy.scopeForVault(ID), 0, 0, 0, 0, 0);
    }

    function _job(uint256 nonce, uint256 ownerKey, uint256 payerKey) private returns (bytes32 id) {
        address owner = vm.addr(ownerKey);
        address payer = vm.addr(payerKey);
        ComputeJobSignedRequestAuthority420.Authorization memory a = ComputeJobSignedRequestAuthority420.Authorization({
            owner: owner, payer: payer, manifestHash: keccak256("manifest"),
            workloadType: keccak256("gpu"), inputCommitment: keccak256("input"),
            outputSchemaCommitment: keccak256("output"), deadline: uint64(block.timestamp + 1 days),
            authorizationExpiry: uint64(block.timestamp + 2 days), maxSpend: 5 ether, nonce: nonce
        });
        bytes32 digest = requests.authorizationDigest(a);
        (uint8 ov, bytes32 or_, bytes32 os) = vm.sign(ownerKey, digest);
        (uint8 pv, bytes32 pr, bytes32 ps) = vm.sign(payerKey, digest);
        vm.prank(owner);
        bytes32 requestId = requests.registerSignedRequest(a,
            abi.encodePacked(or_, os, ov), abi.encodePacked(pr, ps, pv));
        vm.prank(owner);
        id = jobs.createJob(requestId, requestId, a.manifestHash, a.workloadType,
            a.inputCommitment, a.outputSchemaCommitment, a.deadline);
    }

    function _fundPair() private returns (bytes32 a, bytes32 b) {
        a = _job(1, OWNER_A, PAYER_A);
        b = _job(2, OWNER_B, PAYER_B);
        vm.prank(payerA);
        funding.fund{value: 2 ether}(a);
        vm.prank(payerB);
        funding.fund{value: 3 ether}(b);
    }

    function _tryRogueSpend(bytes32 safety) private {
        vm.prank(rogue);
        (bool created,) = address(vault).call(abi.encodeCall(vault.createObligation,
            (keccak256("rogue-create"), keccak256("rogue-credit"), address(0), rogue,
                1, keccak256("rogue"), keccak256("rogue"))));
        vm.prank(rogue);
        (bool released,) = address(vault).call(abi.encodeCall(vault.releaseObligation,
            (keccak256("rogue-release"), safety)));
        vm.prank(rogue);
        (bool cancelled,) = address(vault).call(abi.encodeCall(vault.cancelObligation,
            (keccak256("rogue-cancel"), safety)));
        vm.prank(rogue);
        (bool withdrawn,) = address(vault).call(abi.encodeCall(vault.withdraw,
            (keccak256("rogue-withdraw"), address(0), rogue, 1)));
        require(!created && !released && !cancelled && !withdrawn, "rogue Vault grant bypassed policy");
    }

    function testSealedPolicyRejectsCompetingGrantsAndConservesTwoPayers() public {
        (bytes32 a, bytes32 b) = _fundPair();
        bytes32 first = funding.credit(a).obligationId;
        bytes32 second = funding.credit(b).obligationId;
        _grant(rogue, VaultIds420.ACTION_CREATE_OBLIGATION);
        _grant(rogue, VaultIds420.ACTION_RELEASE_OBLIGATION);
        _grant(rogue, VaultIds420.ACTION_CANCEL_OBLIGATION);
        _grant(rogue, VaultIds420.ACTION_WITHDRAW);
        require(caps.isAuthorized(rogue, VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, policy.scopeForVault(ID), 0),
            "hostile shared grant not active");
        _tryRogueSpend(first);
        _tryRogueSpend(second);
        require(policy.configurationSealed() && address(vault.authorization()) == address(policy)
            && policy.boundVault() == address(vault) && policy.fundingAdapter() == address(funding),
            "policy topology not sealed");
        require(accounting.getObligation(first).state == 1
            && accounting.getObligation(second).state == 1
            && accounting.freeBalance(ID, address(0)) == 0
            && accounting.getAccounting(ID, address(0)).reserved == 5 ether
            && address(vault).balance == 5 ether
            && funding.funded(a, vm.addr(OWNER_A), a)
            && funding.funded(b, vm.addr(OWNER_B), b), "payer backing changed under hostile grant");
    }

    function testRegistrarRotationAndOtherVaultScopeCannotOverrideSealedPolicy() public {
        (bytes32 a,) = _fundPair();
        bytes32 safety = funding.credit(a).obligationId;
        caps.updateProtocolComponentAuthority(VaultIds420.COMPONENT_VAULT, rogue);
        caps.transferComponentRegistrar(rogue);
        // Compute the scope before vm.prank: an external view call in the arguments would
        // otherwise consume the one-shot prank before the actual createGrant call.
        bytes32 scope = policy.scopeForVault(ID);
        vm.prank(rogue);
        caps.createGrant(keccak256("rotated-grant"), rogue, VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, scope, 0, 0, 0, 0, 0);
        _tryRogueSpend(safety);
        require(accounting.getObligation(safety).state == 1, "rotated registrar spent payer deposit");
        require(!policy.isAuthorized(rogue, keccak256("other-vault"),
            VaultIds420.ACTION_RELEASE_OBLIGATION, 0), "other-vault authorization passed");
    }

    function testExpiredUnmatchedRefundIsExactClaimableThenPaidToOriginalPayer() public {
        (bytes32 a, bytes32 b) = _fundPair();
        bytes32 first = funding.credit(a).obligationId;
        bytes32 second = funding.credit(b).obligationId;
        vm.prank(rogue);
        (bool premature,) = address(funding).call(abi.encodeCall(funding.refundExpiredUnmatched, (a)));
        require(!premature && accounting.getObligation(first).state == 1, "premature refund admitted");
        vm.warp(uint256(jobs.job(a).deadline) + 1);
        vm.prank(rogue);
        bytes32 refunded = funding.refundExpiredUnmatched(a);
        require(refunded == first && funding.credit(a).refunded
            && accounting.getObligation(first).state == 2
            && accounting.getObligation(second).state == 1
            && funding.totalFunded() == 3 ether
            && !funding.funded(a, vm.addr(OWNER_A), a)
            && funding.funded(b, vm.addr(OWNER_B), b), "refund changed unrelated payer credit");
        vm.prank(rogue);
        (bool rogueClaim,) = address(vault).call(abi.encodeCall(vault.claim, (keccak256("rogue-claim"), first)));
        require(!rogueClaim, "rogue claimed payer funds");
        uint256 beforePayer = payerA.balance;
        vm.prank(payerA);
        vault.claim(keccak256("payer-claim"), first);
        require(payerA.balance == beforePayer + 2 ether && accounting.getObligation(first).state == 3
            && accounting.getObligation(second).state == 1 && address(vault).balance == 3 ether,
            "wrong payer transfer or second payer affected");
        vm.prank(rogue);
        (bool replay,) = address(funding).call(abi.encodeCall(funding.refundExpiredUnmatched, (a)));
        require(!replay, "duplicate refund accepted");
    }

    function testMissingSharedGrantStillDeniesFundingAndRefund() public {
        bytes32 a = _job(3, OWNER_A, PAYER_A);
        bytes32 createGrant = caps.activeGrantId(address(funding), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION, policy.scopeForVault(ID));
        caps.revokeGrant(createGrant);
        uint256 beforePayer = payerA.balance;
        vm.prank(payerA);
        (bool ok,) = address(funding).call{value: 1 ether}(abi.encodeCall(funding.fund, (a)));
        require(!ok && payerA.balance == beforePayer && address(vault).balance == 0,
            "CMP policy ignored shared CREATE grant");
        _grant(address(funding), VaultIds420.ACTION_CREATE_OBLIGATION);
        vm.prank(payerA);
        funding.fund{value: 1 ether}(a);
        bytes32 releaseGrant = caps.activeGrantId(address(funding), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, policy.scopeForVault(ID));
        caps.revokeGrant(releaseGrant);
        vm.warp(uint256(jobs.job(a).deadline) + 1);
        (ok,) = address(funding).call(abi.encodeCall(funding.refundExpiredUnmatched, (a)));
        require(!ok && !funding.credit(a).refunded
            && accounting.getObligation(funding.credit(a).obligationId).state == 1,
            "CMP policy ignored shared RELEASE grant");
    }
}
