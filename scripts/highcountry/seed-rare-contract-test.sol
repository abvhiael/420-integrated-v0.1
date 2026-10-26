// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { GenomeRegistry } from "../../contracts/src/highcountry/genetics/GenomeRegistry.sol";
import { FoundingGenetics } from "../../contracts/src/highcountry/genetics/FoundingGenetics.sol";
import { GenesisRegistry } from "../../contracts/src/highcountry/genesis/GenesisRegistry.sol";
import { HighCountryAuthorization } from "../../contracts/src/highcountry/auth/HighCountryAuthorization.sol";
import { MockCapabilityRegistry } from "../../contracts/test/highcountry/mocks/MockCapabilityRegistry.sol";
import { ICapabilityRegistry420 } from "../../contracts/src/interfaces/genesis/ICapabilityRegistry420.sol";
import { ActionIds } from "../../contracts/src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../contracts/src/highcountry/constants/ModuleIds.sol";
import { GenesisRoots } from "../../contracts/src/highcountry/types/HighCountryTypes.sol";
import {
    HCGenesisNotFinalized,
    HCUnauthorized,
    HCAlreadyExists,
    HCInvalidId
} from "../../contracts/src/highcountry/errors/HighCountryErrors.sol";

import { BreedingEngine } from "../../contracts/src/highcountry/breeding/BreedingEngine.sol";
import {
    CanonicalBreedingRandomnessAdapter
} from "../../contracts/src/highcountry/random/CanonicalBreedingRandomnessAdapter.sol";
import { EmergencyState } from "../../contracts/src/highcountry/security/EmergencyState.sol";
import { EmergencyDomains } from "../../contracts/src/highcountry/constants/EmergencyDomains.sol";
import { RandomnessRouter420 } from "../../contracts/src/randomness/RandomnessRouter420.sol";
import { RandomnessRegistry } from "../../contracts/src/randomness/RandomnessRegistry.sol";
import { RandomnessProfileRegistry420 } from "../../contracts/src/randomness/RandomnessProfileRegistry420.sol";
import { RandomnessRouteRegistry420 } from "../../contracts/src/randomness/RandomnessRouteRegistry420.sol";
import { IRandomnessVerifier420 } from "../../contracts/src/interfaces/IRandomnessVerifier420.sol";
import { IRandomnessRouter420 } from "../../contracts/src/interfaces/IRandomnessRouter420.sol";

interface SeedRareVm {
    function parseJsonUint(
        string calldata json,
        string calldata key
    ) external pure returns (uint256);
    function toString(
        bytes32 value
    ) external pure returns (string memory);
    function toString(
        address value
    ) external pure returns (string memory);
    function addr(
        uint256 key
    ) external pure returns (address);
    function sign(
        uint256 key,
        bytes32 digest
    ) external pure returns (uint8, bytes32, bytes32);
    function prank(
        address who
    ) external;
    function warp(
        uint256 timestamp
    ) external;
    function writeFile(
        string calldata path,
        string calldata contents
    ) external;

    function readFile(
        string calldata path
    ) external view returns (string memory);
    function parseJsonBytes32(
        string calldata json,
        string calldata key
    ) external pure returns (bytes32);
    function parseJsonBytes32Array(
        string calldata json,
        string calldata key
    ) external pure returns (bytes32[] memory);
    function parseJsonString(
        string calldata json,
        string calldata key
    ) external pure returns (string memory);
    function parseJsonBool(
        string calldata json,
        string calldata key
    ) external pure returns (bool);
    function toString(
        uint256 value
    ) external pure returns (string memory);
}

// TEST ONLY: cryptographic binding fixture, not an approved production VRF verifier.
contract SeedTestSignatureVerifier is IRandomnessVerifier420 {
    address private immutable signer;

    constructor(
        address signer_
    ) {
        signer = signer_;
    }

    function verifyRandomness(
        bytes32 id,
        bytes32 domain,
        bytes32 purpose,
        bytes32 entropy,
        bytes calldata proof
    ) external view returns (bool) {
        if (proof.length != 96) return false;
        (uint8 v, bytes32 r, bytes32 s) = abi.decode(proof, (uint8, bytes32, bytes32));
        return ecrecover(keccak256(abi.encode(id, domain, purpose, entropy)), v, r, s) == signer;
    }
}

