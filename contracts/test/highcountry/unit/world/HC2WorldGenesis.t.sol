// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GrowerProfileRegistry } from "../../../../src/highcountry/player/GrowerProfileRegistry.sol";
import { GenesisRoots } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { FoundingRegions } from "../../../../src/highcountry/world/FoundingRegions.sol";
import { RegionRegistry } from "../../../../src/highcountry/world/RegionRegistry.sol";
import { WorldGenesisReadiness } from "../../../../src/highcountry/world/WorldGenesisReadiness.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract HC2WorldGenesisTest {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    GenesisRegistry private genesis;
    RegionRegistry private regions;
    WorldGenesisReadiness private readiness;
    GrowerProfileRegistry private profiles;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        genesis = new GenesisRegistry(address(authorization));
        regions = new RegionRegistry(address(authorization), address(genesis));
        readiness = new WorldGenesisReadiness(address(genesis), address(regions));
        profiles = new GrowerProfileRegistry(address(authorization), address(regions), address(genesis));

        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, bytes32(0), keccak256("genesis:set-roots"));
        _grant(ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_FINALIZE, bytes32(0), keccak256("genesis:finalize"));
        _grantRegion(1);
        _grantRegion(2);
        _grantRegion(3);
        _grant(ModuleIds.GROWER_PROFILE_REGISTRY, ActionIds.GROWER_PROFILE_CREATE, bytes32(uint256(1)), keccak256("profile:create:1"));
    }

    function testFoundingRegionsRequireAllThreeSlots() public {
        _registerRegionOne();
        require(!regions.foundingRegionsReady(), "one region marked ready");
        _registerRegionTwo();
        require(!regions.foundingRegionsReady(), "two regions marked ready");
        _registerRegionThree();
        require(regions.foundingRegionsReady(), "three regions not ready");
        require(regions.regionCount() == 3, "wrong region count");
    }

    function testWorldReadyRequiresFinalizedGenesisAndAllRegions() public {
        _registerAllRegions();
        require(!readiness.worldReady(), "world ready before genesis finalization");
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();
        require(readiness.worldReady(), "world not ready after finalization");
    }

    function testCannotRegisterRegionAfterGenesisFinalization() public {
        _registerRegionOne();
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();
        (bool ok,) = address(regions).call(
            abi.encodeWithSelector(
                regions.registerFoundingRegion.selector,
                uint16(2),
                FoundingRegions.REGION_TWO_METADATA,
                FoundingRegions.REGION_TWO_CLIMATE,
                FoundingRegions.REGION_TWO_RULESET
            )
        );
        require(!ok, "region registered after genesis finalization");
    }

    function testProfileCreationRequiresFinalizedGenesis() public {
        _registerAllRegions();
        (bool ok,) = address(profiles).call(abi.encodeWithSelector(profiles.createProfile.selector, uint16(1)));
        require(!ok, "profile created before genesis finalization");

        genesis.setRoots(_roots());
        genesis.finalizeGenesis();
        uint64 profileId = profiles.createProfile(1);
        require(profileId == 1, "unexpected profile id");
        require(profiles.profileIdOf(address(this)) == 1, "profile binding missing");
        GrowerProfileRegistry.GrowerProfile memory profile = profiles.getProfile(1);
        require(profile.account == address(this), "profile account mismatch");
        require(profile.homeRegionId == 1, "home region mismatch");
    }

    function testOneProfilePerAccount() public {
        _registerAllRegions();
        genesis.setRoots(_roots());
        genesis.finalizeGenesis();
        profiles.createProfile(1);
        (bool ok,) = address(profiles).call(abi.encodeWithSelector(profiles.createProfile.selector, uint16(1)));
        require(!ok, "duplicate profile created");
    }

    function testRejectsInvalidFoundingRegionIds() public {
        (bool zeroOk,) = address(regions).call(
            abi.encodeWithSelector(regions.registerFoundingRegion.selector, uint16(0), bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)))
        );
        require(!zeroOk, "region zero accepted");
        (bool fourOk,) = address(regions).call(
            abi.encodeWithSelector(regions.registerFoundingRegion.selector, uint16(4), bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)))
        );
        require(!fourOk, "region four accepted");
    }

    function _registerAllRegions() private {
        _registerRegionOne();
        _registerRegionTwo();
        _registerRegionThree();
    }

    function _registerRegionOne() private {
        regions.registerFoundingRegion(1, FoundingRegions.REGION_ONE_METADATA, FoundingRegions.REGION_ONE_CLIMATE, FoundingRegions.REGION_ONE_RULESET);
    }

    function _registerRegionTwo() private {
        regions.registerFoundingRegion(2, FoundingRegions.REGION_TWO_METADATA, FoundingRegions.REGION_TWO_CLIMATE, FoundingRegions.REGION_TWO_RULESET);
    }

    function _registerRegionThree() private {
        regions.registerFoundingRegion(3, FoundingRegions.REGION_THREE_METADATA, FoundingRegions.REGION_THREE_CLIMATE, FoundingRegions.REGION_THREE_RULESET);
    }

    function _grantRegion(uint16 regionId) private {
        _grant(
            ModuleIds.REGION_REGISTRY,
            ActionIds.REGION_REGISTER,
            bytes32(uint256(regionId)),
            keccak256(abi.encode("region:register", regionId))
        );
    }

    function _grant(bytes32 moduleId, bytes32 actionId, bytes32 scopeHash, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
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
