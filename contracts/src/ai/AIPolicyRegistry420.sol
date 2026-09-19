// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./AIIds420.sol";

contract AIPolicyRegistry420 is SystemAccess, I420System {
    struct Policy {
        bytes32 workloadClass;
        bytes32 privacyPolicyHash;
        bytes32 verificationProfileId;
        bytes32 servicePricingPolicyId;
        uint256 maxSpend420;
        uint64 maxDeadlineSeconds;
        uint32 revision;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Policy) private _policies;

    error InvalidPolicy();
    error PolicyNotFound();

    event PolicyConfigured(
        bytes32 indexed policyId,
        bytes32 indexed workloadClass,
        bytes32 verificationProfileId,
        uint256 maxSpend420,
        uint32 revision,
        bool active
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "AIPolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setPolicy(
        bytes32 policyId,
        bytes32 workloadClass,
        bytes32 privacyPolicyHash,
        bytes32 verificationProfileId,
        bytes32 servicePricingPolicyId,
        uint256 maxSpend420,
        uint64 maxDeadlineSeconds,
        bool active
    ) external onlyGovernance {
        if (
            policyId == bytes32(0) || !AIIds420.isWorkload(workloadClass)
                || verificationProfileId == bytes32(0) || servicePricingPolicyId == bytes32(0)
                || maxSpend420 == 0 || maxDeadlineSeconds == 0
        ) revert InvalidPolicy();

        Policy storage p = _policies[policyId];
        p.workloadClass = workloadClass;
        p.privacyPolicyHash = privacyPolicyHash;
        p.verificationProfileId = verificationProfileId;
        p.servicePricingPolicyId = servicePricingPolicyId;
        p.maxSpend420 = maxSpend420;
        p.maxDeadlineSeconds = maxDeadlineSeconds;
        p.revision = p.exists ? p.revision + 1 : 1;
        p.active = active;
        p.exists = true;

        emit PolicyConfigured(
            policyId, workloadClass, verificationProfileId, maxSpend420, p.revision, active
        );
    }

    function getPolicy(bytes32 policyId) external view returns (Policy memory p) {
        p = _policies[policyId];
        if (!p.exists) revert PolicyNotFound();
    }

    function isActive(bytes32 policyId) external view returns (bool) {
        return _policies[policyId].exists && _policies[policyId].active;
    }
}
