// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ICapabilityRegistry420 {
    struct CapabilityGrant {
        address principal;
        bytes32 componentId;
        bytes32 capabilityId;
        bytes32 scopeHash;
        uint256 perCallLimit;
        uint256 periodLimit;
        uint64 periodSeconds;
        uint64 validFrom;
        uint64 validUntil;
        bool revoked;
    }

    event CapabilityGranted(
        bytes32 indexed grantId,
        address indexed principal,
        bytes32 indexed capabilityId,
        bytes32 componentId,
        bytes32 scopeHash
    );
    event CapabilityRevoked(bytes32 indexed grantId);

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory);
    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount
    ) external view returns (bool);
}
