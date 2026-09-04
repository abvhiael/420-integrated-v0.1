// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { EmergencyDomains } from "../../../../src/highcountry/constants/EmergencyDomains.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { EmergencyState } from "../../../../src/highcountry/security/EmergencyState.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract EmergencyStateTest {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    EmergencyState private emergencyState;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        emergencyState = new EmergencyState(address(authorization));
    }

    function testPositiveEmergencyDomainEnumeration() public view {
        require(emergencyState.isAllowedDomain(EmergencyDomains.CULTIVATION), "cultivation missing");
        require(emergencyState.isAllowedDomain(EmergencyDomains.BREEDING), "breeding missing");
        require(emergencyState.isAllowedDomain(EmergencyDomains.MANUFACTURING), "manufacturing missing");
        require(emergencyState.isAllowedDomain(EmergencyDomains.MARKET), "market missing");
        require(emergencyState.isAllowedDomain(EmergencyDomains.LEASE), "lease missing");
        require(emergencyState.isAllowedDomain(EmergencyDomains.LICENSE), "license missing");
        require(emergencyState.isAllowedDomain(EmergencyDomains.RIGHTS), "rights missing");
        require(
            emergencyState.isAllowedDomain(EmergencyDomains.ORGANIZATION_GOVERNANCE),
            "organization governance missing"
        );
        require(
            emergencyState.isAllowedDomain(EmergencyDomains.COOPERATIVE_GOVERNANCE),
            "cooperative governance missing"
        );
        require(emergencyState.isAllowedDomain(EmergencyDomains.RANDOMNESS_REQUEST), "randomness request missing");
        require(emergencyState.isAllowedDomain(EmergencyDomains.COMPETITION_ENTRY), "competition entry missing");
        require(emergencyState.isAllowedDomain(EmergencyDomains.MISSION_ACTIVATION), "mission activation missing");
        require(emergencyState.isAllowedDomain(EmergencyDomains.MODULE_ACTIVATION), "module activation missing");
    }

    function testUnknownDomainDefaultsDenied() public {
        bytes32 unknownDomain = keccak256("HC.EMERGENCY.ALL");
        require(!emergencyState.isAllowedDomain(unknownDomain), "unknown domain allowed");

        (bool ok,) = address(emergencyState).call(
            abi.encodeWithSelector(emergencyState.setRestricted.selector, unknownDomain, true)
        );
        require(!ok, "unknown domain restricted");
    }

    function testRestrictionRequiresCapability() public {
        (bool ok,) = address(emergencyState).call(
            abi.encodeWithSelector(emergencyState.setRestricted.selector, EmergencyDomains.MARKET, true)
        );
        require(!ok, "restriction succeeded without capability");
        require(!emergencyState.isRestricted(EmergencyDomains.MARKET), "market unexpectedly restricted");
    }

    function testCapabilityCanRestrictEnumeratedDomain() public {
        _grant(ActionIds.EMERGENCY_RESTRICT, EmergencyDomains.MARKET, keccak256("grant:market:restrict"));
        emergencyState.setRestricted(EmergencyDomains.MARKET, true);
        require(emergencyState.isRestricted(EmergencyDomains.MARKET), "market not restricted");
    }

    function testReleaseRequiresSeparateCapability() public {
        _grant(ActionIds.EMERGENCY_RESTRICT, EmergencyDomains.MARKET, keccak256("grant:market:restrict"));
        emergencyState.setRestricted(EmergencyDomains.MARKET, true);

        (bool ok,) = address(emergencyState).call(
            abi.encodeWithSelector(emergencyState.setRestricted.selector, EmergencyDomains.MARKET, false)
        );
        require(!ok, "release succeeded without release capability");
        require(emergencyState.isRestricted(EmergencyDomains.MARKET), "restriction unexpectedly released");

        _grant(ActionIds.EMERGENCY_RELEASE, EmergencyDomains.MARKET, keccak256("grant:market:release"));
        emergencyState.setRestricted(EmergencyDomains.MARKET, false);
        require(!emergencyState.isRestricted(EmergencyDomains.MARKET), "market still restricted");
    }

    function testCapabilityIsDomainScoped() public {
        _grant(ActionIds.EMERGENCY_RESTRICT, EmergencyDomains.MARKET, keccak256("grant:market:restrict"));

        (bool ok,) = address(emergencyState).call(
            abi.encodeWithSelector(emergencyState.setRestricted.selector, EmergencyDomains.BREEDING, true)
        );
        require(!ok, "market capability restricted breeding");
        require(!emergencyState.isRestricted(EmergencyDomains.BREEDING), "breeding unexpectedly restricted");
    }

    function _grant(bytes32 actionId, bytes32 domain, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: ModuleIds.EMERGENCY_STATE,
            capabilityId: actionId,
            scopeHash: domain,
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        capabilityRegistry.setGrant(grantId, grant, 0);
    }
}
