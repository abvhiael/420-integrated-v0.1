// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCInvalidId, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGenomeRegistryClone { function exists(bytes32 genomeId) external view returns (bool); }

contract CloneRegistry {
    struct CloneRecord {
        uint64 id;
        bytes32 genomeId;
        uint64 motherId;
        address owner;
        bytes32 metadataHash;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IGenomeRegistryClone public immutable genomeRegistry;
    mapping(uint64 => CloneRecord) private _clones;

    event CloneRegistered(uint64 indexed cloneId, bytes32 indexed genomeId, uint64 indexed motherId, address owner);
    event CloneTransferred(uint64 indexed cloneId, address indexed previousOwner, address indexed newOwner);

    constructor(address authorization_, address genomeRegistry_) {
        if (authorization_ == address(0) || genomeRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistryClone(genomeRegistry_);
    }

    function registerClone(uint64 cloneId, bytes32 genomeId, uint64 motherId, address owner, bytes32 metadataHash) external {
        if (cloneId == 0 || genomeId == bytes32(0) || owner == address(0)) revert HCInvalidId();
        if (!genomeRegistry.exists(genomeId)) revert HCNotFound();
        if (_clones[cloneId].exists) revert HCAlreadyExists();
        _auth(ActionIds.CLONE_REGISTER, cloneId);
        _clones[cloneId] = CloneRecord(cloneId, genomeId, motherId, owner, metadataHash, true);
        emit CloneRegistered(cloneId, genomeId, motherId, owner);
    }

    function transfer(uint64 cloneId, address newOwner) external {
        if (newOwner == address(0)) revert HCZeroAddress();
        CloneRecord storage clone = _require(cloneId);
        _auth(ActionIds.CLONE_TRANSFER, cloneId);
        address previous = clone.owner;
        clone.owner = newOwner;
        emit CloneTransferred(cloneId, previous, newOwner);
    }

    function exists(uint64 cloneId) external view returns (bool) { return _clones[cloneId].exists; }
    function getClone(uint64 cloneId) external view returns (CloneRecord memory) { CloneRecord memory c = _clones[cloneId]; if (!c.exists) revert HCNotFound(); return c; }
    function _require(uint64 id) private view returns (CloneRecord storage c) { c = _clones[id]; if (!c.exists) revert HCNotFound(); }
    function _auth(bytes32 actionId, uint64 id) private view { authorization.requireAuthorized(AuthorizationRequest(msg.sender, ModuleIds.CLONE_REGISTRY, actionId, bytes32(uint256(id)), 0)); }
}
