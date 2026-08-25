// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";

interface IChainContext420 {
    function chainId() external view returns(uint256);
    function networkId() external view returns(uint256);
    function genesisHash() external view returns(bytes32);
    function protocolVersion() external view returns(Types420.Version memory);
}
