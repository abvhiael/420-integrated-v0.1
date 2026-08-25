// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";
interface ISigningDomain420 {
    function signingDomain() external pure returns (bytes32);
    function protocolVersion() external pure returns (Types420.Version memory);
}
