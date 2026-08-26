// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SystemAccess.sol";

/// @notice Separates native finalized-consensus writes from ordinary governance authority.
/// @dev The caller is bound once during genesis/predeploy initialization and cannot be changed.
abstract contract ConsensusSystemAccess420 is SystemAccess {
    address public consensusSystemCaller;
    bool public consensusSystemCallerBound;

    event ConsensusSystemCallerBound(address indexed caller);

    error ConsensusSystemCallerAlreadyBound();
    error ConsensusSystemCallerNotBound();
    error NotConsensusSystemCaller();

    constructor(address timelock_) SystemAccess(timelock_) {}

    function bindConsensusSystemCaller(address caller) external onlyGovernance {
        if (consensusSystemCallerBound) revert ConsensusSystemCallerAlreadyBound();
        if (caller == address(0)) revert ZeroAddress();
        consensusSystemCaller = caller;
        consensusSystemCallerBound = true;
        emit ConsensusSystemCallerBound(caller);
    }

    modifier onlyConsensusSystem() {
        if (!consensusSystemCallerBound) revert ConsensusSystemCallerNotBound();
        if (msg.sender != consensusSystemCaller) revert NotConsensusSystemCaller();
        _;
    }
}
