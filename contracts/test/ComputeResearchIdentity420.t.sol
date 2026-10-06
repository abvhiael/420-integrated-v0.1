// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/Identity420.sol";
import "../src/compute/ComputeResearchIdentity420.sol";

interface VmResearchIdentity420 {
    function prank(address actor) external;
}

contract ComputeResearchIdentity420Test {
    VmResearchIdentity420 constant vm =
        VmResearchIdentity420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant RECOVERY = address(0xBEEF);
    address constant ORG = address(0x0A6);
    address constant ISSUER = address(0x155);
    bytes32 constant ALICE_PROFILE = keccak256("alice-profile");
    bytes32 constant ORG_PROFILE = keccak256("org-profile");
    bytes32 constant RESEARCHER_ISSUER = keccak256("researcher-issuer");
    bytes32 constant INSTITUTION_ISSUER = keccak256("institution-issuer");
    bytes32 constant ALICE_CREDENTIAL = keccak256("alice-researcher-credential");
    bytes32 constant ORG_CREDENTIAL = keccak256("org-institution-credential");
    bytes32 constant METADATA_A = keccak256("research-identity-metadata-a");
    bytes32 constant METADATA_B = keccak256("research-identity-metadata-b");

    Identity420 identity;
    ComputeResearchIdentity420 registry;

    function setUp() public {
        identity = new Identity420(address(this));

        vm.prank(ALICE);
        identity.createProfile(ALICE_PROFILE, keccak256("alice"));
        vm.prank(ORG);
        identity.createProfile(ORG_PROFILE, keccak256("org"));

        identity.setIssuerTrust(
            RESEARCHER_ISSUER,
            ISSUER,
            keccak256("researcher-issuer-metadata"),
            Identity420.TrustClass.VERIFIED,
            true
        );
        identity.setIssuerTrust(
            INSTITUTION_ISSUER,
            ISSUER,
            keccak256("institution-issuer-metadata"),
            Identity420.TrustClass.INSTITUTIONAL,
            true
        );

        registry = new ComputeResearchIdentity420(IComputeResearchIdentitySource420(address(identity)));

        vm.prank(ISSUER);
        identity.issueCredential(
            ALICE_CREDENTIAL,
            RESEARCHER_ISSUER,
            ALICE_PROFILE,
            registry.RESEARCHER_CREDENTIAL_TYPE(),
            keccak256("alice-researcher-claim"),
            0
        );
        vm.prank(ISSUER);
        identity.issueCredential(
            ORG_CREDENTIAL,
            INSTITUTION_ISSUER,
            ORG_PROFILE,
            registry.INSTITUTION_CREDENTIAL_TYPE(),
            keccak256("org-institution-claim"),
            0
        );
    }

    function _registerResearcher() private returns (bytes32 id) {
        vm.prank(ALICE);
        id = registry.register(
            ALICE_PROFILE,
            ALICE_CREDENTIAL,
            ComputeResearchIdentity420.Role.RESEARCHER,
            METADATA_A
        );
    }

    function _attempt(address actor, bytes memory call_) private returns (bool ok) {
        vm.prank(actor);
        (ok,) = address(registry).call(call_);
    }

    function testResearcherBindingIsCanonicalAndEligible() public {
        bytes32 id = _registerResearcher();
        bytes32 expected = keccak256(abi.encode(
            registry.BINDING_DOMAIN(),
            block.chainid,
            address(registry),
            ALICE_PROFILE,
            ComputeResearchIdentity420.Role.RESEARCHER
        ));
        require(id == expected, "binding id");

        ComputeResearchIdentity420.Binding memory b = registry.binding(id);
        require(b.profileId == ALICE_PROFILE && b.credentialId == ALICE_CREDENTIAL, "identity");
        require(b.revision == 1 && b.active, "revision");
        bytes32 c = registry.commitment(id, 1);
        require(registry.isCurrentEligible(id, 1, c, ALICE), "eligible");
        require(!registry.isCurrentEligible(id, 1, c, RECOVERY), "foreign actor");
    }

    function testInstitutionRequiresCredentialedInstitutionCredential() public {
        bytes32 weak = keccak256("weak-institution-credential");
        vm.prank(ISSUER);
        identity.issueCredential(
            weak,
            RESEARCHER_ISSUER,
            ORG_PROFILE,
            registry.INSTITUTION_CREDENTIAL_TYPE(),
            keccak256("weak"),
            0
        );

        bool ok = _attempt(
            ORG,
            abi.encodeWithSelector(
                registry.register.selector,
                ORG_PROFILE,
                weak,
                ComputeResearchIdentity420.Role.INSTITUTION,
                METADATA_A
            )
        );
        require(!ok, "verified issuer must not satisfy institution");

        vm.prank(ORG);
        bytes32 id = registry.register(
            ORG_PROFILE,
            ORG_CREDENTIAL,
            ComputeResearchIdentity420.Role.INSTITUTION,
            METADATA_A
        );
        require(registry.isCurrentEligible(id, 1, registry.commitment(id, 1), ORG), "institution");
    }

    function testIdentityControllerRecoveryChangesAuthorityWithoutRewritingBinding() public {
        bytes32 id = _registerResearcher();
        bytes32 beforeCommitment = registry.commitment(id, 1);

        vm.prank(ALICE);
        identity.transferProfileController(ALICE_PROFILE, RECOVERY);
        vm.prank(RECOVERY);
        identity.acceptProfileController(ALICE_PROFILE);

        require(!registry.isCurrentEligible(id, 1, beforeCommitment, ALICE), "old controller");
        require(registry.isCurrentEligible(id, 1, beforeCommitment, RECOVERY), "recovered controller");
        require(registry.commitment(id, 1) == beforeCommitment, "history rewritten");

        vm.prank(RECOVERY);
        registry.revise(id, 1, ALICE_CREDENTIAL, METADATA_B);
        require(registry.binding(id).revision == 2, "recovery revise");
    }

    function testCredentialLifecycleFailsClosed() public {
        bytes32 id = _registerResearcher();
        bytes32 c = registry.commitment(id, 1);

        vm.prank(ISSUER);
        identity.revokeCredential(ALICE_CREDENTIAL);
        require(!registry.isCurrentEligible(id, 1, c, ALICE), "revoked credential accepted");

        bool ok = _attempt(
            ALICE,
            abi.encodeWithSelector(registry.setActive.selector, id, uint64(1), false)
        );
        require(ok, "owner may deactivate after credential revocation");
        require(!registry.binding(id).active, "not deactivated");
    }

    function testUnauthorizedStaleAndCrossBindingReplayFailClosed() public {
        bytes32 researcherId = _registerResearcher();

        vm.prank(ORG);
        bytes32 institutionId = registry.register(
            ORG_PROFILE,
            ORG_CREDENTIAL,
            ComputeResearchIdentity420.Role.INSTITUTION,
            METADATA_A
        );

        bytes32 researcherCommitment = registry.commitment(researcherId, 1);
        require(
            !registry.isCurrentEligible(institutionId, 1, researcherCommitment, ORG),
            "cross-binding replay"
        );

        bool outsider = _attempt(
            RECOVERY,
            abi.encodeWithSelector(registry.revise.selector, researcherId, uint64(1), ALICE_CREDENTIAL, METADATA_B)
        );
        require(!outsider, "outsider revise");

        vm.prank(ALICE);
        registry.revise(researcherId, 1, ALICE_CREDENTIAL, METADATA_B);
        bool stale = _attempt(
            ALICE,
            abi.encodeWithSelector(registry.setActive.selector, researcherId, uint64(1), false)
        );
        require(!stale, "stale revision");
        require(!registry.isCurrentEligible(researcherId, 1, researcherCommitment, ALICE), "stale commit");
    }

    function testWrongCredentialTypeAndSubjectFailClosed() public {
        bool wrongSubject = _attempt(
            ALICE,
            abi.encodeWithSelector(
                registry.register.selector,
                ALICE_PROFILE,
                ORG_CREDENTIAL,
                ComputeResearchIdentity420.Role.RESEARCHER,
                METADATA_A
            )
        );
        require(!wrongSubject, "cross-subject credential");

        bool wrongRole = _attempt(
            ALICE,
            abi.encodeWithSelector(
                registry.register.selector,
                ALICE_PROFILE,
                ALICE_CREDENTIAL,
                ComputeResearchIdentity420.Role.INSTITUTION,
                METADATA_A
            )
        );
        require(!wrongRole, "researcher credential as institution");
    }
}
