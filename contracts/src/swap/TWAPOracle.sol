// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

contract TWAPOracle is GenesisResidentAccess420 {
    struct Observation { uint64 timestamp; uint192 priceX96; }
    mapping(bytes32 => Observation) public latest;
    event ObservationApplied(bytes32 indexed marketId, uint64 timestamp, uint192 priceX96);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return SwapIds420.TWAP_ORACLE; }

    function applyObservation(bytes32 marketId, uint64 timestamp, uint192 priceX96) external {
        _requireGenesisGovernance(SwapIds420.ACTION_PUBLISH_ORACLE);
        _requireOperational(
            SwapIds420.ACTION_PUBLISH_ORACLE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(marketId != bytes32(0) && priceX96 > 0, "observation");
        require(timestamp <= block.timestamp, "future");
        require(timestamp >= latest[marketId].timestamp, "old");
        latest[marketId] = Observation(timestamp, priceX96);
        emit ObservationApplied(marketId, timestamp, priceX96);
    }
}
