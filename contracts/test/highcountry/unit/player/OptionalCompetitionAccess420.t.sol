// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { OptionalCompetitionAccess420 } from "../../../../src/highcountry/player/OptionalCompetitionAccess420.sol";
import { IHighCountryAuthorization } from "../../../../src/highcountry/interfaces/IHighCountryAuthorization.sol";
import { IHighCountryGamingAccess420 } from "../../../../src/highcountry/player/IHighCountryGamingAccess420.sol";
import { AuthorizationRequest } from "../../../../src/highcountry/types/HighCountryTypes.sol";

contract MockHCCompetitionAuthorization is IHighCountryAuthorization {
    bool public allowed = true;
    function setAllowed(bool allowed_) external { allowed = allowed_; }
    function capabilityRegistry() external pure returns (address) { return address(1); }
    function isAuthorized(AuthorizationRequest calldata) external view returns (bool) { return allowed; }
    function requireAuthorized(AuthorizationRequest calldata) external view { require(allowed, "unauthorized"); }
}

contract MockHCCompetitionGamingAccess is IHighCountryGamingAccess420 {
    mapping(bytes32 => bool) internal access;

    function setCompetition(uint64 growerProfileId, bytes32 entitlementId, bytes32 contentId, bool allowed) external {
        access[keccak256(abi.encode(growerProfileId, entitlementId, contentId))] = allowed;
    }

    function hasScopedEntitlement(uint64, bytes32, bytes32, bytes32) external pure returns (bool) { return false; }
    function requireScopedEntitlement(uint64, bytes32, bytes32, bytes32) external pure { revert("unused"); }
    function hasBonusRegion(uint64, bytes32, bytes32) external pure returns (bool) { return false; }
    function hasCosmetic(uint64, bytes32, bytes32) external pure returns (bool) { return false; }
    function hasCompetitionAccess(uint64 growerProfileId, bytes32 entitlementId, bytes32 contentId)
        external
        view
        returns (bool)
    {
        return access[keccak256(abi.encode(growerProfileId, entitlementId, contentId))];
    }
    function hasGeneticsAccess(uint64, bytes32, bytes32) external pure returns (bool) { return false; }
}

contract OptionalCompetitionAccess420Test {
    MockHCCompetitionAuthorization internal authorization;
    MockHCCompetitionGamingAccess internal gamingAccess;
    OptionalCompetitionAccess420 internal competitionAccess;

    bytes32 internal constant COMPETITION_ID = keccak256("hc/competition/harvest-moon-2027");
    bytes32 internal constant ENTITLEMENT_ID = keccak256("hc/entitlement/harvest-moon-2027");
    bytes32 internal constant CONTENT_ID = keccak256("hc/content/competition/harvest-moon-2027");
    uint64 internal constant GROWER_PROFILE_ID = 42;

    function setUp() public {
        authorization = new MockHCCompetitionAuthorization();
        gamingAccess = new MockHCCompetitionGamingAccess();
        competitionAccess = new OptionalCompetitionAccess420(address(authorization), address(gamingAccess));
    }

    function _register() internal {
        competitionAccess.registerOptionalCompetition(COMPETITION_ID, ENTITLEMENT_ID, CONTENT_ID);
    }

    function testOptionalCompetitionRequiresMatchingEntitlement() public {
        _register();
        require(!competitionAccess.hasAccess(GROWER_PROFILE_ID, COMPETITION_ID), "missing entitlement accepted");

        gamingAccess.setCompetition(GROWER_PROFILE_ID, ENTITLEMENT_ID, CONTENT_ID, true);
        require(competitionAccess.hasAccess(GROWER_PROFILE_ID, COMPETITION_ID), "matching entitlement rejected");
        competitionAccess.requireAccess(GROWER_PROFILE_ID, COMPETITION_ID);
    }

    function testMissingRegistrationDoesNotGateBaseCompetition() public {
        bytes32 baseCompetition = keccak256("hc/base/competition/open-cup");
        require(!competitionAccess.hasAccess(GROWER_PROFILE_ID, baseCompetition), "unregistered competition treated as gated");
    }

    function testRequireAccessFailsClosedWithoutEntitlement() public {
        _register();
        (bool ok,) = address(competitionAccess).call(
            abi.encodeWithSelector(competitionAccess.requireAccess.selector, GROWER_PROFILE_ID, COMPETITION_ID)
        );
        require(!ok, "optional competition opened without entitlement");
    }

    function testInactiveOptionalCompetitionFailsClosed() public {
        _register();
        gamingAccess.setCompetition(GROWER_PROFILE_ID, ENTITLEMENT_ID, CONTENT_ID, true);
        competitionAccess.setOptionalCompetitionStatus(COMPETITION_ID, false);
        require(!competitionAccess.hasAccess(GROWER_PROFILE_ID, COMPETITION_ID), "inactive competition accessible");
    }

    function testAdministrationIsCapabilityAuthorized() public {
        authorization.setAllowed(false);
        (bool ok,) = address(competitionAccess).call(
            abi.encodeWithSelector(
                competitionAccess.registerOptionalCompetition.selector,
                COMPETITION_ID,
                ENTITLEMENT_ID,
                CONTENT_ID
            )
        );
        require(!ok, "unauthorized optional competition registered");
    }
}
