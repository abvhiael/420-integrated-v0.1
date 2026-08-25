
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract AIJobManager is SystemAccess, I420System {
    enum Status { NONE, FUNDED, ACCEPTED, RESULT_COMMITTED, COMPLETE, DISPUTED, REFUNDED }
    struct Job {
        address requester;
        bytes32 providerId;
        bytes32 modelId;
        bytes32 requestHash;
        bytes32 resultHash;
        Status status;
    }
    mapping(bytes32 => Job) public jobs;

    event JobCreated(bytes32 indexed jobId, address indexed requester, bytes32 providerId, bytes32 modelId);
    event JobStatus(bytes32 indexed jobId, Status status, bytes32 resultHash);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "AIJobManager"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function create(bytes32 jobId, bytes32 providerId, bytes32 modelId, bytes32 requestHash)
        external
    {
        require(jobs[jobId].status == Status.NONE, "exists");
        jobs[jobId] = Job(msg.sender, providerId, modelId, requestHash, bytes32(0), Status.FUNDED);
        emit JobCreated(jobId,msg.sender,providerId,modelId);
    }

    function applyStatus(bytes32 jobId, Status status, bytes32 resultHash) external onlyGovernance {
        require(jobs[jobId].status != Status.NONE, "unknown");
        jobs[jobId].status=status;
        jobs[jobId].resultHash=resultHash;
        emit JobStatus(jobId,status,resultHash);
    }
}
