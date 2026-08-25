
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Canonical discovery registry for 420 protocol services.
/// Service IDs are stable bytes32 identifiers; presentation names are handled by 420 Names.
contract ProtocolRegistry is SystemAccess, I420System {
    struct Service {
        address implementation;
        bytes32 codeHash;
        bytes32 metadataHash;
        uint32 version;
        bool active;
    }

    mapping(bytes32 => Service) private _services;

    event ServiceSet(
        bytes32 indexed serviceId,
        address indexed implementation,
        bytes32 codeHash,
        bytes32 metadataHash,
        uint32 version,
        bool active
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "ProtocolRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setService(
        bytes32 serviceId,
        address implementation,
        bytes32 codeHash,
        bytes32 metadataHash,
        uint32 version,
        bool active
    ) external onlyGovernance {
        require(serviceId != bytes32(0), "service id");
        require(implementation != address(0), "implementation");
        _services[serviceId] = Service(implementation, codeHash, metadataHash, version, active);
        emit ServiceSet(serviceId, implementation, codeHash, metadataHash, version, active);
    }

    function getService(bytes32 serviceId) external view returns (Service memory) {
        return _services[serviceId];
    }
}
