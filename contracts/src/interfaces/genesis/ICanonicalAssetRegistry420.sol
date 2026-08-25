// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";
interface ICanonicalAssetRegistry420 {
    event AssetRegistered(bytes32 indexed assetId,address indexed token,uint8 decimals,bytes3 currency,bool canonical);
    event AssetLifecycleChanged(bytes32 indexed assetId,Types420.Lifecycle lifecycle);
    function asset(bytes32 assetId) external view returns (Types420.AssetRef memory);
    function lifecycle(bytes32 assetId) external view returns (Types420.Lifecycle);
    function assetIdOf(address token) external view returns (bytes32);
    function isCanonical(bytes32 assetId) external view returns (bool);
    function isUsable(bytes32 assetId) external view returns (bool);
}
