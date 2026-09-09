// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HighCountryCrossGame420 } from "../../../../src/highcountry/player/HighCountryCrossGame420.sol";
import { HighCountryGamingIds } from "../../../../src/highcountry/player/HighCountryGamingIds.sol";

contract MockHCBindingCrossGame {
    mapping(uint64 => bytes32) public gameProfileIdOfGrower;
    function setBinding(uint64 growerProfileId, bytes32 profileId) external { gameProfileIdOfGrower[growerProfileId] = profileId; }
}

contract MockCrossGameRegistryHC {
    struct Attestation {
        bytes32 attestationId;
        bytes32 sourceGameId;
        bytes32 profileId;
        bytes32 subjectType;
        bytes32 subjectId;
        bytes32 payloadHash;
        uint64 validUntil;
        bool revoked;
        bool exists;
    }
    mapping(bytes32 => Attestation) internal records;
    mapping(bytes32 => bool) internal active;

    function setAttestation(Attestation calldata a, bool isActive_) external {
        records[a.attestationId] = a;
        active[a.attestationId] = isActive_;
    }
    function attestation(bytes32 id) external view returns (Attestation memory) { return records[id]; }
    function isActive(bytes32 id) external view returns (bool) { return active[id]; }
}

contract HighCountryCrossGame420Test {
    MockHCBindingCrossGame binding;
    MockCrossGameRegistryHC registry;
    HighCountryCrossGame420 access;

    uint64 constant GROWER = 7;
    bytes32 constant PROFILE = keccak256("profile");
    bytes32 constant ATTESTATION = keccak256("attestation");
    bytes32 constant SUBJECT_ID = keccak256("cup-2027-champion");
    bytes32 constant PAYLOAD = keccak256("result-root");

    function setUp() public {
        binding = new MockHCBindingCrossGame();
        registry = new MockCrossGameRegistryHC();
        access = new HighCountryCrossGame420(address(registry), address(binding));
        binding.setBinding(GROWER, PROFILE);
    }

    function testMatchingHighCountryAttestationPasses() public {
        setUp();
        bytes32 subjectType = access.global420CupSubject();
        registry.setAttestation(
            MockCrossGameRegistryHC.Attestation({
                attestationId: ATTESTATION,
                sourceGameId: HighCountryGamingIds.GAME_ID,
                profileId: PROFILE,
                subjectType: subjectType,
                subjectId: SUBJECT_ID,
                payloadHash: PAYLOAD,
                validUntil: 0,
                revoked: false,
                exists: true
            }),
            true
        );
        require(access.hasScopedAttestation(GROWER, ATTESTATION, subjectType, SUBJECT_ID, PAYLOAD), "attestation rejected");
    }

    function testCrossGameSourceRejected() public {
        setUp();
        bytes32 subjectType = access.global420CupSubject();
        registry.setAttestation(
            MockCrossGameRegistryHC.Attestation({
                attestationId: ATTESTATION,
                sourceGameId: keccak256("other-game"),
                profileId: PROFILE,
                subjectType: subjectType,
                subjectId: SUBJECT_ID,
                payloadHash: PAYLOAD,
                validUntil: 0,
                revoked: false,
                exists: true
            }),
            true
        );
        require(!access.hasScopedAttestation(GROWER, ATTESTATION, subjectType, SUBJECT_ID, PAYLOAD), "cross-game source accepted");
    }

    function testWrongPayloadRejected() public {
        setUp();
        bytes32 subjectType = access.breederMilestoneSubject();
        registry.setAttestation(
            MockCrossGameRegistryHC.Attestation({
                attestationId: ATTESTATION,
                sourceGameId: HighCountryGamingIds.GAME_ID,
                profileId: PROFILE,
                subjectType: subjectType,
                subjectId: SUBJECT_ID,
                payloadHash: PAYLOAD,
                validUntil: 0,
                revoked: false,
                exists: true
            }),
            true
        );
        require(!access.hasScopedAttestation(GROWER, ATTESTATION, subjectType, SUBJECT_ID, keccak256("wrong")), "wrong payload accepted");
    }

    function testInactiveAttestationRejected() public {
        setUp();
        bytes32 subjectType = access.seasonalAchievementSubject();
        registry.setAttestation(
            MockCrossGameRegistryHC.Attestation({
                attestationId: ATTESTATION,
                sourceGameId: HighCountryGamingIds.GAME_ID,
                profileId: PROFILE,
                subjectType: subjectType,
                subjectId: SUBJECT_ID,
                payloadHash: PAYLOAD,
                validUntil: 0,
                revoked: true,
                exists: true
            }),
            false
        );
        require(!access.hasScopedAttestation(GROWER, ATTESTATION, subjectType, SUBJECT_ID, PAYLOAD), "inactive attestation accepted");
    }

    function testUnboundGrowerRejected() public {
        setUp();
        require(!access.hasScopedAttestation(99, ATTESTATION, access.strainDiscoverySubject(), SUBJECT_ID, PAYLOAD), "unbound grower accepted");
    }
}
