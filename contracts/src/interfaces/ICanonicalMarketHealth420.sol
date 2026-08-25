
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ICanonicalMarketHealth420 {
    function isSettlementAssetActive(address asset) external view returns (bool);
    function isMarketHealthy(bytes32 marketId) external view returns (bool);
}
