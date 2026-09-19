// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

contract ComputePolicyRegistry420 is SystemAccess, I420System {
    struct Policy {
        bytes32 pricingClass;
        bytes32 slaHash;
        bytes32 verificationClass;
        bytes32 privacyHash;
        uint64 maxExecutionSeconds;
        uint128 maxUnits;
        uint32 revision;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Policy) private _policies;

    error InvalidPolicy();
    error PolicyNotFound();

    event PolicyConfigured(
        bytes32 indexed policyId,
        bytes32 pricingClass,
        bytes32 verificationClass,
        uint64 maxExecutionSeconds,
        uint128 maxUnits,
        uint32 revision,
        bool active
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "ComputePolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setPolicy(
        bytes32 policyId,
        bytes32 pricingClass,
        bytes32 slaHash,
        bytes32 verificationClass,
        bytes32 privacyHash,
        uint64 maxExecutionSeconds,
        uint128 maxUnits,
        bool active
    ) external onlyGovernance {
        if (
            policyId == bytes32(0) || pricingClass == bytes32(0) || slaHash == bytes32(0)
                || verificationClass == bytes32(0) || maxExecutionSeconds == 0 || maxUnits == 0
        ) revert InvalidPolicy();

        Policy storage p = _policies[policyId];
        p.pricingClass = pricingClass;
        p.slaHash = slaHash;
        p.verificationClass = verificationClass;
        p.privacyHash = privacyHash;
        p.maxExecutionSeconds = maxExecutionSeconds;
        p.maxUnits = maxUnits;
        p.revision = p.exists ? p.revision + 1 : 1;
        p.active = active;
        p.exists = true;
        emit PolicyConfigured(
            policyId,
            pricingClass,
            verificationClass,
            maxExecutionSeconds,
            maxUnits,
            p.revision,
            active
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
