// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Governance-versioned application security profiles for 420Random.
/// @dev Applications bind a profile before entropy is knowable; routes and fallback behavior are not caller-selectable.
contract RandomnessProfileRegistry420 is SystemAccess, I420System {
    struct Profile {
        bytes32 primaryRoute;
        bytes32 fallbackRoute;
        uint32 primaryTimeoutSeconds;
        uint8 securityTier;
        uint32 revision;
        bytes32 metadataHash;
        bool active;
    }

    mapping(bytes32 => Profile) private _profiles;

    error InvalidProfile();
    error InvalidTimeout();
    error SameFallbackRoute();

    event ProfileSet(
        bytes32 indexed profileId,
        uint32 indexed revision,
        bytes32 indexed primaryRoute,
        bytes32 fallbackRoute,
        uint32 primaryTimeoutSeconds,
        uint8 securityTier,
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
        uint8 securityTier,
        bytes32 metadataHash,
        bool active
    ) external onlyGovernance {
        if (profileId == bytes32(0) || primaryRoute == bytes32(0) || securityTier == 0) revert InvalidProfile();
        if (primaryTimeoutSeconds == 0) revert InvalidTimeout();
        if (fallbackRoute != bytes32(0) && fallbackRoute == primaryRoute) revert SameFallbackRoute();

        Profile storage profile_ = _profiles[profileId];
        uint32 nextRevision = profile_.revision + 1;
        profile_.primaryRoute = primaryRoute;
        profile_.fallbackRoute = fallbackRoute;
        profile_.primaryTimeoutSeconds = primaryTimeoutSeconds;
        profile_.securityTier = securityTier;
        profile_.revision = nextRevision;
        profile_.metadataHash = metadataHash;
        profile_.active = active;

        emit ProfileSet(
            profileId,
            nextRevision,
            primaryRoute,
            fallbackRoute,
            primaryTimeoutSeconds,
            securityTier,
            metadataHash,
            active
        );
    }

    function profile(bytes32 profileId) external view returns (Profile memory) {
        return _profiles[profileId];
    }
}