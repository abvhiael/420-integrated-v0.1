
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface I420System {
    function systemName() external pure returns (string memory);
    function protocolVersion() external pure returns (uint32);
}
