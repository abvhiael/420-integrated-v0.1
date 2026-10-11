// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { EmergencyState } from "../../../../src/highcountry/security/EmergencyState.sol";

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { EmergencyDomains } from "../../../../src/highcountry/constants/EmergencyDomains.sol";
import { EmergencyState } from "../../../../src/highcountry/security/EmergencyState.sol";
import { GenesisRegistry } from "../../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenomeRegistry } from "../../../../src/highcountry/genetics/GenomeRegistry.sol";
import { RandomnessCoordinator } from "../../../../src/highcountry/random/RandomnessCoordinator.sol";
import { BreedingEngine } from "../../../../src/highcountry/breeding/BreedingEngine.sol";
import { GenesisRoots } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

interface VmBreedingR029 {
    function warp(
        uint256 timestamp
    ) external;
}

contract BreedingEngineTest {
    VmBreedingR029 private constant vm = VmBreedingR029(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    GenesisRegistry private genesis;
    GenomeRegistry private genomes;
    RandomnessCoordinator private randomness;
    BreedingEngine private breeding;

    bytes32 private parentA = keccak256("hc5:parent:a");
    bytes32 private parentB = keccak256("hc5:parent:b");

    constructor() {
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        genesis = new GenesisRegistry(address(auth));
        genomes = new GenomeRegistry(address(auth), address(genesis));
        randomness = new RandomnessCoordinator(address(auth));
        breeding = new BreedingEngine(address(auth), address(genomes), address(randomness));
        EmergencyState emergency = new EmergencyState(address(auth));
        _grant(
            address(this),
            ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_BIND_EMERGENCY,
            randomness.EMERGENCY_BIND_SCOPE(),
            keccak256("em:rand")
        );
        randomness.bindEmergencyState(address(emergency));
        _grant(
            address(this),
            ModuleIds.BREEDING_ENGINE,
            ActionIds.BREEDING_BIND_EMERGENCY,
            breeding.EMERGENCY_BIND_SCOPE(),
            keccak256("em:breed")
        );
        breeding.bindEmergencyState(address(emergency));
        _grant(
            address(this),
            ModuleIds.GENESIS_REGISTRY,
            ActionIds.GENESIS_SET_ROOTS,
            genesis.ADMIN_SCOPE(),
            keccak256("hc5:roots")
        );
        _grant(
            address(this),
            ModuleIds.GENESIS_REGISTRY,
            ActionIds.GENESIS_FINALIZE,
            genesis.ADMIN_SCOPE(),
            keccak256("hc5:finalize")
        );
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();

        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, parentA, keccak256("hc5:pa"));
        _grant(address(this), ModuleIds.GENOME_REGISTRY, ActionIds.GENOME_REGISTER, parentB, keccak256("hc5:pb"));
        genomes.registerGenome(parentA, keccak256("line:a"), keccak256("meta:a"), _loci("A"));
        genomes.registerGenome(parentB, keccak256("line:b"), keccak256("meta:b"), _loci("B"));
    }

    function testBreedingRequiresDistinctExistingParents() public {
        _grant(
            address(this),
            ModuleIds.BREEDING_ENGINE,
            ActionIds.BREEDING_REQUEST,
            bytes32(uint256(1)),
            keccak256("hc5:req:1")
        );
        (bool ok,) = address(breeding)
            .call(
                abi.encodeWithSelector(
                    breeding.requestBreeding.selector,
                    uint64(1),
                    parentA,
                    parentA,
                    keccak256("child"),
                    keccak256("line:c"),
                    keccak256("meta:c")
                )
            );
        require(!ok, "same-parent breeding allowed");
    }

    function testRandomnessReplayDeniedAndBreedingFinalizesOnce() public {
        uint64 eventId = 2;
        bytes32 childId = keccak256("hc5:child:2");
        bytes32 scope = bytes32(uint256(eventId));
        _grant(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_REQUEST, scope, keccak256("hc5:req:2"));
        _grant(address(this), ModuleIds.BREEDING_ENGINE, ActionIds.BREEDING_FINALIZE, scope, keccak256("hc5:fin:2"));

        bytes32 lineId = keccak256("line:c");
        bytes32 metadataHash = keccak256("meta:c");
        bytes32 contextHash = keccak256(abi.encode(eventId, parentA, parentB, childId, lineId, metadataHash));
        bytes32 requestId = keccak256(abi.encode(keccak256("HC.RANDOM.BREEDING.V1"), contextHash));
        _grant(
            address(breeding),
            ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_REQUEST,
            requestId,
            keccak256("hc5:rand:req")
        );
        _grant(
            address(this),
            ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_FULFILL,
            requestId,
            keccak256("hc5:rand:fulfill")
        );
        _grant(
            address(breeding),
            ModuleIds.GENOME_REGISTRY,
            ActionIds.GENOME_REGISTER,
            childId,
            keccak256("hc5:child:grant")
        );

        breeding.requestBreeding(eventId, parentA, parentB, childId, lineId, metadataHash);
        bytes32 entropy = keccak256("entropy:2");
        randomness.fulfill(requestId, entropy);
        RandomnessCoordinator.RandomRequest memory beforeConsume = randomness.getRequest(requestId);
        require(
            beforeConsume.provider == address(this) && beforeConsume.fulfilled && !beforeConsume.consumed,
            "provider provenance"
        );

        breeding.finalizeBreeding(eventId);
        require(genomes.exists(childId), "child genome missing");
        require(breeding.pendingChildOwner(childId) == 0, "finalization stranded reservation");
        RandomnessCoordinator.RandomRequest memory afterConsume = randomness.getRequest(requestId);
        require(afterConsume.consumed && afterConsume.entropy == entropy, "request not consumed exactly once");

        (bool replayFulfill,) = address(randomness)
            .call(abi.encodeWithSelector(randomness.fulfill.selector, requestId, keccak256("entropy:again")));
        require(!replayFulfill, "randomness replay allowed");
        (bool replayFinalize,) =
            address(breeding).call(abi.encodeWithSelector(breeding.finalizeBreeding.selector, eventId));
        require(!replayFinalize, "breeding finalized twice");
    }

    function testOnlyOriginalRequesterCanConsumeBoundRequest() public {
        bytes32 requestId = keccak256("standalone:request");
        bytes32 domain = keccak256("standalone:domain");
        bytes32 contextHash = keccak256("standalone:context");
        _grant(
            address(this),
            ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_REQUEST,
            requestId,
            keccak256("standalone:req")
        );
        _grant(
            address(this),
            ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_FULFILL,
            requestId,
            keccak256("standalone:fulfill")
        );
        randomness.request(requestId, domain, contextHash);
        randomness.fulfill(requestId, keccak256("standalone:entropy"));
        bytes32 entropy = randomness.consume(requestId, domain, contextHash);
        require(entropy == keccak256("standalone:entropy"), "consume entropy mismatch");
        (bool replay,) = address(randomness)
            .call(abi.encodeWithSelector(randomness.consume.selector, requestId, domain, contextHash));
        require(!replay, "randomness consumed twice");
    }

    function testEmergencyBreedingAndRandomnessRequireIndependentRelease() public {
        EmergencyState state = EmergencyState(address(breeding.emergencyState()));
        _grant(
            address(this),
            ModuleIds.EMERGENCY_STATE,
            ActionIds.EMERGENCY_RESTRICT,
            EmergencyDomains.BREEDING,
            keccak256("restrict:breed")
        );
        state.setRestricted(EmergencyDomains.BREEDING, true);
        (bool ok,) = address(breeding)
            .call(
                abi.encodeWithSelector(
                    breeding.requestBreeding.selector,
                    uint64(4),
                    parentA,
                    parentB,
                    keccak256("child"),
                    keccak256("line"),
                    keccak256("metadata")
                )
            );
        require(!ok, "breeding request bypassed emergency");
        (ok,) =
            address(state).call(abi.encodeWithSelector(state.setRestricted.selector, EmergencyDomains.BREEDING, false));
        require(!ok, "release permitted without capability");
        _grant(
            address(this),
            ModuleIds.EMERGENCY_STATE,
            ActionIds.EMERGENCY_RELEASE,
            EmergencyDomains.BREEDING,
            keccak256("release:breed")
        );
        state.setRestricted(EmergencyDomains.BREEDING, false);
        _grant(
            address(this),
            ModuleIds.EMERGENCY_STATE,
            ActionIds.EMERGENCY_RESTRICT,
            EmergencyDomains.RANDOMNESS_REQUEST,
            keccak256("restrict:random")
        );
        state.setRestricted(EmergencyDomains.RANDOMNESS_REQUEST, true);
        bytes32 req = keccak256("restricted:request");
        _grant(
            address(this),
            ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_REQUEST,
            req,
            keccak256("restricted:request:grant")
        );
        (ok,) = address(randomness)
            .call(abi.encodeWithSelector(randomness.request.selector, req, keccak256("domain"), keccak256("context")));
        require(!ok, "randomness request bypassed emergency");
    }

    function testPendingChildReservationAndAuthorizedCancelRecovery() public {
        uint64 eventId = 21;
        bytes32 child = keccak256("hc:r029:child");
        bytes32 line = keccak256("hc:r029:line");
        bytes32 metadata = keccak256("hc:r029:metadata");
        bytes32 context = keccak256(abi.encode(eventId, parentA, parentB, child, line, metadata));
        bytes32 requestId = keccak256(abi.encode(keccak256("HC.RANDOM.BREEDING.V1"), context));
        _grant(
            address(this),
            ModuleIds.BREEDING_ENGINE,
            ActionIds.BREEDING_REQUEST,
            bytes32(uint256(eventId)),
            keccak256("r029:req21")
        );
        _grant(
            address(breeding),
            ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_REQUEST,
            requestId,
            keccak256("r029:rand21")
        );
        breeding.requestBreeding(eventId, parentA, parentB, child, line, metadata);
        require(breeding.pendingChildOwner(child) == eventId, "child not reserved");
        _grant(
            address(this),
            ModuleIds.BREEDING_ENGINE,
            ActionIds.BREEDING_REQUEST,
            bytes32(uint256(22)),
            keccak256("r029:req22")
        );
        (bool ok,) = address(breeding)
            .call(abi.encodeCall(breeding.requestBreeding, (uint64(22), parentA, parentB, child, line, metadata)));
        require(!ok, "duplicate pending child accepted");
        (ok,) = address(breeding).call(abi.encodeCall(breeding.cancelBreeding, (eventId)));
        require(!ok, "unauthorized cancellation");
        _grant(
            address(this),
            ModuleIds.BREEDING_ENGINE,
            ActionIds.BREEDING_CANCEL,
            bytes32(uint256(eventId)),
            keccak256("r029:cancel21")
        );
        breeding.cancelBreeding(eventId);
        require(
            breeding.cancelled(eventId) && breeding.pendingChildOwner(child) == 0, "cancel did not recover reservation"
        );
        require(randomness.cancelled(requestId), "randomness not cancelled");
        (ok,) = address(breeding).call(abi.encodeCall(breeding.cancelBreeding, (eventId)));
        require(!ok, "cancellation replay");
        (ok,) = address(breeding).call(abi.encodeCall(breeding.finalizeBreeding, (eventId)));
        require(!ok, "cancelled child finalized");
        (ok,) = address(randomness).call(abi.encodeCall(randomness.fulfill, (requestId, keccak256("late entropy"))));
        require(!ok, "late entropy fulfilled");
    }

    function testTimeoutCannotBeUsedEarly() public {
        uint64 eventId = 23;
        bytes32 child = keccak256("hc:r029:timeout");
        bytes32 line = keccak256("hc:r029:timeoutline");
        bytes32 metadata = keccak256("hc:r029:timeoutmetadata");
        bytes32 context = keccak256(abi.encode(eventId, parentA, parentB, child, line, metadata));
        bytes32 requestId = keccak256(abi.encode(keccak256("HC.RANDOM.BREEDING.V1"), context));
        _grant(
            address(this),
            ModuleIds.BREEDING_ENGINE,
            ActionIds.BREEDING_REQUEST,
            bytes32(uint256(eventId)),
            keccak256("r029:req23")
        );
        _grant(
            address(breeding),
            ModuleIds.RANDOMNESS_COORDINATOR,
            ActionIds.RANDOMNESS_REQUEST,
            requestId,
            keccak256("r029:rand23")
        );
        breeding.requestBreeding(eventId, parentA, parentB, child, line, metadata);
        (bool ok,) = address(breeding).call(abi.encodeCall(breeding.expireBreeding, (eventId)));
        require(!ok && breeding.pendingChildOwner(child) == eventId, "early expiry released reservation");
        vm.warp(block.timestamp + breeding.BREEDING_TIMEOUT());
        breeding.expireBreeding(eventId);
        require(breeding.cancelled(eventId) && breeding.pendingChildOwner(child) == 0, "timeout did not recover");
        require(randomness.cancelled(requestId), "timeout did not cancel randomness");
        (ok,) = address(breeding).call(abi.encodeCall(breeding.expireBreeding, (eventId)));
        require(!ok, "timeout replay");
    }

    function _grant(
        address principal,
        bytes32 moduleId,
        bytes32 actionId,
        bytes32 scopeHash,
        bytes32 grantId
    ) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: principal,
            componentId: moduleId,
            capabilityId: actionId,
            scopeHash: scopeHash,
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        caps.setGrant(grantId, grant, 0);
    }

    function _loci(
        string memory prefix
    ) private pure returns (bytes32[28] memory loci) {
        for (uint256 i = 0; i < 28; ++i) {
            loci[i] = keccak256(abi.encode(prefix, i));
        }
    }

    function _roots() private pure returns (GenesisRoots memory) {
        return GenesisRoots({
            manifestRoot: keccak256("m"),
            parameterRoot: keccak256("p"),
            rulesetRoot: keccak256("r"),
            landRoot: keccak256("l"),
            randomnessRoot: keccak256("x"),
            qualificationRoot: keccak256("q")
        });
    }
}
