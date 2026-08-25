
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";

/// @notice Minimal `.420` name registry/resolver.
/// Names are presentation aliases and do not override ProtocolRegistry truth.
contract Names420 is SystemAccess {
    struct Record {
        address owner;
        address resolvedAddress;
        bytes32 profileId;
        bytes32 serviceId;
        uint64 expiresAt;
    }

    mapping(bytes32 => Record) public records;

    event NameRegistered(bytes32 indexed labelHash, address indexed owner, uint64 expiresAt);
    event ResolutionUpdated(bytes32 indexed labelHash, address resolvedAddress, bytes32 profileId, bytes32 serviceId);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function register(bytes32 labelHash, uint64 expiresAt) external {
        require(labelHash != bytes32(0), "label");
        Record storage r = records[labelHash];
        require(r.owner == address(0) || block.timestamp >= r.expiresAt, "registered");
        require(expiresAt > block.timestamp, "expiry");
        records[labelHash] = Record(msg.sender, msg.sender, bytes32(0), bytes32(0), expiresAt);
        emit NameRegistered(labelHash, msg.sender, expiresAt);
    }

    function setResolution(
        bytes32 labelHash,
        address resolvedAddress,
        bytes32 profileId,
        bytes32 serviceId
    ) external {
        Record storage r = records[labelHash];
        require(r.owner == msg.sender, "owner");
        require(block.timestamp < r.expiresAt, "expired");
        r.resolvedAddress = resolvedAddress;
        r.profileId = profileId;
        r.serviceId = serviceId;
        emit ResolutionUpdated(labelHash, resolvedAddress, profileId, serviceId);
    }

    function transferName(bytes32 labelHash, address newOwner) external {
        Record storage r = records[labelHash];
        require(r.owner == msg.sender, "owner");
        require(newOwner != address(0), "zero");
        r.owner = newOwner;
    }
}
