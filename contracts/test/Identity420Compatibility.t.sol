// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/Identity420.sol";
import "../src/interfaces/genesis/IIdentityCredential420.sol";
import "../src/interfaces/genesis/Types420.sol";

interface VmIdentityCompat420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract Identity420CompatibilityTest {
    VmIdentityCompat420 internal constant vm =
        VmIdentityCompat420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant ISSUER_A = address(0x1A);
    address internal constant ISSUER_B = address(0x1B);

    bytes32 internal constant PROFILE = keccak256("profile");
    bytes32 internal constant TYPE = keccak256("credential-type");
    bytes32 internal constant ISSUER_ID_A = keccak256("issuer-a");
    bytes32 internal constant ISSUER_ID_B = keccak256("issuer-b");

    function _identity() internal returns (Identity420 identity) {
        identity = new Identity420(address(this));
        vm.prank(ALICE);
        identity.createProfile(PROFILE, keccak256("profile-meta"));
    }

    function _setIssuer(
        Identity420 identity,
        bytes32 issuerId,
        address controller,
        Identity420.TrustClass trustClass,
        bool active
    ) internal {
        identity.setIssuerTrust(issuerId, controller, keccak256("issuer-meta"), trustClass, active);
    }

    function _issue(
        Identity420 identity,
        address controller,
        bytes32 credentialId,
        bytes32 issuerId,
        uint64 expiresAt
    ) internal {
        vm.prank(controller);
        identity.issueCredential(
            credentialId,
            issuerId,
            PROFILE,
            TYPE,
            keccak256(abi.encodePacked("claim", credentialId)),
            expiresAt
        );
    }

    function testFrozenInterfaceCredentialViewAndConservativeAssuranceMapping() public {
        Identity420 identity = _identity();
        IIdentityCredential420 frozen = IIdentityCredential420(address(identity));

        _setIssuer(identity, ISSUER_ID_A, ISSUER_A, Identity420.TrustClass.VERIFIED, true);
        bytes32 credentialId = keccak256("credential-a");
        _issue(identity, ISSUER_A, credentialId, ISSUER_ID_A, 0);

        IIdentityCredential420.CredentialView memory view_ = frozen.credential(credentialId);
        require(view_.subjectId == PROFILE, "subject");
        require(view_.credentialType == TYPE, "type");
        require(view_.issuerId == ISSUER_ID_A, "issuer");
        require(view_.assurance == Types420.IdentityAssurance.ATTESTED, "verified=>attested");
        require(!view_.revoked, "not revoked");
        require(frozen.hasValidCredential(PROFILE, TYPE), "valid lookup");

        _setIssuer(identity, ISSUER_ID_A, ISSUER_A, Identity420.TrustClass.INSTITUTIONAL, true);
        view_ = frozen.credential(credentialId);
        require(view_.assurance == Types420.IdentityAssurance.CREDENTIALED, "institutional=>credentialed");

        _setIssuer(identity, ISSUER_ID_A, ISSUER_A, Identity420.TrustClass.SYSTEM, true);
        view_ = frozen.credential(credentialId);
        require(view_.assurance == Types420.IdentityAssurance.CREDENTIALED, "system not regulated");

        _setIssuer(identity, ISSUER_ID_A, ISSUER_A, Identity420.TrustClass.COMMUNITY, true);
        view_ = frozen.credential(credentialId);
        require(view_.assurance == Types420.IdentityAssurance.SELF_ASSERTED, "community=>self asserted");
    }

    function testUnknownCredentialReturnsZeroViewAndLookupFalse() public {
        Identity420 identity = _identity();
        IIdentityCredential420 frozen = IIdentityCredential420(address(identity));
        IIdentityCredential420.CredentialView memory view_ = frozen.credential(keccak256("missing"));
        require(view_.subjectId == bytes32(0), "zero subject");
        require(view_.issuerId == bytes32(0), "zero issuer");
        require(view_.assurance == Types420.IdentityAssurance.NONE, "zero assurance");
        require(!view_.revoked, "zero revoked");
        require(!frozen.hasValidCredential(PROFILE, TYPE), "no valid credential");
    }

