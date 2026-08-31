// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./RightsAuthorization420.sol";
import "./RightsClaimRegistry420.sol";
import "./RightsIds420.sol";

contract RightsLicenseRegistry420 is I420System {
    struct License {
        bytes32 rightId;
        address licensor;
        address licensee;
        bytes32 scopeHash;
        bytes32 termsHash;
        uint64 validFrom;
        uint64 validUntil;
        bool revocable;
        bool revoked;
        bool exists;
    }

    RightsAuthorization420 public immutable authorization;
    RightsClaimRegistry420 public immutable claims;
    mapping(bytes32 => License) private _licenses;

    error InvalidLicense();
    error Unauthorized();
    error LicenseExists();
    error LicenseNotFound();
    error RightNotEffective();
    error NotRevocable();

    event LicenseGranted(bytes32 indexed licenseId, bytes32 indexed rightId, address indexed licensee, address licensor, bytes32 scopeHash, bytes32 termsHash, uint64 validFrom, uint64 validUntil, bool revocable);
    event LicenseRevoked(bytes32 indexed licenseId, address indexed actor);
    event LicenseRenounced(bytes32 indexed licenseId, address indexed licensee);

    constructor(address authorization_, address claims_) {
        require(authorization_ != address(0) && claims_ != address(0), "dependency");
        authorization = RightsAuthorization420(authorization_);
        claims = RightsClaimRegistry420(claims_);
    }

    function systemName() external pure returns (string memory) { return "RightsLicenseRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function grantLicense(bytes32 licenseId, bytes32 rightId, address licensee, bytes32 scopeHash, bytes32 termsHash, uint64 validFrom, uint64 validUntil, bool revocable) external {
        if (licenseId == bytes32(0) || rightId == bytes32(0) || licensee == address(0) || scopeHash == bytes32(0) || termsHash == bytes32(0)) revert InvalidLicense();
        if (_licenses[licenseId].exists) revert LicenseExists();
        if (!claims.isEffective(rightId)) revert RightNotEffective();
        RightsClaimRegistry420.Claim memory c = claims.claim(rightId);
        if (validUntil != 0 && validUntil <= validFrom) revert InvalidLicense();
        if (validFrom < c.validFrom) revert InvalidLicense();
        if (c.validUntil != 0 && (validUntil == 0 || validUntil > c.validUntil)) revert InvalidLicense();
        if (msg.sender != c.holder && !authorization.isRightAuthorized(msg.sender, rightId, RightsIds420.ACTION_GRANT_LICENSE)) revert Unauthorized();
        _licenses[licenseId] = License(rightId, c.holder, licensee, scopeHash, termsHash, validFrom, validUntil, revocable, false, true);
        emit LicenseGranted(licenseId, rightId, licensee, c.holder, scopeHash, termsHash, validFrom, validUntil, revocable);
    }

    function revokeLicense(bytes32 licenseId) external {
        License storage l = _licenses[licenseId];
        if (!l.exists) revert LicenseNotFound();
        if (!l.revocable) revert NotRevocable();
        if (msg.sender != l.licensor && !authorization.isRightAuthorized(msg.sender, l.rightId, RightsIds420.ACTION_REVOKE_LICENSE)) revert Unauthorized();
        l.revoked = true;
        emit LicenseRevoked(licenseId, msg.sender);
    }

    function renounceLicense(bytes32 licenseId) external {
        License storage l = _licenses[licenseId];
        if (!l.exists) revert LicenseNotFound();
        if (msg.sender != l.licensee) revert Unauthorized();
        l.revoked = true;
        emit LicenseRenounced(licenseId, msg.sender);
    }

    function license(bytes32 licenseId) external view returns (License memory l) {
        l = _licenses[licenseId];
        if (!l.exists) revert LicenseNotFound();
    }

    function isEffective(bytes32 licenseId) public view returns (bool) {
        License memory l = _licenses[licenseId];
        if (!l.exists || l.revoked || block.timestamp < l.validFrom || !claims.isEffective(l.rightId)) return false;
        return l.validUntil == 0 || block.timestamp <= l.validUntil;
    }
}
