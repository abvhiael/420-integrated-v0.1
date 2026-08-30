// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

struct PackedUserOperation420 {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IEntryPoint420 {
    function getNonce(address sender, uint192 key) external view returns (uint256);
}
