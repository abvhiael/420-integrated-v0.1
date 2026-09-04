// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./RightsClaimRegistry420.sol";
import "./RightsLicenseRegistry420.sol";

contract RightsRouter420 is I420System {
    RightsClaimRegistry420 public immutable claims;
    RightsLicenseRegistry420 public immutable licenses;

    constructor(address claims_, address licenses_) {
        require(claims_ != address(0) && licenses_ != address(0), "dependency");
        claims = RightsClaimRegistry420(claims_);
        licenses = RightsLicenseRegistry420(licenses_);
    }

    function systemName() external pure returns (string memory) { return "RightsRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canUse(bytes32 licenseId, address actor, bytes32 scopeHash) external view returns (bool) {
        if (!licenses.isEffective(licenseId)) return false;
        RightsLicenseRegistry420.License memory l = licenses.license(licenseId);
        return l.licensee == actor && l.scopeHash == scopeHash;
    }

    function isRightEffective(bytes32 rightId) external view returns (bool) {
        return claims.isEffective(rightId);
    }
}
