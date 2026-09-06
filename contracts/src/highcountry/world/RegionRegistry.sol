// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCInvalidRegion, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IGenesisRegistry } from "../interfaces/IGenesisRegistry.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract RegionRegistry {
    struct RegionRecord {
        uint16 id;
        bytes32 metadataHash;
        bytes32 climateProfileId;
        bytes32 rulesetId;
        bool exists;
    }

    uint16 public constant FOUNDING_REGION_COUNT = 3;

    IHighCountryAuthorization public immutable authorization;
    IGenesisRegistry public immutable genesisRegistry;

    mapping(uint16 => RegionRecord) private _regions;
    uint16 public regionCount;

    event RegionRegistered(uint16 indexed regionId, bytes32 metadataHash, bytes32 climateProfileId, bytes32 rulesetId);

    constructor(address authorization_, address genesisRegistry_) {
        if (authorization_ == address(0) || genesisRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        genesisRegistry = IGenesisRegistry(genesisRegistry_);
    }

    function getRegion(uint16 regionId) external view returns (RegionRecord memory) {
        RegionRecord memory region = _regions[regionId];
        if (!region.exists) revert HCInvalidRegion(regionId);
        return region;
    }

    function exists(uint16 regionId) public view returns (bool) {
        return _regions[regionId].exists;
    }

    function registerFoundingRegion(uint16 regionId, bytes32 metadataHash, bytes32 climateProfileId, bytes32 rulesetId) external {
        if (genesisRegistry.finalized()) revert HCAlreadyExists();
        if (regionId == 0 || regionId > FOUNDING_REGION_COUNT) revert HCInvalidRegion(regionId);
        if (_regions[regionId].exists) revert HCAlreadyExists();
        if (metadataHash == bytes32(0) || climateProfileId == bytes32(0) || rulesetId == bytes32(0)) revert HCInvalidRegion(regionId);

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.REGION_REGISTRY,
                actionId: ActionIds.REGION_REGISTER,
                scopeHash: bytes32(uint256(regionId)),
                amount: 0
            })
        );

        _regions[regionId] = RegionRecord({
            id: regionId,
            metadataHash: metadataHash,
            climateProfileId: climateProfileId,
            rulesetId: rulesetId,
            exists: true
        });
        unchecked { regionCount += 1; }
        emit RegionRegistered(regionId, metadataHash, climateProfileId, rulesetId);
    }

    function foundingRegionsReady() external view returns (bool) {
        return regionCount == FOUNDING_REGION_COUNT && _regions[1].exists && _regions[2].exists && _regions[3].exists;
    }
}
