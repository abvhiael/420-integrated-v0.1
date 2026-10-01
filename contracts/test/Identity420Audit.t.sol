// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/Identity420.sol";
import "../src/system/SystemAccess.sol";

interface VmIdentityAudit420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract Identity420AuditTest {
    VmIdentityAudit420 internal constant vm =
        VmIdentityAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);
    address internal constant ISSUER = address(0x155E7);
    address internal constant ISSUER2 = address(0x155E8);

    function _identity() internal returns (Identity420 identity) {
        identity = new Identity420(address(this));
    }

    function _profile(Identity420 identity, bytes32 profileId, address controller) internal {
        vm.prank(controller);
        identity.createProfile(profileId, keccak256("profile-meta"));
    }

    function _issuer(Identity420 identity, bytes32 issuerId, address controller) internal {
        identity.setIssuerTrust(
            issuerId,
            controller,
            keccak256("issuer-meta"),
            Identity420.TrustClass.INSTITUTIONAL,
            true
        );
    }

    function testCreateProfileRejectsZeroAndDuplicateIds() public {
        Identity420 identity = _identity();

        vm.prank(ALICE);
        vm.expectRevert(Identity420.InvalidProfileId.selector);
        identity.createProfile(bytes32(0), bytes32(0));

        bytes32 profileId = keccak256("alice");
        _profile(identity, profileId, ALICE);

        vm.prank(BOB);
        vm.expectRevert(Identity420.ProfileExists.selector);
        identity.createProfile(profileId, bytes32(0));
    }

    function testOnlyControllerMayUpdateOrNominateTransfer() public {
        Identity420 identity = _identity();
        bytes32 profileId = keccak256("alice");
        _profile(identity, profileId, ALICE);

        vm.prank(BOB);
        vm.expectRevert(Identity420.NotProfileController.selector);
        identity.updateProfile(profileId, bytes32(0), false);

        vm.prank(BOB);
        vm.expectRevert(Identity420.NotProfileController.selector);
        identity.transferProfileController(profileId, CAROL);

        vm.prank(ALICE);
        vm.expectRevert(Identity420.InvalidController.selector);
        identity.transferProfileController(profileId, address(0));

        vm.prank(ALICE);
        vm.expectRevert(Identity420.InvalidController.selector);
        identity.transferProfileController(profileId, ALICE);
    }

    function testOnlyPendingControllerMayAcceptAndPendingStateClears() public {
        Identity420 identity = _identity();
        bytes32 profileId = keccak256("alice");
        _profile(identity, profileId, ALICE);

        vm.prank(ALICE);
        identity.transferProfileController(profileId, BOB);

        vm.prank(CAROL);
        vm.expectRevert(Identity420.NotPendingController.selector);
        identity.acceptProfileController(profileId);

        vm.prank(BOB);
        identity.acceptProfileController(profileId);

        (address controller, address pending,,,,,) = identity.profiles(profileId);
        require(controller == BOB, "controller");
        require(pending == address(0), "pending cleared");
    }

    function testIssuerConfigurationIsGovernanceOnlyAndValidated() public {
        Identity420 identity = _identity();
        bytes32 issuerId = keccak256("issuer");

        vm.prank(ALICE);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        identity.setIssuer(issuerId, ISSUER, bytes32(0), true);

        vm.expectRevert(Identity420.InvalidIssuerId.selector);
        identity.setIssuer(bytes32(0), ISSUER, bytes32(0), true);

        vm.expectRevert(Identity420.InvalidController.selector);
        identity.setIssuer(issuerId, address(0), bytes32(0), true);

        vm.expectRevert(Identity420.InvalidTrustClass.selector);
        identity.setIssuerTrust(
            issuerId,
            ISSUER,
            bytes32(0),
            Identity420.TrustClass.NONE,
            true
        );
    }

    function testCredentialIssuanceRejectsUnknownInactiveUnauthorizedAndExpiredInputs() public {
        Identity420 identity = _identity();
        bytes32 profileId = keccak256("alice");
        bytes32 issuerId = keccak256("issuer");
        _profile(identity, profileId, ALICE);

        vm.prank(ISSUER);
        vm.expectRevert(Identity420.UnknownIssuer.selector);
        identity.issueCredential(
            keccak256("c0"),
            issuerId,
            profileId,
            keccak256("type"),
            bytes32(0),
            0
        );

        identity.setIssuer(issuerId, ISSUER, bytes32(0), false);
        vm.prank(ISSUER);
        vm.expectRevert(Identity420.InactiveIssuer.selector);
        identity.issueCredential(
            keccak256("c1"),
            issuerId,
            profileId,
            keccak256("type"),
            bytes32(0),
            0
        );

        identity.setIssuer(issuerId, ISSUER, bytes32(0), true);

        vm.prank(BOB);
        vm.expectRevert(Identity420.NotIssuerController.selector);
        identity.issueCredential(
            keccak256("c2"),
            issuerId,
            profileId,
            keccak256("type"),
            bytes32(0),
            0
        );

        vm.prank(ISSUER);
        vm.expectRevert(Identity420.UnknownProfile.selector);
        identity.issueCredential(
            keccak256("c3"),
            issuerId,
            keccak256("missing"),
            keccak256("type"),
            bytes32(0),
            0
        );

        vm.prank(ISSUER);
        vm.expectRevert(Identity420.InvalidExpiry.selector);
        identity.issueCredential(
            keccak256("c4"),
            issuerId,
            profileId,
            keccak256("type"),
            bytes32(0),
            uint64(block.timestamp)
        );
    }

    function testCredentialIdCannotBeReused() public {
        Identity420 identity = _identity();
        bytes32 profileId = keccak256("alice");
        bytes32 issuerId = keccak256("issuer");
        bytes32 credentialId = keccak256("credential");
        _profile(identity, profileId, ALICE);
        _issuer(identity, issuerId, ISSUER);

        vm.prank(ISSUER);
        identity.issueCredential(credentialId, issuerId, profileId, keccak256("type"), bytes32(0), 0);

        vm.prank(ISSUER);
        vm.expectRevert(Identity420.CredentialExists.selector);
        identity.issueCredential(credentialId, issuerId, profileId, keccak256("type2"), bytes32(0), 0);
    }

    function testCredentialValidityTracksExpiryProfileAndIssuerState() public {
        Identity420 identity = _identity();
        bytes32 profileId = keccak256("alice");
        bytes32 issuerId = keccak256("issuer");
        bytes32 credentialId = keccak256("credential");
        _profile(identity, profileId, ALICE);
        _issuer(identity, issuerId, ISSUER);

        uint64 expiry = uint64(block.timestamp + 100);
        vm.prank(ISSUER);
        identity.issueCredential(credentialId, issuerId, profileId, keccak256("type"), bytes32(0), expiry);
        require(identity.credentialValid(credentialId), "initially valid");

        vm.prank(ALICE);
        identity.updateProfile(profileId, bytes32(0), false);
        require(!identity.credentialValid(credentialId), "inactive profile invalidates");

        vm.prank(ALICE);
        identity.updateProfile(profileId, bytes32(0), true);
        require(identity.credentialValid(credentialId), "reactivation restores");

        identity.setIssuerTrust(issuerId, ISSUER, bytes32(0), Identity420.TrustClass.INSTITUTIONAL, false);
        require(!identity.credentialValid(credentialId), "inactive issuer invalidates");

        identity.setIssuerTrust(issuerId, ISSUER, bytes32(0), Identity420.TrustClass.INSTITUTIONAL, true);
        require(identity.credentialValid(credentialId), "issuer reactivation restores");

        vm.warp(expiry);
        require(!identity.credentialValid(credentialId), "expiry boundary invalid");
    }

    function testOnlyIssuerControllerOrGovernanceMayRevoke() public {
        Identity420 identity = _identity();
        bytes32 profileId = keccak256("alice");
        bytes32 issuerId = keccak256("issuer");
        bytes32 credentialId = keccak256("credential");
        _profile(identity, profileId, ALICE);
        _issuer(identity, issuerId, ISSUER);

        vm.prank(ISSUER);
        identity.issueCredential(credentialId, issuerId, profileId, keccak256("type"), bytes32(0), 0);

        vm.prank(BOB);
        vm.expectRevert(Identity420.NotIssuerController.selector);
        identity.revokeCredential(credentialId);

        identity.revokeCredential(credentialId);
        require(!identity.credentialValid(credentialId), "governance revoke");

        vm.expectRevert(Identity420.AlreadyRevoked.selector);
        identity.revokeCredential(credentialId);
    }

    function testCurrentIssuerControllerOwnsRevocationAuthorityAfterGovernanceReplacement() public {
        Identity420 identity = _identity();
        bytes32 profileId = keccak256("alice");
        bytes32 issuerId = keccak256("issuer");
        bytes32 credentialId = keccak256("credential");
        _profile(identity, profileId, ALICE);
        _issuer(identity, issuerId, ISSUER);

        vm.prank(ISSUER);
        identity.issueCredential(credentialId, issuerId, profileId, keccak256("type"), bytes32(0), 0);

        identity.setIssuerTrust(
            issuerId,
            ISSUER2,
            bytes32(0),
            Identity420.TrustClass.INSTITUTIONAL,
            true
        );

        vm.prank(ISSUER);
        vm.expectRevert(Identity420.NotIssuerController.selector);
        identity.revokeCredential(credentialId);

        vm.prank(ISSUER2);
        identity.revokeCredential(credentialId);
        require(!identity.credentialValid(credentialId), "new controller revokes");
    }

    function testOnlyCurrentSubjectControllerMayRejectCredential() public {
        Identity420 identity = _identity();
        bytes32 profileId = keccak256("alice");
        bytes32 issuerId = keccak256("issuer");
        bytes32 credentialId = keccak256("credential");
        _profile(identity, profileId, ALICE);
        _issuer(identity, issuerId, ISSUER);

        vm.prank(ISSUER);
        identity.issueCredential(credentialId, issuerId, profileId, keccak256("type"), bytes32(0), 0);

        vm.prank(BOB);
        vm.expectRevert(Identity420.NotCredentialSubject.selector);
        identity.rejectCredential(credentialId);

        vm.prank(ALICE);
        identity.transferProfileController(profileId, BOB);
        vm.prank(BOB);
        identity.acceptProfileController(profileId);

        vm.prank(ALICE);
        vm.expectRevert(Identity420.NotCredentialSubject.selector);
        identity.rejectCredential(credentialId);

        vm.prank(BOB);
        identity.rejectCredential(credentialId);
        require(!identity.credentialValid(credentialId), "subject rejection");
    }

    function testTrustThresholdReadsCurrentIssuerClass() public {
        Identity420 identity = _identity();
        bytes32 profileId = keccak256("alice");
        bytes32 issuerId = keccak256("issuer");
        bytes32 credentialId = keccak256("credential");
        _profile(identity, profileId, ALICE);
        _issuer(identity, issuerId, ISSUER);

        vm.prank(ISSUER);
        identity.issueCredential(credentialId, issuerId, profileId, keccak256("type"), bytes32(0), 0);

        require(identity.credentialMeetsTrust(credentialId, Identity420.TrustClass.COMMUNITY), "community");
        require(identity.credentialMeetsTrust(credentialId, Identity420.TrustClass.VERIFIED), "verified");
        require(identity.credentialMeetsTrust(credentialId, Identity420.TrustClass.INSTITUTIONAL), "institutional");
        require(!identity.credentialMeetsTrust(credentialId, Identity420.TrustClass.SYSTEM), "not system");

        identity.setIssuerTrust(
            issuerId,
            ISSUER,
            bytes32(0),
            Identity420.TrustClass.COMMUNITY,
            true
        );
        require(!identity.credentialMeetsTrust(credentialId, Identity420.TrustClass.VERIFIED), "current class");
    }
}
