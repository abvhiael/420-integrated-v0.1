// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/system/SystemAccess.sol";

interface VmRegistry420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract RegistryImplementation420 {
    function ping() external pure returns (bytes4) { return this.ping.selector; }
}

contract RegistryGenesis420Test {
    VmRegistry420 constant vm = VmRegistry420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant OUTSIDER = address(0xBAD);

    function testCanonicalCatalogIncludesIntegratedGenesisServices() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        require(registry.isGenesisCanonicalServiceId(keccak256("420/service/420-is/v1")), "420-is");
        require(registry.isGenesisCanonicalServiceId(keccak256("420/service/messenger/v1")), "messenger");
        require(registry.isGenesisCanonicalServiceId(keccak256("420/service/treasury/v1")), "treasury");
        require(registry.isGenesisCanonicalServiceId(keccak256("420/service/resource-protocol/v1")), "resource");
        require(registry.isGenesisCanonicalServiceId(keccak256("420/service/cannaseur/v1")), "cannaseur");
    }

    function testRegisteredPublicationCommitsCodeAndManifest() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryImplementation420 implementation = new RegistryImplementation420();
        bytes32 serviceId = keccak256("420/service/protocol-registry/v1");
        bytes32 manifestHash = keccak256("registry-manifest-v1");
        bytes32 dependencyRoot = keccak256("registry-dependencies-v1");
        bytes32 interfaceHash = keccak256("registry-interface-v1");

        registry.publishRegisteredService(
            serviceId,
            address(implementation),
            keccak256("metadata"),
            1,
            true,
            ProtocolRegistry.ComponentType.REGISTRY,
            manifestHash,
            dependencyRoot,
            interfaceHash
        );

        ProtocolRegistry.Service memory service = registry.getService(serviceId);
        ProtocolRegistry.RegistrationProfile memory profile = registry.getRegistrationProfile(serviceId, 1);
        require(service.implementation == address(implementation), "implementation");
        require(service.codeHash == address(implementation).codehash, "code hash");
        require(service.active, "active");
        require(profile.componentType == ProtocolRegistry.ComponentType.REGISTRY, "type");
        require(profile.manifestHash == manifestHash, "manifest");
        require(profile.dependencyRoot == dependencyRoot, "dependencies");
        require(profile.interfaceHash == interfaceHash, "interface");
    }

    function testRegisteredPublicationRejectsEOA() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        vm.expectRevert(ProtocolRegistry.ImplementationHasNoCode.selector);
        registry.publishRegisteredService(
            keccak256("420/service/pay/v1"),
            address(0x1001),
            bytes32(0),
            1,
            true,
            ProtocolRegistry.ComponentType.APPLICATION,
            keccak256("manifest"),
            bytes32(0),
            keccak256("interface")
        );
    }

    function testRegistryIsGovernanceBound() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryImplementation420 implementation = new RegistryImplementation420();
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        vm.prank(OUTSIDER);
        registry.publishRegisteredService(
            keccak256("420/service/pay/v1"),
            address(implementation),
            bytes32(0),
            1,
            true,
            ProtocolRegistry.ComponentType.APPLICATION,
            keccak256("manifest"),
            bytes32(0),
            keccak256("interface")
        );
    }

    function testVersionHistoryIsAppendOnlyAndDeprecationFailsClosed() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryImplementation420 first = new RegistryImplementation420();
        RegistryImplementation420 second = new RegistryImplementation420();
        bytes32 serviceId = keccak256("420/service/pay/v1");

        registry.publishRegisteredService(serviceId, address(first), bytes32(0), 1, true,
            ProtocolRegistry.ComponentType.APPLICATION, keccak256("m1"), bytes32(0), keccak256("i1"));
        registry.publishRegisteredService(serviceId, address(second), bytes32(0), 2, true,
            ProtocolRegistry.ComponentType.APPLICATION, keccak256("m2"), keccak256("d2"), keccak256("i2"));

        require(registry.getServiceVersion(serviceId, 1).implementation == address(first), "history");
        require(registry.getRegistrationProfile(serviceId, 1).manifestHash == keccak256("m1"), "profile history");
        registry.deprecateService(serviceId);
        require(!registry.isActive(serviceId), "inactive");
        vm.expectRevert(ProtocolRegistry.UnknownService.selector);
        registry.resolveActive(serviceId);
    }

    function testExtensionRequiresExplicitDescriptorApproval() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryImplementation420 implementation = new RegistryImplementation420();
        bytes32 serviceId = keccak256("420/service/future-extension/v1");

        vm.expectRevert(ProtocolRegistry.UnapprovedServiceId.selector);
        registry.publishRegisteredService(serviceId, address(implementation), bytes32(0), 1, true,
            ProtocolRegistry.ComponentType.SERVICE, keccak256("manifest"), bytes32(0), keccak256("interface"));

        registry.approveServiceId(serviceId, keccak256("descriptor"));
        registry.publishRegisteredService(serviceId, address(implementation), bytes32(0), 1, true,
            ProtocolRegistry.ComponentType.SERVICE, keccak256("manifest"), bytes32(0), keccak256("interface"));
        require(registry.currentVersion(serviceId) == 1, "published");
    }
}
