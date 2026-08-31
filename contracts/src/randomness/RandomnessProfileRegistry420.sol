// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./RandomnessIds420.sol";

/// @notice Governance-versioned application security profiles for 420Random.
/// @dev Applications bind a profile before entropy is knowable; routes and fallback behavior are not caller-selectable.
contract RandomnessProfileRegistry420 is SystemAccess, I420System {
    struct Profile {
        bytes32 primaryRoute;
        bytes32 fallbackRoute;
        uint32 primaryTimeoutSeconds;
        uint32 maxTimeoutSeconds;
        uint8 securityTier;
        uint8 fallbackPolicy;
        uint32 revision;
        bytes32 metadataHash;
        bool active;
    }

    mapping(bytes32 => Profile) private _profiles;

    error InvalidProfile();
    error InvalidTimeout();
    error InvalidSecurityTier();
    error InvalidFallbackPolicy();
    error SameFallbackRoute();

    event ProfileSet(
        bytes32 indexed profileId,
        uint32 indexed revision,
        bytes32 indexed primaryRoute,
        bytes32 fallbackRoute,
        uint32 primaryTimeoutSeconds,
        uint32 maxTimeoutSeconds,
        uint8 securityTier,
        uint8 fallbackPolicy,
        bytes32 metadataHash,
        bool active
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "RandomnessProfileRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setProfile(
        bytes32 profileId,
        bytes32 primaryRoute,
        bytes32 fallbackRoute,
        uint32 primaryTimeoutSeconds,
        uint32 maxTimeoutSeconds,
        uint8 securityTier,
        uint8 fallbackPolicy,
        bytes32 metadataHash,
        bool active
    ) external onlyGovernance {
        if (profileId == bytes32(0) || primaryRoute == bytes32(0)) revert InvalidProfile();
        if (primaryTimeoutSeconds == 0 || maxTimeoutSeconds < primaryTimeoutSeconds) revert InvalidTimeout();
        if (securityTier < RandomnessIds420.SECURITY_STANDARD || securityTier > RandomnessIds420.SECURITY_CRITICAL) {
            revert InvalidSecurityTier();
        }
        if (fallbackPolicy == RandomnessIds420.FALLBACK_VOID) {
            if (fallbackRoute != bytes32(0)) revert InvalidFallbackPolicy();
        } else if (fallbackPolicy == RandomnessIds420.FALLBACK_ONCE_THEN_VOID) {
            if (fallbackRoute == bytes32(0)) revert InvalidFallbackPolicy();
        } else {
            revert InvalidFallbackPolicy();
        }
        if (fallbackRoute != bytes32(0) && fallbackRoute == primaryRoute) revert SameFallbackRoute();

        Profile storage profile_ = _profiles[profileId];
        uint32 nextRevision = profile_.revision + 1;
        profile_.primaryRoute = primaryRoute;
        profile_.fallbackRoute = fallbackRoute;
        profile_.primaryTimeoutSeconds = primaryTimeoutSeconds;
        profile_.maxTimeoutSeconds = maxTimeoutSeconds;
        profile_.securityTier = securityTier;
        profile_.fallbackPolicy = fallbackPolicy;
        profile_.revision = nextRevision;
        profile_.metadataHash = metadataHash;
        profile_.active = active;

        emit ProfileSet(
            profileId,
            nextRevision,
            primaryRoute,
            fallbackRoute,
            primaryTimeoutSeconds,
            maxTimeoutSeconds,
            securityTier,
            fallbackPolicy,
            metadataHash,
            active
        );
    }

    function profile(bytes32 profileId) external view returns (Profile memory) {
        return _profiles[profileId];
    }
}