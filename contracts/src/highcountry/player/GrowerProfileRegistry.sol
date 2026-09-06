// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCGenesisNotFinalized, HCInvalidRegion, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IGenesisRegistry } from "../interfaces/IGenesisRegistry.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IRegionRegistryHC2 {
    function exists(uint16 regionId) external view returns (bool);
}

contract GrowerProfileRegistry {
    struct GrowerProfile {
        uint64 id;
        address account;
        uint16 homeRegionId;
        uint64 createdAt;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IRegionRegistryHC2 public immutable regionRegistry;
    IGenesisRegistry public immutable genesisRegistry;

    uint64 public nextProfileId = 1;
    mapping(uint64 => GrowerProfile) private _profiles;
    mapping(address => uint64) public profileIdOf;

    event GrowerProfileCreated(uint64 indexed profileId, address indexed account, uint16 indexed homeRegionId);

    constructor(address authorization_, address regionRegistry_, address genesisRegistry_) {
        if (authorization_ == address(0) || regionRegistry_ == address(0) || genesisRegistry_ == address(0)) {
            revert HCZeroAddress();
        }
        authorization = IHighCountryAuthorization(authorization_);
        regionRegistry = IRegionRegistryHC2(regionRegistry_);
        genesisRegistry = IGenesisRegistry(genesisRegistry_);
    }

    function getProfile(uint64 profileId) external view returns (GrowerProfile memory) {
        GrowerProfile memory profile = _profiles[profileId];
        if (!profile.exists) revert HCNotFound();
        return profile;
    }

    function createProfile(uint16 homeRegionId) external returns (uint64 profileId) {
        if (!genesisRegistry.finalized()) revert HCGenesisNotFinalized();
        if (profileIdOf[msg.sender] != 0) revert HCAlreadyExists();
        if (!regionRegistry.exists(homeRegionId)) revert HCInvalidRegion(homeRegionId);

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.GROWER_PROFILE_REGISTRY,
                actionId: ActionIds.GROWER_PROFILE_CREATE,
                scopeHash: bytes32(uint256(homeRegionId)),
                amount: 0
            })
        );

        profileId = nextProfileId++;
        _profiles[profileId] = GrowerProfile({
            id: profileId,
            account: msg.sender,
            homeRegionId: homeRegionId,
            createdAt: uint64(block.timestamp),
            exists: true
        });
        profileIdOf[msg.sender] = profileId;

        emit GrowerProfileCreated(profileId, msg.sender, homeRegionId);
    }
}
