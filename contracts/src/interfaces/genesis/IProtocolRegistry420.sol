// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";
interface IProtocolRegistry420 {
    event ComponentRegistered(bytes32 indexed componentId,address indexed implementation,bytes32 runtimeCodeHash,uint16 major,uint16 minor,uint16 patch,Types420.Lifecycle lifecycle);
    event ComponentLifecycleChanged(bytes32 indexed componentId,Types420.Lifecycle lifecycle);
    function component(bytes32 componentId) external view returns (Types420.ContractRef memory);
    function isActive(bytes32 componentId) external view returns (bool);
    function resolve(bytes32 componentId) external view returns (address);
    function runtimeCodeHash(bytes32 componentId) external view returns (bytes32);
    function supportsVersion(bytes32 componentId,Types420.Version calldata version) external view returns (bool);
}
