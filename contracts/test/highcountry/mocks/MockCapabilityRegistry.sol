// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract MockCapabilityRegistry is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bytes32) private _grantIdsByAuthorizationKey;

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) {
        return _grants[grantId];
    }

    function setGrant(bytes32 grantId, CapabilityGrant calldata capabilityGrant, uint256 amount) external {
        _grants[grantId] = capabilityGrant;
        _grantIdsByAuthorizationKey[
            keccak256(
                abi.encode(
                    capabilityGrant.principal,
                    capabilityGrant.componentId,
                    capabilityGrant.capabilityId,
                    capabilityGrant.scopeHash,
                    amount
                )
            )
        ] = grantId;
    }

    function setRevoked(bytes32 grantId, bool revoked) external {
        _grants[grantId].revoked = revoked;
    }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount
    ) external view returns (bool) {
        bytes32 grantId = _grantIdsByAuthorizationKey[
            keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))
        ];
        if (grantId == bytes32(0)) return false;

        CapabilityGrant memory capabilityGrant = _grants[grantId];
        if (capabilityGrant.revoked) return false;
        if (block.timestamp < capabilityGrant.validFrom) return false;
        if (capabilityGrant.validUntil != 0 && block.timestamp > capabilityGrant.validUntil) return false;
        if (amount > capabilityGrant.perCallLimit && capabilityGrant.perCallLimit != 0) return false;

        return true;
    }
}
