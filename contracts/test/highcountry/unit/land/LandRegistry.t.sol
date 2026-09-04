// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { IGenesisRegistry } from "../../../../src/highcountry/interfaces/IGenesisRegistry.sol";
import { LandRegistry } from "../../../../src/highcountry/land/LandRegistry.sol";
import { GenesisRoots } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract MockRegionRegistryHC3Unit {
    function exists(uint16 regionId) external pure returns (bool) {
        return regionId >= 1 && regionId <= 3;
    }
}

contract MockGenesisRegistryHC3Unit is IGenesisRegistry {
    GenesisRoots private _roots;
    bool public finalized;
    bool public genesisAuthorityEnabled = true;

    function roots() external view returns (GenesisRoots memory) { return _roots; }
    function setRoots(GenesisRoots calldata newRoots) external { _roots = newRoots; }
    function finalizeGenesis() external { finalized = true; genesisAuthorityEnabled = false; }
}

contract LandRegistryHC3Test {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    MockRegionRegistryHC3Unit private regions;
    MockGenesisRegistryHC3Unit private genesis;
    LandRegistry private land;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        regions = new MockRegionRegistryHC3Unit();
        genesis = new MockGenesisRegistryHC3Unit();
        land = new LandRegistry(address(authorization), address(regions), address(genesis));
    }

    function testGenesisParcelMustMatchLandRoot() public {
        uint64 parcelId = 1;
        uint32 capacity = 12;
        bytes32 parcelType = keccak256("FOUNDING_FARM");
        bytes32 metadataHash = keccak256("parcel:1");
        bytes32 leaf = land.genesisLeaf(parcelId, 1, address(this), capacity, parcelType, metadataHash);
        genesis.setRoots(_rootsWithLand(leaf));
        _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_GENESIS_REGISTER, parcelId, capacity, keccak256("genesis-land"));

        bytes32[] memory proof = new bytes32[](0);
        land.registerGenesisParcel(parcelId, 1, address(this), capacity, parcelType, metadataHash, proof);

        LandRegistry.LandParcel memory parcel = land.getParcel(parcelId);
        require(parcel.genesisParcel, "not genesis parcel");
        require(parcel.regionId == 1, "wrong region");
        require(parcel.growCapacity == capacity, "wrong capacity");
    }

    function testInvalidGenesisProofCannotInjectParcel() public {
        genesis.setRoots(_rootsWithLand(keccak256("different-leaf")));
        _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_GENESIS_REGISTER, 2, 9, keccak256("bad-proof"));
        bytes32[] memory proof = new bytes32[](0);

        (bool ok,) = address(land).call(
            abi.encodeWithSelector(
                land.registerGenesisParcel.selector,
                uint64(2), uint16(1), address(this), uint32(9), keccak256("TYPE"), keccak256("META"), proof
            )
        );
        require(!ok, "invalid manifest proof accepted");
        require(!land.exists(2), "invalid parcel persisted");
    }

    function testNormalParcelRegistrationRequiresFinalizedGenesis() public {
        _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_REGISTER, 3, 10, keccak256("normal-land"));
        (bool beforeOk,) = address(land).call(
            abi.encodeWithSelector(land.registerParcel.selector, uint64(3), uint16(2), address(this), uint32(10), keccak256("TYPE"), keccak256("META"))
        );
        require(!beforeOk, "normal parcel registered before finalization");

        genesis.finalizeGenesis();
        land.registerParcel(3, 2, address(this), 10, keccak256("TYPE"), keccak256("META"));
        require(land.exists(3), "normal parcel missing");
    }

    function testOwnershipAndOccupancyAreIndependent() public {
        genesis.finalizeGenesis();
        _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_REGISTER, 4, 20, keccak256("register-4"));
        _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_TRANSFER, 4, 0, keccak256("transfer-4"));
        _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_SET_OCCUPANCY, 4, 0, keccak256("occupy-4"));
        _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_CLEAR_OCCUPANCY, 4, 0, keccak256("clear-4"));

        land.registerParcel(4, 3, address(this), 20, keccak256("TYPE"), keccak256("META"));
        address newOwner = address(0xBEEF);
        address lessee = address(0xCAFE);
        bytes32 leaseRef = keccak256("lease:4");

        land.transferOwner(4, newOwner);
        land.setOccupancy(4, lessee, LandRegistry.OccupancyKind.LEASE, leaseRef);

        LandRegistry.LandParcel memory occupied = land.getParcel(4);
        require(occupied.owner == newOwner, "owner not transferred");
        require(occupied.occupant == lessee, "occupant not set");
        require(occupied.occupancyRef == leaseRef, "lease ref missing");
        require(land.effectiveOperator(4) == lessee, "occupant not operator");

        (bool conflictOk,) = address(land).call(
            abi.encodeWithSelector(land.setOccupancy.selector, uint64(4), address(0xD00D), LandRegistry.OccupancyKind.LICENSE, keccak256("license"))
        );
        require(!conflictOk, "conflicting occupancy accepted");

        land.clearOccupancy(4);
        require(land.effectiveOperator(4) == newOwner, "owner not restored as operator");
    }

    function testGenesisRegistrationClosesAfterFinalization() public {
        uint64 parcelId = 5;
        uint32 capacity = 7;
        bytes32 parcelType = keccak256("TYPE");
        bytes32 metadataHash = keccak256("META");
        bytes32 leaf = land.genesisLeaf(parcelId, 1, address(this), capacity, parcelType, metadataHash);
        genesis.setRoots(_rootsWithLand(leaf));
        genesis.finalizeGenesis();
        _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_GENESIS_REGISTER, parcelId, capacity, keccak256("late-genesis"));
        bytes32[] memory proof = new bytes32[](0);

        (bool ok,) = address(land).call(
            abi.encodeWithSelector(land.registerGenesisParcel.selector, parcelId, uint16(1), address(this), capacity, parcelType, metadataHash, proof)
        );
        require(!ok, "genesis land injected after finalization");
    }

    function _grant(bytes32 moduleId, bytes32 actionId, uint64 id, uint256 amount, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: moduleId,
            capabilityId: actionId,
            scopeHash: bytes32(uint256(id)),
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        capabilityRegistry.setGrant(grantId, grant, amount);
    }

    function _rootsWithLand(bytes32 landRoot) private pure returns (GenesisRoots memory) {
        return GenesisRoots({
            manifestRoot: keccak256("manifest"),
            parameterRoot: keccak256("parameters"),
            rulesetRoot: keccak256("rulesets"),
            landRoot: landRoot,
            randomnessRoot: keccak256("randomness"),
            qualificationRoot: keccak256("qualification")
        });
    }
}
