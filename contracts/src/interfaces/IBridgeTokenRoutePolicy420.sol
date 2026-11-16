// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IBridgeTokenRoutePolicy420 {
    function componentId() external view returns (bytes32);
    function qualifyTokenTransfer(
        bytes32 routeId,
        bytes32 assetId,
        bytes32 sourceAsset,
        bytes32 adapterId,
        address verifier,
        bytes32 gateway,
        uint256 amount,
        bool inbound
    ) external view returns (uint256);
}
