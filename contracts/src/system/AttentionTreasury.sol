
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./ProtocolTreasury.sol";
import "../interfaces/I420System.sol";

contract AttentionTreasury is ProtocolTreasury, I420System {
    constructor(address timelock_) ProtocolTreasury(timelock_) {}
    function systemName() external pure returns (string memory) { return "AttentionTreasury"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
}
