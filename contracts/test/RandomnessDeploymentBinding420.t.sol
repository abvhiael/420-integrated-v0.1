// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/randomness/RandomnessProfileRegistry420.sol";
import "../src/randomness/RandomnessRegistry.sol";
import "../src/randomness/RandomnessRouteRegistry420.sol";
import "../src/randomness/RandomnessRouter420.sol";

interface VmRandomnessDeployment420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract RandomnessDeploymentBinding420Test {
    VmRandomnessDeployment420 private constant vm =
        VmRandomnessDeployment420(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 internal constant RANDOMNESS_SERVICE_ID = keccak256("420/service/randomness/v1");
    bytes32 internal constant RANDOMNESS_ROUTER_COMPONENT_ID =
        keccak256("420/APP/420RANDOM/RANDOMNESS_ROUTER");
    bytes32 internal constant METADATA_HASH = keccak256("420/RANDOMNESS/RELEASE/METADATA/V1");
    bytes32 internal constant MANIFEST_HASH =
        keccak256("420/RANDOMNESS/AUDIT-4/DEPLOYMENT-BUNDLE/V1");
    bytes32 internal constant INTERFACE_HASH =
        keccak256("420/RANDOMNESS/RANDOMNESS_ROUTER/INTERFACE/V1");

    struct Env {
        ProtocolRegistry protocolRegistry;
        RandomnessRegistry randomnessRegistry;
        RandomnessRouteRegistry420 routes;
        RandomnessProfileRegistry420 profiles;
        RandomnessRouter420 router;
        bytes32 dependencyRoot;
    }

    function _deployAndPublish() internal returns (Env memory e) {
        e.protocolRegistry = new ProtocolRegistry(address(this));
        e.randomnessRegistry = new RandomnessRegistry(address(this));
        e.routes = new RandomnessRouteRegistry420(address(this));
        e.profiles = new RandomnessProfileRegistry420(address(this));
        e.router = new RandomnessRouter420(address(e.profiles), address(e.routes), address(e.randomnessRegistry));

        e.dependencyRoot = keccak256(
            abi.encode(
                address(e.routes),
                address(e.profiles),
                address(e.randomnessRegistry),
                address(e.router),
                address(e.routes).codehash,
                address(e.profiles).codehash,
                address(e.randomnessRegistry).codehash,
                address(e.router).codehash
            )
        );

        e.protocolRegistry.registerComponent(
            RANDOMNESS_ROUTER_COMPONENT_ID,
            address(e.router),
            Types420.Version({major: 1, minor: 0, patch: 0}),
            Types420.Lifecycle.ACTIVE
        );
        e.protocolRegistry.publishRegisteredService(
            RANDOMNESS_SERVICE_ID,
            address(e.router),
            METADATA_HASH,
            1,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            e.dependencyRoot,
            INTERFACE_HASH
        );

        e.randomnessRegistry.bindRouter(address(e.router));
    }

    function testDeploymentOrderAndConstructorBindings() public {
        Env memory e = _deployAndPublish();

        require(e.routes.governanceTimelock() == address(this), "route/timelock binding");
        require(e.profiles.governanceTimelock() == address(this), "profile/timelock binding");
        require(e.randomnessRegistry.governanceTimelock() == address(this), "registry/timelock binding");
        require(address(e.router.profileRegistry()) == address(e.profiles), "router/profile binding");
        require(address(e.router.routeRegistry()) == address(e.routes), "router/route binding");
        require(address(e.router.randomnessRegistry()) == address(e.randomnessRegistry), "router/registry binding");
        require(e.randomnessRegistry.randomnessRouter() == address(e.router), "registry/router binding");
    }

    function testProtocolRegistryPublishesExactRouterAndRuntimeIdentity() public {
        Env memory e = _deployAndPublish();

        ProtocolRegistry.Service memory service = e.protocolRegistry.getService(RANDOMNESS_SERVICE_ID);
        require(service.implementation == address(e.router), "service implementation");
        require(service.codeHash == address(e.router).codehash, "service codehash");
        require(service.metadataHash == METADATA_HASH, "service metadata");
        require(service.version == 1 && service.active, "service lifecycle");

        ProtocolRegistry.RegistrationProfile memory profile =
            e.protocolRegistry.getRegistrationProfile(RANDOMNESS_SERVICE_ID, 1);
        require(profile.componentType == ProtocolRegistry.ComponentType.SERVICE, "component type");
        require(profile.manifestHash == MANIFEST_HASH, "manifest hash");
        require(profile.dependencyRoot == e.dependencyRoot, "dependency root");
        require(profile.interfaceHash == INTERFACE_HASH, "interface hash");

        (address resolved, uint32 version) = e.protocolRegistry.resolveActive(RANDOMNESS_SERVICE_ID);
        require(resolved == address(e.router) && version == 1, "active resolution");

        Types420.ContractRef memory component = e.protocolRegistry.component(RANDOMNESS_ROUTER_COMPONENT_ID);
        require(component.implementation == address(e.router), "component implementation");
        require(component.runtimeCodeHash == address(e.router).codehash, "component codehash");
        require(component.lifecycle == Types420.Lifecycle.ACTIVE, "component lifecycle");
    }

    function testRegistryBindingIsGovernanceOnlyAndOneTime() public {
        RandomnessRegistry registry = new RandomnessRegistry(address(this));
        RandomnessRouteRegistry420 routes = new RandomnessRouteRegistry420(address(this));
        RandomnessProfileRegistry420 profiles = new RandomnessProfileRegistry420(address(this));
        RandomnessRouter420 router = new RandomnessRouter420(address(profiles), address(routes), address(registry));

        vm.prank(address(0xBEEF));
        vm.expectRevert(bytes4(keccak256("Unauthorized()")));
        registry.bindRouter(address(router));

        registry.bindRouter(address(router));
        require(registry.randomnessRouter() == address(router), "initial router bind");

        vm.expectRevert(RandomnessRegistry.RouterAlreadyBound.selector);
        registry.bindRouter(address(0xCAFE));
        require(registry.randomnessRouter() == address(router), "router changed after one-time bind");
    }

    function testPublishedRouterAndBoundRouterCannotDiverge() public {
        Env memory e = _deployAndPublish();
        RandomnessRouter420 wrong =
            new RandomnessRouter420(address(e.profiles), address(e.routes), address(e.randomnessRegistry));

        ProtocolRegistry.Service memory service = e.protocolRegistry.getService(RANDOMNESS_SERVICE_ID);
        require(service.implementation == e.randomnessRegistry.randomnessRouter(), "published/bound router mismatch");
        require(service.implementation != address(wrong), "wrong router published");

        vm.expectRevert(RandomnessRegistry.RouterAlreadyBound.selector);
        e.randomnessRegistry.bindRouter(address(wrong));
        require(e.randomnessRegistry.randomnessRouter() == address(e.router), "wrong router rebound");
    }
}
