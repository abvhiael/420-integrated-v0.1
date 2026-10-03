// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/IRandomnessVerifier420.sol";
import "../src/randomness/RandomnessIds420.sol";
import "../src/randomness/RandomnessRouteRegistry420.sol";
import "../src/randomness/RandomnessProfileRegistry420.sol";
import "../src/randomness/RandomnessRegistry.sol";
import "../src/randomness/RandomnessDraw420.sol";

interface VmRandomnessAudit420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract RandomnessDrawHarness420 {
    function bounded(bytes32 root, bytes32 domain, uint256 index, uint256 upper) external pure returns (uint256) {
        return RandomnessDraw420.boundedUint(root, domain, index, upper);
    }
    function range(bytes32 root, bytes32 domain, uint256 index, uint256 min, uint256 max) external pure returns (uint256) {
        return RandomnessDraw420.uniformRange(root, domain, index, min, max);
    }
    function sample(bytes32 root, bytes32 domain, uint256 index, uint256 population, uint256 count)
        external pure returns (uint256[] memory)
    {
        return RandomnessDraw420.sampleWithoutReplacement(root, domain, index, population, count);
    }
}

contract RandomnessAudit420Test {
    VmRandomnessAudit420 private constant vm =
        VmRandomnessAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testRouteRegistryRejectsInvalidAuthorityMaterial() public {
        RandomnessRouteRegistry420 routes = new RandomnessRouteRegistry420(address(this));
        vm.expectRevert(RandomnessRouteRegistry420.InvalidRoute.selector);
        routes.setRoute(bytes32(0), address(1), address(2), bytes32(uint256(1)), bytes32(0), bytes32(0), true);
        vm.expectRevert(RandomnessRouteRegistry420.InvalidOperator.selector);
        routes.setRoute(bytes32(uint256(1)), address(0), address(2), bytes32(uint256(1)), bytes32(0), bytes32(0), true);
        vm.expectRevert(RandomnessRouteRegistry420.InvalidVerifier.selector);
        routes.setRoute(bytes32(uint256(1)), address(1), address(0), bytes32(uint256(1)), bytes32(0), bytes32(0), true);
    }

    function testProfileRegistryRejectsUnsafeFallbackShapes() public {
        RandomnessProfileRegistry420 profiles = new RandomnessProfileRegistry420(address(this));
        bytes32 primary = keccak256("primary");
        bytes32 fallbackRoute = keccak256("fallback");

        vm.expectRevert(RandomnessProfileRegistry420.InvalidTimeout.selector);
        profiles.setProfile(keccak256("p1"), primary, bytes32(0), 0, 10, 1, 0, bytes32(0), true);

        vm.expectRevert(RandomnessProfileRegistry420.InvalidFallbackPolicy.selector);
        profiles.setProfile(keccak256("p2"), primary, fallbackRoute, 1, 10, 1, 0, bytes32(0), true);

        vm.expectRevert(RandomnessProfileRegistry420.SameFallbackRoute.selector);
        profiles.setProfile(keccak256("p3"), primary, primary, 1, 10, 1, 1, bytes32(0), true);
    }

    function testRegistryBindingIsOneTimeAndRouterScoped() public {
        RandomnessRegistry registry = new RandomnessRegistry(address(this));
        address router = address(0xBEEF);
        registry.bindRouter(router);

        vm.expectRevert(RandomnessRegistry.RouterAlreadyBound.selector);
        registry.bindRouter(address(0xCAFE));

        vm.expectRevert(RandomnessRegistry.OnlyRouter.selector);
        registry.recordRequest(keccak256("request"), keccak256("binding"), 1);

        vm.prank(router);
        registry.recordRequest(keccak256("request"), keccak256("binding"), 1);
        RandomnessRegistry.Record memory record_ = registry.record(keccak256("request"));
        require(record_.exists && !record_.fulfilled, "request not recorded");
    }

    function testDrawsAreDeterministicBoundedAndWithoutReplacement() public {
        RandomnessDrawHarness420 h = new RandomnessDrawHarness420();
        bytes32 root = keccak256("root");
        bytes32 domain = keccak256("domain");
        uint256 a = h.bounded(root, domain, 7, 17);
        uint256 b = h.bounded(root, domain, 7, 17);
        require(a == b && a < 17, "bounded draw");

        uint256 ranged = h.range(root, domain, 8, 20, 30);
        require(ranged >= 20 && ranged <= 30, "range");

        uint256[] memory sample = h.sample(root, domain, 9, 8, 8);
        bool[8] memory seen;
        for (uint256 i; i < sample.length; ++i) {
            require(sample[i] < 8 && !seen[sample[i]], "replacement");
            seen[sample[i]] = true;
        }
    }

    function testDrawRejectsInvalidBounds() public {
        RandomnessDrawHarness420 h = new RandomnessDrawHarness420();
        vm.expectRevert(RandomnessDraw420.InvalidBound.selector);
        h.bounded(bytes32(uint256(1)), bytes32(uint256(2)), 0, 0);

        vm.expectRevert(RandomnessDraw420.SampleTooLarge.selector);
        h.sample(bytes32(uint256(1)), bytes32(uint256(2)), 0, 3, 4);
    }
}
