// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { EmergencyDomains } from "../constants/EmergencyDomains.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCEmergencyDomainNotAllowed, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { IEmergencyState } from "../interfaces/IEmergencyState.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract EmergencyState is IEmergencyState {
    IHighCountryAuthorization public immutable authorization;

    mapping(bytes32 => bool) private _restricted;

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
    }

    function isAllowedDomain(bytes32 domain) public pure returns (bool) {
        return domain == EmergencyDomains.CULTIVATION || domain == EmergencyDomains.BREEDING
            || domain == EmergencyDomains.MANUFACTURING || domain == EmergencyDomains.MARKET
            || domain == EmergencyDomains.LEASE || domain == EmergencyDomains.LICENSE
            || domain == EmergencyDomains.RIGHTS || domain == EmergencyDomains.ORGANIZATION_GOVERNANCE
            || domain == EmergencyDomains.COOPERATIVE_GOVERNANCE || domain == EmergencyDomains.RANDOMNESS_REQUEST
            || domain == EmergencyDomains.COMPETITION_ENTRY || domain == EmergencyDomains.MISSION_ACTIVATION
            || domain == EmergencyDomains.MODULE_ACTIVATION;
    }

    function isRestricted(bytes32 domain) external view returns (bool) {
        return _restricted[domain];
    }

    function setRestricted(bytes32 domain, bool restricted) external {
        if (!isAllowedDomain(domain)) revert HCEmergencyDomainNotAllowed(domain);

        bytes32 actionId = restricted ? ActionIds.EMERGENCY_RESTRICT : ActionIds.EMERGENCY_RELEASE;
        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.EMERGENCY_STATE,
                actionId: actionId,
                scopeHash: domain,
                amount: 0
            })
        );

        if (_restricted[domain] == restricted) return;
        _restricted[domain] = restricted;
        emit EmergencyRestrictionChanged(domain, restricted);
    }
}
