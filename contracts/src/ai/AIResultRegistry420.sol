// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./AIJobManager.sol";

/// @notice Read-through mature result surface over AIJobManager result commitments.
/// @dev No duplicate mutable result state is created.
contract AIResultRegistry420 is I420System {
    AIJobManager public immutable jobs;

    struct ResultView {
        bytes32 requestId;
        bytes32 computeJobId;
        bytes32 providerId;
        bytes32 modelVersionId;
        bytes32 outputCommitment;
        bytes32 resultManifestHash;
        AIJobManager.Status status;
    }

    constructor(address jobs_) {
        require(jobs_ != address(0), "dependency");
        jobs = AIJobManager(jobs_);
    }

    function systemName() external pure returns (string memory) { return "AIResultRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function getResult(bytes32 requestId) external view returns (ResultView memory r) {
        AIJobManager.Job memory j = jobs.getJob(requestId);
        r = ResultView({
            requestId: requestId,
            computeJobId: j.computeJobId,
            providerId: j.providerId,
            modelVersionId: j.modelVersionId,
            outputCommitment: j.resultHash,
            resultManifestHash: j.resultManifestHash,
            status: j.status
        });
    }
}
