// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract MediaCapabilityRegistry420 is SystemAccess, I420System {
    struct Capability {
        bytes32 metadataHash;
        uint64 createdAt;
        uint32 revision;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Capability) public capabilities;

    error InvalidCapabilityId();
    error CapabilityExists();
    error CapabilityNotFound();
    error NoChange();

    event CapabilityRegistered(bytes32 indexed capabilityId, bytes32 metadataHash);
    event CapabilityMetadataUpdated(bytes32 indexed capabilityId, bytes32 metadataHash, uint32 revision);
    event CapabilityStateChanged(bytes32 indexed capabilityId, bool active, uint32 revision);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "MediaCapabilityRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerCapability(bytes32 capabilityId, bytes32 metadataHash) external onlyGovernance {
        if (capabilityId == bytes32(0)) revert InvalidCapabilityId();
        if (capabilities[capabilityId].exists) revert CapabilityExists();
        capabilities[capabilityId] = Capability({
            metadataHash: metadataHash,
            createdAt: uint64(block.timestamp),
            revision: 1,
            active: true,
            exists: true
        });
        emit CapabilityRegistered(capabilityId, metadataHash);
    }

    function updateMetadata(bytes32 capabilityId, bytes32 metadataHash) external onlyGovernance {
        Capability storage c = _get(capabilityId);
        c.metadataHash = metadataHash;
        c.revision += 1;
        emit CapabilityMetadataUpdated(capabilityId, metadataHash, c.revision);
    }

    function setActive(bytes32 capabilityId, bool active) external onlyGovernance {
        Capability storage c = _get(capabilityId);
        if (c.active == active) revert NoChange();
        c.active = active;
        c.revision += 1;
        emit CapabilityStateChanged(capabilityId, active, c.revision);
    }

    function isActive(bytes32 capabilityId) external view returns (bool) {
        Capability storage c = capabilities[capabilityId];
        return c.exists && c.active;
    }

    function _get(bytes32 capabilityId) private view returns (Capability storage c) {
        c = capabilities[capabilityId];
        if (!c.exists) revert CapabilityNotFound();
    }
}
