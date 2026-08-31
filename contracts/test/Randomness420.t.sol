// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/IRandomnessVerifier420.sol";
import "../src/interfaces/IRandomnessRouter420.sol";
import "../src/randomness/RandomnessIds420.sol";
import "../src/randomness/RandomnessRouteRegistry420.sol";
import "../src/randomness/RandomnessProfileRegistry420.sol";
import "../src/randomness/RandomnessRegistry.sol";
import "../src/randomness/RandomnessRouter420.sol";

interface VmRandomness420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract MockRandomnessVerifier420 is IRandomnessVerifier420 {
    function verifyRandomness(
        bytes32 requestId,
        bytes32 domain,
        bytes32 purpose,
        bytes32 providerRandomness,
        bytes calldata proof
    ) external pure returns (bool) {
        if (proof.length != 32) return false;
        bytes32 supplied = abi.decode(proof, (bytes32));
        return supplied == keccak256(abi.encode(requestId, domain, purpose, providerRandomness));
    }
}

contract Randomness420Test {
    VmRandomness420 internal constant vm = VmRandomness420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant PRIMARY_OPERATOR = address(0xA11CE);
    address internal constant FALLBACK_OPERATOR = address(0xB0B);
    bytes32 internal constant PRIMARY_ROUTE = keccak256("primary-route");
    bytes32 internal constant FALLBACK_ROUTE = keccak256("fallback-route");
    bytes32 internal constant PROFILE = keccak256("game-profile");
    bytes32 internal constant DOMAIN = keccak256("game-domain");
    bytes32 internal constant PURPOSE = keccak256("round-42");

    function _deploy()
        private
        returns (
            RandomnessRouteRegistry420 routes,
            RandomnessProfileRegistry420 profiles,
            RandomnessRegistry registry,
            RandomnessRouter420 router
        )
    {
        MockRandomnessVerifier420 verifier = new MockRandomnessVerifier420();
        routes = new RandomnessRouteRegistry420(address(this));
        routes.setRoute(
            PRIMARY_ROUTE,
            PRIMARY_OPERATOR,
            address(verifier),
            RandomnessIds420.METHOD_NATIVE_THRESHOLD_VRF,
            keccak256("primary-stake"),
            keccak256("primary-meta"),
            true
        );
        routes.setRoute(
            FALLBACK_ROUTE,
            FALLBACK_OPERATOR,
            address(verifier),
            RandomnessIds420.METHOD_EXTERNAL_VRF,
            keccak256("fallback-stake"),
            keccak256("fallback-meta"),
            true
        );

        profiles = new RandomnessProfileRegistry420(address(this));
        profiles.setProfile(PROFILE, PRIMARY_ROUTE, FALLBACK_ROUTE, 60, 2, keccak256("profile-meta"), true);

        registry = new RandomnessRegistry(address(this));
        router = new RandomnessRouter420(address(profiles), address(routes), address(registry));
        registry.bindRouter(address(router));
    }

    function _proof(bytes32 requestId, bytes32 randomness) private pure returns (bytes memory) {
        return abi.encode(keccak256(abi.encode(requestId, DOMAIN, PURPOSE, randomness)));
    }

    function testRequestBindsProfileAndPrimaryRouteBeforeEntropy() public {
        (, RandomnessProfileRegistry420 profiles, RandomnessRegistry registry, RandomnessRouter420 router) = _deploy();
        vm.warp(1_000);
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_300);

        IRandomnessRouter420.Request memory request_ = router.request(requestId);
        require(request_.profileId == PROFILE, "profile");
        require(request_.profileRevision == 1, "profile revision");
        require(request_.primaryRoute == PRIMARY_ROUTE, "primary route");
        require(request_.fallbackRoute == FALLBACK_ROUTE, "fallback route");
        require(request_.primaryDeadline == 1_060, "primary deadline");
        require(request_.deadline == 1_300, "deadline");
        require(request_.status == IRandomnessRouter420.Status.REQUESTED, "status");

        RandomnessRegistry.Record memory record_ = registry.record(requestId);
        require(record_.exists && !record_.fulfilled, "registry request");
        require(record_.bindingHash != bytes32(0), "binding");

        profiles.setProfile(PROFILE, PRIMARY_ROUTE, FALLBACK_ROUTE, 120, 3, keccak256("changed"), true);
        IRandomnessRouter420.Request memory unchanged = router.request(requestId);
        require(unchanged.profileRevision == 1, "request mutated");
        require(unchanged.securityTier == 2, "tier mutated");
    }

    function testValidProofFulfillsExactlyOnce() public {
        (, , RandomnessRegistry registry, RandomnessRouter420 router) = _deploy();
        vm.warp(2_000);
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 2_300);
        bytes32 providerRandomness = keccak256("entropy-a");

        vm.prank(PRIMARY_OPERATOR);
        router.fulfillRandomness(requestId, providerRandomness, _proof(requestId, providerRandomness));

        require(router.status(requestId) == IRandomnessRouter420.Status.FULFILLED, "not fulfilled");
        (bytes32 root, bytes32 proofHash) = router.result(requestId);
        require(root != bytes32(0), "root");
        require(proofHash != bytes32(0), "proof hash");
        RandomnessRegistry.Record memory record_ = registry.record(requestId);
        require(record_.fulfilled && record_.routeId == PRIMARY_ROUTE, "registry result");

        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.WrongStatus.selector);
        router.fulfillRandomness(requestId, keccak256("entropy-b"), _proof(requestId, keccak256("entropy-b")));
    }

    function testInvalidProofFailsClosed() public {
        (, , , RandomnessRouter420 router) = _deploy();
        vm.warp(3_000);
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 3_300);
        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.InvalidProof.selector);
        router.fulfillRandomness(requestId, keccak256("entropy"), abi.encode(bytes32(uint256(7))));
        require(router.status(requestId) == IRandomnessRouter420.Status.REQUESTED, "status changed");
    }

    function testUnauthorizedOperatorCannotFulfill() public {
        (, , , RandomnessRouter420 router) = _deploy();
        vm.warp(4_000);
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 4_300);
        bytes32 entropy = keccak256("entropy");
        vm.prank(address(0xBAD));
        vm.expectRevert(RandomnessRouter420.UnauthorizedOperator.selector);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));
    }

    function testFallbackIsPredeterminedAndCannotActivateEarly() public {
        (, , , RandomnessRouter420 router) = _deploy();
        vm.warp(5_000);
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 5_300);

        vm.expectRevert(RandomnessRouter420.FallbackTooEarly.selector);
        router.activateFallback(requestId);

        vm.warp(5_061);
        router.activateFallback(requestId);
        require(router.status(requestId) == IRandomnessRouter420.Status.FALLBACK_ACTIVE, "fallback status");

        bytes32 entropy = keccak256("fallback-entropy");
        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.UnauthorizedOperator.selector);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));

        vm.prank(FALLBACK_OPERATOR);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));
        require(router.status(requestId) == IRandomnessRouter420.Status.FULFILLED, "fallback fulfillment");
    }

    function testPrimaryCannotFulfillAfterFallbackWindowOpens() public {
        (, , , RandomnessRouter420 router) = _deploy();
        vm.warp(6_000);
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 6_300);
        vm.warp(6_061);
        bytes32 entropy = keccak256("late-primary");
        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.PrimaryWindowElapsed.selector);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));
    }

    function testExpiredRequestCannotBeResolvedOrRerolled() public {
        (, , , RandomnessRouter420 router) = _deploy();
        vm.warp(7_000);
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 7_100);
        vm.warp(7_101);
        router.expire(requestId);
        require(router.status(requestId) == IRandomnessRouter420.Status.EXPIRED, "not expired");

        bytes32 entropy = keccak256("too-late");
        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.WrongStatus.selector);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));
    }

    function testRouteRevisionChangeFailsClosedForInflightRequest() public {
        (RandomnessRouteRegistry420 routes, , , RandomnessRouter420 router) = _deploy();
        vm.warp(8_000);
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 8_300);
        MockRandomnessVerifier420 verifier2 = new MockRandomnessVerifier420();
        routes.setRoute(
            PRIMARY_ROUTE,
            PRIMARY_OPERATOR,
            address(verifier2),
            RandomnessIds420.METHOD_NATIVE_THRESHOLD_VRF,
            keccak256("new-stake"),
            keccak256("new-meta"),
            true
        );
        bytes32 entropy = keccak256("entropy");
        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.RouteRevisionChanged.selector);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));
    }

    function testRequestIdsAreReplaySafePerRequesterNonce() public {
        (, , , RandomnessRouter420 router) = _deploy();
        vm.warp(9_000);
        bytes32 a = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 9_300);
        bytes32 b = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 9_300);
        require(a != b, "request replay");
    }
}