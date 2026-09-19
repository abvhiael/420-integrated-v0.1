// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeIds420.sol";
import "./ComputeJobRegistry420.sol";
import "./ComputeRequestRegistry420.sol";

contract ComputeDispute420 is I420System {
    enum State { NONE, OPEN, RESOLVED }

    struct Dispute {
        bytes32 jobId;
        address opener;
        bytes32 evidenceRef;
        bytes32 resolutionRef;
        bool providerUpheld;
        State state;
        bool exists;
    }

    ComputeAuthorization420 public immutable authorization;
    ComputeJobRegistry420 public immutable jobs;
    ComputeRequestRegistry420 public immutable requests;
    mapping(bytes32 => Dispute) private _disputes;

    error InvalidDispute();
    error DisputeExists();
    error Unauthorized();

    event DisputeOpened(bytes32 indexed disputeId, bytes32 indexed jobId, address indexed opener, bytes32 evidenceRef);
    event DisputeResolved(bytes32 indexed disputeId, bool providerUpheld, bytes32 resolutionRef);

    constructor(address authorization_, address jobs_, address requests_) {
        if (authorization_ == address(0) || jobs_ == address(0) || requests_ == address(0)) revert InvalidDispute();
        authorization = ComputeAuthorization420(authorization_);
        jobs = ComputeJobRegistry420(jobs_);
        requests = ComputeRequestRegistry420(requests_);
    }

    function systemName() external pure returns (string memory) { return "ComputeDispute420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalDisputeId(bytes32 jobId) public view returns (bytes32) {
        return keccak256(abi.encode("420/COMPUTE/DISPUTE/V1", block.chainid, address(this), jobId));
    }

    function open(bytes32 jobId, bytes32 evidenceRef) external returns (bytes32 disputeId) {
        if (evidenceRef == bytes32(0)) revert InvalidDispute();
        ComputeJobRegistry420.Job memory j = jobs.getJob(jobId);
        ComputeRequestRegistry420.Request memory r = requests.getRequest(j.requestId);
        if (
            msg.sender != r.requester
                && !authorization.isJobAuthorized(msg.sender, jobId, ComputeIds420.ACTION_DISPUTE, 0)
        ) revert Unauthorized();

        disputeId = canonicalDisputeId(jobId);
        if (_disputes[disputeId].exists) revert DisputeExists();
        jobs.markDisputed(jobId);
        _disputes[disputeId] = Dispute(jobId, msg.sender, evidenceRef, bytes32(0), false, State.OPEN, true);
        emit DisputeOpened(disputeId, jobId, msg.sender, evidenceRef);
    }

    function resolve(bytes32 disputeId, bool providerUpheld, bytes32 resolutionRef) external {
        Dispute storage d = _disputes[disputeId];
        if (!d.exists || d.state != State.OPEN || resolutionRef == bytes32(0)) revert InvalidDispute();
        if (!authorization.isJobAuthorized(msg.sender, d.jobId, ComputeIds420.ACTION_DISPUTE, 0)) revert Unauthorized();
        d.providerUpheld = providerUpheld;
        d.resolutionRef = resolutionRef;
        d.state = State.RESOLVED;
        jobs.resolveDispute(d.jobId, providerUpheld);
        emit DisputeResolved(disputeId, providerUpheld, resolutionRef);
    }

    function getDispute(bytes32 disputeId) external view returns (Dispute memory d) {
        d = _disputes[disputeId];
        if (!d.exists) revert InvalidDispute();
    }
}
