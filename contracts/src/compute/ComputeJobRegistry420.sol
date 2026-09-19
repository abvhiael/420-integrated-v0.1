// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeIds420.sol";
import "./ComputeMatch420.sol";
import "./ComputeProviderRegistry420.sol";
import "./ComputeRequestRegistry420.sol";

contract ComputeJobRegistry420 is I420System {
    enum State {
        NONE,
        CREATED,
        MATCHED,
        ACCEPTED,
        RUNNING,
        RESULT_COMMITTED,
        VERIFIED,
        SETTLED,
        FAILED,
        DISPUTED,
        REFUNDED
    }

    struct Job {
        bytes32 matchId;
        bytes32 requestId;
        bytes32 providerId;
        bytes32 resourceId;
        bytes32 outputCommitment;
        bytes32 resultManifestHash;
        uint64 createdAt;
        State state;
        bool exists;
    }

    ComputeAuthorization420 public immutable authorization;
    ComputeMatch420 public immutable matches;
    ComputeProviderRegistry420 public immutable providers;
    ComputeRequestRegistry420 public immutable requests;
    mapping(bytes32 => Job) private _jobs;

    error InvalidJob();
    error JobExists();
    error JobNotFound();
    error Unauthorized();
    error InvalidState();

    event JobCreated(bytes32 indexed jobId, bytes32 indexed matchId, bytes32 indexed requestId, bytes32 providerId);
    event JobStateChanged(bytes32 indexed jobId, State previousState, State newState);
    event ResultCommitted(bytes32 indexed jobId, bytes32 outputCommitment, bytes32 resultManifestHash);

    constructor(address authorization_, address matches_, address providers_, address requests_) {
        if (
            authorization_ == address(0) || matches_ == address(0) || providers_ == address(0)
                || requests_ == address(0)
        ) revert InvalidJob();
        authorization = ComputeAuthorization420(authorization_);
        matches = ComputeMatch420(matches_);
        providers = ComputeProviderRegistry420(providers_);
        requests = ComputeRequestRegistry420(requests_);
    }

    function systemName() external pure returns (string memory) { return "ComputeJobRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalJobId(bytes32 matchId) public view returns (bytes32) {
        return keccak256(abi.encode("420/COMPUTE/JOB/V1", block.chainid, address(this), matchId));
    }

    function createJob(bytes32 jobId, bytes32 matchId) external {
        if (jobId != canonicalJobId(matchId)) revert InvalidJob();
        if (_jobs[jobId].exists) revert JobExists();
        ComputeMatch420.MatchRecord memory m = matches.getMatch(matchId);
        ComputeRequestRegistry420.Request memory r = requests.getRequest(m.requestId);
        if (
            msg.sender != r.requester
                && !authorization.isRequestAuthorized(
                    msg.sender, m.requestId, ComputeIds420.ACTION_ACCEPT_MATCH, m.quotedAmount420
                )
        ) revert Unauthorized();

        _jobs[jobId] = Job({
            matchId: matchId,
            requestId: m.requestId,
            providerId: m.providerId,
            resourceId: m.resourceId,
            outputCommitment: bytes32(0),
            resultManifestHash: bytes32(0),
            createdAt: uint64(block.timestamp),
            state: State.MATCHED,
            exists: true
        });
        emit JobCreated(jobId, matchId, m.requestId, m.providerId);
    }

    function accept(bytes32 jobId) external {
        Job storage j = _providerJob(jobId);
        _advance(jobId, j, State.MATCHED, State.ACCEPTED);
    }

    function markRunning(bytes32 jobId) external {
        Job storage j = _providerJob(jobId);
        _advance(jobId, j, State.ACCEPTED, State.RUNNING);
    }

    function commitResult(bytes32 jobId, bytes32 outputCommitment, bytes32 resultManifestHash) external {
        Job storage j = _providerJob(jobId);
        if (j.state != State.RUNNING || outputCommitment == bytes32(0) || resultManifestHash == bytes32(0)) {
            revert InvalidState();
        }
        j.outputCommitment = outputCommitment;
        j.resultManifestHash = resultManifestHash;
        _setState(jobId, j, State.RESULT_COMMITTED);
        emit ResultCommitted(jobId, outputCommitment, resultManifestHash);
    }

    function markVerified(bytes32 jobId) external {
        Job storage j = _get(jobId);
        if (
            !authorization.isJobAuthorized(msg.sender, jobId, ComputeIds420.ACTION_VERIFY, 0)
        ) revert Unauthorized();
        _advance(jobId, j, State.RESULT_COMMITTED, State.VERIFIED);
    }

    function markSettled(bytes32 jobId, uint256 amount) external {
        Job storage j = _get(jobId);
        if (!authorization.isJobAuthorized(msg.sender, jobId, ComputeIds420.ACTION_SETTLE, amount)) {
            revert Unauthorized();
        }
        _advance(jobId, j, State.VERIFIED, State.SETTLED);
    }

    function markFailed(bytes32 jobId) external {
        Job storage j = _providerJob(jobId);
        if (j.state != State.MATCHED && j.state != State.ACCEPTED && j.state != State.RUNNING) revert InvalidState();
        _setState(jobId, j, State.FAILED);
    }

    function markDisputed(bytes32 jobId) external {
        Job storage j = _get(jobId);
        ComputeRequestRegistry420.Request memory r = requests.getRequest(j.requestId);
        if (
            msg.sender != r.requester
                && !authorization.isJobAuthorized(msg.sender, jobId, ComputeIds420.ACTION_DISPUTE, 0)
        ) revert Unauthorized();
        if (j.state != State.RESULT_COMMITTED && j.state != State.VERIFIED) revert InvalidState();
        _setState(jobId, j, State.DISPUTED);
    }

    function resolveDispute(bytes32 jobId, bool providerUpheld) external {
        Job storage j = _get(jobId);
        if (!authorization.isJobAuthorized(msg.sender, jobId, ComputeIds420.ACTION_DISPUTE, 0)) {
            revert Unauthorized();
        }
        if (j.state != State.DISPUTED) revert InvalidState();
        _setState(jobId, j, providerUpheld ? State.VERIFIED : State.FAILED);
    }

    function markRefunded(bytes32 jobId) external {
        Job storage j = _get(jobId);
        if (!authorization.isJobAuthorized(msg.sender, jobId, ComputeIds420.ACTION_SETTLE, 0)) revert Unauthorized();
        if (j.state != State.FAILED && j.state != State.DISPUTED) revert InvalidState();
        _setState(jobId, j, State.REFUNDED);
    }

    function getJob(bytes32 jobId) external view returns (Job memory) { return _get(jobId); }

    function _providerJob(bytes32 jobId) private view returns (Job storage j) {
        j = _get(jobId);
        ComputeProviderRegistry420.Provider memory p = providers.getProvider(j.providerId);
        if (
            msg.sender != p.operatorAccount
                && !authorization.isJobAuthorized(msg.sender, jobId, ComputeIds420.ACTION_ADVANCE_JOB, 0)
        ) revert Unauthorized();
    }

    function _advance(bytes32 jobId, Job storage j, State from, State to) private {
        if (j.state != from) revert InvalidState();
        _setState(jobId, j, to);
    }

    function _setState(bytes32 jobId, Job storage j, State next) private {
        State previous = j.state;
        j.state = next;
        emit JobStateChanged(jobId, previous, next);
    }

    function _get(bytes32 jobId) private view returns (Job storage j) {
        j = _jobs[jobId];
        if (!j.exists) revert JobNotFound();
    }
}
