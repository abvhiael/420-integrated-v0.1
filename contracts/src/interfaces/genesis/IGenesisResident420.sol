// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";
interface IGenesisResident420 {
    function componentId() external pure returns (bytes32);
    function protocolVersion() external pure returns (Types420.Version memory);
    function registry() external view returns (address);
}