    function testSubjectTypeLookupIsAnyCurrentlyValidCredentialAcrossIssuers() public {
        Identity420 identity = _identity();
        IIdentityCredential420 frozen = IIdentityCredential420(address(identity));
        _setIssuer(identity, ISSUER_ID_A, ISSUER_A, Identity420.TrustClass.VERIFIED, true);
        _setIssuer(identity, ISSUER_ID_B, ISSUER_B, Identity420.TrustClass.INSTITUTIONAL, true);

        bytes32 a = keccak256("a");
        bytes32 b = keccak256("b");
        _issue(identity, ISSUER_A, a, ISSUER_ID_A, 0);
        _issue(identity, ISSUER_B, b, ISSUER_ID_B, 0);
        require(frozen.hasValidCredential(PROFILE, TYPE), "two valid");

        vm.prank(ISSUER_A);
        identity.revokeCredential(a);
        require(frozen.hasValidCredential(PROFILE, TYPE), "other issuer remains valid");

        _setIssuer(identity, ISSUER_ID_B, ISSUER_B, Identity420.TrustClass.INSTITUTIONAL, false);
        require(!frozen.hasValidCredential(PROFILE, TYPE), "inactive remaining issuer");

        _setIssuer(identity, ISSUER_ID_B, ISSUER_B, Identity420.TrustClass.INSTITUTIONAL, true);
        require(frozen.hasValidCredential(PROFILE, TYPE), "reactivation restores");
    }

    function testDynamicProfileExpiryAndSubjectRejectionSemantics() public {
        Identity420 identity = _identity();
        IIdentityCredential420 frozen = IIdentityCredential420(address(identity));
        _setIssuer(identity, ISSUER_ID_A, ISSUER_A, Identity420.TrustClass.VERIFIED, true);

        bytes32 expiring = keccak256("expiring");
        _issue(identity, ISSUER_A, expiring, ISSUER_ID_A, uint64(block.timestamp + 10));
        require(frozen.hasValidCredential(PROFILE, TYPE), "initial valid");

        vm.prank(ALICE);
        identity.updateProfile(PROFILE, bytes32(0), false);
        require(!frozen.hasValidCredential(PROFILE, TYPE), "inactive profile");

        vm.prank(ALICE);
        identity.updateProfile(PROFILE, bytes32(0), true);
        require(frozen.hasValidCredential(PROFILE, TYPE), "reactivated profile");

        vm.warp(block.timestamp + 10);
        require(!frozen.hasValidCredential(PROFILE, TYPE), "expired boundary");

        bytes32 rejected = keccak256("rejected");
        _issue(identity, ISSUER_A, rejected, ISSUER_ID_A, 0);
        require(frozen.hasValidCredential(PROFILE, TYPE), "replacement valid");

        vm.prank(ALICE);
        identity.rejectCredential(rejected);
        require(!frozen.hasValidCredential(PROFILE, TYPE), "subject rejection invalid");
        IIdentityCredential420.CredentialView memory view_ = frozen.credential(rejected);
        require(!view_.revoked, "rejection is not revocation");
    }

    function testCandidateBoundIsEnforcedAndPermanentlyInvalidSlotCanBeReused() public {
        Identity420 identity = _identity();
        _setIssuer(identity, ISSUER_ID_A, ISSUER_A, Identity420.TrustClass.VERIFIED, true);

        uint256 max = identity.MAX_CREDENTIAL_CANDIDATES();
        bytes32 first;
        for (uint256 i = 0; i < max; ++i) {
            bytes32 credentialId = keccak256(abi.encodePacked("bounded", i));
            if (i == 0) first = credentialId;
            _issue(identity, ISSUER_A, credentialId, ISSUER_ID_A, 0);
        }

        vm.prank(ISSUER_A);
        vm.expectRevert(Identity420.TooManyCredentialCandidates.selector);
        identity.issueCredential(
            keccak256("overflow"),
            ISSUER_ID_A,
            PROFILE,
            TYPE,
            bytes32(0),
            0
        );

        vm.prank(ISSUER_A);
        identity.revokeCredential(first);

        _issue(identity, ISSUER_A, keccak256("after-revoke"), ISSUER_ID_A, 0);
    }

    function testExpiredCandidateIsPrunedBeforeCapacityCheck() public {
        Identity420 identity = _identity();
        _setIssuer(identity, ISSUER_ID_A, ISSUER_A, Identity420.TrustClass.VERIFIED, true);

        uint256 max = identity.MAX_CREDENTIAL_CANDIDATES();
        for (uint256 i = 0; i < max; ++i) {
            _issue(
                identity,
                ISSUER_A,
                keccak256(abi.encodePacked("expiring-bounded", i)),
                ISSUER_ID_A,
                uint64(block.timestamp + 5)
            );
        }

        vm.warp(block.timestamp + 5);
        _issue(identity, ISSUER_A, keccak256("post-expiry"), ISSUER_ID_A, 0);
        require(IIdentityCredential420(address(identity)).hasValidCredential(PROFILE, TYPE), "post-expiry valid");
    }
}
