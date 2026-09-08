// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { ActionIds } from "../constants/ActionIds.sol";
import { HighCountryGamingIds } from "./HighCountryGamingIds.sol";

interface IHighCountryGamingMigrationBridge420 {
    function growerProfileIdOfMigrationClaim(bytes32 claimId) external view returns (uint64);
}

interface IGameClaimsMigration420 {
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

library HighCountryMigrationCommitments420 {
    bytes32 internal constant GUEST_STATE_DOMAIN = keccak256("420/HC/GUEST_STATE/V1");
    bytes32 internal constant PAYLOAD_DOMAIN = keccak256("420/HC/MIGRATION_PAYLOAD/V1");

    function guestState(bytes32 guestAccountCommitment, uint64 saveRevision, bytes32 stateHash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(GUEST_STATE_DOMAIN, guestAccountCommitment, saveRevision, stateHash));
    }

    function payload(bytes32 guestStateCommitment, uint64 growerProfileId, uint32 schemaVersion, bytes32 payloadBodyHash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(PAYLOAD_DOMAIN, guestStateCommitment, growerProfileId, schemaVersion, payloadBodyHash));
    }
}

contract HighCountryMigration420 {
    struct AppliedMigration {
        uint64 growerProfileId;
        bytes32 guestStateCommitment;
        bytes32 migrationPayloadHash;
        uint64 appliedAt;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IHighCountryGamingMigrationBridge420 public immutable gamingBridge;
    IGameClaimsMigration420 public immutable gameClaims;

    mapping(bytes32 => AppliedMigration) public appliedMigration;

    error ZeroAddress();
    error InvalidMigration();
    error MigrationAlreadyApplied();

    event MigrationApplied(
        bytes32 indexed claimId,
        uint64 indexed growerProfileId,
        bytes32 guestStateCommitment,
        bytes32 migrationPayloadHash
    );

    constructor(address authorization_, address gamingBridge_, address gameClaims_) {
        if (authorization_ == address(0) || gamingBridge_ == address(0) || gameClaims_ == address(0)) revert ZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        gamingBridge = IHighCountryGamingMigrationBridge420(gamingBridge_);
        gameClaims = IGameClaimsMigration420(gameClaims_);
    }

    function guestStateCommitment(bytes32 guestAccountCommitment, uint64 saveRevision, bytes32 stateHash)
        external
        pure
        returns (bytes32)
    {
        return HighCountryMigrationCommitments420.guestState(guestAccountCommitment, saveRevision, stateHash);
    }

    function migrationPayloadHash(
        bytes32 guestStateCommitment_,
        uint64 growerProfileId,
        uint32 schemaVersion,
        bytes32 payloadBodyHash
    ) external pure returns (bytes32) {
        return HighCountryMigrationCommitments420.payload(
            guestStateCommitment_, growerProfileId, schemaVersion, payloadBodyHash
        );
    }

    function isReadyToApply(
        bytes32 claimId,
        uint64 growerProfileId,
        bytes32 expectedGuestStateCommitment,
        bytes32 expectedPayloadHash
    ) public view returns (bool) {
        if (appliedMigration[claimId].exists) return false;
        if (gamingBridge.growerProfileIdOfMigrationClaim(claimId) != growerProfileId) return false;

        try gameClaims.claim(claimId) returns (IGameClaimsMigration420.MigrationClaim memory migration) {
            return migration.exists
                && migration.consumed
                && !migration.cancelled
                && migration.gameId == HighCountryGamingIds.GAME_ID
                && migration.guestStateCommitment == expectedGuestStateCommitment
                && migration.migrationPayloadHash == expectedPayloadHash;
        } catch {
            return false;
        }
    }

    function markApplied(
        bytes32 claimId,
        uint64 growerProfileId,
        bytes32 expectedGuestStateCommitment,
        bytes32 expectedPayloadHash
    ) external {
        if (appliedMigration[claimId].exists) revert MigrationAlreadyApplied();

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.GUEST_MIGRATION,
                actionId: ActionIds.GUEST_MIGRATION_APPLY,
                scopeHash: claimId,
                amount: 0
            })
        );

        if (!isReadyToApply(claimId, growerProfileId, expectedGuestStateCommitment, expectedPayloadHash)) {
            revert InvalidMigration();
        }

        appliedMigration[claimId] = AppliedMigration({
            growerProfileId: growerProfileId,
            guestStateCommitment: expectedGuestStateCommitment,
            migrationPayloadHash: expectedPayloadHash,
            appliedAt: uint64(block.timestamp),
            exists: true
        });

        emit MigrationApplied(claimId, growerProfileId, expectedGuestStateCommitment, expectedPayloadHash);
    }
}
