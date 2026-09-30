// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifierRegistry420.sol";

interface VmComputeVerifierRegistry420 {
    function prank(address caller) external;
}

contract ComputeVerifierRegistry420Test {
    VmComputeVerifierRegistry420 private constant vm =
        VmComputeVerifierRegistry420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant VERIFIER_A = address(0xA11CE);
    address private constant VERIFIER_B = address(0xB0B);
    address private constant OUTSIDER = address(0xBAD);

    bytes32 private constant MANIFEST_A = keccak256("verifier-a-registration");
    bytes32 private constant MANIFEST_B = keccak256("verifier-b-rotation");

    ComputeVerifierRegistry420 private registry;

    function setUp() public {
        registry = new ComputeVerifierRegistry420(GOV);
    }

    function _register(address authority, bytes32 manifestHash) private returns (bytes32 verifierId) {
        vm.prank(authority);
        verifierId = registry.register(manifestHash);
    }

    function _registerAndActivate() private returns (bytes32 verifierId) {
        verifierId = _register(VERIFIER_A, MANIFEST_A);
        vm.prank(GOV);
        registry.activate(verifierId);
    }

    function testSelfRegistrationCreatesDomainSeparatedIdentityWithoutActivation() public {
        bytes32 verifierId = _register(VERIFIER_A, MANIFEST_A);
        ComputeVerifierRegistry420.Verifier memory v = registry.verifier(verifierId);

        require(verifierId == registry.deriveId(1), "verifier id mismatch");
        require(v.authority == VERIFIER_A, "authority mismatch");
        require(v.registrationManifestHash == MANIFEST_A, "manifest mismatch");
        require(v.revision == 1, "initial revision mismatch");
        require(v.status == ComputeVerifierRegistry420.Status.REGISTERED, "wrong initial status");
        require(registry.verifierIdForAuthority(VERIFIER_A) == verifierId, "authority lookup missing");
        require(!registry.isActive(verifierId, VERIFIER_A, 1), "registration implied activation");
    }

    function testLifecycleRequiresGovernanceAndRetirementIsTerminal() public {
        bytes32 verifierId = _register(VERIFIER_A, MANIFEST_A);

        vm.prank(OUTSIDER);
        (bool ok,) = address(registry).call(abi.encodeCall(registry.activate, (verifierId)));
        require(!ok, "outsider activated verifier");

        vm.prank(GOV);
        registry.activate(verifierId);
        uint64 activeRevision = registry.verifier(verifierId).revision;
        require(registry.isActive(verifierId, VERIFIER_A, activeRevision), "active verifier ineligible");
        require(!registry.isActive(verifierId, VERIFIER_A, activeRevision - 1), "stale revision eligible");

        vm.prank(VERIFIER_A);
        registry.suspend(verifierId);
        require(!registry.isActive(verifierId, VERIFIER_A, registry.verifier(verifierId).revision), "suspended verifier active");

        vm.prank(GOV);
        registry.activate(verifierId);
        vm.prank(GOV);
        registry.retire(verifierId);
        require(registry.verifier(verifierId).status == ComputeVerifierRegistry420.Status.RETIRED, "retirement missing");
        require(registry.verifierIdForAuthority(VERIFIER_A) == bytes32(0), "retired authority still current");

        vm.prank(GOV);
        (ok,) = address(registry).call(abi.encodeCall(registry.activate, (verifierId)));
        require(!ok, "retired verifier reactivated");

        vm.prank(GOV);
        (ok,) = address(registry).call(
            abi.encodeCall(registry.proposeRotation, (verifierId, VERIFIER_B, MANIFEST_B))
        );
        require(!ok, "retired verifier rotated");
    }

    function testOnlyAuthorityOrGovernanceCanSuspendActiveVerifier() public {
        bytes32 verifierId = _registerAndActivate();

        vm.prank(OUTSIDER);
        (bool ok,) = address(registry).call(abi.encodeCall(registry.suspend, (verifierId)));
        require(!ok, "outsider suspended verifier");

        vm.prank(GOV);
        registry.suspend(verifierId);
        require(registry.verifier(verifierId).status == ComputeVerifierRegistry420.Status.SUSPENDED, "governance suspension missing");
    }

    function testRotationRequiresGovernanceProposalAndNewAuthorityAcceptance() public {
        bytes32 verifierId = _registerAndActivate();
        ComputeVerifierRegistry420.Verifier memory beforeRotation = registry.verifier(verifierId);

        vm.prank(OUTSIDER);
        (bool ok,) = address(registry).call(
            abi.encodeCall(registry.proposeRotation, (verifierId, VERIFIER_B, MANIFEST_B))
        );
        require(!ok, "outsider proposed rotation");

        vm.prank(GOV);
        registry.proposeRotation(verifierId, VERIFIER_B, MANIFEST_B);

        vm.prank(OUTSIDER);
        (ok,) = address(registry).call(abi.encodeCall(registry.acceptRotation, (verifierId)));
        require(!ok, "outsider accepted rotation");

        vm.prank(VERIFIER_B);
        registry.acceptRotation(verifierId);

        ComputeVerifierRegistry420.Verifier memory rotated = registry.verifier(verifierId);
        require(rotated.authority == VERIFIER_B, "new authority missing");
        require(rotated.registrationManifestHash == MANIFEST_B, "rotation manifest missing");
        require(rotated.status == ComputeVerifierRegistry420.Status.SUSPENDED, "rotation auto-activated verifier");
        require(registry.verifierIdForAuthority(VERIFIER_A) == bytes32(0), "old authority remained current");
        require(registry.verifierIdForAuthority(VERIFIER_B) == verifierId, "new authority lookup missing");
        require(
            registry.revision(verifierId, beforeRotation.revision).authority == VERIFIER_A,
            "historical authority rewritten"
        );

        vm.prank(GOV);
        registry.activate(verifierId);
        require(
            registry.isActive(verifierId, VERIFIER_B, registry.verifier(verifierId).revision),
            "rotated authority failed reactivation"
        );
    }

    function testDuplicateAuthorityAndPendingRotationFailClosed() public {
        bytes32 first = _registerAndActivate();

        vm.prank(VERIFIER_A);
        (bool ok,) = address(registry).call(abi.encodeCall(registry.register, (keccak256("duplicate"))));
        require(!ok && registry.nextSerial() == 1, "duplicate authority consumed identity");

        bytes32 second = _register(VERIFIER_B, MANIFEST_B);

        vm.prank(GOV);
        (ok,) = address(registry).call(
            abi.encodeCall(registry.proposeRotation, (first, VERIFIER_B, keccak256("collision")))
        );
        require(!ok, "rotation accepted already-bound authority");

        vm.prank(GOV);
        registry.retire(second);

        vm.prank(GOV);
        registry.proposeRotation(first, VERIFIER_B, MANIFEST_B);
        vm.prank(GOV);
        (ok,) = address(registry).call(
            abi.encodeCall(registry.proposeRotation, (first, address(0xCAFE), keccak256("second-pending")))
        );
        require(!ok, "second pending rotation replaced first");

        vm.prank(GOV);
        registry.cancelRotation(first);
        ComputeVerifierRegistry420.PendingRotation memory pending = registry.pendingRotation(first);
        require(pending.newAuthority == address(0), "rotation cancellation missing");
    }

    function testRevisionHistoryPreservesStatusTransitions() public {
        bytes32 verifierId = _register(VERIFIER_A, MANIFEST_A);
        vm.prank(GOV);
        registry.activate(verifierId);
        vm.prank(VERIFIER_A);
        registry.suspend(verifierId);

        ComputeVerifierRegistry420.Verifier memory r1 = registry.revision(verifierId, 1);
        ComputeVerifierRegistry420.Verifier memory r2 = registry.revision(verifierId, 2);
        ComputeVerifierRegistry420.Verifier memory r3 = registry.revision(verifierId, 3);

        require(r1.status == ComputeVerifierRegistry420.Status.REGISTERED, "registered history lost");
        require(r2.status == ComputeVerifierRegistry420.Status.ACTIVE, "active history lost");
        require(r3.status == ComputeVerifierRegistry420.Status.SUSPENDED, "suspended history lost");
    }
}
