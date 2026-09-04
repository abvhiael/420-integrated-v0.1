// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface ILandRegistryHC3 {
    function exists(uint64 parcelId) external view returns (bool);
}

contract PublicCultivationAccess {
    struct PublicPlot {
        uint64 id;
        uint64 parcelId;
        uint32 growCapacity;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    ILandRegistryHC3 public immutable landRegistry;

    mapping(uint64 => PublicPlot) private _plots;
    uint64 public plotCount;

    event PublicPlotRegistered(uint64 indexed plotId, uint64 indexed parcelId, uint32 growCapacity);

    constructor(address authorization_, address landRegistry_) {
        if (authorization_ == address(0) || landRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        landRegistry = ILandRegistryHC3(landRegistry_);
    }

    function registerPublicPlot(uint64 plotId, uint64 parcelId, uint32 growCapacity) external {
        if (plotId == 0 || growCapacity == 0) revert HCNotFound();
        if (!landRegistry.exists(parcelId)) revert HCNotFound();
        if (_plots[plotId].exists) revert HCAlreadyExists();

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.PUBLIC_CULTIVATION_ACCESS,
                actionId: ActionIds.PUBLIC_PLOT_REGISTER,
                scopeHash: bytes32(uint256(plotId)),
                amount: growCapacity
            })
        );

        _plots[plotId] = PublicPlot({
            id: plotId,
            parcelId: parcelId,
            growCapacity: growCapacity,
            exists: true
        });
        unchecked { plotCount += 1; }
        emit PublicPlotRegistered(plotId, parcelId, growCapacity);
    }

    function exists(uint64 plotId) external view returns (bool) {
        return _plots[plotId].exists;
    }

    function getPlot(uint64 plotId) external view returns (PublicPlot memory) {
        PublicPlot memory plot = _plots[plotId];
        if (!plot.exists) revert HCNotFound();
        return plot;
    }
}