contract SeedRareLifecycleTest {
    SeedRareVm private constant vm = SeedRareVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockCapabilityRegistry private capabilities;
    HighCountryAuthorization private authorization;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    string private manifest;

    function setUp() public {
        vm.warp(1_000);
        capabilities = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilities));
        genesis = new GenesisRegistry(address(authorization));
        genomes = new GenomeRegistry(address(authorization), address(genesis));
        manifest = vm.readFile("deployments/highcountry/common-reference-genomes.v1.json");
    }

    function _key(
        uint256 index,
        string memory field
    ) private pure returns (string memory) {
        return string.concat(".genomes[", vm.toString(index), "]", field);
    }

    function _record(
        uint256 index
    ) private view returns (GenomeRegistry.GenomeRecord memory e) {
        e.id = vm.parseJsonBytes32(manifest, _key(index, ".genomeId"));
        e.lineId = vm.parseJsonBytes32(manifest, _key(index, ".lineId"));
        e.metadataHash = vm.parseJsonBytes32(manifest, _key(index, ".metadataHash"));
        bytes32[] memory loci = vm.parseJsonBytes32Array(manifest, _key(index, ".loci"));
        require(loci.length == 28, "manifest locus count");
        for (uint256 i; i < 28; ++i) {
            e.loci[i] = loci[i];
        }
        require(!vm.parseJsonBool(manifest, _key(index, ".founding")), "common marked founding");
    }

    function _grant(
        bytes32 module,
        bytes32 action,
        bytes32 scope
    ) private returns (bytes32 grantId) {
        grantId = keccak256(abi.encode(module, action, scope));
        capabilities.setGrant(
            grantId,
            ICapabilityRegistry420.CapabilityGrant({
                principal: address(this),
                componentId: module,
                capabilityId: action,
                scopeHash: scope,
                perCallLimit: 0,
                periodLimit: 0,
                periodSeconds: 0,
                validFrom: 0,
                validUntil: uint64(block.timestamp + 1 days),
                revoked: false
            }),
            0
        );
    }

    function _finalize() private {
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE());
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, genesis.ADMIN_SCOPE());
        bytes32 root = keccak256("HC.SEED.03.DISPOSABLE.TEST.ROOT.NOT.LIVE.GENESIS");
        genesis.setRoots(GenesisRoots(root, root, root, root, root, root));
        genesis.finalizeGenesis();
    }

    function _register(
        GenomeRegistry.GenomeRecord memory e
    ) private {
        genomes.registerGenome(e.id, e.lineId, e.metadataHash, e.loci);
    }

    function _reject(
        GenomeRegistry.GenomeRecord memory e,
        bytes4 selector
    ) private {
        uint64 count = genomes.genomeCount();
        (bool ok, bytes memory data) =
            address(genomes).call(abi.encodeCall(genomes.registerGenome, (e.id, e.lineId, e.metadataHash, e.loci)));
        require(!ok && data.length >= 4 && bytes4(data) == selector, "wrong rejection");
        require(genomes.genomeCount() == count, "failed call changed registry");
    }

    function _assertRecord(
        GenomeRegistry.GenomeRecord memory expected
    ) private view {
        GenomeRegistry.GenomeRecord memory actual = genomes.getGenome(expected.id);
        require(actual.exists && !actual.founding, "nonfounding identity");
        require(actual.id == expected.id && actual.lineId == expected.lineId, "identity mismatch");
        require(actual.metadataHash == expected.metadataHash, "metadata mismatch");
        require(keccak256(abi.encode(actual.loci)) == keccak256(abi.encode(expected.loci)), "loci mismatch");
    }

    BreedingEngine private breeding;
    CanonicalBreedingRandomnessAdapter private adapter;
    EmergencyState private emergency;
    RandomnessRouter420 private router;
    RandomnessRegistry private randomRecords;
    string private plan;
    uint256 private constant PROVIDER_TEST_KEY = 0x420;
    bytes32 private constant PROFILE = keccak256("HC.SEED.04.TEST.PROFILE");
    bytes32 private constant ROUTE = keccak256("HC.SEED.04.TEST.ROUTE");
    bytes32 private constant DOMAIN = keccak256("HC.RANDOM.BREEDING.V1");

    function _allow(
        address principal,
        bytes32 module,
        bytes32 action,
        bytes32 scope
    ) private returns (bytes32 grantId) {
        grantId = keccak256(abi.encode(principal, module, action, scope));
        capabilities.setGrant(
            grantId,
            ICapabilityRegistry420.CapabilityGrant({
                principal: principal,
                componentId: module,
                capabilityId: action,
                scopeHash: scope,
                perCallLimit: 0,
                periodLimit: 0,
                periodSeconds: 0,
                validFrom: 0,
                validUntil: 0,
                revoked: false
            }),
            0
        );
    }

    function _setupLifecycle() private {
        _finalize();
        for (uint256 i; i < 23; ++i) {
            GenomeRegistry.GenomeRecord memory e = _record(i);
            _grant(ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, e.id);
            _register(e);
        }
        RandomnessRouteRegistry420 routes = new RandomnessRouteRegistry420(address(this));
        SeedTestSignatureVerifier verifier = new SeedTestSignatureVerifier(vm.addr(PROVIDER_TEST_KEY));
        routes.setRoute(
            ROUTE,
            vm.addr(PROVIDER_TEST_KEY),
            address(verifier),
            keccak256("TEST_ONLY_SIGNATURE_NOT_VRF"),
            keccak256("test-stake"),
            keccak256("test-route"),
            true
        );
        RandomnessProfileRegistry420 profiles = new RandomnessProfileRegistry420(address(this));
        profiles.setProfile(PROFILE, ROUTE, bytes32(0), 1 days, 1 days, 2, 0, keccak256("test-profile"), true);
        randomRecords = new RandomnessRegistry(address(this));
        router = new RandomnessRouter420(address(profiles), address(routes), address(randomRecords));
        randomRecords.bindRouter(address(router));
        adapter = new CanonicalBreedingRandomnessAdapter(address(router), address(authorization), PROFILE, 1 days);
        breeding = new BreedingEngine(address(authorization), address(genomes), address(adapter));
        emergency = new EmergencyState(address(authorization));
        _allow(
            address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_BIND_EMERGENCY, breeding.EMERGENCY_BIND_SCOPE()
        );
        breeding.bindEmergencyState(address(emergency));
        _allow(
            address(this), ModuleIds.RANDOMNESS_COORDINATOR, ActionIds.RANDOMNESS_BIND_BREEDING, adapter.BIND_SCOPE()
        );
        adapter.bindBreedingEngine(address(breeding));
        plan = vm.readFile("deployments/highcountry/rare-breeding-plan.v1.json");
    }

    function _path(
        uint256 i,
        string memory field
    ) private pure returns (string memory) {
        return string.concat(".events[", vm.toString(i), "]", field);
    }

    function _bytes(
        uint256 i,
        string memory field
    ) private view returns (bytes32) {
        return vm.parseJsonBytes32(plan, _path(i, field));
    }

    function _eventId(
        uint256 i
    ) private view returns (uint64) {
        return uint64(vm.parseJsonUint(plan, _path(i, ".breedingEventId")));
    }

    function _request(
        uint256 i
    ) private returns (BreedingEngine.BreedingEvent memory e) {
        uint64 id = _eventId(i);
        _allow(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_REQUEST, bytes32(uint256(id)));
        _allow(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_FINALIZE, bytes32(uint256(id)));
        _allow(address(breeding), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, _bytes(i, ".childGenomeId"));
        breeding.requestBreeding(
            id,
            _bytes(i, ".parentAGenomeId"),
            _bytes(i, ".parentBGenomeId"),
            _bytes(i, ".childGenomeId"),
            _bytes(i, ".childLineId"),
            _bytes(i, ".metadataHash")
        );
        e = breeding.getBreedingEvent(id);
        require(
            e.contextHash == _bytes(i, ".contextHash") && e.requestId == _bytes(i, ".localRequestId"),
            "plan context mismatch"
        );
    }

    function _proof(
        bytes32 canonicalId,
        bytes32 purpose,
        bytes32 providerEntropy
    ) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(PROVIDER_TEST_KEY, keccak256(abi.encode(canonicalId, DOMAIN, purpose, providerEntropy)));
        return abi.encode(v, r, s);
    }

    function _fulfill(
        BreedingEngine.BreedingEvent memory e,
        uint256 i
    ) private returns (bytes32 canonicalId, bytes32 root, bytes32 proofHash) {
        (canonicalId,,,,) = adapter.pending(e.requestId);
        bytes32 providerEntropy = keccak256(abi.encode("TEST_ONLY_PROVIDER_ENTROPY", i));
        bytes memory proof = _proof(canonicalId, e.contextHash, providerEntropy);
        vm.prank(vm.addr(PROVIDER_TEST_KEY));
        router.fulfillRandomness(canonicalId, providerEntropy, proof);
        (root, proofHash) = router.result(canonicalId);
        require(root != bytes32(0) && proofHash == keccak256(proof), "proof record mismatch");
    }

    function _assertOffspring(
        BreedingEngine.BreedingEvent memory e
    ) private view returns (bytes32[28] memory loci) {
        GenomeRegistry.GenomeRecord memory a = genomes.getGenome(e.parentA);
        GenomeRegistry.GenomeRecord memory b = genomes.getGenome(e.parentB);
        GenomeRegistry.GenomeRecord memory c = genomes.getGenome(e.childGenomeId);
        require(
            e.finalized && c.exists && !c.founding && c.lineId == e.childLineId && c.metadataHash == e.metadataHash,
            "child binding"
        );
        for (uint256 j; j < 28; ++j) {
            uint256 draw = uint256(keccak256(abi.encode(e.entropy, e.id, j)));
            bytes32 expected = (draw & 1) == 0 ? a.loci[j] : b.loci[j];
            if (((draw >> 8) & 0xff) < 5) {
                expected = keccak256(abi.encode("HC.MUTATION.V1", expected, e.entropy, e.id, j));
            }
            require(c.loci[j] == expected, "child not canonical offspring");
        }
        return c.loci;
    }

    function _rejectFinalize(
        uint64 id
    ) private {
        (bool ok,) = address(breeding).call(abi.encodeCall(breeding.finalizeBreeding, (id)));
        require(!ok, "invalid finalize accepted");
    }

    function _lociJson(
        bytes32[28] memory loci
    ) private pure returns (string memory out) {
        out = "[";
        for (uint256 j; j < 28; ++j) {
            out = string.concat(out, j == 0 ? '"' : ',"', vm.toString(loci[j]), '"');
        }
        return string.concat(out, "]");
    }

    function testAll26CrossesRegisterThroughCanonicalProofBoundLifecycle() public {
        _setupLifecycle();
        string memory evidence =
            '{"schema":"HC.SEED.04.TEST_EVIDENCE.V1","environment":"DISPOSABLE_CONTRACT_TEST","liveRegistration":false,"provider":"TEST_ONLY_SIGNATURE_NOT_VRF","commonCount":23,"rareCount":26,"events":[';
        for (uint256 i; i < 26; ++i) {
            BreedingEngine.BreedingEvent memory e = _request(i);
            (bytes32 canonicalId, bytes32 entropy, bytes32 proofHash) = _fulfill(e, i);
            breeding.finalizeBreeding(e.id);
            e = breeding.getBreedingEvent(e.id);
            require(
                e.entropy == entropy && breeding.childGenomeOfFinalizedEvent(e.id) == e.childGenomeId, "event entropy"
            );
            require(breeding.pendingChildOwner(e.childGenomeId) == 0, "reservation retained");
            (,,, bool cancelled, bool consumed) = adapter.pending(e.requestId);
            require(!cancelled && consumed, "adapter consumption");
            require(randomRecords.record(canonicalId).fulfilled, "canonical record absent");
            bytes32[28] memory loci = _assertOffspring(e);
            evidence = string.concat(
                evidence,
                i == 0 ? "" : ",",
                '{"index":',
                vm.toString(i),
                ',"eventId":"',
                vm.toString(uint256(e.id)),
                '","childGenomeId":"',
                vm.toString(e.childGenomeId),
                '","contextHash":"',
                vm.toString(e.contextHash),
                '","localRequestId":"',
                vm.toString(e.requestId),
                '","canonicalRequestId":"',
                vm.toString(canonicalId),
                '","entropy":"',
                vm.toString(entropy),
                '","proofHash":"',
                vm.toString(proofHash),
                '","loci":',
                _lociJson(loci),
                "}"
            );
            _rejectFinalize(e.id);
        }
        require(genomes.genomeCount() == 49 && genomes.foundingGenomeCount() == 0, "49-genome registry count");
        vm.writeFile("out/hc-seed-04-test-evidence.json", string.concat(evidence, "]}"));
    }

    function testNoRareAppearsBeforeProofFulfillment() public {
        _setupLifecycle();
        BreedingEngine.BreedingEvent memory e = _request(0);
        _rejectFinalize(e.id);
        require(!genomes.exists(e.childGenomeId), "proofless genome");
    }

    function testInvalidProofAndWrongProviderDoNotFulfill() public {
        _setupLifecycle();
        BreedingEngine.BreedingEvent memory e = _request(0);
        (bytes32 canonicalId,,,,) = adapter.pending(e.requestId);
        (bool ok,) = address(router)
            .call(abi.encodeCall(router.fulfillRandomness, (canonicalId, keccak256("bad"), bytes("bad proof"))));
        require(!ok, "wrong provider accepted");
        vm.prank(vm.addr(PROVIDER_TEST_KEY));
        (ok,) = address(router)
            .call(abi.encodeCall(router.fulfillRandomness, (canonicalId, keccak256("bad"), bytes("bad proof"))));
        require(!ok && router.status(canonicalId) == IRandomnessRouter420.Status.REQUESTED, "invalid proof accepted");
        _rejectFinalize(e.id);
    }

    function testMissingChildRegistrarRollsBackConsumption() public {
        _setupLifecycle();
        BreedingEngine.BreedingEvent memory e = _request(0);
        _fulfill(e, 0);
        bytes32 grantId = keccak256(
            abi.encode(address(breeding), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, e.childGenomeId)
        );
        capabilities.setRevoked(grantId, true);
        _rejectFinalize(e.id);
        (,,,, bool consumed) = adapter.pending(e.requestId);
        require(!consumed && !genomes.exists(e.childGenomeId), "failed registration consumed request");
        capabilities.setRevoked(grantId, false);
        breeding.finalizeBreeding(e.id);
        _assertOffspring(breeding.getBreedingEvent(e.id));
    }

    function testDuplicatePendingChildAndRequestReplayReject() public {
        _setupLifecycle();
        BreedingEngine.BreedingEvent memory e = _request(0);
        (bool ok,) = address(breeding)
            .call(
                abi.encodeCall(
                    breeding.requestBreeding,
                    (e.id, e.parentA, e.parentB, e.childGenomeId, e.childLineId, e.metadataHash)
                )
            );
        require(!ok, "duplicate request accepted");
        _allow(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_REQUEST, bytes32(uint256(e.id) + 1));
        (ok,) = address(breeding)
            .call(
                abi.encodeCall(
                    breeding.requestBreeding,
                    (e.id + 1, e.parentA, e.parentB, e.childGenomeId, e.childLineId, e.metadataHash)
                )
            );
        require(!ok, "duplicate child reservation accepted");
    }

    function testEmergencyStopsFinalizationWithoutConsumingEntropy() public {
        _setupLifecycle();
        BreedingEngine.BreedingEvent memory e = _request(0);
        _fulfill(e, 0);
        _allow(address(this), ModuleIds.EMERGENCY_STATE, ActionIds.EMERGENCY_RESTRICT, EmergencyDomains.BREEDING);
        emergency.setRestricted(EmergencyDomains.BREEDING, true);
        _rejectFinalize(e.id);
        (,,,, bool consumed) = adapter.pending(e.requestId);
        require(!consumed, "emergency consumed entropy");
    }

    function testCancellationAndTimeoutCannotBeRerolledUnderSamePlan() public {
        _setupLifecycle();
        BreedingEngine.BreedingEvent memory e = _request(0);
        _allow(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_CANCEL, bytes32(uint256(e.id)));
        breeding.cancelBreeding(e.id);
        _rejectFinalize(e.id);
        (bool ok,) = address(breeding)
            .call(
                abi.encodeCall(
                    breeding.requestBreeding,
                    (e.id, e.parentA, e.parentB, e.childGenomeId, e.childLineId, e.metadataHash)
                )
            );
        require(!ok, "cancelled plan rerolled");
        e = _request(1);
        vm.warp(block.timestamp + breeding.BREEDING_TIMEOUT());
        breeding.expireBreeding(e.id);
        _rejectFinalize(e.id);
        require(!genomes.exists(e.childGenomeId), "expired child exists");
    }

    function testProviderCannotFulfillTwice() public {
        _setupLifecycle();
        BreedingEngine.BreedingEvent memory e = _request(0);
        (bytes32 id,,) = _fulfill(e, 0);
        bytes32 newEntropy = keccak256("reroll");
        bytes memory proof = _proof(id, e.contextHash, newEntropy);
        vm.prank(vm.addr(PROVIDER_TEST_KEY));
        (bool ok,) = address(router).call(abi.encodeCall(router.fulfillRandomness, (id, newEntropy, proof)));
        require(!ok, "provider reroll accepted");
    }
}
