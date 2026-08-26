// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Optional pseudonymous profile and credential anchor for 420 Integrated.
/// @dev Profiles are controller-based identities, not transferable economic assets.
/// Credentials are issuer attestations; they do not grant protocol governance, custody,
/// validator, copyright, royalty, or other economic rights by themselves.
contract Identity420 is SystemAccess, I420System {
    struct Profile {
        address controller;
        address pendingController;
        bytes32 metadataHash;
        uint64 createdAt;
        uint64 updatedAt;
        bool active;
    }

    struct Issuer {
        address controller;
        bytes32 metadataHash;
        bool active;
    }

    struct Credential {
        bytes32 issuerId;
        bytes32 subjectProfileId;
        bytes32 credentialType;
        bytes32 claimHash;
        uint64 issuedAt;
        uint64 expiresAt;
        uint64 revokedAt;
        bool subjectRejected;
    }

    mapping(bytes32 => Profile) public profiles;
    mapping(bytes32 => Issuer) public issuers;
    mapping(bytes32 => Credential) public credentials;

    error InvalidProfileId();
    error ProfileExists();
    error UnknownProfile();
    error NotProfileController();
    error InvalidController();
    error NotPendingController();
    error InvalidIssuerId();
    error UnknownIssuer();
    error InactiveIssuer();
    error NotIssuerController();
    error InvalidCredentialId();
    error CredentialExists();
    error UnknownCredential();
    error AlreadyRevoked();
    error InvalidExpiry();
    error NotCredentialSubject();

    event ProfileCreated(bytes32 indexed profileId, address indexed controller, bytes32 metadataHash);
    event ProfileUpdated(bytes32 indexed profileId, bytes32 metadataHash, bool active);
    event ProfileControllerTransferStarted(bytes32 indexed profileId, address indexed currentController, address indexed pendingController);
    event ProfileControllerTransferred(bytes32 indexed profileId, address indexed previousController, address indexed newController);
    event IssuerSet(bytes32 indexed issuerId, address indexed controller, bytes32 metadataHash, bool active);
    event CredentialIssued(
        bytes32 indexed credentialId,
        bytes32 indexed issuerId,
        bytes32 indexed subjectProfileId,
        bytes32 credentialType,
        bytes32 claimHash,
        uint64 expiresAt
    );
    event CredentialRevoked(bytes32 indexed credentialId, bytes32 indexed issuerId);
    event CredentialRejected(bytes32 indexed credentialId, bytes32 indexed subjectProfileId);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "Identity420"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function createProfile(bytes32 profileId, bytes32 metadataHash) external {
        if (profileId == bytes32(0)) revert InvalidProfileId();
        if (profiles[profileId].controller != address(0)) revert ProfileExists();

        uint64 nowTs = uint64(block.timestamp);
        profiles[profileId] = Profile({
            controller: msg.sender,
            pendingController: address(0),
            metadataHash: metadataHash,
            createdAt: nowTs,
            updatedAt: nowTs,
            active: true
        });
        emit ProfileCreated(profileId, msg.sender, metadataHash);
    }

    function updateProfile(bytes32 profileId, bytes32 metadataHash, bool active) external {
        Profile storage profile = profiles[profileId];
        if (profile.controller == address(0)) revert UnknownProfile();
        if (profile.controller != msg.sender) revert NotProfileController();
        profile.metadataHash = metadataHash;
        profile.updatedAt = uint64(block.timestamp);
        profile.active = active;
        emit ProfileUpdated(profileId, metadataHash, active);
    }

    /// @notice Starts a two-step controller transfer. Recovery remains a smart-account concern.
    function transferProfileController(bytes32 profileId, address newController) external {
        Profile storage profile = profiles[profileId];
        if (profile.controller == address(0)) revert UnknownProfile();
        if (profile.controller != msg.sender) revert NotProfileController();
        if (newController == address(0) || newController == msg.sender) revert InvalidController();
        profile.pendingController = newController;
        emit ProfileControllerTransferStarted(profileId, msg.sender, newController);
    }

    function acceptProfileController(bytes32 profileId) external {
        Profile storage profile = profiles[profileId];
        if (profile.controller == address(0)) revert UnknownProfile();
        if (profile.pendingController != msg.sender) revert NotPendingController();
        address previous = profile.controller;
        profile.controller = msg.sender;
        profile.pendingController = address(0);
        profile.updatedAt = uint64(block.timestamp);
        emit ProfileControllerTransferred(profileId, previous, msg.sender);
    }

    /// @notice Governance authorizes credential issuers; authorized issuers issue/revoke their own attestations.
    function setIssuer(bytes32 issuerId, address controller, bytes32 metadataHash, bool active) external onlyGovernance {
        if (issuerId == bytes32(0)) revert InvalidIssuerId();
        if (controller == address(0)) revert InvalidController();
        issuers[issuerId] = Issuer(controller, metadataHash, active);
        emit IssuerSet(issuerId, controller, metadataHash, active);
    }

    function issueCredential(
        bytes32 credentialId,
        bytes32 issuerId,
        bytes32 subjectProfileId,
        bytes32 credentialType,
        bytes32 claimHash,
        uint64 expiresAt
    ) external {
        if (credentialId == bytes32(0)) revert InvalidCredentialId();
        if (credentials[credentialId].subjectProfileId != bytes32(0)) revert CredentialExists();

        Issuer memory issuer = issuers[issuerId];
        if (issuer.controller == address(0)) revert UnknownIssuer();
        if (!issuer.active) revert InactiveIssuer();
        if (issuer.controller != msg.sender) revert NotIssuerController();
        if (profiles[subjectProfileId].controller == address(0)) revert UnknownProfile();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();

        credentials[credentialId] = Credential({
            issuerId: issuerId,
            subjectProfileId: subjectProfileId,
            credentialType: credentialType,
            claimHash: claimHash,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revokedAt: 0,
            subjectRejected: false
        });

        emit CredentialIssued(credentialId, issuerId, subjectProfileId, credentialType, claimHash, expiresAt);
    }

    function revokeCredential(bytes32 credentialId) external {
        Credential storage credential = credentials[credentialId];
        if (credential.subjectProfileId == bytes32(0)) revert UnknownCredential();
        if (credential.revokedAt != 0) revert AlreadyRevoked();

        Issuer memory issuer = issuers[credential.issuerId];
        if (issuer.controller != msg.sender && msg.sender != governanceTimelock) revert NotIssuerController();
        credential.revokedAt = uint64(block.timestamp);
        emit CredentialRevoked(credentialId, credential.issuerId);
    }

    /// @notice Lets a subject explicitly reject an unwanted issuer assertion without deleting history.
    function rejectCredential(bytes32 credentialId) external {
        Credential storage credential = credentials[credentialId];
        if (credential.subjectProfileId == bytes32(0)) revert UnknownCredential();
        if (profiles[credential.subjectProfileId].controller != msg.sender) revert NotCredentialSubject();
        credential.subjectRejected = true;
        emit CredentialRejected(credentialId, credential.subjectProfileId);
    }

    function credentialValid(bytes32 credentialId) external view returns (bool) {
        Credential memory credential = credentials[credentialId];
        if (credential.subjectProfileId == bytes32(0)) return false;
        if (credential.revokedAt != 0 || credential.subjectRejected) return false;
        if (credential.expiresAt != 0 && block.timestamp >= credential.expiresAt) return false;
        if (!issuers[credential.issuerId].active) return false;
        return profiles[credential.subjectProfileId].active;
    }
}
