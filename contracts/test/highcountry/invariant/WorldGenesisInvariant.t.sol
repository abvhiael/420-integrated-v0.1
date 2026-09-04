// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";
import { FoundingRegions } from "../../../src/highcountry/world/FoundingRegions.sol";
import { RegionRegistry } from "../../../src/highcountry/world/RegionRegistry.sol";
import { WorldGenesisReadiness } from "../../../src/highcountry/world/WorldGenesisReadiness.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract WorldGenesisInvariantHandler {
    RegionRegistry public immutable regions;

    constructor(RegionRegistry regions_) {
        regions = regions_;
    }

    function stepAttemptRegionMutation(uint16 rawId, uint256 salt) external {
        uint16 regionId = uint16((uint256(rawId) % 3) + 1);
        address(regions).call(
            abi.encodeWithSelector(
                regions.registerFoundingRegion.selector,
                regionId,
                keccak256(abi.encode("mutated:metadata", salt)),
                keccak256(abi.encode("mutated:climate", salt)),
                keccak256(abi.encode("mutated:ruleset", salt))
            )
        );
    }
}

contract WorldGenesisInvariantTest is InvariantTarget420 {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    GenesisRegistry private genesis;
    RegionRegistry private regions;
    WorldGenesisReadiness private readiness;
    WorldGenesisInvariantHandler private handler;

    function setUp() public {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        genesis = new GenesisRegistry(address(authorization));
        regions = new RegionRegistry(address(authorization), address(genesis));
        readiness = new WorldGenesisReadiness(address(genesis), address(regions));

        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("inv:roots"));
        _grant(address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("inv:finalize"));
        _grantRegion(address(this), 1);
        _grantRegion(address(this), 2);
        _grantRegion(address(this), 3);

        regions.registerFoundingRegion(1, FoundingRegions.REGION_ONE_METADATA, FoundingRegions.REGION_ONE_CLIMATE, FoundingRegions.REGION_ONE_RULESET);
        regions.registerFoundingRegion(2, FoundingRegions.REGION_TWO_METADATA, FoundingRegions.REGION_TWO_CLIMATE, FoundingRegions.REGION_TWO_RULESET);
        regions.registerFoundingRegion(3, FoundingRegions.REGION_THREE_METADATA, FoundingRegions.REGION_THREE_CLIMATE, FoundingRegions.REGION_THREE_RULESET);
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();

        handler = new WorldGenesisInvariantHandler(regions);
        _grantRegion(address(handler), 1);
        _grantRegion(address(handler), 2);
        _grantRegion(address(handler), 3);
        targetContract(address(handler));
    }

    function invariant_HC_INV_WORLD_004_FoundingRegionsImmutableAfterGenesis() public view {
        require(regions.regionCount() == 3, "HC-INV-WORLD-004: region count changed");
        RegionRegistry.RegionRecord memory one = regions.getRegion(1);
        RegionRegistry.RegionRecord memory two = regions.getRegion(2);
        RegionRegistry.RegionRecord memory three = regions.getRegion(3);
        require(one.metadataHash == FoundingRegions.REGION_ONE_METADATA, "HC-INV-WORLD-004: region one mutated");
        require(two.metadataHash == FoundingRegions.REGION_TWO_METADATA, "HC-INV-WORLD-004: region two mutated");
        require(three.metadataHash == FoundingRegions.REGION_THREE_METADATA, "HC-INV-WORLD-004: region three mutated");
    }

    function invariant_HC_INV_WORLD_005_ReadinessCannotRegressAfterFinalizedWorld() public view {
        require(genesis.finalized(), "HC-INV-WORLD-005: genesis lost finality");
        require(regions.foundingRegionsReady(), "HC-INV-WORLD-005: founding regions lost readiness");
        require(readiness.worldReady(), "HC-INV-WORLD-005: world readiness regressed");
    }

    function _grantRegion(address principal, uint16 regionId) private {
        _grant(
            principal,
            ModuleIds.REGION_REGISTRY,
            ActionIds.REGION_REGISTER,
            bytes32(uint256(regionId)),
            keccak256(abi.encode("inv:region", principal, regionId))
        );
    }

    function _grant(address principal, bytes32 moduleId, bytes32 actionId, bytes32 scopeHash, bytes32 grantId) private {
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
        capabilityRegistry.setGrant(grantId, grant, 0);
    }

    function _roots() private pure returns (GenesisRoots memory) {
        return GenesisRoots({
            manifestRoot: keccak256("hc2:manifest"),
            parameterRoot: keccak256("hc2:parameters"),
            rulesetRoot: keccak256("hc2:rulesets"),
            landRoot: keccak256("hc2:land"),
            randomnessRoot: keccak256("hc2:randomness"),
            qualificationRoot: keccak256("hc2:qualification")
        });
    }
}
