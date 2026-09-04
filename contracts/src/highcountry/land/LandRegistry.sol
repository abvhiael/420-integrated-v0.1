// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCInvalidRegion, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IRegionRegistryHC3 {
    function exists(uint16 regionId) external view returns (bool);
}

contract LandRegistry {
    struct LandParcel {
        uint64 id;
        uint16 regionId;
        address owner;
        uint32 growCapacity;
        bytes32 parcelType;
        bytes32 metadataHash;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IRegionRegistryHC3 public immutable regionRegistry;

    mapping(uint64 => LandParcel) private _parcels;
    uint64 public parcelCount;

    event LandParcelRegistered(
        uint64 indexed parcelId,
        uint16 indexed regionId,
        address indexed owner,
        uint32 growCapacity,
        bytes32 parcelType,
        bytes32 metadataHash
    );

    constructor(address authorization_, address regionRegistry_) {
        if (authorization_ == address(0) || regionRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        regionRegistry = IRegionRegistryHC3(regionRegistry_);
    }

    function registerParcel(
        uint64 parcelId,
        uint16 regionId,
        address owner,
        uint32 growCapacity,
        bytes32 parcelType,
        bytes32 metadataHash
    ) external {
        if (parcelId == 0 || owner == address(0) || growCapacity == 0 || parcelType == bytes32(0)) revert HCNotFound();
        if (!regionRegistry.exists(regionId)) revert HCInvalidRegion(regionId);
        if (_parcels[parcelId].exists) revert HCAlreadyExists();

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.LAND_REGISTRY,
                actionId: ActionIds.LAND_REGISTER,
                scopeHash: bytes32(uint256(parcelId)),
                amount: growCapacity
            })
        );

        _parcels[parcelId] = LandParcel({
            id: parcelId,
            regionId: regionId,
            owner: owner,
            growCapacity: growCapacity,
            parcelType: parcelType,
            metadataHash: metadataHash,
            exists: true
        });
        unchecked { parcelCount += 1; }

        emit LandParcelRegistered(parcelId, regionId, owner, growCapacity, parcelType, metadataHash);
    }

    function exists(uint64 parcelId) external view returns (bool) {
        return _parcels[parcelId].exists;
    }

    function getParcel(uint64 parcelId) external view returns (LandParcel memory) {
        LandParcel memory parcel = _parcels[parcelId];
        if (!parcel.exists) revert HCNotFound();
        return parcel;
    }
}
