// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice 420-IS v1 reusable interoperability interfaces.
/// @dev Implementations remain authoritative for their own domain; these interfaces do not transfer custody/admin authority.
interface I420ISIdentity {
    function canonicalSubject(address account) external view returns (bytes32 subjectId, bool active);
}

interface I420ISEntitlement {
    function entitlement(bytes32 subjectId, bytes32 resourceId, bytes32 entitlementId)
        external view returns (bool active, uint64 validUntil, bytes32 termsHash);
}

interface I420ISCapability {
    function isAuthorized(address principal, bytes32 componentId, bytes32 actionId, bytes32 scopeHash, uint256 amount)
        external view returns (bool);
}

interface I420ISPaymentReference {
    function paymentStatus(bytes32 paymentId)
        external view returns (uint8 status, address asset, uint256 amount, address payer, address recipient);
}

interface I420ISEncryptionEndpoint {
    function encryptionEndpoint(address account)
        external view returns (uint64 revision, bytes32 keyPackageHash, bytes32 transportHash, bool active);
}

interface I420ISSession {
    function sessionStatus(bytes32 sessionId)
        external view returns (address principal, bytes32 scopeHash, uint64 validUntil, bool revoked);
}

interface I420ISCheckpoint {
    function latestCheckpoint(bytes32 providerId, bytes32 domainId)
        external view returns (uint64 sequence, bytes32 stateHash, bytes32 checkpointHash);
}

interface I420ISPrivacyProof {
    function verifyProof(bytes32 policyId, bytes32 subjectCommitment, bytes calldata proof)
        external view returns (bool valid, bytes32 resultCommitment);
}

interface I420ISAdapter {
    function standardVersion() external pure returns (uint32);
    function adapterType() external view returns (bytes32);
    function supportsDomain(bytes32 domainId) external view returns (bool);
    function adapterManifestHash() external view returns (bytes32);
}
