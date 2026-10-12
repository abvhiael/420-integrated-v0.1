// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { LandRegistry } from "../land/LandRegistry.sol";

interface ICanonicalPlantOccupancyR049 {
    function activePlantsByParcel(
        uint64 parcelId
    ) external view returns (uint32);
    function landRegistry() external view returns (address);
}

/// @notice Read-only R04.9 gateway to existing authoritative R02 land and cultivation records.
/// @dev Never treats a separately registered RightsRegistry shadow asset as land title.
contract CanonicalLandPlantGate {
    error InvalidCanonicalBinding();
    LandRegistry public immutable land;
    ICanonicalPlantOccupancyR049 public immutable plants;

    constructor(
        address land_,
        address plants_
    ) {
        if (land_.code.length == 0 || plants_.code.length == 0) revert InvalidCanonicalBinding();
        land = LandRegistry(land_);
        plants = ICanonicalPlantOccupancyR049(plants_);
        if (plants.landRegistry() != land_) revert InvalidCanonicalBinding();
    }

    /// @dev Unique parcel key, not an arbitrary client-supplied shadow asset ID.
    function parcelAsset(
        uint64 parcelId
    ) public pure returns (bytes32) {
        if (parcelId == 0) revert InvalidCanonicalBinding();
        return keccak256(abi.encode("HC.R04.9.CANONICAL.PARCEL", parcelId));
    }

    function snapshot(
        uint64 parcelId
    )
        external
        view
        returns (
            bytes32 asset,
            address owner,
            address occupant,
            bytes32 occupancyRef,
            uint8 kind,
            uint32 active,
            uint32 capacity
        )
    {
        LandRegistry.LandParcel memory p = land.getParcel(parcelId);
        asset = parcelAsset(parcelId);
        owner = p.owner;
        occupant = p.occupant;
        occupancyRef = p.occupancyRef;
        kind = uint8(p.occupancyKind);
        active = plants.activePlantsByParcel(parcelId);
        capacity = p.growCapacity;
        if (owner == address(0) || active > capacity) revert InvalidCanonicalBinding();
    }

    function leaseAdmissible(
        uint64 parcelId,
        bytes32 leaseId,
        address lessor,
        address tenant
    ) external view returns (bool) {
        LandRegistry.LandParcel memory p = land.getParcel(parcelId);
        return parcelId != 0 && leaseId != bytes32(0) && p.owner == lessor && p.occupant == tenant
            && p.occupancyKind == LandRegistry.OccupancyKind.LEASE && p.occupancyRef == leaseId
            && plants.activePlantsByParcel(parcelId) <= p.growCapacity;
    }

    function licenseAdmissible(uint64 parcelId, bytes32 licenseId, address licensor, address licensee)
        external view returns (bool)
    {
        LandRegistry.LandParcel memory p = land.getParcel(parcelId);
        return parcelId != 0 && licenseId != bytes32(0) && p.owner == licensor && p.occupant == licensee
            && p.occupancyKind == LandRegistry.OccupancyKind.LICENSE && p.occupancyRef == licenseId
            && plants.activePlantsByParcel(parcelId) <= p.growCapacity;
    }

    function canClearOccupancy(
        uint64 parcelId,
        bytes32 leaseId
    ) external view returns (bool) {
        LandRegistry.LandParcel memory p = land.getParcel(parcelId);
        return p.occupancyRef == leaseId && p.occupancyKind == LandRegistry.OccupancyKind.LEASE
            && plants.activePlantsByParcel(parcelId) == 0;
    }
}
