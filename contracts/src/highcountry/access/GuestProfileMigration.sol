// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGrowerProfileMigration {
    struct GrowerProfile {
        uint64 id;
        address account;
        uint16 homeRegionId;
        uint64 createdAt;
        bool exists;
    }

    function getProfile(uint64 profileId) external view returns (GrowerProfile memory);
}

/// @notice HC-PA.3 deterministic guest/registered profile claim registry.
/// It records provenance and one-time eligibility consumption only; it does not
/// mint or transfer gameplay assets itself.
contract GuestProfileMigration {
    enum CanonicalObjectKind {
        REGISTERED_CULTIVAR,
        SIGNIFICANT_GENETIC_LINEAGE,
        CHAMPIONSHIP_RESULT,
        MARKETPLACE_ASSET,
        TRANSFERABLE_SEED_OR_CLONE,
        CROSS_GAME_ASSET,
        ECOSYSTEM_REWARD,
        SIGNIFICANT_ACHIEVEMENT,
        LICENSING_RIGHT
    }

    struct ProfileClaim {
        bytes32 sourceProfileId;
        uint64 growerProfileId;
        address account;
        bytes32 manifestRoot;
        uint32 policyVersion;
        uint64 claimedAt;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IGrowerProfileMigration public immutable growerProfiles;

    mapping(bytes32 => ProfileClaim) private _claims;
    mapping(uint64 => bytes32) public sourceProfileOfGrowerProfile;
    mapping(bytes32 => bool) public consumedObject;

    event ProfileClaimed(
        bytes32 indexed sourceProfileId,
        uint64 indexed growerProfileId,
        address indexed account,
        bytes32 manifestRoot,
        uint32 policyVersion
    );
    event MigrationObjectConsumed(
        bytes32 indexed sourceProfileId,
        bytes32 indexed objectId,
        CanonicalObjectKind indexed kind,
        bytes32 payloadHash
    );

    constructor(address authorization_, address growerProfiles_) {
        require(authorization_ != address(0) && growerProfiles_ != address(0), "HC-PA: zero address");
        authorization = IHighCountryAuthorization(authorization_);
        growerProfiles = IGrowerProfileMigration(growerProfiles_);
    }

    /// @notice Bind a guest/registered source profile to exactly one canonical GrowerProfile.
    /// Replaying the exact same claim is idempotent and returns false.
    function claimProfile(
        bytes32 sourceProfileId,
        uint64 growerProfileId,
        bytes32 manifestRoot,
        uint32 policyVersion
    ) external returns (bool created) {
        require(sourceProfileId != bytes32(0) && growerProfileId != 0, "HC-PA: invalid profile");
        require(manifestRoot != bytes32(0) && policyVersion != 0, "HC-PA: invalid manifest");

        IGrowerProfileMigration.GrowerProfile memory gp = growerProfiles.getProfile(growerProfileId);
        require(gp.exists && gp.account == msg.sender, "HC-PA: not grower account");
        _auth(sourceProfileId);

        ProfileClaim storage existing = _claims[sourceProfileId];
        if (existing.exists) {
            require(
                existing.growerProfileId == growerProfileId
                    && existing.account == msg.sender
                    && existing.manifestRoot == manifestRoot
                    && existing.policyVersion == policyVersion,
                "HC-PA: conflicting replay"
            );
            return false;
        }

        bytes32 boundSource = sourceProfileOfGrowerProfile[growerProfileId];
        require(boundSource == bytes32(0), "HC-PA: grower already claimed");

        _claims[sourceProfileId] = ProfileClaim({
            sourceProfileId: sourceProfileId,
            growerProfileId: growerProfileId,
            account: msg.sender,
            manifestRoot: manifestRoot,
            policyVersion: policyVersion,
            claimedAt: uint64(block.timestamp),
            exists: true
        });
        sourceProfileOfGrowerProfile[growerProfileId] = sourceProfileId;
        emit ProfileClaimed(sourceProfileId, growerProfileId, msg.sender, manifestRoot, policyVersion);
        return true;
    }

    /// @notice Consume one explicitly-manifested canonicalizable object.
    /// The object is not minted here; downstream canonical registries may use
    /// this proof/consumption record as the migration provenance gate.
    function consumeObject(
        bytes32 sourceProfileId,
        bytes32 objectId,
        CanonicalObjectKind kind,
        bytes32 payloadHash,
        bytes32[] calldata proof
    ) external returns (bytes32 objectKey) {
        ProfileClaim memory claim = _claims[sourceProfileId];
        require(claim.exists && claim.account == msg.sender, "HC-PA: unclaimed profile");
        require(objectId != bytes32(0) && payloadHash != bytes32(0), "HC-PA: invalid object");
        _auth(sourceProfileId);

        bytes32 leaf = migrationLeaf(sourceProfileId, objectId, kind, payloadHash, claim.policyVersion);
        require(_verifyProof(proof, claim.manifestRoot, leaf), "HC-PA: object not eligible");

        objectKey = keccak256(abi.encode(sourceProfileId, objectId));
        require(!consumedObject[objectKey], "HC-PA: object already consumed");
        consumedObject[objectKey] = true;
        emit MigrationObjectConsumed(sourceProfileId, objectId, kind, payloadHash);
    }

    function getClaim(bytes32 sourceProfileId) external view returns (ProfileClaim memory) {
        ProfileClaim memory claim = _claims[sourceProfileId];
        require(claim.exists, "HC-PA: claim not found");
        return claim;
    }

    function migrationLeaf(
        bytes32 sourceProfileId,
        bytes32 objectId,
        CanonicalObjectKind kind,
        bytes32 payloadHash,
        uint32 policyVersion
    ) public pure returns (bytes32) {
        return keccak256(abi.encode("HC.PA.MIGRATION.OBJECT.V1", sourceProfileId, objectId, kind, payloadHash, policyVersion));
    }

    function _auth(bytes32 sourceProfileId) private view {
        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.GUEST_MIGRATION,
                actionId: ActionIds.GUEST_MIGRATION_APPLY,
                scopeHash: sourceProfileId,
                amount: 0
            })
        );
    }

    function _verifyProof(bytes32[] calldata proof, bytes32 root, bytes32 leaf) private pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; ++i) {
            bytes32 sibling = proof[i];
            computed = computed <= sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
        }
        return root != bytes32(0) && computed == root;
    }
}
