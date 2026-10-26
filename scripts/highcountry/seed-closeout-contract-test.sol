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

interface CloseoutVm {
    function deal(
        address,
        uint256
    ) external;
    function parseJsonBytes32Array(
        string calldata,
        string calldata
    ) external pure returns (bytes32[] memory);
    function parseJsonString(
        string calldata,
        string calldata
    ) external pure returns (string memory);
    function toString(
        bytes32
    ) external pure returns (string memory);
    function toString(
        address
    ) external pure returns (string memory);
    function writeFile(
        string calldata,
        string calldata
    ) external;

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

import { SeedPackPayments } from "../../contracts/src/highcountry/seeds/SeedPackPayments.sol";
import { SeedRegistry } from "../../contracts/src/highcountry/genetics/SeedRegistry.sol";
import { GenomeRegistry } from "../../contracts/src/highcountry/genetics/GenomeRegistry.sol";
import { GenesisRegistry } from "../../contracts/src/highcountry/genesis/GenesisRegistry.sol";
import { GenesisRoots } from "../../contracts/src/highcountry/types/HighCountryTypes.sol";
import { ActionIds } from "../../contracts/src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../contracts/src/highcountry/constants/ModuleIds.sol";
import { RandomnessIds420 } from "../../contracts/src/randomness/RandomnessIds420.sol";

contract SeedCloseoutLifecycleTest {
    SeedPackPayments private payments;
    GenomeRegistry private genomes;
    SeedRegistry private seeds;
    uint256 constant QUOTE_KEY = 0x999;
    receive() external payable { }

    CloseoutVm private constant vm = CloseoutVm(address(uint160(uint256(keccak256("hevm cheat code")))));
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
        GenesisRegistry genesis = new GenesisRegistry(address(auth));
        genomes = new GenomeRegistry(address(auth), address(genesis));
        grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE());
        grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, genesis.ADMIN_SCOPE());
        bytes32 root = keccak256("DISPOSABLE TEST GENESIS NOT LIVE");
        genesis.setRoots(GenesisRoots(root, root, root, root, root, root));
        genesis.finalizeGenesis();
        seeds = new SeedRegistry(address(auth), address(genomes));
        payments = new SeedPackPayments(
            keccak256("game"), opening.policyHash(), address(this), address(emergency), vm.addr(QUOTE_KEY)
        );
        vm.deal(OWNER, 2 ether);
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

    function paid() private returns (bytes32 id) {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", payments.quoteDigest(OWNER, PACK, COMMITMENT, 3))
        );
        (uint8 v, bytes32 r, bytes32 sigS) = vm.sign(QUOTE_KEY, digest);
        vm.prank(OWNER);
        payments.pay{ value: 1 ether }(PACK, COMMITMENT, 3, v, r, sigS);
        id = payments.purchaseId(OWNER, PACK);
        require(payments.receipt(id).status == 1, "payment absent");
    }

    // Explicit TEST-ONLY signature provider. Choosing common fixture coverage is not production VRF evidence.
    function commonProof(
        bytes32 id
    ) private {
        IRandomnessRouter420.Request memory r = router.request(id);
        bytes32 entropy;
        for (uint256 nonce; nonce < 100; nonce++) {
            bytes32 candidate = keccak256(abi.encode("TEST ONLY COMMON FIXTURE", nonce));
            bytes32 root = keccak256(
                abi.encode(
                    RandomnessIds420.ROOT_TYPEHASH,
                    block.chainid,
                    address(router),
                    id,
                    r.profileId,
                    r.profileRevision,
                    r.primaryRoute,
                    r.primaryRouteRevision,
                    r.primaryMethod,
                    candidate
                )
            );
            if (opening.tierForTicket(opening.uniform(root, id, opening.TIER_DRAW(), 10)) == 0) {
                entropy = candidate;
                break;
            }
        }
        require(entropy != 0, "fixture root search exhausted");
        bytes memory p = proof(id, entropy);
        vm.prank(vm.addr(KEY));
        router.fulfillRandomness(id, entropy, p);
        opening.fulfillOpening(PACK);
    }

    function delivery(
        bool authorize
    ) private returns (bytes32 gid) {
        SeedPackOpening.Opening memory o = opening.getOpening(PACK);
        require(o.fulfilled && o.tier == 0, "verified common outcome required");
        string memory refs = vm.readFile("deployments/highcountry/common-reference-genomes.v1.json");
        string memory base = string.concat(".genomes[", vm.toString(uint256(o.index)), "]");
        require(
            keccak256(bytes(vm.parseJsonString(refs, string.concat(base, ".cultivarId"))))
                == keccak256(
                    bytes(
                        vm.parseJsonString(
                            manifest, string.concat(".pools[3].tiers[0][", vm.toString(uint256(o.index)), "]")
                        )
                    )
                ),
            "pool/genome index mismatch"
        );
        gid = vm.parseJsonBytes32(refs, string.concat(base, ".genomeId"));
        bytes32 line = vm.parseJsonBytes32(refs, string.concat(base, ".lineId"));
        bytes32 metadata = vm.parseJsonBytes32(refs, string.concat(base, ".metadataHash"));
        bytes32[] memory raw = vm.parseJsonBytes32Array(refs, string.concat(base, ".loci"));
        bytes32[28] memory loci;
        require(raw.length == 28, "loci");
        for (uint256 n; n < 28; n++) {
            loci[n] = raw[n];
        }
        grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, gid);
        genomes.registerGenome(gid, line, metadata, loci);
        if (authorize) {
            caps.setGrant(
                keccak256("EXACT LOT CAP"),
                ICapabilityRegistry420.CapabilityGrant(
                    address(this),
                    ModuleIds.SEED_REGISTRY,
                    ActionIds.SEED_REGISTER,
                    bytes32(uint256(42)),
                    3,
                    0,
                    0,
                    0,
                    0,
                    false
                ),
                3
            );
        }
        (bool ok,) = address(seeds)
            .call(
                abi.encodeCall(
                    seeds.registerSeedLot,
                    (
                        42,
                        gid,
                        0,
                        OWNER,
                        3,
                        keccak256(abi.encode(payments.purchaseId(OWNER, PACK), o.requestId, o.proofHash, gid))
                    )
                )
            );
        require(ok == authorize, "registration authorization boundary");
    }

    function testNativePaymentToCanonicalOpeningToExactAuthorizedSeedLot() public {
        bytes32 paymentId = paid();
        bytes32 requestId = request();
        commonProof(requestId);
        bytes32 gid = delivery(true);
        SeedRegistry.SeedLot memory lot = seeds.getSeedLot(42);
        require(
            lot.owner == OWNER && lot.quantity == 3 && lot.genomeId == gid && seeds.remainingQuantity(42) == 3,
            "delivery mismatch"
        );
        require(payments.treasuryCredit() == 1 ether, "native conservation");
        opening.fulfillOpening(PACK);
        (bool replay,) =
            address(seeds).call(abi.encodeCall(seeds.registerSeedLot, (42, gid, 0, OWNER, 3, lot.metadataHash)));
        require(!replay && seeds.remainingQuantity(42) == 3, "duplicate seed delivery");
        vm.writeFile(
            "out/hc-seed-10-chain-trace.json",
            string.concat(
                '{"schema":"HC.SEED.CHAIN_TRACE.V1","environment":"DISPOSABLE_CONTRACT_TEST","liveRegistration":false,"provider":"TEST_ONLY_SIGNATURE_NOT_VRF","paymentId":"',
                vm.toString(paymentId),
                '","openingKey":"',
                vm.toString(PACK),
                '","requestId":"',
                vm.toString(requestId),
                '","genomeId":"',
                vm.toString(gid),
                '","lotId":42,"quantity":3,"owner":"',
                vm.toString(lot.owner),
                '"}'
            )
        );
    }

    function testPaidReceiptDoesNotBypassSeedRegistryCapability() public {
        paid();
        bytes32 id = request();
        commonProof(id);
        delivery(false);
        (bool exists,) = address(seeds).staticcall(abi.encodeCall(seeds.getSeedLot, (42)));
        require(!exists, "unauthorized seed lot exists");
    }

    function testPaidEntitlementSurvivesProviderDelayAndOriginalLateProof() public {
        bytes32 paymentId = paid();
        bytes32 id = request();
        vm.warp(5000);
        (bool voided,) = address(router).call(abi.encodeCall(router.voidExpired, (id)));
        require(!voided && payments.receipt(paymentId).status == 1, "lost paid entitlement");
        commonProof(id);
        delivery(true);
        require(seeds.remainingQuantity(42) == 3, "late delivery failed");
    }
}
