// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {R04EmergencyConsumer} from "../../../src/highcountry/security/R04EmergencyConsumer.sol";
import {EmergencyState} from "../../../src/highcountry/security/EmergencyState.sol";
import {HighCountryAuthorization} from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import {ICapabilityRegistry420} from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import {MockCapabilityRegistry} from "./MockCapabilityRegistry.sol";
import {ModuleIds} from "../../../src/highcountry/constants/ModuleIds.sol";

/// @dev Retained focused fixtures get a real EmergencyState; new shared-root integrations use production registry grants.
contract R04RetainedAuthorization is HighCountryAuthorization {
    MockCapabilityRegistry public immutable testCapabilities;
    constructor(MockCapabilityRegistry caps) HighCountryAuthorization(address(caps)) { testCapabilities = caps; }
}
function retainedR04AuthorizationRoot() returns (address) {
    return address(new R04RetainedAuthorization(new MockCapabilityRegistry()));
}
function bindRetainedR04Emergency(address target) {
    R04EmergencyConsumer c = R04EmergencyConsumer(target);
    R04RetainedAuthorization root = R04RetainedAuthorization(c.r04AuthorizationRoot());
    MockCapabilityRegistry caps = root.testCapabilities();
    EmergencyState state = new EmergencyState(address(root));
    address fixture;
    assembly ("memory-safe") { fixture := address() }
    ICapabilityRegistry420.CapabilityGrant memory g = ICapabilityRegistry420.CapabilityGrant(
        fixture, ModuleIds.EMERGENCY_STATE, c.R04_BIND_ACTION(), c.emergencyBindingScope(address(state)),
        0, 0, 0, 0, 0, false);
    caps.setGrant(keccak256(abi.encode(target)), g, 0);
    c.bindR04Emergency(address(state));
}
