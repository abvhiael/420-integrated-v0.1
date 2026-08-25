
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";

/// @notice Optional pseudonymous profile and credential anchor.
/// No wallet is required to create a public profile.
contract Identity420 is SystemAccess {
    struct Profile {
        address controller;
        bytes32 metadataHash;
        bool active;
    }
    struct Credential {
        bytes32 issuerId;
        bytes32 subjectProfileId;
        bytes32 credentialType;
        bytes32 claimHash;
        uint64 expiresAt;
        bool revoked;
    }

    mapping(bytes32 => Profile) public profiles;
    mapping(bytes32 => Credential) public credentials;

    event ProfileCreated(bytes32 indexed profileId, address indexed controller, bytes32 metadataHash);
    event CredentialIssued(bytes32 indexed credentialId, bytes32 indexed subjectProfileId, bytes32 credentialType);
    event CredentialRevoked(bytes32 indexed credentialId);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function createProfile(bytes32 profileId, bytes32 metadataHash) external {
        require(profileId != bytes32(0) && profiles[profileId].controller == address(0), "invalid/exists");
        profiles[profileId] = Profile(msg.sender, metadataHash, true);
        emit ProfileCreated(profileId, msg.sender, metadataHash);
    }

    function updateProfile(bytes32 profileId, bytes32 metadataHash, bool active) external {
        require(profiles[profileId].controller == msg.sender, "controller");
        profiles[profileId].metadataHash = metadataHash;
        profiles[profileId].active = active;
    }

    /// @dev Issuer authorization is governance-controlled in v1; future credential issuer registry may replace it.
    function issueCredential(
        bytes32 credentialId,
        bytes32 issuerId,
        bytes32 subjectProfileId,
        bytes32 credentialType,
        bytes32 claimHash,
        uint64 expiresAt
    ) external onlyGovernance {
        require(credentials[credentialId].subjectProfileId == bytes32(0), "exists");
        require(profiles[subjectProfileId].controller != address(0), "profile");
        credentials[credentialId] = Credential(
            issuerId, subjectProfileId, credentialType, claimHash, expiresAt, false
        );
        emit CredentialIssued(credentialId, subjectProfileId, credentialType);
    }

    function revokeCredential(bytes32 credentialId) external onlyGovernance {
        require(credentials[credentialId].subjectProfileId != bytes32(0), "unknown");
        credentials[credentialId].revoked = true;
        emit CredentialRevoked(credentialId);
    }
}
