// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Dual-role allowlisted emergency control. Requires separate underlying HC scoped capabilities.
/// @dev No asset custody, grant writing, ownership transfer or arbitrary call target.
interface IRestrictedEmergencyR0414 {
    function isAllowedDomain(
        bytes32 domain
    ) external view returns (bool);
    function isRestricted(
        bytes32 domain
    ) external view returns (bool);
    function setRestricted(
        bytes32 domain,
        bool restricted
    ) external;
}

contract SecurityCouncilController {
    error Unauthorized();
    error Invalid();
    address public immutable restrictOfficer;
    address public immutable releaseOfficer;
    IRestrictedEmergencyR0414 public immutable emergency;
    uint64 public constant RELEASE_DELAY = 1 days;
    mapping(bytes32 => uint64) public releaseReadyAt;
    event Restricted(bytes32 indexed domain);
    event ReleaseScheduled(bytes32 indexed domain, uint64 eligibleAt);
    event Released(bytes32 indexed domain);
    event ReleaseVetoed(bytes32 indexed domain);

    constructor(
        address emergency_,
        address restrict_,
        address release_
    ) {
        if (emergency_.code.length == 0 || restrict_ == address(0) || release_ == address(0) || restrict_ == release_) {
            revert Invalid();
        }
        emergency = IRestrictedEmergencyR0414(emergency_);
        restrictOfficer = restrict_;
        releaseOfficer = release_;
    }

    function restrict(
        bytes32 domain
    ) external {
        if (msg.sender != restrictOfficer || !emergency.isAllowedDomain(domain)) revert Unauthorized();
        delete releaseReadyAt[domain];
        // Underlying EmergencyState independently requires an exact scoped EMERGENCY_RESTRICT grant.
        emergency.setRestricted(domain, true);
        emit Restricted(domain);
    }

    function scheduleRelease(
        bytes32 domain
    ) external {
        if (
            msg.sender != releaseOfficer || !emergency.isAllowedDomain(domain) || !emergency.isRestricted(domain)
                || releaseReadyAt[domain] != 0
        ) revert Unauthorized();
        uint64 at = uint64(block.timestamp + RELEASE_DELAY);
        releaseReadyAt[domain] = at;
        emit ReleaseScheduled(domain, at);
    }

    function vetoRelease(
        bytes32 domain
    ) external {
        if (msg.sender != restrictOfficer || releaseReadyAt[domain] == 0) revert Unauthorized();
        delete releaseReadyAt[domain];
        emit ReleaseVetoed(domain);
    }

    function release(
        bytes32 domain
    ) external {
        uint64 ready = releaseReadyAt[domain];
        if (msg.sender != releaseOfficer || ready == 0 || block.timestamp < ready || !emergency.isRestricted(domain)) {
            revert Unauthorized();
        }
        delete releaseReadyAt[domain];
        // Underlying EmergencyState independently requires an exact scoped EMERGENCY_RELEASE grant.
        emergency.setRestricted(domain, false);
        emit Released(domain);
    }
}
