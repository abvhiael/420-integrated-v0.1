// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { SeedPackOpening } from "../../contracts/src/highcountry/seeds/SeedPackOpening.sol";
import { HighCountryAuthorization } from "../../contracts/src/highcountry/auth/HighCountryAuthorization.sol";
import { EmergencyState } from "../../contracts/src/highcountry/security/EmergencyState.sol";
import { MockCapabilityRegistry } from "../../contracts/test/highcountry/mocks/MockCapabilityRegistry.sol";
import { ICapabilityRegistry420 } from "../../contracts/src/interfaces/genesis/ICapabilityRegistry420.sol";
import { RandomnessRouter420 } from "../../contracts/src/randomness/RandomnessRouter420.sol";
import { RandomnessRegistry } from "../../contracts/src/randomness/RandomnessRegistry.sol";
import { RandomnessRouteRegistry420 } from "../../contracts/src/randomness/RandomnessRouteRegistry420.sol";
import { RandomnessProfileRegistry420 } from "../../contracts/src/randomness/RandomnessProfileRegistry420.sol";
import { IRandomnessRouter420 } from "../../contracts/src/interfaces/IRandomnessRouter420.sol";
import { SeedTestSignatureVerifier } from "./seed-rare-contract-test.sol";

interface OpeningVm {
    function mockCall(
        address,
        bytes calldata,
        bytes calldata
    ) external;
    function warp(
        uint256
    ) external;
    function addr(
        uint256
    ) external pure returns (address);
    function prank(
        address
    ) external;
    function sign(
        uint256,
        bytes32
    ) external pure returns (uint8, bytes32, bytes32);
    function readFile(
        string calldata
    ) external view returns (string memory);
    function parseJsonBytes32(
        string calldata,
        string calldata
    ) external pure returns (bytes32);
    function parseJsonUint(
        string calldata,
        string calldata
    ) external pure returns (uint256);
    function toString(
        uint256
    ) external pure returns (string memory);
}

