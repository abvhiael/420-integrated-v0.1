// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeResourceRegistry420.sol";
import "./ComputeAuthorization420.sol";
import "./IComputeAcceptedMatchRuntime420.sol";

/// @notice An explicit owner-proposed, resource-operator-accepted match.
/// @dev This is an admission/identity record, not metering, hardware attestation,
/// capacity reservation, or evidence that a computation has completed.
contract ComputeJobAcceptedMatch420 is IComputeJobMatchEvidence420 {
    bytes32 private constant MATCH_DOMAIN = keccak256("420/COMPUTE/ACCEPTED_MATCH/V1");
    bytes32 private constant ACCEPT_DOMAIN = keccak256("420/COMPUTE/ACCEPTANCE/V1");

    struct Match {
        bytes32 jobId;
        bytes32 requestId;
        bytes32 manifestHash;
        bytes32 resourceId;
        bytes32 providerId;
        bytes32 nodeId;
        uint64 resourceRevision;
        address owner;
        address operator;
        bytes32 acceptanceRef;
        bool exists;
    }

    ComputeJobRegistry420 public jobs;
    ComputeResourceRegistry420 public immutable resources;
    ComputeAuthorization420 public immutable authorization;
    address public immutable bindingAdmin;
    mapping(bytes32 => Match) private _matches;
    mapping(bytes32 => bytes32) public matchForJob;

    error InvalidMatch();
    error Unauthorized();
    event MatchProposed(bytes32 indexed jobId, bytes32 indexed matchId, bytes32 indexed resourceId, address operator);
    event MatchAccepted(bytes32 indexed jobId, bytes32 indexed matchId, bytes32 acceptanceRef);

    constructor(address resources_, address authorization_) {
        if (resources_.code.length == 0 || authorization_.code.length == 0) revert InvalidMatch();
        resources = ComputeResourceRegistry420(resources_);
        authorization = ComputeAuthorization420(authorization_);
        bindingAdmin = msg.sender;
    }

    function bindJobs(address jobs_) external {
        if (msg.sender != bindingAdmin || address(jobs) != address(0) || jobs_.code.length == 0)
            revert Unauthorized();
        if (address(ComputeJobRegistry420(jobs_).matchEvidence()) != address(this)) revert InvalidMatch();
        jobs = ComputeJobRegistry420(jobs_);
    }

    function propose(bytes32 jobId, bytes32 resourceId) external returns (bytes32 matchId) {
        if (address(jobs) == address(0) || matchForJob[jobId] != bytes32(0)
            || !resources.isAvailable(resourceId)) revert InvalidMatch();
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.FUNDED || j.owner != msg.sender
            || j.deadline <= block.timestamp) revert Unauthorized();
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(r.nodeId);
        if (n.providerId != r.providerId || n.operator == address(0)
            || !resources.providers().isOperator(r.providerId, n.operator)) revert InvalidMatch();
        matchId = keccak256(abi.encode(MATCH_DOMAIN, block.chainid, address(this),
            jobId, j.requestId, j.manifestHash, resourceId, r.providerId, r.nodeId,
            r.revision, j.owner, n.operator));
        if (_matches[matchId].exists) revert InvalidMatch();
        _matches[matchId] = Match(jobId, j.requestId, j.manifestHash, resourceId,
            r.providerId, r.nodeId, r.revision, j.owner, n.operator, bytes32(0), true);
        matchForJob[jobId] = matchId;
        emit MatchProposed(jobId, matchId, resourceId, n.operator);
    }

    function matched(bytes32 jobId, bytes32 requestId, bytes32 matchId, bytes32 manifestHash)
        external view returns (bool) {
        Match storage m = _matches[matchId];
        return m.exists && m.jobId == jobId && m.requestId == requestId
            && m.manifestHash == manifestHash && matchForJob[jobId] == matchId && _eligible(m);
    }

    function acceptMatch(bytes32 jobId, uint64 expectedRevision) external returns (bytes32 acceptanceRef) {
        bytes32 matchId = matchForJob[jobId];
        Match storage m = _matches[matchId];
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (!m.exists || j.status != ComputeJobRegistry420.Status.MATCHED
            || j.matchId != matchId || j.revision != expectedRevision
            || j.deadline <= block.timestamp || !_eligible(m)) revert InvalidMatch();
        if (msg.sender != m.operator || !authorization.isAuthorized(msg.sender,
            authorization.ACTION_ACCEPT_MATCH(), authorization.scopeJob(jobId), 0)) revert Unauthorized();
        if (m.acceptanceRef != bytes32(0)) revert InvalidMatch();
        acceptanceRef = keccak256(abi.encode(ACCEPT_DOMAIN, block.chainid, address(this),
            jobId, matchId, m.resourceId, m.resourceRevision, m.operator, expectedRevision));
        m.acceptanceRef = acceptanceRef;
        jobs.recordAcceptance(jobId, expectedRevision, acceptanceRef);
        emit MatchAccepted(jobId, matchId, acceptanceRef);
    }

    function accepted(bytes32 jobId, bytes32 matchId, bytes32 acceptanceRef) external view returns (bool) {
        Match storage m = _matches[matchId];
        return m.exists && m.jobId == jobId && matchForJob[jobId] == matchId
            && acceptanceRef != bytes32(0) && m.acceptanceRef == acceptanceRef && _eligible(m);
    }

    /// @notice Fail closed on a resource revision or node/operator change after acceptance.
    function authorizedResource(bytes32 jobId, bytes32 matchId, bytes32 acceptanceRef,
        bytes32 resourceId, address operator) external view returns (bool) {
        Match storage m = _matches[matchId];
        return m.exists && m.jobId == jobId && matchForJob[jobId] == matchId
            && m.acceptanceRef != bytes32(0) && m.acceptanceRef == acceptanceRef
            && m.resourceId == resourceId && m.operator == operator && _eligible(m);
    }

    function matchParties(bytes32 matchId)
        external view returns (bytes32 jobId, address owner, address operator, bool exists)
    {
        Match storage m = _matches[matchId];
        return (m.jobId, m.owner, m.operator, m.exists);
    }

    function getMatch(bytes32 matchId) external view returns (Match memory m) {
        m = _matches[matchId];
        if (!m.exists) revert InvalidMatch();
    }

    function _eligible(Match storage m) private view returns (bool) {
        if (!resources.isAvailable(m.resourceId)) return false;
        ComputeResourceRegistry420.Resource memory r = resources.resource(m.resourceId);
        if (r.revision != m.resourceRevision || r.providerId != m.providerId || r.nodeId != m.nodeId) return false;
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(m.nodeId);
        return n.providerId == m.providerId && n.operator == m.operator
            && resources.providers().isOperator(m.providerId, m.operator);
    }
}
