// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract RightsPolicyRegistry420 is SystemAccess, I420System {
    struct RightClassPolicy {
        bytes32 metadataHash;
        uint32 revision;
        bool active;
        bool exists;
    }

    mapping(bytes32 => RightClassPolicy) private _policies;

    error InvalidRightClass();
    error PolicyNotFound();

    event RightClassPolicyConfigured(bytes32 indexed rightClass, bytes32 metadataHash, uint32 revision, bool active);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "RightsPolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setRightClass(bytes32 rightClass, bytes32 metadataHash, bool active) external onlyGovernance {
        if (rightClass == bytes32(0)) revert InvalidRightClass();
        RightClassPolicy storage p = _policies[rightClass];
        uint32 nextRevision = p.exists ? p.revision + 1 : 1;
        p.metadataHash = metadataHash;
        p.revision = nextRevision;
        p.active = active;
        p.exists = true;
        emit RightClassPolicyConfigured(rightClass, metadataHash, nextRevision, active);
    }

    function getRightClass(bytes32 rightClass) external view returns (RightClassPolicy memory p) {
        p = _policies[rightClass];
        if (!p.exists) revert PolicyNotFound();
    }

    function isActiveRightClass(bytes32 rightClass) external view returns (bool) {
        return _policies[rightClass].exists && _policies[rightClass].active;
    }
}