contract SeedOpeningQualificationTest {
    OpeningVm private constant vm = OpeningVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    EmergencyState private emergency;
    RandomnessRouter420 private router;
    RandomnessProfileRegistry420 private profiles;
    SeedPackOpening private opening;
    uint256 private constant KEY = 0x420;
    bytes32 private constant PROFILE = keccak256("SEED08.TEST_ONLY.PROFILE");
    bytes32 private constant ROUTE = keccak256("SEED08.TEST_ONLY.ROUTE");
    bytes32 private constant PACK = keccak256("SEED08.TEST_ONLY.PACK");
    bytes32 private constant COMMITMENT = keccak256("SEED08.TEST_ONLY.COMMITMENT");
    address private constant OWNER = address(0xA11CE);
    string private manifest;

    function grant(
        address principal,
        bytes32 module,
        bytes32 action,
        bytes32 scope
    ) private {
        caps.setGrant(
            keccak256(abi.encode(principal, module, action, scope)),
            ICapabilityRegistry420.CapabilityGrant(principal, module, action, scope, 0, 0, 0, 0, 0, false),
            0
        );
    }

    function setUp() public {
        vm.warp(1000);
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        emergency = new EmergencyState(address(auth));
        RandomnessRouteRegistry420 routes = new RandomnessRouteRegistry420(address(this));
        SeedTestSignatureVerifier verifier = new SeedTestSignatureVerifier(vm.addr(KEY));
        routes.setRoute(
            ROUTE,
            vm.addr(KEY),
            address(verifier),
            keccak256("420.RANDOM.METHOD.EXTERNAL_VRF.V1"),
            keccak256("stake"),
            keccak256("route"),
            true
        );
        profiles = new RandomnessProfileRegistry420(address(this));
        profiles.setProfile(PROFILE, ROUTE, 0, 100, 100, 2, 0, keccak256("profile"), true);
        RandomnessRegistry records = new RandomnessRegistry(address(this));
        router = new RandomnessRouter420(address(profiles), address(routes), address(records));
        records.bindRouter(address(router));
        manifest = vm.readFile("deployments/highcountry/seed-opening-policy.v1.json");
        bytes32[4] memory hashes;
        uint16[3][4] memory sizes;
        for (uint256 i; i < 4; i++) {
            string memory p = string.concat(".pools[", vm.toString(i), "]");
            hashes[i] = vm.parseJsonBytes32(manifest, string.concat(p, ".hash"));
            for (uint256 t; t < 3; t++) {
                sizes[i][t] = uint16(vm.parseJsonUint(manifest, string.concat(p, ".tierSizes[", vm.toString(t), "]")));
            }
        }
        opening = new SeedPackOpening(
            address(router),
            address(auth),
            address(emergency),
            keccak256("game"),
            vm.parseJsonBytes32(manifest, ".policyHash"),
            PROFILE,
            100,
            hashes,
            sizes
        );
        grant(address(this), opening.MODULE(), opening.REQUEST(), PACK);
    }

    function request() private returns (bytes32) {
        return opening.requestOpening(PACK, OWNER, 3, COMMITMENT);
    }

    function proof(
        bytes32 id,
        bytes32 entropy
    ) private returns (bytes memory) {
        IRandomnessRouter420.Request memory r = router.request(id);
        (uint8 v, bytes32 a, bytes32 b) = vm.sign(KEY, keccak256(abi.encode(id, r.domain, r.purpose, entropy)));
        return abi.encode(v, a, b);
    }

    function fulfill(
        bytes32 id
    ) private {
        bytes32 e = keccak256("TEST_ONLY_PROVIDER_ENTROPY");
        bytes memory p = proof(id, e);
        vm.prank(vm.addr(KEY));
        router.fulfillRandomness(id, e, p);
    }

    // Explicit boundary injection only: finding a zero Keccak preimage is not claimed.
    // Real request status and context are fulfilled through the actual router first.
    function testFulfilledZeroResultDoesNotStrandEntitlement() public {
        bytes32 id = request();
        fulfill(id);
        vm.mockCall(address(router), abi.encodeCall(router.result, (id)), abi.encode(bytes32(0), bytes32(0)));
        opening.fulfillOpening(PACK);
        require(opening.getOpening(PACK).fulfilled, "zero result stranded");
        opening.fulfillOpening(PACK);
    }

    function testModuloBiasRejectionBoundaries() public view {
        for (uint256 bound = 1; bound <= 65; bound++) {
            uint256 threshold;
            unchecked {
                threshold = (0 - bound) % bound;
            }
            if (threshold > 0) {
                (bool low,) = opening.reduce(threshold - 1, bound);
                require(!low, "biased low word admitted");
            }
            (bool accepted, uint256 ticket) = opening.reduce(threshold, bound);
            require(accepted && ticket == threshold % bound, "threshold mismatch");
        }
    }

    function testExactTierPartition() public view {
        uint256[3] memory counts;
        for (uint256 i; i < 10; i++) {
            counts[opening.tierForTicket(i)]++;
        }
        require(counts[0] == 6 && counts[1] == 3 && counts[2] == 1, "odds mismatch");
    }

    function testAll256JavaScriptDrawVectorsMatchSolidity() public view {
        for (uint256 i; i < 256; i++) {
            string memory p = string.concat(".testOnlyVectors[", vm.toString(i), "]");
            bytes32 e = vm.parseJsonBytes32(manifest, string.concat(p, ".entropy"));
            bytes32 r = vm.parseJsonBytes32(manifest, string.concat(p, ".requestId"));
            uint8 pool = uint8(vm.parseJsonUint(manifest, string.concat(p, ".pool")));
            uint8 tier = opening.tierForTicket(opening.uniform(e, r, opening.TIER_DRAW(), 10));
            require(tier == vm.parseJsonUint(manifest, string.concat(p, ".tierIndex")), "tier mismatch");
            require(
                opening.uniform(e, r, opening.CULTIVAR_DRAW(), opening.poolSize(pool, tier))
                    == vm.parseJsonUint(manifest, string.concat(p, ".index")),
                "index mismatch"
            );
        }
    }

    function testNoFreePreviewOrProoflessFulfillment() public {
        (bool ok,) = address(opening).call(abi.encodeCall(opening.fulfillOpening, (PACK)));
        require(!ok, "uncommitted preview");
        request();
        (ok,) = address(opening).call(abi.encodeCall(opening.fulfillOpening, (PACK)));
        require(!ok && !opening.getOpening(PACK).fulfilled, "proofless award");
    }

    function testUnauthorizedAndChangedCommitmentsCannotRequest() public {
        vm.prank(address(0xB0B));
        (bool ok,) = address(opening).call(abi.encodeCall(opening.requestOpening, (PACK, OWNER, 3, COMMITMENT)));
        require(!ok, "unauthorized request");
        request();
        (ok,) = address(opening).call(abi.encodeCall(opening.requestOpening, (PACK, OWNER, 2, COMMITMENT)));
        require(!ok, "changed pool");
        (ok,) = address(opening).call(abi.encodeCall(opening.requestOpening, (PACK, address(0xB0B), 3, COMMITMENT)));
        require(!ok, "changed owner");
        (ok,) = address(opening).call(abi.encodeCall(opening.requestOpening, (PACK, OWNER, 3, keccak256("changed"))));
        require(!ok, "changed commitment");
    }

    function testOneRequestAndOneImmutableFulfillment() public {
        bytes32 r = request();
        require(request() == r && router.requesterNonce(address(opening)) == 1, "reroll");
        fulfill(r);
        opening.fulfillOpening(PACK);
        SeedPackOpening.Opening memory o = opening.getOpening(PACK);
        opening.fulfillOpening(PACK);
        require(
            keccak256(abi.encode(o)) == keccak256(abi.encode(opening.getOpening(PACK))) && request() == r
                && router.requesterNonce(address(opening)) == 1,
            "double fulfillment"
        );
    }

    function testProviderOutageAndLateProofKeepOriginalEntitlement() public {
        bytes32 r = request();
        vm.warp(10000);
        (bool ok,) = address(router).call(abi.encodeCall(router.voidExpired, (r)));
        require(!ok && router.persistentRequest(r), "entitlement voided");
        require(request() == r, "replacement request");
        fulfill(r);
        opening.fulfillOpening(PACK);
        require(
            opening.getOpening(PACK).fulfilled && router.requesterNonce(address(opening)) == 1, "late recovery failed"
        );
    }

    function testInvalidProofAndWrongProviderNeverFulfill() public {
        bytes32 r = request();
        bytes32 e = keccak256("test");
        bytes memory p = proof(r, e);
        (bool ok,) = address(router).call(abi.encodeCall(router.fulfillRandomness, (r, e, p)));
        require(!ok, "wrong provider");
        vm.prank(vm.addr(KEY));
        (ok,) = address(router).call(abi.encodeCall(router.fulfillRandomness, (r, e, hex"00")));
        require(!ok && router.status(r) == IRandomnessRouter420.Status.REQUESTED, "bad proof");
    }

    function testLegacyRequestExpiryAndVoidAreUnchanged() public {
        bytes32 r = router.requestRandomness(PROFILE, keccak256("legacy"), keccak256("purpose"), 1100);
        vm.warp(1200);
        bytes32 e = keccak256("test");
        bytes memory p = proof(r, e);
        vm.prank(vm.addr(KEY));
        (bool ok,) = address(router).call(abi.encodeCall(router.fulfillRandomness, (r, e, p)));
        require(!ok, "legacy late proof allowed");
        router.voidExpired(r);
        require(router.status(r) == IRandomnessRouter420.Status.VOIDED, "legacy void changed");
    }

    function testPersistentCannotUseWeakOrSwitchableProfiles() public {
        profiles.setProfile(PROFILE, ROUTE, 0, 100, 100, 1, 0, keccak256("weak"), true);
        (bool ok,) = address(opening).call(abi.encodeCall(opening.requestOpening, (PACK, OWNER, 3, COMMITMENT)));
        require(!ok, "weak route");
        profiles.setProfile(PROFILE, ROUTE, keccak256("other-route"), 50, 100, 2, 1, keccak256("fallback"), true);
        (ok,) = address(opening).call(abi.encodeCall(opening.requestOpening, (PACK, OWNER, 3, COMMITMENT)));
        require(!ok, "provider switching");
    }

    function testNonUniqueMethodCannotOptIn() public {
        RandomnessRouteRegistry420 routes = router.routeRegistry();
        RandomnessRouteRegistry420.Route memory r = routes.route(ROUTE);
        routes.setRoute(
            ROUTE,
            r.operator,
            r.verifier,
            keccak256("420.RANDOM.METHOD.COMMIT_REVEAL.V1"),
            keccak256("stake"),
            keccak256("route"),
            true
        );
        (bool ok,) = address(opening).call(abi.encodeCall(opening.requestOpening, (PACK, OWNER, 3, COMMITMENT)));
        require(!ok && router.requesterNonce(address(opening)) == 0, "non-unique route admitted");
    }

    function testFrozenProviderSurvivesGovernanceChangesWithoutReroll() public {
        bytes32 id = request();
        RandomnessRouteRegistry420 routes = router.routeRegistry();
        SeedTestSignatureVerifier alternate = new SeedTestSignatureVerifier(vm.addr(KEY + 1));
        routes.setRoute(
            ROUTE,
            vm.addr(KEY + 1),
            address(alternate),
            keccak256("420.RANDOM.METHOD.EXTERNAL_VRF.V1"),
            keccak256("new-stake"),
            keccak256("new-route"),
            true
        );
        profiles.setProfile(PROFILE, ROUTE, 0, 100, 100, 2, 0, keccak256("new-profile"), true);
        vm.prank(vm.addr(KEY + 1));
        (bool ok,) = address(router).call(abi.encodeCall(router.fulfillRandomness, (id, keccak256("wrong"), hex"00")));
        require(!ok, "replacement provider admitted");
        require(request() == id && router.requesterNonce(address(opening)) == 1, "governance reroll");
        fulfill(id);
        opening.fulfillOpening(PACK);
        require(opening.getOpening(PACK).fulfilled, "original frozen proof rejected");
    }

    function testEmergencyPreservesCommittedDrawAndRecovery() public {
        bytes32 module = keccak256("HC.MODULE.EMERGENCY_STATE");
        bytes32 domain = keccak256("HC.EMERGENCY.MARKET");
        // Use canonical module identifier from the registry, never a permissive emergency stub.
        module = keccak256("HC.MODULE.EMERGENCY_STATE");
        grant(address(this), module, keccak256("HC.ACTION.EMERGENCY_STATE.RESTRICT"), domain);
        grant(address(this), module, keccak256("HC.ACTION.EMERGENCY_STATE.RELEASE"), domain);
        bytes32 r = request();
        fulfill(r);
        emergency.setRestricted(domain, true);
        (bool ok,) = address(opening).call(abi.encodeCall(opening.fulfillOpening, (PACK)));
        require(!ok && !opening.getOpening(PACK).fulfilled, "emergency ignored");
        emergency.setRestricted(domain, false);
        opening.fulfillOpening(PACK);
        require(opening.getOpening(PACK).fulfilled, "lost committed draw");
    }
}
