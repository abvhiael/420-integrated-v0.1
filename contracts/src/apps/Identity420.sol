// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "../interfaces/genesis/IIdentityCredential420.sol";
import "../interfaces/genesis/Types420.sol";

/// @notice Optional pseudonymous profile and credential anchor for 420 Integrated.
/// @dev Directly implements the frozen Genesis credential read interface. Subject/type compatibility
///      reads mean "any currently valid credential" across bounded live candidates; canonical credential
///      history remains keyed by immutable credentialId.
contract Identity420 is SystemAccess, I420System, IIdentityCredential420 {
    enum TrustClass { NONE, COMMUNITY, VERIFIED, INSTITUTIONAL, SYSTEM }

    /// @dev Bounds shared-interface subject/type reads. Permanently invalid credentials are removed
    ///      from the candidate set, while canonical credential history remains immutable.
    uint256 public constant MAX_CREDENTIAL_CANDIDATES = 32;

    struct Profile {
        address controller;
        address pendingController;
        bytes32 metadataHash;
        bytes32 primaryName;
        uint64 createdAt;
        uint64 updatedAt;
        bool active;
    }

    struct Issuer {
        address controller;
        bytes32 metadataHash;
        TrustClass trustClass;
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
    mapping(bytes32 => mapping(bytes32 => bytes32[])) private _credentialCandidates;

    error InvalidProfileId(); error ProfileExists(); error UnknownProfile(); error NotProfileController();
    error InvalidController(); error NotPendingController(); error InvalidIssuerId(); error UnknownIssuer();
    error InactiveIssuer(); error NotIssuerController(); error InvalidCredentialId(); error CredentialExists();
    error UnknownCredential(); error AlreadyRevoked(); error InvalidExpiry(); error NotCredentialSubject();
    error InvalidTrustClass(); error TooManyCredentialCandidates();

    event ProfileCreated(bytes32 indexed profileId, address indexed controller, bytes32 metadataHash);
    event ProfileUpdated(bytes32 indexed profileId, bytes32 metadataHash, bool active);
    event PrimaryNameSet(bytes32 indexed profileId, bytes32 indexed labelHash);
    event ProfileControllerTransferStarted(bytes32 indexed profileId, address indexed currentController, address indexed pendingController);
    event ProfileControllerTransferred(bytes32 indexed profileId, address indexed previousController, address indexed newController);
    event IssuerSet(bytes32 indexed issuerId, address indexed controller, bytes32 metadataHash, TrustClass trustClass, bool active);
    event CredentialIssued(bytes32 indexed credentialId, bytes32 indexed issuerId, bytes32 indexed subjectProfileId, bytes32 credentialType, bytes32 claimHash, uint64 expiresAt);
    event CredentialRevoked(bytes32 indexed credentialId, bytes32 indexed issuerId);
    event CredentialRejected(bytes32 indexed credentialId, bytes32 indexed subjectProfileId);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "Identity420"; }
    function protocolVersion() external pure returns (uint32) { return 3; }

    function createProfile(bytes32 profileId, bytes32 metadataHash) external {
        if (profileId == bytes32(0)) revert InvalidProfileId();
        if (profiles[profileId].controller != address(0)) revert ProfileExists();
        uint64 nowTs = uint64(block.timestamp);
        profiles[profileId] = Profile(msg.sender, address(0), metadataHash, bytes32(0), nowTs, nowTs, true);
        emit ProfileCreated(profileId, msg.sender, metadataHash);
    }

    function updateProfile(bytes32 profileId, bytes32 metadataHash, bool active) external {
        Profile storage p = profiles[profileId];
        if (p.controller == address(0)) revert UnknownProfile();
        if (p.controller != msg.sender) revert NotProfileController();
        p.metadataHash = metadataHash; p.updatedAt = uint64(block.timestamp); p.active = active;
        emit ProfileUpdated(profileId, metadataHash, active);
    }

    function setPrimaryName(bytes32 profileId, bytes32 labelHash) external {
        Profile storage p = profiles[profileId];
        if (p.controller == address(0)) revert UnknownProfile();
        if (p.controller != msg.sender) revert NotProfileController();
        p.primaryName = labelHash; p.updatedAt = uint64(block.timestamp);
        emit PrimaryNameSet(profileId, labelHash);
    }

    function transferProfileController(bytes32 profileId, address newController) external {
        Profile storage p = profiles[profileId];
        if (p.controller == address(0)) revert UnknownProfile();
        if (p.controller != msg.sender) revert NotProfileController();
        if (newController == address(0) || newController == msg.sender) revert InvalidController();
        p.pendingController = newController;
        emit ProfileControllerTransferStarted(profileId, msg.sender, newController);
    }

    function acceptProfileController(bytes32 profileId) external {
        Profile storage p = profiles[profileId];
        if (p.controller == address(0)) revert UnknownProfile();
        if (p.pendingController != msg.sender) revert NotPendingController();
        address previous = p.controller; p.controller = msg.sender; p.pendingController = address(0); p.updatedAt = uint64(block.timestamp);
        emit ProfileControllerTransferred(profileId, previous, msg.sender);
    }

    function setIssuer(bytes32 issuerId, address controller, bytes32 metadataHash, bool active) external onlyGovernance {
        _setIssuer(issuerId, controller, metadataHash, TrustClass.VERIFIED, active);
    }

    function setIssuerTrust(bytes32 issuerId, address controller, bytes32 metadataHash, TrustClass trustClass, bool active) external onlyGovernance {
        _setIssuer(issuerId, controller, metadataHash, trustClass, active);
    }

    function _setIssuer(bytes32 issuerId, address controller, bytes32 metadataHash, TrustClass trustClass, bool active) private {
        if (issuerId == bytes32(0)) revert InvalidIssuerId();
        if (controller == address(0)) revert InvalidController();
        if (trustClass == TrustClass.NONE) revert InvalidTrustClass();
        issuers[issuerId] = Issuer(controller, metadataHash, trustClass, active);
        emit IssuerSet(issuerId, controller, metadataHash, trustClass, active);
    }

    function issueCredential(bytes32 credentialId, bytes32 issuerId, bytes32 subjectProfileId, bytes32 credentialType, bytes32 claimHash, uint64 expiresAt) external {
        if (credentialId == bytes32(0)) revert InvalidCredentialId();
        if (credentials[credentialId].subjectProfileId != bytes32(0)) revert CredentialExists();
        Issuer memory issuer = issuers[issuerId];
        if (issuer.controller == address(0)) revert UnknownIssuer();
        if (!issuer.active) revert InactiveIssuer();
        if (issuer.controller != msg.sender) revert NotIssuerController();
        if (profiles[subjectProfileId].controller == address(0)) revert UnknownProfile();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();

        _pruneCredentialCandidates(subjectProfileId, credentialType);
        bytes32[] storage candidates = _credentialCandidates[subjectProfileId][credentialType];
        if (candidates.length >= MAX_CREDENTIAL_CANDIDATES) revert TooManyCredentialCandidates();

        credentials[credentialId] = Credential(issuerId, subjectProfileId, credentialType, claimHash, uint64(block.timestamp), expiresAt, 0, false);
        candidates.push(credentialId);
        emit CredentialIssued(credentialId, issuerId, subjectProfileId, credentialType, claimHash, expiresAt);
    }

    function revokeCredential(bytes32 credentialId) external {
        Credential storage c = credentials[credentialId];
        if (c.subjectProfileId == bytes32(0)) revert UnknownCredential();
        if (c.revokedAt != 0) revert AlreadyRevoked();
        Issuer memory issuer = issuers[c.issuerId];
        if (issuer.controller != msg.sender && msg.sender != governanceTimelock) revert NotIssuerController();
        c.revokedAt = uint64(block.timestamp);
        _removeCredentialCandidate(c.subjectProfileId, c.credentialType, credentialId);
        emit CredentialRevoked(credentialId, c.issuerId);
    }

    function rejectCredential(bytes32 credentialId) external {
        Credential storage c = credentials[credentialId];
        if (c.subjectProfileId == bytes32(0)) revert UnknownCredential();
        if (profiles[c.subjectProfileId].controller != msg.sender) revert NotCredentialSubject();
        c.subjectRejected = true;
        _removeCredentialCandidate(c.subjectProfileId, c.credentialType, credentialId);
        emit CredentialRejected(credentialId, c.subjectProfileId);
    }

    function credentialValid(bytes32 credentialId) public view returns (bool) {
        Credential memory c = credentials[credentialId];
        if (c.subjectProfileId == bytes32(0) || c.revokedAt != 0 || c.subjectRejected) return false;
        if (c.expiresAt != 0 && block.timestamp >= c.expiresAt) return false;
        if (!issuers[c.issuerId].active) return false;
        return profiles[c.subjectProfileId].active;
    }

    function credentialMeetsTrust(bytes32 credentialId, TrustClass minimumTrust) external view returns (bool) {
        if (!credentialValid(credentialId)) return false;
        return uint8(issuers[credentials[credentialId].issuerId].trustClass) >= uint8(minimumTrust);
    }

    /// @notice Frozen-v1 compatibility view for one immutable credential ID.
    /// @dev revoked means explicit issuer/governance revocation only. Other invalidity (expiry,
    ///      subject rejection, inactive issuer/profile) is represented by hasValidCredential/credentialValid.
    function credential(bytes32 credentialId) external view override returns (CredentialView memory view_) {
        Credential memory c = credentials[credentialId];
        if (c.subjectProfileId == bytes32(0)) return view_;
        view_ = CredentialView({
            subjectId: c.subjectProfileId,
            credentialType: c.credentialType,
            issuerId: c.issuerId,
            assurance: _identityAssurance(issuers[c.issuerId].trustClass),
            issuedAt: c.issuedAt,
            expiresAt: c.expiresAt,
            revoked: c.revokedAt != 0
        });
    }

    /// @notice True when any bounded canonical candidate for subject/type is currently valid.
    /// @dev Multiple issuers and credentials are allowed. No newest/highest-trust precedence is invented.
    function hasValidCredential(bytes32 subjectId, bytes32 credentialType) external view override returns (bool) {
        bytes32[] storage candidates = _credentialCandidates[subjectId][credentialType];
        for (uint256 i = 0; i < candidates.length; ++i) {
            if (credentialValid(candidates[i])) return true;
        }
        return false;
    }

    function _identityAssurance(TrustClass trustClass) private pure returns (Types420.IdentityAssurance) {
        if (trustClass == TrustClass.COMMUNITY) return Types420.IdentityAssurance.SELF_ASSERTED;
        if (trustClass == TrustClass.VERIFIED) return Types420.IdentityAssurance.ATTESTED;
        if (trustClass == TrustClass.INSTITUTIONAL || trustClass == TrustClass.SYSTEM) {
            return Types420.IdentityAssurance.CREDENTIALED;
        }
        return Types420.IdentityAssurance.NONE;
    }

    function _pruneCredentialCandidates(bytes32 subjectProfileId, bytes32 credentialType) private {
        bytes32[] storage candidates = _credentialCandidates[subjectProfileId][credentialType];
        uint256 i = 0;
        while (i < candidates.length) {
            Credential storage c = credentials[candidates[i]];
            bool permanentlyInvalid =
                c.revokedAt != 0 ||
                c.subjectRejected ||
                (c.expiresAt != 0 && block.timestamp >= c.expiresAt);
            if (permanentlyInvalid) {
                candidates[i] = candidates[candidates.length - 1];
                candidates.pop();
            } else {
                ++i;
            }
        }
    }

    function _removeCredentialCandidate(bytes32 subjectProfileId, bytes32 credentialType, bytes32 credentialId) private {
        bytes32[] storage candidates = _credentialCandidates[subjectProfileId][credentialType];
        for (uint256 i = 0; i < candidates.length; ++i) {
            if (candidates[i] == credentialId) {
                candidates[i] = candidates[candidates.length - 1];
                candidates.pop();
                return;
            }
        }
    }
}
