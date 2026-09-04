// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/apps/Identity420.sol";
import "../src/apps/Names420.sol";

interface Vm420 {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract RegistryIdentityNames420Test {
    Vm420 internal constant vm = Vm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant ISSUER = address(0x155E7);

    function testProtocolRegistryCanonicalAndExtensionIds() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        bytes32 payId = keccak256("420/service/pay/v1");
        require(registry.isGenesisCanonicalServiceId(payId), "canonical pay");
        registry.publishService(payId, address(0x1001), keccak256("code1"), keccak256("meta1"), 1, true);

        bytes32 extensionId = keccak256("420/service/custom-example/v1");
        vm.expectRevert(ProtocolRegistry.UnapprovedServiceId.selector);
        registry.publishService(extensionId, address(0x2001), bytes32(0), bytes32(0), 1, true);
        registry.approveServiceId(extensionId, keccak256("custom-example descriptor"));
        registry.publishService(extensionId, address(0x2001), bytes32(0), bytes32(0), 1, true);
        require(registry.getService(extensionId).version == 1, "extension published");
    }

    function testProtocolRegistryPreservesVersionHistory() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        bytes32 serviceId = keccak256("420/service/pay/v1");
        address implementation1 = address(0x1001);
        address implementation2 = address(0x1002);
        registry.publishService(serviceId, implementation1, keccak256("code1"), keccak256("meta1"), 1, true);
        registry.publishService(serviceId, implementation2, keccak256("code2"), keccak256("meta2"), 2, true);
        ProtocolRegistry.Service memory current = registry.getService(serviceId);
        ProtocolRegistry.Service memory previous = registry.getServiceVersion(serviceId, 1);
        require(current.version == 2 && current.implementation == implementation2, "current");
        require(previous.version == 1 && previous.implementation == implementation1, "history");
        registry.deprecateService(serviceId);
        require(!registry.isActive(serviceId), "deprecated");
        require(!registry.getServiceVersion(serviceId, 2).active, "history active");
    }

    function testProtocolRegistryRejectsVersionGaps() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        bytes32 serviceId = keccak256("420/service/names/v1");
        vm.expectRevert(ProtocolRegistry.InvalidVersion.selector);
        registry.publishService(serviceId, address(0x1001), bytes32(0), bytes32(0), 2, true);
    }

    function testIdentityControllerTransferAndIssuerCredentialLifecycle() public {
        Identity420 identity = new Identity420(address(this));
        bytes32 profileId = keccak256("alice-profile");
        bytes32 issuerId = keccak256("420-merchant-verifier");
        bytes32 credentialId = keccak256("credential-1");
        vm.prank(ALICE); identity.createProfile(profileId, keccak256("alice-meta"));
        vm.prank(ALICE); identity.transferProfileController(profileId, BOB);
        vm.prank(BOB); identity.acceptProfileController(profileId);
        (address controller,,,,,,) = identity.profiles(profileId);
        require(controller == BOB, "controller transfer");
        identity.setIssuer(issuerId, ISSUER, keccak256("issuer-meta"), true);
        vm.prank(ISSUER);
        identity.issueCredential(credentialId, issuerId, profileId, keccak256("merchant-verified"), keccak256("claim"), 0);
        require(identity.credentialValid(credentialId), "credential valid");
        vm.prank(BOB); identity.rejectCredential(credentialId);
        require(!identity.credentialValid(credentialId), "subject rejection");
    }

    function testIdentityTrustClasses() public {
        Identity420 identity = new Identity420(address(this));
        bytes32 profileId = keccak256("alice-profile");
        bytes32 issuerId = keccak256("institution");
        bytes32 credentialId = keccak256("credential");
        vm.prank(ALICE); identity.createProfile(profileId, bytes32(0));
        identity.setIssuerTrust(issuerId, ISSUER, bytes32(0), Identity420.TrustClass.INSTITUTIONAL, true);
        vm.prank(ISSUER); identity.issueCredential(credentialId, issuerId, profileId, keccak256("type"), keccak256("claim"), 0);
        require(identity.credentialMeetsTrust(credentialId, Identity420.TrustClass.VERIFIED), "verified threshold");
        require(identity.credentialMeetsTrust(credentialId, Identity420.TrustClass.INSTITUTIONAL), "institutional threshold");
        require(!identity.credentialMeetsTrust(credentialId, Identity420.TrustClass.SYSTEM), "system threshold");
    }

    function testIdentityIssuerSuspensionInvalidatesCredential() public {
        Identity420 identity = new Identity420(address(this));
        bytes32 profileId = keccak256("alice-profile");
        bytes32 issuerId = keccak256("issuer");
        bytes32 credentialId = keccak256("credential");
        vm.prank(ALICE); identity.createProfile(profileId, bytes32(0));
        identity.setIssuer(issuerId, ISSUER, bytes32(0), true);
        vm.prank(ISSUER); identity.issueCredential(credentialId, issuerId, profileId, keccak256("type"), keccak256("claim"), 0);
        require(identity.credentialValid(credentialId), "before suspend");
        identity.setIssuer(issuerId, ISSUER, bytes32(0), false);
        require(!identity.credentialValid(credentialId), "after suspend");
    }

    function _registerAlice(Names420 names, bytes32 labelHash) internal {
        bytes32 salt = keccak256("salt");
        uint64 duration = 30 days;
        bytes32 commitment = names.makeCommitment(labelHash, 5, ALICE, duration, salt, ALICE);
        vm.prank(ALICE); names.commit(commitment);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());
        vm.prank(ALICE); names.register(labelHash, 5, ALICE, duration, salt);
    }

    function testNamesReverseResolutionRequiresForwardAgreement() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("alice");
        _registerAlice(names, labelHash);
        vm.prank(ALICE); names.setReverseName(labelHash);
        require(names.reverseResolve(ALICE) == labelHash, "reverse set");
        vm.prank(ALICE); names.setResolution(labelHash, BOB, bytes32(0), bytes32(0));
        require(names.reverseResolve(ALICE) == bytes32(0), "stale reverse rejected");
        vm.prank(ALICE); vm.expectRevert(Names420.ResolutionMismatch.selector); names.setReverseName(labelHash);
    }

    function testIdentityNameBilateralBinding() public {
        Identity420 identity = new Identity420(address(this));
        Names420 names = new Names420(address(this));
        bytes32 profileId = keccak256("alice-profile");
        bytes32 labelHash = keccak256("alice");
        vm.prank(ALICE); identity.createProfile(profileId, bytes32(0));
        _registerAlice(names, labelHash);
        vm.prank(ALICE); names.setResolution(labelHash, ALICE, profileId, bytes32(0));
        vm.prank(ALICE); identity.setPrimaryName(profileId, labelHash);
        require(names.nameClaimsProfile(labelHash, profileId), "name side");
        (,,, bytes32 primaryName,,,) = identity.profiles(profileId);
        require(primaryName == labelHash, "identity side");
    }

    function testNamesCommitRevealTransferAndResolutionReset() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("alice");
        bytes32 salt = keccak256("salt");
        uint64 duration = 30 days;
        bytes32 commitment = names.makeCommitment(labelHash, 5, ALICE, duration, salt, ALICE);
        vm.prank(ALICE); names.commit(commitment);
        vm.prank(ALICE); vm.expectRevert(Names420.CommitmentTooNew.selector); names.register(labelHash, 5, ALICE, duration, salt);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());
        vm.prank(ALICE); names.register(labelHash, 5, ALICE, duration, salt);
        vm.prank(ALICE); names.setResolution(labelHash, address(0xCAFE), keccak256("profile"), keccak256("service"));
        vm.prank(ALICE); names.transferName(labelHash, BOB);
        vm.prank(BOB); names.acceptName(labelHash);
        Names420.Record memory record = names.resolve(labelHash);
        require(record.owner == BOB, "owner");
        require(record.resolvedAddress == BOB, "address reset");
        require(record.profileId == bytes32(0) && record.serviceId == bytes32(0), "links reset");
    }

    function testNamesCommitCannotBeReplayedAfterRegistration() public {
        Names420 names = new Names420(address(this));
        bytes32 labelHash = keccak256("bob"); bytes32 salt = keccak256("salt-bob"); uint64 duration = 30 days;
        bytes32 commitment = names.makeCommitment(labelHash, 3, BOB, duration, salt, BOB);
        vm.prank(BOB); names.commit(commitment);
        vm.warp(block.timestamp + names.MIN_COMMITMENT_AGE());
        vm.prank(BOB); names.register(labelHash, 3, BOB, duration, salt);
        vm.prank(BOB); vm.expectRevert(Names420.NameUnavailable.selector); names.register(labelHash, 3, BOB, duration, salt);
    }
}
