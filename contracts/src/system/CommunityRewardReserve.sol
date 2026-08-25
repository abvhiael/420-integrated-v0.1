
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./ProtocolTreasury.sol";
import "../interfaces/I420System.sol";

contract CommunityRewardReserve is ProtocolTreasury, I420System {
    uint256 public constant GENESIS_ALLOCATION = 2_100_000 ether;
    constructor(address timelock_) ProtocolTreasury(timelock_) {}
    function systemName() external pure returns (string memory) { return "CommunityRewardReserve"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
}
