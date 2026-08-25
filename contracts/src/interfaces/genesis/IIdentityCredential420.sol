// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";
interface IIdentityCredential420 {
    struct CredentialView {
        bytes32 subjectId; bytes32 credentialType; bytes32 issuerId;
        Types420.IdentityAssurance assurance; uint64 issuedAt; uint64 expiresAt; bool revoked;
    }
    function credential(bytes32 credentialId) external view returns (CredentialView memory);
    function hasValidCredential(bytes32 subjectId,bytes32 credentialType) external view returns (bool);
}
