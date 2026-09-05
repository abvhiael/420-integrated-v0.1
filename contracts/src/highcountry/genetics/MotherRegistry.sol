// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCCapacityExceeded, HCInvalidId, HCInvalidState, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IGenomeRegistryMother { function exists(bytes32 genomeId) external view returns (bool); }

contract MotherRegistry {
    struct MotherRecord {
        uint64 id;
        bytes32 genomeId;
        address owner;
        uint32 maxCuttings;
        uint32 cuttingsTaken;
        bytes32 metadataHash;
        bool retired;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    IGenomeRegistryMother public immutable genomeRegistry;
    mapping(uint64 => MotherRecord) private _mothers;

    event MotherRegistered(uint64 indexed motherId, bytes32 indexed genomeId, address indexed owner, uint32 maxCuttings);
    event MotherTransferred(uint64 indexed motherId, address indexed previousOwner, address indexed newOwner);
    event MotherCuttingConsumed(uint64 indexed motherId, uint32 cuttingsTaken, uint32 remaining);
    event MotherRetired(uint64 indexed motherId);

    constructor(address authorization_, address genomeRegistry_) {
        if (authorization_ == address(0) || genomeRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        genomeRegistry = IGenomeRegistryMother(genomeRegistry_);
    }

    function registerMother(uint64 motherId, bytes32 genomeId, address owner, uint32 maxCuttings, bytes32 metadataHash) external {
        if (motherId == 0 || genomeId == bytes32(0) || owner == address(0) || maxCuttings == 0) revert HCInvalidId();
        if (!genomeRegistry.exists(genomeId)) revert HCNotFound();
        if (_mothers[motherId].exists) revert HCAlreadyExists();
        _auth(ActionIds.MOTHER_REGISTER, motherId, maxCuttings);
        _mothers[motherId] = MotherRecord(motherId, genomeId, owner, maxCuttings, 0, metadataHash, false, true);
        emit MotherRegistered(motherId, genomeId, owner, maxCuttings);
    }

    function transfer(uint64 motherId, address newOwner) external {
        if (newOwner == address(0)) revert HCZeroAddress();
        MotherRecord storage mother = _require(motherId);
        if (mother.retired) revert HCInvalidState();
        _auth(ActionIds.MOTHER_TRANSFER, motherId, 0);
        address previous = mother.owner;
        mother.owner = newOwner;
        emit MotherTransferred(motherId, previous, newOwner);
    }

    function consumeCutting(uint64 motherId) external {
        MotherRecord storage mother = _require(motherId);
        if (mother.retired) revert HCInvalidState();
        uint256 next = uint256(mother.cuttingsTaken) + 1;
        if (next > mother.maxCuttings) revert HCCapacityExceeded(next, mother.maxCuttings);
        _auth(ActionIds.MOTHER_CONSUME_CUTTING, motherId, 1);
        mother.cuttingsTaken = uint32(next);
        uint32 remaining = mother.maxCuttings - mother.cuttingsTaken;
        if (remaining == 0) {
            mother.retired = true;
            emit MotherRetired(motherId);
        }
        emit MotherCuttingConsumed(motherId, mother.cuttingsTaken, remaining);
    }

    function remainingCuttings(uint64 motherId) external view returns (uint32) { MotherRecord memory m = getMother(motherId); return m.maxCuttings - m.cuttingsTaken; }
    function exists(uint64 motherId) external view returns (bool) { return _mothers[motherId].exists; }
    function getMother(uint64 motherId) public view returns (MotherRecord memory) { MotherRecord memory m = _mothers[motherId]; if (!m.exists) revert HCNotFound(); return m; }
    function _require(uint64 id) private view returns (MotherRecord storage m) { m = _mothers[id]; if (!m.exists) revert HCNotFound(); }
    function _auth(bytes32 actionId, uint64 id, uint256 amount) private view { authorization.requireAuthorized(AuthorizationRequest(msg.sender, ModuleIds.MOTHER_REGISTRY, actionId, bytes32(uint256(id)), amount)); }
}
