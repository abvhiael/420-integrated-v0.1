// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
/// @notice Proposed V1 deterministic device-control conversion policy.
/// @dev Each operation's utility debit must be coupled to its environment update
///      by the authorized execution service; this library never grants credits.
library RegionalClimatePolicy {
    error InvalidPolicy();
    // A device action consumes these exact integer quantities, without wallet modifiers.
    uint256 internal constant IRRIGATION_ML_PER_100_BPS=1_000;
    uint256 internal constant CLIMATE_WH_PER_100_BPS=250;
    uint16 internal constant STEP_BPS=100;
    function irrigation(uint16 steps) internal pure returns(uint16 delta,uint256 millilitres){
        if(steps==0||steps>100)revert InvalidPolicy();
        return (steps*STEP_BPS,uint256(steps)*IRRIGATION_ML_PER_100_BPS);
    }
    function climateControl(uint16 steps) internal pure returns(uint16 delta,uint256 wattHours){
        if(steps==0||steps>100)revert InvalidPolicy();
        return (steps*STEP_BPS,uint256(steps)*CLIMATE_WH_PER_100_BPS);
    }
}
