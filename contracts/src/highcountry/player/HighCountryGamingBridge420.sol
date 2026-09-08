// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HighCountryGamingIds } from "./HighCountryGamingIds.sol";

interface IGameIdentityHC420 {
    struct GameProfile {
        bytes32 profileId;
        bytes32 gameId;
        address account;
        bytes32 externalProfileCommitment;
        uint64 createdAt;
        bool exists;
    }

    function profileIdOf(bytes32 gameId, address account) external view returns (bytes32);
    function profile(bytes32 profileId) external view returns (GameProfile memory);
}

interface IGameClaimsHC420 {
    struct MigrationClaim {
        bytes32 claimId;
        bytes32 gameId;
        address targetAccount;
        bytes32 guestStateCommitment;
        bytes32 migrationPayloadHash;
        uint64 validUntil;
        bool consumed;
        bool cancelled;
        bool exists;
    }

    function claim(bytes32 claimId) external view returns (MigrationClaim memory);
}

interface IGameEntitlementsHC420 {
    struct Entitlement {
        bytes32 entitlementId;
        bytes32 profileId;
        bytes32 gameId;
        bytes32 entitlementType;
        bytes32 contentId;
        uint64 validFrom;
        uint64 validUntil;
        bool revoked;
        bool exists;
    }

    function entitlement(bytes32 entitlementId) external view returns (Entitlement memory);
    function isActive(bytes32 entitlementId) external view returns (bool);
}

interface IGrowerProfileHC420 {
    struct GrowerProfile {
        uint64 id;
        address account;
        uint16 homeRegionId;
        uint64 createdAt;
        bool exists;
    }

    function getProfile(uint64 profileId) external view returns (GrowerProfile memory);
}

contract HighCountryGamingBridge420 {
    IGameIdentityHC420 public immutable gameIdentity;
    IGameClaimsHC420 public immutable gameClaims;
    IGameEntitlementsHC420 public immutable gameEntitlements;
    IGrowerProfileHC420 public immutable growerProfiles;

    mapping(uint64 => bytes32) public gameProfileIdOfGrower;
    mapping(bytes32 => uint64) public growerProfileIdOfGameProfile;
    mapping(bytes32 => uint64) public growerProfileIdOfMigrationClaim;

    error ZeroAddress();
    error GrowerAccountMismatch();
    error SharedProfileRequired();
    error InvalidSharedProfile();
    error GrowerAlreadyBound();
    error SharedProfileAlreadyBound();
    error MigrationClaimUnavailable();
    error MigrationClaimMismatch();
    error MigrationClaimAlreadyBound();

    event GrowerGamingProfileBound(uint64 indexed growerProfileId, bytes32 indexed gameProfileId, address indexed account);
    event MigrationClaimBound(bytes32 indexed claimId, uint64 indexed growerProfileId, bytes32 indexed gameProfileId);

    constructor(address gameIdentity_, address gameClaims_, address gameEntitlements_, address growerProfiles_) {
        if (gameIdentity_ == address(0) || gameClaims_ == address(0) || gameEntitlements_ == address(0) || growerProfiles_ == address(0)) {
            revert ZeroAddress();
        }
        gameIdentity = IGameIdentityHC420(gameIdentity_);
        gameClaims = IGameClaimsHC420(gameClaims_);
        gameEntitlements = IGameEntitlementsHC420(gameEntitlements_);
        growerProfiles = IGrowerProfileHC420(growerProfiles_);
    }

    function gameId() external pure returns (bytes32) {
        return HighCountryGamingIds.GAME_ID;
    }

    function sharedProfileOf(address account) public view returns (bytes32) {
        return gameIdentity.profileIdOf(HighCountryGamingIds.GAME_ID, account);
    }

    function bindGrowerProfile(uint64 growerProfileId) external returns (bytes32 gameProfileId) {
        IGrowerProfileHC420.GrowerProfile memory grower = growerProfiles.getProfile(growerProfileId);
        if (grower.account != msg.sender) revert GrowerAccountMismatch();
        if (gameProfileIdOfGrower[growerProfileId] != bytes32(0)) revert GrowerAlreadyBound();

        gameProfileId = sharedProfileOf(msg.sender);
        if (gameProfileId == bytes32(0)) revert SharedProfileRequired();
        if (growerProfileIdOfGameProfile[gameProfileId] != 0) revert SharedProfileAlreadyBound();

        IGameIdentityHC420.GameProfile memory shared = gameIdentity.profile(gameProfileId);
        if (!shared.exists || shared.gameId != HighCountryGamingIds.GAME_ID || shared.account != msg.sender) {
            revert InvalidSharedProfile();
        }

        gameProfileIdOfGrower[growerProfileId] = gameProfileId;
        growerProfileIdOfGameProfile[gameProfileId] = growerProfileId;
        emit GrowerGamingProfileBound(growerProfileId, gameProfileId, msg.sender);
    }

    function bindConsumedMigrationClaim(bytes32 claimId, uint64 growerProfileId, bytes32 expectedPayloadHash) external {
        if (growerProfileIdOfMigrationClaim[claimId] != 0) revert MigrationClaimAlreadyBound();

        bytes32 gameProfileId = gameProfileIdOfGrower[growerProfileId];
        if (gameProfileId == bytes32(0)) revert SharedProfileRequired();

        IGameIdentityHC420.GameProfile memory shared = gameIdentity.profile(gameProfileId);
        if (shared.account != msg.sender || shared.gameId != HighCountryGamingIds.GAME_ID) revert InvalidSharedProfile();

        IGameClaimsHC420.MigrationClaim memory migration = gameClaims.claim(claimId);
        if (!migration.exists || !migration.consumed || migration.cancelled) revert MigrationClaimUnavailable();
        if (
            migration.gameId != HighCountryGamingIds.GAME_ID ||
            migration.targetAccount != msg.sender ||
            migration.migrationPayloadHash != expectedPayloadHash
        ) revert MigrationClaimMismatch();

        growerProfileIdOfMigrationClaim[claimId] = growerProfileId;
        emit MigrationClaimBound(claimId, growerProfileId, gameProfileId);
    }

    function hasActiveEntitlement(uint64 growerProfileId, bytes32 entitlementId) external view returns (bool) {
        bytes32 gameProfileId = gameProfileIdOfGrower[growerProfileId];
        if (gameProfileId == bytes32(0)) return false;
        if (!gameEntitlements.isActive(entitlementId)) return false;

        IGameEntitlementsHC420.Entitlement memory record = gameEntitlements.entitlement(entitlementId);
        return record.exists && record.gameId == HighCountryGamingIds.GAME_ID && record.profileId == gameProfileId;
    }
}
