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
    address internal constant REPLACEMENT_OPERATOR = address(0xCA11);
    bytes32 internal constant PRIMARY_ROUTE = keccak256("primary-route");
    bytes32 internal constant FALLBACK_ROUTE = keccak256("fallback-route");
    bytes32 internal constant PROFILE = keccak256("game-profile");
    bytes32 internal constant VOID_PROFILE = keccak256("void-profile");
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
        vm.warp(1_000);
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
        profiles.setProfile(
            PROFILE,
            PRIMARY_ROUTE,
            FALLBACK_ROUTE,
            60,
            300,
            RandomnessIds420.SECURITY_HIGH,
            RandomnessIds420.FALLBACK_ONCE_THEN_VOID,
            keccak256("profile-meta"),
            true
        );
        profiles.setProfile(
            VOID_PROFILE,
            PRIMARY_ROUTE,
            bytes32(0),
            60,
            300,
            RandomnessIds420.SECURITY_STANDARD,
            RandomnessIds420.FALLBACK_VOID,
            keccak256("void-profile-meta"),
            true
        );

        registry = new RandomnessRegistry(address(this));
        router = new RandomnessRouter420(address(profiles), address(routes), address(registry));
        registry.bindRouter(address(router));
    }

    function _proof(bytes32 requestId, bytes32 randomness) private pure returns (bytes memory) {
        return abi.encode(keccak256(abi.encode(requestId, DOMAIN, PURPOSE, randomness)));
    }

    function testRequestBindsProfileAndExactRoutesBeforeEntropy() public {
        (, RandomnessProfileRegistry420 profiles, RandomnessRegistry registry, RandomnessRouter420 router) = _deploy();
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_300);

        IRandomnessRouter420.Request memory request_ = router.request(requestId);
        require(request_.profileId == PROFILE, "profile");
        require(request_.profileRevision == 1, "profile revision");
        require(request_.primaryRouteRevision == 1 && request_.fallbackRouteRevision == 1, "route revisions");
        require(request_.primaryOperator == PRIMARY_OPERATOR, "primary operator");
        require(request_.fallbackOperator == FALLBACK_OPERATOR, "fallback operator");
        require(request_.primaryVerifier != address(0) && request_.fallbackVerifier != address(0), "verifiers");
        require(request_.primaryMethod == RandomnessIds420.METHOD_NATIVE_THRESHOLD_VRF, "primary method");
        require(request_.fallbackMethod == RandomnessIds420.METHOD_EXTERNAL_VRF, "fallback method");
        require(request_.primaryDeadline == 1_060, "primary deadline");
        require(request_.deadline == 1_300, "deadline");
        require(request_.fallbackPolicy == RandomnessIds420.FALLBACK_ONCE_THEN_VOID, "fallback policy");

        RandomnessRegistry.Record memory record_ = registry.record(requestId);
        require(record_.exists && !record_.fulfilled && record_.bindingHash != bytes32(0), "registry request");

        profiles.setProfile(
            PROFILE,
            PRIMARY_ROUTE,
            FALLBACK_ROUTE,
            120,
            240,
            RandomnessIds420.SECURITY_CRITICAL,
            RandomnessIds420.FALLBACK_ONCE_THEN_VOID,
            keccak256("changed"),
            true
        );
        IRandomnessRouter420.Request memory unchanged = router.request(requestId);
        require(unchanged.profileRevision == 1, "request mutated");
        require(unchanged.securityTier == RandomnessIds420.SECURITY_HIGH, "tier mutated");
        require(unchanged.primaryDeadline == 1_060, "deadline mutated");
    }

    function testRouteRevisionDoesNotBrickAcceptedRequest() public {
        (RandomnessRouteRegistry420 routes, , , RandomnessRouter420 router) = _deploy();
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_300);
        MockRandomnessVerifier420 verifier2 = new MockRandomnessVerifier420();
        routes.setRoute(
            PRIMARY_ROUTE,
            REPLACEMENT_OPERATOR,
            address(verifier2),
            RandomnessIds420.METHOD_MULTI_PROVIDER,
            keccak256("new-stake"),
            keccak256("new-meta"),
            true
        );

        bytes32 entropy = keccak256("accepted-before-route-update");
        vm.prank(PRIMARY_OPERATOR);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));
        require(router.status(requestId) == IRandomnessRouter420.Status.FULFILLED, "snapshot not honored");
    }

    function testValidProofFulfillsExactlyOnceIncludingZeroProviderWord() public {
        (, , RandomnessRegistry registry, RandomnessRouter420 router) = _deploy();
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_300);
        bytes32 providerRandomness = bytes32(0);

        vm.prank(PRIMARY_OPERATOR);
        router.fulfillRandomness(requestId, providerRandomness, _proof(requestId, providerRandomness));

        require(router.status(requestId) == IRandomnessRouter420.Status.FULFILLED, "not fulfilled");
        (, bytes32 proofHash) = router.result(requestId);
        RandomnessRegistry.Record memory record_ = registry.record(requestId);
        require(record_.fulfilled && record_.routeId == PRIMARY_ROUTE, "registry result");
        require(proofHash == keccak256(_proof(requestId, providerRandomness)), "proof commitment");

        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.WrongStatus.selector);
        router.fulfillRandomness(requestId, keccak256("reroll"), _proof(requestId, keccak256("reroll")));
    }

    function testInvalidProofAndUnauthorizedOperatorFailClosed() public {
        (, , , RandomnessRouter420 router) = _deploy();
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_300);
        bytes32 entropy = keccak256("entropy");

        vm.prank(address(0xBAD));
        vm.expectRevert(RandomnessRouter420.UnauthorizedOperator.selector);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));

        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.InvalidProof.selector);
        router.fulfillRandomness(requestId, entropy, abi.encode(bytes32(uint256(7))));
        require(router.status(requestId) == IRandomnessRouter420.Status.REQUESTED, "status changed");
    }

    function testFallbackIsPredeterminedTimeoutOnlyAndSingleStage() public {
        (, , , RandomnessRouter420 router) = _deploy();
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_300);

        vm.expectRevert(RandomnessRouter420.FallbackTooEarly.selector);
        router.activateFallback(requestId);

        vm.warp(1_061);
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

    function testVoidProfileHasNoFallbackPath() public {
        (, , , RandomnessRouter420 router) = _deploy();
        bytes32 requestId = router.requestRandomness(VOID_PROFILE, DOMAIN, PURPOSE, 1_200);
        vm.warp(1_061);
        vm.expectRevert(RandomnessRouter420.FallbackUnavailable.selector);
        router.activateFallback(requestId);
    }

    function testRequestLifetimeCannotExceedProfileMaximum() public {
        (, , , RandomnessRouter420 router) = _deploy();
        vm.expectRevert(RandomnessRouter420.InvalidDeadline.selector);
        router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_301);
    }

    function testPrimaryCannotFulfillAfterFallbackWindowOpens() public {
        (, , , RandomnessRouter420 router) = _deploy();
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_300);
        vm.warp(1_061);
        bytes32 entropy = keccak256("late-primary");
        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.PrimaryWindowElapsed.selector);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));
    }

    function testExpiredRequestVoidsAndCannotBeResolvedOrRerolled() public {
        (, , , RandomnessRouter420 router) = _deploy();
        bytes32 requestId = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_100);
        vm.warp(1_101);
        router.voidExpired(requestId);
        require(router.status(requestId) == IRandomnessRouter420.Status.VOIDED, "not voided");

        bytes32 entropy = keccak256("too-late");
        vm.prank(PRIMARY_OPERATOR);
        vm.expectRevert(RandomnessRouter420.WrongStatus.selector);
        router.fulfillRandomness(requestId, entropy, _proof(requestId, entropy));
    }

    function testRequestIdsAreReplaySafePerRequesterNonce() public {
        (, , , RandomnessRouter420 router) = _deploy();
        bytes32 a = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_300);
        bytes32 b = router.requestRandomness(PROFILE, DOMAIN, PURPOSE, 1_300);
        require(a != b, "request replay");
    }
}