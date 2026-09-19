// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./AIJobManager.sol";

/// @notice Read-through mature request surface over the frozen AIJobManager predeploy.
/// @dev Canonical request state remains in AIJobManager to avoid duplicate lifecycle authority.
contract AIRequestRegistry420 is I420System {
    AIJobManager public immutable jobs;

    constructor(address jobs_) {
        require(jobs_ != address(0), "dependency");
        jobs = AIJobManager(jobs_);
    }

    function systemName() external pure returns (string memory) { return "AIRequestRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function getRequest(bytes32 requestId) external view returns (AIJobManager.Job memory) {
        return jobs.getJob(requestId);
    }
}
