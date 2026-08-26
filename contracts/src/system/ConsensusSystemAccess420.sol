// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SystemAccess.sol";

/// @notice Separates native finalized-consensus writes from ordinary governance authority.
/// @dev The only valid caller is the frozen ConsensusSystemCall420 predeploy at 0x043C.
abstract contract ConsensusSystemAccess420 is SystemAccess {
    address public constant CANONICAL_CONSENSUS_SYSTEM_CALL =
        0x000000000000000000000000000000000000043c;

    address public consensusSystemCaller;
    bool public consensusSystemCallerBound;

    event ConsensusSystemCallerBound(address indexed caller);

    error ConsensusSystemCallerAlreadyBound();
    error ConsensusSystemCallerNotBound();
    error InvalidConsensusSystemCaller();
    error NotConsensusSystemCaller();

    constructor(address timelock_) SystemAccess(timelock_) {}

    /// @notice One-time genesis initialization. The caller is not configurable: only 0x043C is valid.
    function bindConsensusSystemCaller(address caller) external onlyGovernance {
        if (consensusSystemCallerBound) revert ConsensusSystemCallerAlreadyBound();
        if (caller != CANONICAL_CONSENSUS_SYSTEM_CALL) revert InvalidConsensusSystemCaller();
        consensusSystemCaller = caller;
        consensusSystemCallerBound = true;
        emit ConsensusSystemCallerBound(caller);
    }

    modifier onlyConsensusSystem() {
        if (!consensusSystemCallerBound) revert ConsensusSystemCallerNotBound();
        if (msg.sender != CANONICAL_CONSENSUS_SYSTEM_CALL || msg.sender != consensusSystemCaller) {
            revert NotConsensusSystemCaller();
        }
        _;
    }
}
