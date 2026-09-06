// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCCapacityExceeded, HCInvalidState, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface ILandRegistryHC3 {
    function exists(uint64 parcelId) external view returns (bool);
    function growCapacityOf(uint64 parcelId) external view returns (uint32);
}

contract PublicCultivationAccess {
    struct PublicPlot {
        uint64 id;
        uint64 parcelId;
        uint32 growCapacity;
        uint32 allocatedCapacity;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    ILandRegistryHC3 public immutable landRegistry;

    mapping(uint64 => PublicPlot) private _plots;
    mapping(uint64 => mapping(address => uint32)) public allocationOf;
    mapping(uint64 => uint32) public publicCapacityOnParcel;
    uint64 public plotCount;

    event PublicPlotRegistered(uint64 indexed plotId, uint64 indexed parcelId, uint32 growCapacity);
    event PublicPlotAllocated(uint64 indexed plotId, address indexed grower, uint32 capacity);
    event PublicPlotReleased(uint64 indexed plotId, address indexed grower, uint32 capacity);

    constructor(address authorization_, address landRegistry_) {
        if (authorization_ == address(0) || landRegistry_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
        landRegistry = ILandRegistryHC3(landRegistry_);
    }

    function registerPublicPlot(uint64 plotId, uint64 parcelId, uint32 growCapacity) external {
        if (plotId == 0 || growCapacity == 0) revert HCNotFound();
        if (!landRegistry.exists(parcelId)) revert HCNotFound();
        if (_plots[plotId].exists) revert HCAlreadyExists();

        uint32 parcelCapacity = landRegistry.growCapacityOf(parcelId);
        uint256 nextPublicCapacity = uint256(publicCapacityOnParcel[parcelId]) + growCapacity;
        if (nextPublicCapacity > parcelCapacity) {
            revert HCCapacityExceeded(nextPublicCapacity, parcelCapacity);
        }

        _requireAuthorized(ActionIds.PUBLIC_PLOT_REGISTER, plotId, growCapacity);

        _plots[plotId] = PublicPlot({
            id: plotId,
            parcelId: parcelId,
            growCapacity: growCapacity,
            allocatedCapacity: 0,
            exists: true
        });
        publicCapacityOnParcel[parcelId] = uint32(nextPublicCapacity);
        unchecked { plotCount += 1; }
        emit PublicPlotRegistered(plotId, parcelId, growCapacity);
    }

    function allocate(uint64 plotId, uint32 capacity) external {
        PublicPlot storage plot = _requirePlot(plotId);
        if (capacity == 0 || allocationOf[plotId][msg.sender] != 0) revert HCInvalidState();

        uint256 nextAllocated = uint256(plot.allocatedCapacity) + capacity;
        if (nextAllocated > plot.growCapacity) {
            revert HCCapacityExceeded(nextAllocated, plot.growCapacity);
        }

        _requireAuthorized(ActionIds.PUBLIC_PLOT_ALLOCATE, plotId, capacity);
        allocationOf[plotId][msg.sender] = capacity;
        plot.allocatedCapacity = uint32(nextAllocated);
        emit PublicPlotAllocated(plotId, msg.sender, capacity);
    }

    function release(uint64 plotId) external {
        PublicPlot storage plot = _requirePlot(plotId);
        uint32 capacity = allocationOf[plotId][msg.sender];
        if (capacity == 0) revert HCInvalidState();

        _requireAuthorized(ActionIds.PUBLIC_PLOT_RELEASE, plotId, capacity);
        delete allocationOf[plotId][msg.sender];
        plot.allocatedCapacity -= capacity;
        emit PublicPlotReleased(plotId, msg.sender, capacity);
    }

    function availableCapacity(uint64 plotId) external view returns (uint32) {
        PublicPlot memory plot = _plots[plotId];
        if (!plot.exists) revert HCNotFound();
        return plot.growCapacity - plot.allocatedCapacity;
    }

    function exists(uint64 plotId) external view returns (bool) {
        return _plots[plotId].exists;
    }

    function getPlot(uint64 plotId) external view returns (PublicPlot memory) {
        PublicPlot memory plot = _plots[plotId];
        if (!plot.exists) revert HCNotFound();
        return plot;
    }

    function _requirePlot(uint64 plotId) private view returns (PublicPlot storage plot) {
        plot = _plots[plotId];
        if (!plot.exists) revert HCNotFound();
    }

    function _requireAuthorized(bytes32 actionId, uint64 plotId, uint256 amount) private view {
        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.PUBLIC_CULTIVATION_ACCESS,
                actionId: actionId,
                scopeHash: bytes32(uint256(plotId)),
                amount: amount
            })
        );
    }
}
