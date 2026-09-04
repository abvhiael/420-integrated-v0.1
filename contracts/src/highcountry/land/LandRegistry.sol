// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import {
    HCAlreadyExists,
    HCGenesisAlreadyFinalized,
    HCGenesisNotFinalized,
    HCInvalidProof,
    HCInvalidRegion,
    HCInvalidState,
    HCNotFound,
    HCOccupancyConflict,
    HCZeroAddress
} from "../errors/HighCountryErrors.sol";
import { IGenesisRegistry } from "../interfaces/IGenesisRegistry.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest, GenesisRoots } from "../types/HighCountryTypes.sol";

interface IRegionRegistryHC3 {
    function exists(uint16 regionId) external view returns (bool);
}

contract LandRegistry {
    enum OccupancyKind {
        NONE,
        LEASE,
        LICENSE
    }

    struct LandParcel {
        uint64 id;
        uint16 regionId;
        address owner;
        address occupant;
        uint32 growCapacity;
        bytes32 parcelType;
        bytes32 metadataHash;
        bytes32 occupancyRef;
        OccupancyKind occupancyKind;
        bool genesisParcel;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IRegionRegistryHC3 public immutable regionRegistry;
    IGenesisRegistry public immutable genesisRegistry;

    mapping(uint64 => LandParcel) private _parcels;
    uint64 public parcelCount;

    event LandParcelRegistered(
        uint64 indexed parcelId,
        uint16 indexed regionId,
        address indexed owner,
        uint32 growCapacity,
        bytes32 parcelType,
        bytes32 metadataHash,
        bool genesisParcel
    );
    event LandOwnerTransferred(uint64 indexed parcelId, address indexed previousOwner, address indexed newOwner);
    event LandOccupancySet(
        uint64 indexed parcelId,
        address indexed occupant,
        OccupancyKind occupancyKind,
        bytes32 indexed occupancyRef
    );
    event LandOccupancyCleared(uint64 indexed parcelId, address indexed previousOccupant, bytes32 indexed occupancyRef);

    constructor(address authorization_, address regionRegistry_, address genesisRegistry_) {
        if (authorization_ == address(0) || regionRegistry_ == address(0) || genesisRegistry_ == address(0)) {
            revert HCZeroAddress();
        }
        authorization = IHighCountryAuthorization(authorization_);
        regionRegistry = IRegionRegistryHC3(regionRegistry_);
        genesisRegistry = IGenesisRegistry(genesisRegistry_);
    }

    function registerGenesisParcel(
        uint64 parcelId,
        uint16 regionId,
        address owner,
        uint32 growCapacity,
        bytes32 parcelType,
        bytes32 metadataHash,
        bytes32[] calldata proof
    ) external {
        if (genesisRegistry.finalized()) revert HCGenesisAlreadyFinalized();
        _validateParcelInput(parcelId, regionId, owner, growCapacity, parcelType);

        GenesisRoots memory roots = genesisRegistry.roots();
        bytes32 leaf = genesisLeaf(parcelId, regionId, owner, growCapacity, parcelType, metadataHash);
        if (!_verifyProof(proof, roots.landRoot, leaf)) revert HCInvalidProof();

        _requireAuthorized(ActionIds.LAND_GENESIS_REGISTER, parcelId, growCapacity);
        _register(parcelId, regionId, owner, growCapacity, parcelType, metadataHash, true);
    }

    function registerParcel(
        uint64 parcelId,
        uint16 regionId,
        address owner,
        uint32 growCapacity,
        bytes32 parcelType,
        bytes32 metadataHash
    ) external {
        if (!genesisRegistry.finalized()) revert HCGenesisNotFinalized();
        _validateParcelInput(parcelId, regionId, owner, growCapacity, parcelType);
        _requireAuthorized(ActionIds.LAND_REGISTER, parcelId, growCapacity);
        _register(parcelId, regionId, owner, growCapacity, parcelType, metadataHash, false);
    }

    function transferOwner(uint64 parcelId, address newOwner) external {
        if (newOwner == address(0)) revert HCZeroAddress();
        LandParcel storage parcel = _requireParcel(parcelId);
        _requireAuthorized(ActionIds.LAND_TRANSFER, parcelId, 0);

        address previousOwner = parcel.owner;
        parcel.owner = newOwner;
        emit LandOwnerTransferred(parcelId, previousOwner, newOwner);
    }

    function setOccupancy(
        uint64 parcelId,
        address occupant,
        OccupancyKind occupancyKind,
        bytes32 occupancyRef
    ) external {
        if (occupant == address(0) || occupancyKind == OccupancyKind.NONE || occupancyRef == bytes32(0)) {
            revert HCInvalidState();
        }
        LandParcel storage parcel = _requireParcel(parcelId);
        if (parcel.occupant != address(0)) revert HCOccupancyConflict();

        _requireAuthorized(ActionIds.LAND_SET_OCCUPANCY, parcelId, 0);
        parcel.occupant = occupant;
        parcel.occupancyKind = occupancyKind;
        parcel.occupancyRef = occupancyRef;
        emit LandOccupancySet(parcelId, occupant, occupancyKind, occupancyRef);
    }

    function clearOccupancy(uint64 parcelId) external {
        LandParcel storage parcel = _requireParcel(parcelId);
        if (parcel.occupant == address(0)) revert HCInvalidState();

        _requireAuthorized(ActionIds.LAND_CLEAR_OCCUPANCY, parcelId, 0);
        address previousOccupant = parcel.occupant;
        bytes32 previousRef = parcel.occupancyRef;
        parcel.occupant = address(0);
        parcel.occupancyKind = OccupancyKind.NONE;
        parcel.occupancyRef = bytes32(0);
        emit LandOccupancyCleared(parcelId, previousOccupant, previousRef);
    }

    function effectiveOperator(uint64 parcelId) external view returns (address) {
        LandParcel memory parcel = _parcels[parcelId];
        if (!parcel.exists) revert HCNotFound();
        return parcel.occupant == address(0) ? parcel.owner : parcel.occupant;
    }

    function exists(uint64 parcelId) external view returns (bool) {
        return _parcels[parcelId].exists;
    }

    function getParcel(uint64 parcelId) external view returns (LandParcel memory) {
        LandParcel memory parcel = _parcels[parcelId];
        if (!parcel.exists) revert HCNotFound();
        return parcel;
    }

    function genesisLeaf(
        uint64 parcelId,
        uint16 regionId,
        address owner,
        uint32 growCapacity,
        bytes32 parcelType,
        bytes32 metadataHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(parcelId, regionId, owner, growCapacity, parcelType, metadataHash));
    }

    function _register(
        uint64 parcelId,
        uint16 regionId,
        address owner,
        uint32 growCapacity,
        bytes32 parcelType,
        bytes32 metadataHash,
        bool isGenesis
    ) private {
        _parcels[parcelId] = LandParcel({
            id: parcelId,
            regionId: regionId,
            owner: owner,
            occupant: address(0),
            growCapacity: growCapacity,
            parcelType: parcelType,
            metadataHash: metadataHash,
            occupancyRef: bytes32(0),
            occupancyKind: OccupancyKind.NONE,
            genesisParcel: isGenesis,
            exists: true
        });
        unchecked { parcelCount += 1; }
        emit LandParcelRegistered(parcelId, regionId, owner, growCapacity, parcelType, metadataHash, isGenesis);
    }

    function _validateParcelInput(
        uint64 parcelId,
        uint16 regionId,
        address owner,
        uint32 growCapacity,
        bytes32 parcelType
    ) private view {
        if (parcelId == 0 || owner == address(0) || growCapacity == 0 || parcelType == bytes32(0)) revert HCNotFound();
        if (!regionRegistry.exists(regionId)) revert HCInvalidRegion(regionId);
        if (_parcels[parcelId].exists) revert HCAlreadyExists();
    }

    function _requireParcel(uint64 parcelId) private view returns (LandParcel storage parcel) {
        parcel = _parcels[parcelId];
        if (!parcel.exists) revert HCNotFound();
    }

    function _requireAuthorized(bytes32 actionId, uint64 parcelId, uint256 amount) private view {
        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.LAND_REGISTRY,
                actionId: actionId,
                scopeHash: bytes32(uint256(parcelId)),
                amount: amount
            })
        );
    }

    function _verifyProof(bytes32[] calldata proof, bytes32 root, bytes32 leaf) private pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; ++i) {
            bytes32 sibling = proof[i];
            computed = computed <= sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
        }
        return root != bytes32(0) && computed == root;
    }
}
