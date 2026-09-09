// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HighCountryGamingIds } from "./HighCountryGamingIds.sol";

interface IHighCountryCrossGameRegistry420 {
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

    function attestation(bytes32 attestationId) external view returns (Attestation memory);
    function isActive(bytes32 attestationId) external view returns (bool);
}

interface IHighCountryGamingProfileBinding420 {
    function gameProfileIdOfGrower(uint64 growerProfileId) external view returns (bytes32);
}

library HighCountryCrossGameIds420 {
    bytes32 internal constant SUBJECT_GLOBAL_420_CUP = keccak256("420/HC/CROSS_GAME/GLOBAL_420_CUP/V1");
    bytes32 internal constant SUBJECT_BREEDER_MILESTONE = keccak256("420/HC/CROSS_GAME/BREEDER_MILESTONE/V1");
    bytes32 internal constant SUBJECT_STRAIN_DISCOVERY = keccak256("420/HC/CROSS_GAME/STRAIN_DISCOVERY/V1");
    bytes32 internal constant SUBJECT_SEASONAL_ACHIEVEMENT = keccak256("420/HC/CROSS_GAME/SEASONAL_ACHIEVEMENT/V1");

    function attestationId(bytes32 profileId, bytes32 subjectType, bytes32 subjectId, bytes32 payloadHash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("420/HC/CROSS_GAME/ATTESTATION/V1", profileId, subjectType, subjectId, payloadHash));
    }
}

/// @notice High Country verifier for narrowly scoped cross-game achievements.
/// @dev Issuance remains in the shared CrossGameRegistry420 under the High Country game operator.
contract HighCountryCrossGame420 {
    IHighCountryCrossGameRegistry420 public immutable crossGameRegistry;
    IHighCountryGamingProfileBinding420 public immutable gamingBridge;

    error ZeroAddress();
    error UnsupportedSubjectType();
    error CrossGameAttestationRequired();

    constructor(address crossGameRegistry_, address gamingBridge_) {
        if (crossGameRegistry_ == address(0) || gamingBridge_ == address(0)) revert ZeroAddress();
        crossGameRegistry = IHighCountryCrossGameRegistry420(crossGameRegistry_);
        gamingBridge = IHighCountryGamingProfileBinding420(gamingBridge_);
    }

    function isSupportedSubjectType(bytes32 subjectType) public pure returns (bool) {
        return subjectType == HighCountryCrossGameIds420.SUBJECT_GLOBAL_420_CUP
            || subjectType == HighCountryCrossGameIds420.SUBJECT_BREEDER_MILESTONE
            || subjectType == HighCountryCrossGameIds420.SUBJECT_STRAIN_DISCOVERY
            || subjectType == HighCountryCrossGameIds420.SUBJECT_SEASONAL_ACHIEVEMENT;
    }

    function canonicalAttestationId(
        uint64 growerProfileId,
        bytes32 subjectType,
        bytes32 subjectId,
        bytes32 payloadHash
    ) external view returns (bytes32) {
        if (!isSupportedSubjectType(subjectType)) revert UnsupportedSubjectType();
        bytes32 profileId = gamingBridge.gameProfileIdOfGrower(growerProfileId);
        return HighCountryCrossGameIds420.attestationId(profileId, subjectType, subjectId, payloadHash);
    }

    function hasScopedAttestation(
        uint64 growerProfileId,
        bytes32 attestationId,
        bytes32 expectedSubjectType,
        bytes32 expectedSubjectId,
        bytes32 expectedPayloadHash
    ) public view returns (bool) {
        if (!isSupportedSubjectType(expectedSubjectType)) return false;
        bytes32 profileId = gamingBridge.gameProfileIdOfGrower(growerProfileId);
        if (profileId == bytes32(0)) return false;
        if (!crossGameRegistry.isActive(attestationId)) return false;

        IHighCountryCrossGameRegistry420.Attestation memory a = crossGameRegistry.attestation(attestationId);
        return a.exists
            && a.sourceGameId == HighCountryGamingIds.GAME_ID
            && a.profileId == profileId
            && a.subjectType == expectedSubjectType
            && a.subjectId == expectedSubjectId
            && a.payloadHash == expectedPayloadHash;
    }

    function requireScopedAttestation(
        uint64 growerProfileId,
        bytes32 attestationId,
        bytes32 expectedSubjectType,
        bytes32 expectedSubjectId,
        bytes32 expectedPayloadHash
    ) external view {
        if (!hasScopedAttestation(
            growerProfileId,
            attestationId,
            expectedSubjectType,
            expectedSubjectId,
            expectedPayloadHash
        )) revert CrossGameAttestationRequired();
    }

    function global420CupSubject() external pure returns (bytes32) {
        return HighCountryCrossGameIds420.SUBJECT_GLOBAL_420_CUP;
    }

    function breederMilestoneSubject() external pure returns (bytes32) {
        return HighCountryCrossGameIds420.SUBJECT_BREEDER_MILESTONE;
    }

    function strainDiscoverySubject() external pure returns (bytes32) {
        return HighCountryCrossGameIds420.SUBJECT_STRAIN_DISCOVERY;
    }

    function seasonalAchievementSubject() external pure returns (bytes32) {
        return HighCountryCrossGameIds420.SUBJECT_SEASONAL_ACHIEVEMENT;
    }
}
