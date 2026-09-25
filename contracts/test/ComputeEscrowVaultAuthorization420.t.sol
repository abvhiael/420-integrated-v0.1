// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeEscrowVaultAuthorization420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/vault/AssetVault420.sol";
import "../src/vault/VaultPolicyRegistry420.sol";
import "../src/vault/VaultIds420.sol";

interface VmEscrowFence420 {
    function deal(address account, uint256 amount) external;
    function prank(address sender) external;
}

contract EscrowFenceActor420 {
    function create(AssetVault420 vault, bytes32 operationId, bytes32 obligationId,
        address beneficiary, uint256 amount) external {
        vault.createObligation(operationId, obligationId, address(0), beneficiary,
            amount, keccak256("420/CMP/PAYER-SAFETY/V1"), obligationId);
    }
    function release(AssetVault420 vault, bytes32 operationId, bytes32 obligationId) external {
        vault.releaseObligation(operationId, obligationId);
    }
    function cancel(AssetVault420 vault, bytes32 operationId, bytes32 obligationId) external {
        vault.cancelObligation(operationId, obligationId);
    }
    function withdraw(AssetVault420 vault, bytes32 operationId, address recipient, uint256 amount) external {
        vault.withdraw(operationId, address(0), recipient, amount);
    }
}

/// @notice Uses actual CapabilityRegistry420, Vault registry/accounting and AssetVault420;
/// grant issuer actively attempts hostile grant expansion after the bindings are frozen.
contract ComputeEscrowVaultAuthorization420Test {
    VmEscrowFence420 private constant vm = VmEscrowFence420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant ID = keccak256("cmp/dedicated/fenced/v1");
    CapabilityRegistry420 private caps;
    ComputeEscrowVaultAuthorization420 private auth;
    VaultRegistry420 private registry;
    VaultAccounting420 private accounting;
    AssetVault420 private vault;
    EscrowFenceActor420 private funding;
    EscrowFenceActor420 private controller;
    EscrowFenceActor420 private rogue;
    address private payerA;
    address private payerB;
    bytes32 private constant A = keccak256("payer-a");
    bytes32 private constant B = keccak256("payer-b");

    function setUp() public {
        vm.deal(address(this), 20 ether);
        payerA = address(0xA11CE);
        payerB = address(0xBEEF);
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT, address(this));
        auth = new ComputeEscrowVaultAuthorization420(address(caps), ID, address(this));
        VaultPolicyRegistry420 policies = new VaultPolicyRegistry420(address(this));
        registry = new VaultRegistry420(address(auth), address(policies));
        accounting = new VaultAccounting420(address(registry));
        bytes32 ap = keccak256("cmp/fenced/auth");
        bytes32 np = keccak256("cmp/fenced/native");
        bytes32 rp = keccak256("cmp/fenced/release");
        bytes32 cp = keccak256("cmp/fenced/accounting");
        policies.setPolicy(ap, VaultIds420.POLICY_AUTHORIZATION, keccak256("auth-v1"), bytes32(0), true);
        policies.setPolicy(np, VaultIds420.POLICY_ASSET, keccak256("native-v1"), bytes32(0), true);
        policies.setPolicy(rp, VaultIds420.POLICY_RELEASE, keccak256("release-v1"), bytes32(0), true);
        policies.setPolicy(cp, VaultIds420.POLICY_ACCOUNTING, keccak256("accounting-v1"), bytes32(0), true);
        vault = new AssetVault420(ID, address(registry), address(auth), address(accounting), address(this));
        registry.registerVault(ID, address(vault), VaultIds420.VAULT_ESCROW,
            ap, np, rp, cp, bytes32(0), bytes32(0), bytes32(0));
        funding = new EscrowFenceActor420();
        controller = new EscrowFenceActor420();
        rogue = new EscrowFenceActor420();
        _grant(address(funding), VaultIds420.ACTION_CREATE_OBLIGATION, auth.scopeForVault(ID));
        _grant(address(controller), VaultIds420.ACTION_CREATE_OBLIGATION, auth.scopeForVault(ID));
        _grant(address(controller), VaultIds420.ACTION_RELEASE_OBLIGATION, auth.scopeForVault(ID));
        _grant(address(controller), VaultIds420.ACTION_CANCEL_OBLIGATION, auth.scopeForVault(ID));
    }

    function _grant(address principal, bytes32 action, bytes32 scope) private {
        caps.createGrant(keccak256(abi.encode(principal, action, scope, block.chainid)),
            principal, VaultIds420.COMPONENT_VAULT, action, scope, 0, 0, 0, 0, 0);
    }

    function _reserve() private {
        vault.depositNative{value: 5 ether}();
        funding.create(vault, keccak256("create-a"), A, payerA, 2 ether);
        funding.create(vault, keccak256("create-b"), B, payerB, 3 ether);
        require(address(vault).balance == 5 ether && accounting.freeBalance(ID, address(0)) == 0,
            "payer safety reservation missing");
    }

    function testUnfrozenPolicyCannotAdmitFundsDespiteGrant() public {
        vault.depositNative{value: 2 ether}();
        (bool ok,) = address(funding).call(abi.encodeCall(funding.create,
            (vault, keccak256("early"), A, payerA, 2 ether)));
        require(!ok && accounting.freeBalance(ID, address(0)) == 2 ether,
            "unfrozen writer admitted safety obligation");
    }

    function testFrozenPolicyRejectsHostileReleaseCancelCreateAndWithdrawal() public {
        auth.freezeBindings(address(funding), address(controller));
        _reserve();
        bytes32 scope = auth.scopeForVault(ID);
        _grant(address(rogue), VaultIds420.ACTION_RELEASE_OBLIGATION, scope);
        _grant(address(rogue), VaultIds420.ACTION_CANCEL_OBLIGATION, scope);
        _grant(address(rogue), VaultIds420.ACTION_CREATE_OBLIGATION, scope);
        _grant(address(rogue), VaultIds420.ACTION_WITHDRAW, scope);
        _grant(address(rogue), VaultIds420.ACTION_CLAIM, scope);
        _grant(address(rogue), VaultIds420.ACTION_WITHDRAW,
            auth.scopeForRoute(ID, address(0), address(rogue), VaultIds420.ACTION_WITHDRAW));
        require(caps.isAuthorized(address(rogue), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, scope, 0), "hostile grant was not real");
        (bool rel,) = address(rogue).call(abi.encodeCall(rogue.release,
            (vault, keccak256("hostile-release"), A)));
        (bool can,) = address(rogue).call(abi.encodeCall(rogue.cancel,
            (vault, keccak256("hostile-cancel"), B)));
        (bool cre,) = address(rogue).call(abi.encodeCall(rogue.create,
            (vault, keccak256("hostile-create"), keccak256("hostile-obligation"), address(rogue), 1 ether)));
        (bool wd,) = address(rogue).call(abi.encodeCall(rogue.withdraw,
            (vault, keccak256("hostile-withdraw"), address(rogue), 1 ether)));
        require(!rel && !can && !cre && !wd && address(vault).balance == 5 ether,
            "grant-expansion bypassed CMP firewall");
        require(accounting.getObligation(A).state == 1 && accounting.getObligation(B).state == 1
            && accounting.freeBalance(ID, address(0)) == 0, "payer liabilities mutated");
        vm.prank(payerA);
        (bool premature,) = address(vault).call(abi.encodeCall(vault.claim,
            (keccak256("premature"), A)));
        require(!premature, "payer claimed pending obligation");
    }

    function testOnlyFrozenControllerCanReleaseAndBindingCannotChange() public {
        auth.freezeBindings(address(funding), address(controller));
        _reserve();
        (bool rebound,) = address(auth).call(abi.encodeCall(auth.freezeBindings,
            (address(rogue), address(rogue))));
        require(!rebound, "binding was mutable");
        (bool fundingRelease,) = address(funding).call(abi.encodeCall(funding.release,
            (vault, keccak256("funding-release"), A)));
        require(!fundingRelease, "funding adapter gained release authority");
        // Vault payer-safety controller is bound to the original obligation creator (funding).
        // The distinct generic controller's policy grant is intentionally insufficient to
        // release this payer safety obligation: a lawful refund requires the separately
        // qualified CMP funding-adapter exit path, never arbitrary controller release.
        bytes32 controllerOp = keccak256("authorized-controller-release");
        (bool controllerRelease,) = address(controller).call(abi.encodeCall(controller.release,
            (vault, controllerOp, A)));
        require(!controllerRelease && !vault.executedOperation(controllerOp)
            && accounting.getObligation(A).state == 1
            && accounting.getObligation(B).state == 1
            && accounting.getAccounting(ID, address(0)).reserved == 5 ether
            && address(vault).balance == 5 ether,
            "generic controller overrode immutable payer safety binding");
    }
}
