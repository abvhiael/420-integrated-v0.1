// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @dev Test-only Capability Registry double for WorkerRegistry qualification.
/// Supports principal-wide compatibility mode for retained tests and exact grants
/// with expiry/revocation for CMP-1.3.8 adversarial coverage.
contract ComputeWorkerCapabilityMock420 {
    struct ExactGrant {
        uint64 validUntil;
        bool revoked;
        bool exists;
    }

    mapping(address => bool) public allowPrincipal;
    mapping(bytes32 => ExactGrant) private _grants;

    function setAllowPrincipal(address principal, bool allowed) external {
        allowPrincipal[principal] = allowed;
    }

    function grantExact(
        address principal,
        bytes32 component,
        bytes32 action,
        bytes32 scope,
        uint64 validUntil
    ) external {
        _grants[_key(principal, component, action, scope)] =
            ExactGrant({validUntil: validUntil, revoked: false, exists: true});
    }

    function revokeExact(address principal, bytes32 component, bytes32 action, bytes32 scope) external {
        ExactGrant storage g = _grants[_key(principal, component, action, scope)];
        require(g.exists, "unknown grant");
        g.revoked = true;
    }

    function isAuthorized(
        address principal,
        bytes32 component,
        bytes32 action,
        bytes32 scope,
        uint256
    ) external view returns (bool) {
        if (allowPrincipal[principal]) return true;
        ExactGrant storage g = _grants[_key(principal, component, action, scope)];
        return g.exists && !g.revoked && (g.validUntil == 0 || block.timestamp <= g.validUntil);
    }

    function _key(address principal, bytes32 component, bytes32 action, bytes32 scope)
        private pure returns (bytes32)
    {
        return keccak256(abi.encode(principal, component, action, scope));
    }
}
