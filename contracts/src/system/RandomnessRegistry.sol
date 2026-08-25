
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Execution mirror for finalized consensus randomness commitments/results.
/// This contract never generates consensus randomness.
contract RandomnessRegistry is SystemAccess, I420System {
    struct Result {
        bytes32 seed;
        bytes32 checkpointRoot;
        uint64 rotation;
        bool degraded;
    }

    mapping(uint64 => Result) public results;
    uint64 public latestRotation;

    event RandomnessApplied(uint64 indexed rotation, bytes32 seed, bytes32 checkpointRoot, bool degraded);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "RandomnessRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function applyResult(uint64 rotation, bytes32 seed, bytes32 checkpointRoot, bool degraded)
        external
        onlyGovernance
    {
        require(rotation >= latestRotation, "old rotation");
        require(seed != bytes32(0), "seed");
        results[rotation]=Result(seed,checkpointRoot,rotation,degraded);
        latestRotation=rotation;
        emit RandomnessApplied(rotation,seed,checkpointRoot,degraded);
    }
}
