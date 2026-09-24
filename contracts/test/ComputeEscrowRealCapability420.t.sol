// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeEscrowFunding420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/vault/VaultAuthorization420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultIds420.sol";
import "./ComputeEscrowFunding420.t.sol";

interface VmEscrowRealCaps420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function deal(address account, uint256 amount) external;
    function prank(address caller) external;
}

/// @notice CMP-1.2.1.2: real capability registry, real Vault and two independently signed payers.
/// @dev These tests do NOT establish that a deployed registrar or component authority cannot issue
/// a future hostile grant. The final test demonstrates that such an issuance is a real risk.
contract ComputeEscrowRealCapability420Test {
    VmEscrowRealCaps420 private constant vm = VmEscrowRealCaps420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant VAULT_ID = keccak256("cmp/vault/real-capabilities/1");
    bytes32 private constant AUTH_POLICY = keccak256("cmp/real/auth");
    bytes32 private constant ASSET_POLICY = keccak256("cmp/real/native");
    bytes32 private constant RELEASE_POLICY = keccak256("cmp/real/release");
    bytes32 private constant ACCOUNTING_POLICY = keccak256("cmp/real/accounting");
    uint256 private constant OWNER_A_KEY = 0xA11CE;
    uint256 private constant PAYER_A_KEY = 0xBEEF;
    uint256 private constant OWNER_B_KEY = 0xA11CF;
    uint256 private constant PAYER_B_KEY = 0xCAFE;

    CapabilityRegistry420 private caps;
    VaultAuthorization420 private auth;
    VaultRegistry420 private registry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;
    ComputeJobSignedRequestAuthority420 private requests;
    ComputeEscrowFunding420 private funding;
    ComputeJobRegistry420 private jobs;
    address private payerA;
    address private payerB;
    address private outsider;

    function setUp() public {
        payerA = vm.addr(PAYER_A_KEY);
        payerB = vm.addr(PAYER_B_KEY);
        outsider = vm.addr(0xBAD);
        vm.deal(payerA, 10 ether);
        vm.deal(payerB, 10 ether);
        vm.deal(outsider, 10 ether);
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        auth = new VaultAuthorization420(address(caps));
        VaultPolicyRegistry420 policies = new VaultPolicyRegistry420(address(this));
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
        _grant(address(funding), VaultIds420.ACTION_CREATE_OBLIGATION);
    }

    function _grant(address principal, bytes32 action) private {
        caps.createGrant(keccak256(abi.encode("cmp/real/grant", principal, action)), principal,
            VaultIds420.COMPONENT_VAULT, action, auth.scopeForVault(VAULT_ID), 0, 0, 0, 0, 0);
    }

    function _signedJob(uint256 nonce, uint256 ownerKey, uint256 payerKey) private returns (bytes32 id) {
        address owner = vm.addr(ownerKey);
        address payer = vm.addr(payerKey);
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization({
                owner: owner, payer: payer, manifestHash: keccak256("manifest"),
                workloadType: keccak256("gpu"), inputCommitment: keccak256("input"),
                outputSchemaCommitment: keccak256("output"),
                deadline: uint64(block.timestamp + 1 days),
                authorizationExpiry: uint64(block.timestamp + 2 days),
                maxSpend: 5 ether, nonce: nonce
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
        a = _signedJob(1, OWNER_A_KEY, PAYER_A_KEY);
        b = _signedJob(2, OWNER_B_KEY, PAYER_B_KEY);
        vm.prank(payerA);
        funding.fund{value: 2 ether}(a);
        vm.prank(payerB);
        funding.fund{value: 3 ether}(b);
    }

    function testRealRegistryTwoPayerFundingHasNoUnallocatedBalance() public {
        (bytes32 a, bytes32 b) = _fundPair();
        VaultAccounting420.AssetAccounting memory amounts = accounting.getAccounting(VAULT_ID, address(0));
        require(address(vault).balance == 5 ether && amounts.recordedBalance == 5 ether
            && amounts.reserved == 5 ether && amounts.claimable == 0
            && accounting.freeBalance(VAULT_ID, address(0)) == 0, "real registry backing mismatch");
        require(funding.funded(a, vm.addr(OWNER_A_KEY), a)
            && funding.funded(b, vm.addr(OWNER_B_KEY), b), "signed payer isolation missing");
        require(accounting.getObligation(funding.credit(a).obligationId).beneficiary == payerA
            && accounting.getObligation(funding.credit(b).obligationId).beneficiary == payerB,
            "incorrect immutable refund beneficiaries");
    }

    function testRealRegistryRejectsOutsiderGrantIssuanceAndVaultSpending() public {
        (bytes32 a,) = _fundPair();
        vm.prank(outsider);
        (bool issued,) = address(caps).call(abi.encodeCall(caps.createGrant,
            (keccak256("outsider"), outsider, VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, auth.scopeForVault(VAULT_ID), 0, 0, 0, 0, 0)));
        require(!issued, "non-authority issued grant");
        bytes32 obligation = funding.credit(a).obligationId;
        vm.prank(outsider);
        (bool released,) = address(vault).call(abi.encodeCall(vault.releaseObligation,
            (keccak256("release"), obligation)));
        vm.prank(outsider);
        (bool cancelled,) = address(vault).call(abi.encodeCall(vault.cancelObligation,
            (keccak256("cancel"), obligation)));
        vm.prank(outsider);
        (bool withdrawn,) = address(vault).call(abi.encodeCall(vault.withdraw,
            (keccak256("withdraw"), address(0), outsider, 1 ether)));
        require(!released && !cancelled && !withdrawn && address(vault).balance == 5 ether
            && accounting.getObligation(obligation).state == 1, "unauthorized payer safety spend");
    }

    function testAuthorizedGrantExpansionIsUnsafeAndMustBlockDeployment() public {
        (bytes32 a,) = _fundPair();
        bytes32 obligation = funding.credit(a).obligationId;
        // This contract deliberately retains protocol-component grant authority in this fixture.
        // The actual registry allows that authority to issue RELEASE for an arbitrary principal.
        _grant(outsider, VaultIds420.ACTION_RELEASE_OBLIGATION);
        vm.prank(outsider);
        vault.releaseObligation(keccak256("hostile-release"), obligation);
        require(accounting.getObligation(obligation).state == 2
            && !funding.funded(a, vm.addr(OWNER_A_KEY), a), "hostile grant risk not reproduced");
        // This test's success documents a DEPLOYMENT BLOCKER, not a safe production configuration.
    }
}
