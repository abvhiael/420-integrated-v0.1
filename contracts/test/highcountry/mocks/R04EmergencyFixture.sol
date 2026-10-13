// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {R04EmergencyConsumer} from "../../../src/highcountry/security/R04EmergencyConsumer.sol";
import {EmergencyState} from "../../../src/highcountry/security/EmergencyState.sol";
import {HighCountryAuthorization} from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import {ICapabilityRegistry420} from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import {MockCapabilityRegistry} from "./MockCapabilityRegistry.sol";
import {ModuleIds} from "../../../src/highcountry/constants/ModuleIds.sol";

/// @dev Retained focused fixtures get a real EmergencyState; new shared-root integrations use production registry grants.
function bindRetainedR04Emergency(address target) {
    MockCapabilityRegistry caps = new MockCapabilityRegistry();
    HighCountryAuthorization root = new HighCountryAuthorization(address(caps));
    EmergencyState state = new EmergencyState(address(root));
    R04EmergencyConsumer c = R04EmergencyConsumer(target);
    ICapabilityRegistry420.CapabilityGrant memory g = ICapabilityRegistry420.CapabilityGrant(
        address(this), ModuleIds.EMERGENCY_STATE, c.R04_BIND_ACTION(), c.emergencyBindingScope(address(state)),
        0, 0, 0, 0, 0, false);
    caps.setGrant(keccak256(abi.encode(target)), g, 0);
    c.bindR04Emergency(address(state));
}
