// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCInvalidId, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGenomeRegistrySeed {
    function exists(bytes32 genomeId) external view returns (bool);
}

contract SeedRegistry {
    struct SeedLot {
        uint64 id;
        bytes32 genomeId;
        uint64 breedingEventId;
        address owner;
        uint32 quantity;
        bytes32 metadataHash;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IGenomeRegistrySeed public immutable genomeRegistry;
    mapping(uint64 => SeedLot) private _lots;

    event SeedLotRegistered(uint64 indexed seedLotId, bytes32 indexed genomeId, address indexed owner, uint32 quantity, uint64 breedingEventId);
    event SeedLotTransferred(uint64 indexed seedLotId, address indexed previousOwner, address indexed newOwner);

    constructor(address authorization_, address genomeRegistry_) {
        if (authorization_ == address(0) || genomeRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistrySeed(genomeRegistry_);
    }

    function registerSeedLot(uint64 seedLotId, bytes32 genomeId, uint64 breedingEventId, address owner, uint32 quantity, bytes32 metadataHash) external {
        if (seedLotId == 0 || genomeId == bytes32(0) || owner == address(0) || quantity == 0) revert HCInvalidId();
        if (!genomeRegistry.exists(genomeId)) revert HCNotFound();
        if (_lots[seedLotId].exists) revert HCAlreadyExists();
        _auth(ActionIds.SEED_REGISTER, seedLotId, quantity);
        _lots[seedLotId] = SeedLot(seedLotId, genomeId, breedingEventId, owner, quantity, metadataHash, true);
        emit SeedLotRegistered(seedLotId, genomeId, owner, quantity, breedingEventId);
    }

    function transfer(uint64 seedLotId, address newOwner) external {
        if (newOwner == address(0)) revert HCZeroAddress();
        SeedLot storage lot = _require(seedLotId);
        _auth(ActionIds.SEED_TRANSFER, seedLotId, lot.quantity);
        address previous = lot.owner;
        lot.owner = newOwner;
        emit SeedLotTransferred(seedLotId, previous, newOwner);
    }

    function getSeedLot(uint64 seedLotId) external view returns (SeedLot memory) { return _requireView(seedLotId); }
    function exists(uint64 seedLotId) external view returns (bool) { return _lots[seedLotId].exists; }

    function _require(uint64 id) private view returns (SeedLot storage lot) { lot = _lots[id]; if (!lot.exists) revert HCNotFound(); }
    function _requireView(uint64 id) private view returns (SeedLot memory lot) { lot = _lots[id]; if (!lot.exists) revert HCNotFound(); }
    function _auth(bytes32 actionId, uint64 id, uint256 amount) private view {
        authorization.requireAuthorized(AuthorizationRequest(msg.sender, ModuleIds.SEED_REGISTRY, actionId, bytes32(uint256(id)), amount));
    }
}
