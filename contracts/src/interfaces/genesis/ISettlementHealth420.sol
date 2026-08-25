// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface ISettlementHealth420 {
    function settlementAssetHealthy(bytes32 assetId) external view returns (bool);
    function marketHealthy(bytes32 marketId) external view returns (bool);
    function routeHealthy(bytes32 routeId) external view returns (bool);
}
