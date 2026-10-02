// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobSignedRequestAuthority420.sol";
import "./ComputeAuthorization420.sol";

/// @notice Requester-owned market constraints anchored to existing requester AND payer consent.
/// @dev Advertises demand only. No debit, custody, reservation, matching or scheduler authority.
contract ComputeRequestRegistry420 is I420System {
    bytes32 public constant REQUEST_DOMAIN = keccak256("420/COMPUTE/MARKET_REQUEST/V1");
    bytes32 public constant COMMITMENT_DOMAIN = keccak256("420/COMPUTE/MARKET_REQUEST_COMMITMENT/V1");
    enum Status { NONE, OPEN, CANCELLED, EXPIRED }
    struct PolicyRef { bytes32 id; uint32 version; bytes32 commitment; }
    struct Terms {
        bytes32 resourceClass;
        bytes32 runtimeHash;
        bytes32 capabilityHash;
        PolicyRef verification;
        PolicyRef privacy;
        bytes32 jurisdictionHash;
        bytes32 dataAccessHash;
        bytes32 partitionPlanHash;
        uint32 partitionCount;
        uint32 replicationFactor;
        uint256 capacityUnits;
        PolicyRef pricing;
        PolicyRef sla;
        uint64 deadline;
        uint64 expiresAt;
        uint256 maximumPrice;
        bytes32 fundingReference;
    }
    struct Request {
        address owner;
        address payer;
        bytes32 signedRequestId;
        bytes32 manifestHash;
        bytes32 workloadType;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        Terms terms;
        uint64 createdAt;
        uint64 revision;
        bytes32 predecessorCommitment;
        Status status;
    }
    struct Delegation { uint64 revision; bool update; bool cancel; uint256 maximumPrice; }
    ComputeJobSignedRequestAuthority420 public immutable signedRequests;
    ComputeAuthorization420 public immutable authorization;
    uint64 public nextRequestNonce;
    mapping(bytes32 => Request) private _requests;
    mapping(bytes32 => mapping(uint64 => Request)) private _history;
    mapping(bytes32 => bool) public signedRequestUsed;
    mapping(bytes32 => mapping(address => bytes32)) public creationApprovals;
    mapping(bytes32 => mapping(address => Delegation)) public delegates;
    error InvalidRequest();
    error Unauthorized();
    error StaleRevision();
    event RequestRevision(bytes32 indexed requestId, address indexed owner, uint64 indexed revision,
        address actor, bytes32 commitment, bytes32 predecessorCommitment, Status status);
    event CreationApproved(bytes32 indexed signedRequestId, address indexed delegate, bytes32 termsHash);
    event DelegateApproved(bytes32 indexed requestId, address indexed delegate, uint64 indexed revision,
        bool update, bool cancel, uint256 maximumPrice);

    constructor(address signedRequests_, address authorization_) {
        if (signedRequests_.code.length == 0 || authorization_.code.length == 0) revert InvalidRequest();
        signedRequests = ComputeJobSignedRequestAuthority420(signedRequests_);
        authorization = ComputeAuthorization420(authorization_);
    }
    function systemName() external pure returns (string memory) { return "ComputeRequestRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice Explicit requester consent to exact creation terms; capability alone cannot impersonate an owner.
    function approveCreation(bytes32 signedRequestId, address delegate, bytes32 termsHash) external {
        if (signedRequests.getRequest(signedRequestId).owner != msg.sender || delegate == address(0)
            || signedRequestUsed[signedRequestId]) revert Unauthorized();
        creationApprovals[signedRequestId][delegate] = termsHash; // zero revokes consent
        emit CreationApproved(signedRequestId, delegate, termsHash);
    }
    function createRequest(bytes32 signedRequestId, Terms calldata terms) external returns (bytes32 requestId) {
        ComputeJobSignedRequestAuthority420.Request memory a = signedRequests.getRequest(signedRequestId);
        if (msg.sender != a.owner && (
            creationApprovals[signedRequestId][msg.sender] != keccak256(abi.encode(terms))
            || !authorization.isAuthorized(msg.sender, authorization.ACTION_CREATE_REQUEST(),
                authorization.scopeRequest(signedRequestId), terms.maximumPrice)
        )) revert Unauthorized();
        if (signedRequestUsed[signedRequestId]) revert InvalidRequest();
        _validate(a, terms);
        uint64 nonce = ++nextRequestNonce;
        requestId = keccak256(abi.encode(REQUEST_DOMAIN, block.chainid, address(this), a.owner, nonce));
        Request storage r = _requests[requestId];
        r.owner = a.owner;
        r.payer = a.payer;
        r.signedRequestId = signedRequestId;
        r.manifestHash = a.manifestHash;
        r.workloadType = a.workloadType;
        r.inputCommitment = a.inputCommitment;
        r.outputSchemaCommitment = a.outputSchemaCommitment;
        r.terms = terms;
        r.createdAt = uint64(block.timestamp);
        r.revision = 1;
        r.status = Status.OPEN;
        signedRequestUsed[signedRequestId] = true;
        _record(requestId, r);
    }

    /// @notice Owner consent AND the shared exact-request capability are required for a delegate.
    /// Grants expire automatically at the next successful revision, including cancellation.
    function approveDelegate(bytes32 requestId, uint64 expectedRevision, address delegate,
        bool update, bool cancel, uint256 maximumPrice) external {
        Request storage r = _guard(requestId, expectedRevision);
        if (msg.sender != r.owner || delegate == address(0) || maximumPrice > r.terms.maximumPrice)
            revert Unauthorized();
        delegates[requestId][delegate] = Delegation(r.revision, update, cancel, maximumPrice);
        emit DelegateApproved(requestId, delegate, r.revision, update, cancel, maximumPrice);
    }
    function updateRequest(bytes32 requestId, uint64 expectedRevision, Terms calldata terms) external {
        Request storage r = _guard(requestId, expectedRevision);
        _authorize(requestId, r, true, terms.maximumPrice);
        // Budget increases need a new separately payer-authorized request/funding action.
        if (terms.maximumPrice > r.terms.maximumPrice) revert InvalidRequest();
        _validate(signedRequests.getRequest(r.signedRequestId), terms);
        bytes32 predecessor = commitment(requestId, r.revision);
        r.terms = terms;
        r.predecessorCommitment = predecessor;
        r.revision++;
        _record(requestId, r);
    }
    function cancelRequest(bytes32 requestId, uint64 expectedRevision) external {
        Request storage r = _requests[requestId];
        if (r.status != Status.OPEN) revert InvalidRequest();
        if (r.revision != expectedRevision) revert StaleRevision();
        _authorize(requestId, r, false, 0);
        _terminate(requestId, r, Status.CANCELLED);
    }
    function expireRequest(bytes32 requestId, uint64 expectedRevision) external {
        Request storage r = _requests[requestId];
        if (r.status != Status.OPEN || block.timestamp < r.terms.expiresAt) revert InvalidRequest();
        if (r.revision != expectedRevision) revert StaleRevision();
        _terminate(requestId, r, Status.EXPIRED);
    }
    function request(bytes32 requestId) external view returns (Request memory r) {
        r = _requests[requestId];
        if (r.status == Status.NONE) revert InvalidRequest();
    }
    function revision(bytes32 requestId, uint64 number) external view returns (Request memory r) {
        r = _history[requestId][number];
        if (r.status == Status.NONE) revert InvalidRequest();
    }
    function commitment(bytes32 requestId, uint64 number) public view returns (bytes32) {
        Request memory r = _history[requestId][number];
        if (r.status == Status.NONE) revert InvalidRequest();
        return keccak256(abi.encode(COMMITMENT_DOMAIN, block.chainid, address(this), requestId, r));
    }
    function isEffective(bytes32 requestId) public view returns (bool) {
        Request storage r = _requests[requestId];
        if (r.status != Status.OPEN || block.timestamp >= r.terms.expiresAt
            || block.timestamp >= r.terms.deadline) return false;
        return signedRequests.validRequest(r.signedRequestId, r.owner, r.signedRequestId,
            r.manifestHash, r.workloadType, r.inputCommitment, r.outputSchemaCommitment,
            signedRequests.getRequest(r.signedRequestId).deadline);
    }
    function _guard(bytes32 id, uint64 expectedRevision) private view returns (Request storage r) {
        r = _requests[id];
        if (!isEffective(id)) revert InvalidRequest();
        if (r.revision != expectedRevision) revert StaleRevision();
    }
    function _authorize(bytes32 id, Request storage r, bool update, uint256 price) private view {
        if (msg.sender == r.owner) return;
        Delegation memory d = delegates[id][msg.sender];
        if (d.revision != r.revision || (update ? !d.update : !d.cancel) || price > d.maximumPrice)
            revert Unauthorized();
        bytes32 action = update ? authorization.ACTION_UPDATE_REQUEST() : authorization.ACTION_CANCEL_REQUEST();
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeRequest(id), price))
            revert Unauthorized();
    }
    function _validate(ComputeJobSignedRequestAuthority420.Request memory a, Terms calldata t) private view {
        if (!a.exists || block.timestamp >= a.deadline || block.timestamp > a.authorizationExpiry
            || t.resourceClass == 0 || t.runtimeHash == 0 || t.capabilityHash == 0
            || t.jurisdictionHash == 0 || t.dataAccessHash == 0 || t.partitionPlanHash == 0
            || t.partitionCount == 0 || t.replicationFactor == 0 || t.capacityUnits == 0
            || t.maximumPrice == 0 || t.maximumPrice > a.maxSpend
            || t.deadline <= block.timestamp || t.deadline > a.deadline
            || t.expiresAt <= block.timestamp || t.expiresAt > t.deadline
            || !_policy(t.verification) || !_policy(t.privacy) || !_policy(t.pricing) || !_policy(t.sla))
            revert InvalidRequest();
        // Checked aggregate plan bounds; no floating-point or implicit per-replica budget.
        uint256 units = uint256(t.partitionCount) * uint256(t.replicationFactor) * t.capacityUnits;
        if (units == 0) revert InvalidRequest();
    }
    function _policy(PolicyRef calldata p) private pure returns (bool) {
        return p.id != 0 && p.version != 0 && p.commitment != 0;
    }
    function _terminate(bytes32 id, Request storage r, Status terminal) private {
        r.predecessorCommitment = commitment(id, r.revision);
        r.revision++;
        r.status = terminal;
        _record(id, r);
    }
    function _record(bytes32 id, Request storage r) private {
        _history[id][r.revision] = r;
        emit RequestRevision(id, r.owner, r.revision, msg.sender, commitment(id, r.revision),
            r.predecessorCommitment, r.status);
    }
}
