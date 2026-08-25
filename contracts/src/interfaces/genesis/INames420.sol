// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface INames420 {
    function resolve(bytes32 namehash) external view returns (address);
    function reverseResolve(address account) external view returns (bytes32 namehash);
}
