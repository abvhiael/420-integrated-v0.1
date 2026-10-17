// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { RegionalUtilities } from "./RegionalUtilities.sol";

interface IRegionalEnvironmentEngine {
    struct EnvironmentSnapshot {
        uint16 temperature;
        uint16 humidity;
        uint16 light;
        uint16 water;
        uint16 nutrients;
        uint16 airflow;
    }
    function updateEnvironment(
        uint64 plantId,
        EnvironmentSnapshot calldata environment
    ) external;
}

interface IRegionPlantLocator {
    function regionIdOf(
        uint64 parcelId
    ) external view returns (uint16);
}

/// @notice Atomically burns authorized utility inputs and applies an environment snapshot.
/// @dev Configure exact per-region CONSUME and per-plant CULTIVATION_UPDATE grants for this
///      service. It cannot approve client-supplied arbitrary snapshot changes: the trusted
///      application must authenticate the prior snapshot, equipment, owner and quoted effect.
contract RegionalEnvironmentSettlement {
    error InvalidSettlement();
    RegionalUtilities public immutable utilities;
    IRegionalEnvironmentEngine public immutable engine;
    address public immutable coordinator;
    mapping(bytes32 => bool) public settled;
    event Settled(bytes32 indexed op, uint16 indexed region, uint64 indexed plantId, uint256 waterMl, uint256 energyWh);

    constructor(
        address utilities_,
        address engine_,
        address coordinator_
    ) {
        if (utilities_.code.length == 0 || engine_.code.length == 0 || coordinator_ == address(0)) revert InvalidSettlement();
        utilities = RegionalUtilities(utilities_);
        engine = IRegionalEnvironmentEngine(engine_);
        coordinator = coordinator_;
    }

    function applySettlement(
        bytes32 op,
        uint16 region,
        uint64 plantId,
        address owner,
        uint256 waterMl,
        uint256 energyWh,
        IRegionalEnvironmentEngine.EnvironmentSnapshot calldata next
    ) external {
        if (
            msg.sender != coordinator || op == 0 || settled[op] || region == 0 || plantId == 0 || owner == address(0)
                || (waterMl == 0 && energyWh == 0)
        ) revert InvalidSettlement();
        settled[op] = true;
        if (waterMl != 0) utilities.consume(keccak256(abi.encode(op, uint8(1))), region, 1, owner, waterMl);
        if (energyWh != 0) utilities.consume(keccak256(abi.encode(op, uint8(2))), region, 2, owner, energyWh);
        engine.updateEnvironment(plantId, next);
        emit Settled(op, region, plantId, waterMl, energyWh);
    }
}
