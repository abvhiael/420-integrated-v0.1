// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { IGenesisRegistry } from "../../../src/highcountry/interfaces/IGenesisRegistry.sol";
import { LandRegistry } from "../../../src/highcountry/land/LandRegistry.sol";
import { PublicCultivationAccess } from "../../../src/highcountry/land/PublicCultivationAccess.sol";
import { GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract MockRegionRegistryHC3Invariant {
    function exists(uint16 regionId) external pure returns (bool) { return regionId >= 1 && regionId <= 3; }
}

contract MockGenesisRegistryHC3Invariant is IGenesisRegistry {
    GenesisRoots private _roots;
    bool public finalized = true;
    bool public genesisAuthorityEnabled;
    function roots() external view returns (GenesisRoots memory) { return _roots; }
    function setRoots(GenesisRoots calldata newRoots) external { _roots = newRoots; }
    function finalizeGenesis() external { finalized = true; genesisAuthorityEnabled = false; }
}

contract LandAccessInvariantHandler {
    LandRegistry public immutable land;
    PublicCultivationAccess public immutable publicAccess;

    constructor(LandRegistry land_, PublicCultivationAccess publicAccess_) {
        land = land_;
        publicAccess = publicAccess_;
    }

    function stepSetOccupancy(uint256 salt) external {
        address(land).call(
            abi.encodeWithSelector(
                land.setOccupancy.selector,
                uint64(1),
                address(uint160(uint256(keccak256(abi.encode("occupant", salt))) | 1)),
                LandRegistry.OccupancyKind.LEASE,
                keccak256(abi.encode("lease", salt))
            )
        );
    }

    function stepClearOccupancy() external {
        address(land).call(abi.encodeWithSelector(land.clearOccupancy.selector, uint64(1)));
    }

    function stepAllocateOne() external {
        address(publicAccess).call(abi.encodeWithSelector(publicAccess.allocate.selector, uint64(1), uint32(1)));
    }

    function stepRelease() external {
        address(publicAccess).call(abi.encodeWithSelector(publicAccess.release.selector, uint64(1)));
    }

    function stepAttemptDuplicateLand(uint256 salt) external {
        address(land).call(
            abi.encodeWithSelector(
                land.registerParcel.selector,
                uint64(1), uint16(2), address(this), uint32(99), keccak256("MUTATED"), keccak256(abi.encode("mutated", salt))
            )
        );
    }
}

contract LandAccessInvariantTest is InvariantTarget420 {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    LandRegistry private land;
    PublicCultivationAccess private publicAccess;
    LandAccessInvariantHandler private handler;

    bytes32 private constant ORIGINAL_TYPE = keccak256("HC3.INVARIANT.LAND.TYPE");
    bytes32 private constant ORIGINAL_METADATA = keccak256("HC3.INVARIANT.LAND.META");

    function setUp() public {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        MockRegionRegistryHC3Invariant regions = new MockRegionRegistryHC3Invariant();
        MockGenesisRegistryHC3Invariant genesis = new MockGenesisRegistryHC3Invariant();
        land = new LandRegistry(address(authorization), address(regions), address(genesis));
        publicAccess = new PublicCultivationAccess(address(authorization), address(land));

        _grant(address(this), ModuleIds.LAND_REGISTRY, ActionIds.LAND_REGISTER, 1, 10, keccak256("inv:land-register"));
        land.registerParcel(1, 1, address(this), 10, ORIGINAL_TYPE, ORIGINAL_METADATA);

        _grant(address(this), ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_REGISTER, 1, 10, keccak256("inv:plot-register"));
        publicAccess.registerPublicPlot(1, 1, 10);

        handler = new LandAccessInvariantHandler(land, publicAccess);
        _grant(address(handler), ModuleIds.LAND_REGISTRY, ActionIds.LAND_SET_OCCUPANCY, 1, 0, keccak256("inv:set-occupancy"));
        _grant(address(handler), ModuleIds.LAND_REGISTRY, ActionIds.LAND_CLEAR_OCCUPANCY, 1, 0, keccak256("inv:clear-occupancy"));
        _grant(address(handler), ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_ALLOCATE, 1, 1, keccak256("inv:allocate"));
        _grant(address(handler), ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_RELEASE, 1, 1, keccak256("inv:release"));
        targetContract(address(handler));
    }

    function invariant_HC_INV_LAND_006_ParcelIdentityAndCapacityRemainStable() public view {
        LandRegistry.LandParcel memory parcel = land.getParcel(1);
        require(parcel.regionId == 1, "HC-INV-LAND-006: region mutated");
        require(parcel.growCapacity == 10, "HC-INV-LAND-006: capacity mutated");
        require(parcel.parcelType == ORIGINAL_TYPE, "HC-INV-LAND-006: type mutated");
        require(parcel.metadataHash == ORIGINAL_METADATA, "HC-INV-LAND-006: metadata mutated");
        require(land.parcelCount() == 1, "HC-INV-LAND-006: duplicate parcel created");
    }

    function invariant_HC_INV_LAND_007_PublicCapacityNeverOverbooksLandOrPlot() public view {
        PublicCultivationAccess.PublicPlot memory plot = publicAccess.getPlot(1);
        require(publicAccess.publicCapacityOnParcel(1) <= land.growCapacityOf(1), "HC-INV-LAND-007: land overbooked");
        require(plot.allocatedCapacity <= plot.growCapacity, "HC-INV-LAND-007: plot overbooked");
        require(publicAccess.availableCapacity(1) + plot.allocatedCapacity == plot.growCapacity, "HC-INV-LAND-007: capacity not conserved");
    }

    function invariant_HC_INV_LAND_008_OccupancyStateIsCanonical() public view {
        LandRegistry.LandParcel memory parcel = land.getParcel(1);
        if (parcel.occupant == address(0)) {
            require(parcel.occupancyKind == LandRegistry.OccupancyKind.NONE, "HC-INV-LAND-008: empty occupant has kind");
            require(parcel.occupancyRef == bytes32(0), "HC-INV-LAND-008: empty occupant has ref");
        } else {
            require(parcel.occupancyKind != LandRegistry.OccupancyKind.NONE, "HC-INV-LAND-008: occupant lacks kind");
            require(parcel.occupancyRef != bytes32(0), "HC-INV-LAND-008: occupant lacks ref");
        }
    }

    function _grant(
        address principal,
        bytes32 moduleId,
        bytes32 actionId,
        uint64 id,
        uint256 amount,
        bytes32 grantId
    ) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: principal,
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
}
