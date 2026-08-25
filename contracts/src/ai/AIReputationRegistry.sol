
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract AIReputationRegistry is SystemAccess, I420System {
    struct Reputation { uint64 completed; uint64 disputed; uint64 upheld; }
    mapping(bytes32 => Reputation) public reputation;
    event ReputationApplied(bytes32 indexed providerId, uint64 completed, uint64 disputed, uint64 upheld);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "AIReputationRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function apply(bytes32 providerId, uint64 completed, uint64 disputed, uint64 upheld)
        external
        onlyGovernance
    {
        reputation[providerId]=Reputation(completed,disputed,upheld);
        emit ReputationApplied(providerId,completed,disputed,upheld);
    }
}
