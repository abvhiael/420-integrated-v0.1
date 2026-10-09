// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { EmergencyDomains } from "../../../src/highcountry/constants/EmergencyDomains.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { EmergencyState } from "../../../src/highcountry/security/EmergencyState.sol";
import { RandomnessCoordinator } from "../../../src/highcountry/random/RandomnessCoordinator.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract EmergencyEnforcementTest {
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    EmergencyState private emergency;
    RandomnessCoordinator private random;

    constructor() {
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        emergency = new EmergencyState(address(auth));
        random = new RandomnessCoordinator(address(auth));
        _grant(
            ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_BIND_EMERGENCY, random.EMERGENCY_BIND_SCOPE(), "bind"
        );
        _grant(ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_REQUEST, bytes32(uint256(1)), "request1");
        _grant(ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_REQUEST, bytes32(uint256(2)), "request2");
        _grant(ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_FULFILL, bytes32(uint256(1)), "fulfill1");
        _grant(ModuleIds.EMERGENCY_STATE, ActionIds.EMERGENCY_RESTRICT, EmergencyDomains.RANDOMNESS_REQUEST, "restrict");
    }

    function testUnboundRandomnessRequestFailsClosed() public {
        (bool ok,) = address(random)
            .call(
                abi.encodeWithSelector(
                    random.request.selector, bytes32(uint256(1)), keccak256("DOMAIN"), keccak256("CTX")
                )
            );
        require(!ok, "unbound coordinator accepted request");
    }

    function testBoundRequestRestrictionAndExistingRecovery() public {
        random.bindEmergencyState(address(emergency));
        bytes32 domain = keccak256("DOMAIN");
        bytes32 context = keccak256("CTX");
        random.request(bytes32(uint256(1)), domain, context);
        emergency.setRestricted(EmergencyDomains.RANDOMNESS_REQUEST, true);
        (bool ok,) =
            address(random).call(abi.encodeWithSelector(random.request.selector, bytes32(uint256(2)), domain, context));
        require(!ok, "restricted new request");
        random.fulfill(bytes32(uint256(1)), keccak256("ENTROPY"));
        bytes32 entropy = random.consume(bytes32(uint256(1)), domain, context);
        require(entropy == keccak256("ENTROPY"), "pending request not recoverable");
        (ok,) = address(random)
            .call(abi.encodeWithSelector(random.consume.selector, bytes32(uint256(1)), domain, context));
        require(!ok, "consumed twice");
        (ok,) = address(emergency)
            .call(abi.encodeWithSelector(emergency.setRestricted.selector, EmergencyDomains.RANDOMNESS_REQUEST, false));
        require(!ok, "release without release authority");
        _grant(ModuleIds.EMERGENCY_STATE, ActionIds.EMERGENCY_RELEASE, EmergencyDomains.RANDOMNESS_REQUEST, "release");
        emergency.setRestricted(EmergencyDomains.RANDOMNESS_REQUEST, false);
        random.request(bytes32(uint256(2)), domain, context);
    }

    function testBindingWrongAuthorityOrEoaRejected() public {
        (bool ok,) = address(random).call(abi.encodeWithSelector(random.bindEmergencyState.selector, address(0xBEEF)));
        require(!ok, "EOA controller accepted");
        HighCountryAuthorization other = new HighCountryAuthorization(address(new MockCapabilityRegistry()));
        EmergencyState rogue = new EmergencyState(address(other));
        (ok,) = address(random).call(abi.encodeWithSelector(random.bindEmergencyState.selector, address(rogue)));
        require(!ok, "mismatched authorization root accepted");
        random.bindEmergencyState(address(emergency));
        (ok,) = address(random).call(abi.encodeWithSelector(random.bindEmergencyState.selector, address(emergency)));
        require(!ok, "rebinding accepted");
    }

    function _grant(
        bytes32 moduleId,
        bytes32 actionId,
        bytes32 scope,
        string memory tag
    ) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: moduleId,
            capabilityId: actionId,
            scopeHash: scope,
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        caps.setGrant(keccak256(bytes(tag)), grant, 0);
    }
}
