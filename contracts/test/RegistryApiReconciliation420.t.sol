// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/system/GenesisResidentAccess420.sol";
import "../src/system/SystemAccess.sol";
import "../src/interfaces/genesis/IProtocolRegistry420.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/interfaces/genesis/Errors420.sol";

interface VmRegistryApi420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function etch(address, bytes calldata) external;
}

contract RegistryApiImplementation420 {
    function ping() external pure returns (bytes4) { return this.ping.selector; }
}

contract RegistryResidentHarness420 is GenesisResidentAccess420 {
    bytes32 internal constant ID = keccak256("420/APP/REGISTRY_API_TEST_RESIDENT");

    constructor(address timelock_, address registry_)
        GenesisResidentAccess420(timelock_, registry_, keccak256("registry-api-test"))
    {}

    function componentId() public pure override returns (bytes32) { return ID; }
    function requireResidentActive() external view { _requireResidentActive(); }
    function resolveRequired(bytes32 dependencyId) external view returns (address) {
        return _resolveRequired(dependencyId);
    }
}

contract RegistryApiReconciliation420Test {
    VmRegistryApi420 constant vm =
        VmRegistryApi420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OUTSIDER = address(0xBAD);
    bytes32 constant COMPONENT_ID = keccak256("420/APP/REGISTRY_API_COMPONENT");
    bytes32 constant DEPENDENCY_ID = keccak256("420/APP/REGISTRY_API_DEPENDENCY");

    function _v(uint16 major, uint16 minor, uint16 patch) internal pure returns (Types420.Version memory) {
        return Types420.Version({major: major, minor: minor, patch: patch});
    }

    function testProtocolRegistryImplementsFrozenInterfaceDirectly() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryApiImplementation420 implementation = new RegistryApiImplementation420();
        registry.registerComponent(COMPONENT_ID, address(implementation), _v(1, 2, 3), Types420.Lifecycle.ACTIVE);

        IProtocolRegistry420 frozen = IProtocolRegistry420(address(registry));
        Types420.ContractRef memory ref = frozen.component(COMPONENT_ID);

        require(ref.componentId == COMPONENT_ID, "component id");
        require(ref.implementation == address(implementation), "implementation");
        require(ref.runtimeCodeHash == address(implementation).codehash, "codehash");
        require(ref.version.major == 1 && ref.version.minor == 2 && ref.version.patch == 3, "version");
        require(ref.lifecycle == Types420.Lifecycle.ACTIVE, "lifecycle");
        require(frozen.isActive(COMPONENT_ID), "active");
        require(frozen.resolve(COMPONENT_ID) == address(implementation), "resolve");
        require(frozen.runtimeCodeHash(COMPONENT_ID) == address(implementation).codehash, "runtime hash");
    }

    function testServiceAndComponentNamespacesNeverImplicitlyAlias() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryApiImplementation420 implementation = new RegistryApiImplementation420();
        bytes32 serviceId = keccak256("420/service/pay/v1");

        registry.publishRegisteredService(
            serviceId,
            address(implementation),
            keccak256("service-metadata"),
            1,
            true,
            ProtocolRegistry.ComponentType.APPLICATION,
            keccak256("service-manifest"),
            bytes32(0),
            keccak256("service-interface")
        );
        registry.registerComponent(COMPONENT_ID, address(implementation), _v(1, 0, 0), Types420.Lifecycle.ACTIVE);

        require(registry.isServiceActive(serviceId), "service should be active");
        require(!registry.isActive(serviceId), "service id leaked into component namespace");
        require(registry.component(serviceId).implementation == address(0), "service aliased to component");
        require(registry.getService(COMPONENT_ID).version == 0, "component aliased to service");
        require(registry.component(COMPONENT_ID).implementation == address(implementation), "component missing");
    }

    function testSemanticVersionCompatibilityBoundaries() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryApiImplementation420 implementation = new RegistryApiImplementation420();
        registry.registerComponent(COMPONENT_ID, address(implementation), _v(1, 2, 3), Types420.Lifecycle.ACTIVE);

        require(registry.supportsVersion(COMPONENT_ID, _v(1, 0, 0)), "older minor");
        require(registry.supportsVersion(COMPONENT_ID, _v(1, 2, 2)), "older patch");
        require(registry.supportsVersion(COMPONENT_ID, _v(1, 2, 3)), "exact");
        require(!registry.supportsVersion(COMPONENT_ID, _v(1, 2, 4)), "newer patch accepted");
        require(!registry.supportsVersion(COMPONENT_ID, _v(1, 3, 0)), "newer minor accepted");
        require(!registry.supportsVersion(COMPONENT_ID, _v(2, 0, 0)), "major mismatch accepted");
    }

    function testUnknownAndDeprecatedComponentsFailClosed() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));

        require(!registry.isActive(COMPONENT_ID), "unknown active");
        require(registry.runtimeCodeHash(COMPONENT_ID) == bytes32(0), "unknown hash");
        require(!registry.supportsVersion(COMPONENT_ID, _v(1, 0, 0)), "unknown supports version");
        vm.expectRevert(ProtocolRegistry.UnknownComponent.selector);
        registry.resolve(COMPONENT_ID);

        RegistryApiImplementation420 implementation = new RegistryApiImplementation420();
        registry.registerComponent(COMPONENT_ID, address(implementation), _v(1, 0, 0), Types420.Lifecycle.ACTIVE);
        registry.setComponentLifecycle(COMPONENT_ID, Types420.Lifecycle.DEPRECATED);

        require(!registry.isActive(COMPONENT_ID), "deprecated active");
        require(!registry.supportsVersion(COMPONENT_ID, _v(1, 0, 0)), "deprecated supports version");
        vm.expectRevert(ProtocolRegistry.UnknownComponent.selector);
        registry.resolve(COMPONENT_ID);
        require(registry.component(COMPONENT_ID).implementation == address(implementation), "provenance lost");
    }

    function testComponentRegistrationRejectsEOAAndUnauthorizedMutation() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryApiImplementation420 implementation = new RegistryApiImplementation420();

        vm.expectRevert(ProtocolRegistry.ImplementationHasNoCode.selector);
        registry.registerComponent(COMPONENT_ID, address(0x1001), _v(1, 0, 0), Types420.Lifecycle.ACTIVE);

        vm.prank(OUTSIDER);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        registry.registerComponent(COMPONENT_ID, address(implementation), _v(1, 0, 0), Types420.Lifecycle.ACTIVE);

        registry.registerComponent(COMPONENT_ID, address(implementation), _v(1, 0, 0), Types420.Lifecycle.ACTIVE);
        vm.prank(OUTSIDER);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        registry.setComponentLifecycle(COMPONENT_ID, Types420.Lifecycle.DEPRECATED);
    }

    function testComponentRevisionHistoryAndServiceHistoryBothSurvive() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryApiImplementation420 first = new RegistryApiImplementation420();
        RegistryApiImplementation420 second = new RegistryApiImplementation420();
        bytes32 serviceId = keccak256("420/service/pay/v1");

        registry.publishRegisteredService(
            serviceId, address(first), bytes32(0), 1, true,
            ProtocolRegistry.ComponentType.APPLICATION, keccak256("m1"), bytes32(0), keccak256("i1")
        );
        registry.publishRegisteredService(
            serviceId, address(second), bytes32(0), 2, true,
            ProtocolRegistry.ComponentType.APPLICATION, keccak256("m2"), bytes32(0), keccak256("i2")
        );

        registry.registerComponent(COMPONENT_ID, address(first), _v(1, 0, 0), Types420.Lifecycle.ACTIVE);
        registry.registerComponent(COMPONENT_ID, address(second), _v(1, 1, 0), Types420.Lifecycle.ACTIVE);

        require(registry.currentComponentRevision(COMPONENT_ID) == 2, "component revision");
        require(registry.getComponentRevision(COMPONENT_ID, 1).implementation == address(first), "component rev1 lost");
        require(registry.getComponentRevision(COMPONENT_ID, 2).implementation == address(second), "component rev2");
        require(registry.getServiceVersion(serviceId, 1).implementation == address(first), "service rev1 lost");
        require(registry.getServiceVersion(serviceId, 2).implementation == address(second), "service rev2");
        require(registry.currentVersion(serviceId) == 2, "service revision drift");
    }

    function testRealGenesisResidentResolvesThroughProtocolRegistryAndFailsClosedWhenDeprecated() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryResidentHarness420 resident = new RegistryResidentHarness420(address(this), address(registry));
        RegistryApiImplementation420 dependency = new RegistryApiImplementation420();

        registry.registerComponent(
            resident.componentId(), address(resident), _v(1, 0, 0), Types420.Lifecycle.ACTIVE
        );
        registry.registerComponent(
            DEPENDENCY_ID, address(dependency), _v(1, 0, 0), Types420.Lifecycle.ACTIVE
        );

        resident.requireResidentActive();
        require(resident.resolveRequired(DEPENDENCY_ID) == address(dependency), "dependency resolve");

        registry.setComponentLifecycle(DEPENDENCY_ID, Types420.Lifecycle.DEPRECATED);
        vm.expectRevert(Errors420.InactiveComponent.selector);
        resident.resolveRequired(DEPENDENCY_ID);

        registry.setComponentLifecycle(resident.componentId(), Types420.Lifecycle.DEPRECATED);
        vm.expectRevert(Errors420.InactiveComponent.selector);
        resident.requireResidentActive();
    }

    function testRealGenesisResidentRejectsRuntimeCodeHashDrift() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryResidentHarness420 resident = new RegistryResidentHarness420(address(this), address(registry));
        RegistryApiImplementation420 dependency = new RegistryApiImplementation420();

        registry.registerComponent(
            resident.componentId(), address(resident), _v(1, 0, 0), Types420.Lifecycle.ACTIVE
        );
        registry.registerComponent(
            DEPENDENCY_ID, address(dependency), _v(1, 0, 0), Types420.Lifecycle.ACTIVE
        );

        vm.etch(address(dependency), hex"00");
        vm.expectRevert(Errors420.InactiveComponent.selector);
        resident.resolveRequired(DEPENDENCY_ID);
    }
}
