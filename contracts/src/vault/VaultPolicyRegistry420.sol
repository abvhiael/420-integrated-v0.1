// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./VaultIds420.sol";

contract VaultPolicyRegistry420 is SystemAccess, I420System {
    struct Policy {
        bytes32 policyType;
        bytes32 semanticsHash;
        bytes32 metadataHash;
        uint32 revision;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Policy) private _policies;

    error InvalidPolicyId();
    error InvalidPolicyType();
    error InvalidSemanticsHash();
    error PolicyNotFound();
    error PolicySemanticChange();

    event PolicyConfigured(bytes32 indexed policyId, bytes32 indexed policyType, bytes32 semanticsHash, bytes32 metadataHash, uint32 revision, bool active);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "VaultPolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setPolicy(bytes32 policyId, bytes32 policyType, bytes32 semanticsHash, bytes32 metadataHash, bool active) external onlyGovernance {
        if (policyId == bytes32(0)) revert InvalidPolicyId();
        if (!_validPolicyType(policyType)) revert InvalidPolicyType();
        if (semanticsHash == bytes32(0)) revert InvalidSemanticsHash();
        Policy storage policy = _policies[policyId];
        if (policy.exists && (policy.policyType != policyType || policy.semanticsHash != semanticsHash)) revert PolicySemanticChange();
        uint32 revision = policy.exists ? policy.revision + 1 : 1;
        policy.policyType = policyType;
        policy.semanticsHash = semanticsHash;
        policy.metadataHash = metadataHash;
        policy.revision = revision;
        policy.active = active;
        policy.exists = true;
        emit PolicyConfigured(policyId, policyType, semanticsHash, metadataHash, revision, active);
    }

    function getPolicy(bytes32 policyId) external view returns (Policy memory policy) {
        policy = _policies[policyId];
        if (!policy.exists) revert PolicyNotFound();
    }

    function isActive(bytes32 policyId) external view returns (bool) {
        Policy storage policy = _policies[policyId];
        return policy.exists && policy.active;
    }

    function isActiveOfType(bytes32 policyId, bytes32 policyType) external view returns (bool) {
        Policy storage policy = _policies[policyId];
        return policy.exists && policy.active && policy.policyType == policyType;
    }

    function _validPolicyType(bytes32 x) private pure returns (bool) {
        return x == VaultIds420.POLICY_AUTHORIZATION || x == VaultIds420.POLICY_ASSET
            || x == VaultIds420.POLICY_RELEASE || x == VaultIds420.POLICY_ACCOUNTING;
    }
}
