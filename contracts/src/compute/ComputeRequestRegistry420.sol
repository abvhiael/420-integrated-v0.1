// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeIds420.sol";

contract ComputeRequestRegistry420 is I420System {
    enum State { NONE, CREATED, FUNDED, MATCHED, CANCELLED, EXPIRED }

    struct Request {
        address requester;
        bytes32 workloadClass;
        bytes32 resourceRequirementId;
        bytes32 inputCommitment;
        uint256 maxSpend420;
        uint64 deadline;
        bytes32 privacyPolicyId;
        bytes32 verificationProfileId;
        bytes32 providerConstraintHash;
        bytes32 fundingRef;
        uint256 fundedAmount;
        uint64 createdAt;
        State state;
        bool exists;
    }

    ComputeAuthorization420 public immutable authorization;
    mapping(bytes32 => Request) private _requests;

    error InvalidRequest();
    error RequestExists();
    error RequestNotFound();
    error Unauthorized();
    error InvalidState();
    error FundingExceedsMaximum();

    event RequestCreated(
        bytes32 indexed requestId,
        address indexed requester,
        bytes32 indexed workloadClass,
        uint256 maxSpend420,
        uint64 deadline
    );
    event RequestFunded(bytes32 indexed requestId, bytes32 fundingRef, uint256 amount);
    event RequestMatched(bytes32 indexed requestId);
    event RequestCancelled(bytes32 indexed requestId);
    event RequestExpired(bytes32 indexed requestId);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert InvalidRequest();
        authorization = ComputeAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "ComputeRequestRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createRequest(
        bytes32 requestId,
        bytes32 workloadClass,
        bytes32 resourceRequirementId,
        bytes32 inputCommitment,
        uint256 maxSpend420,
        uint64 deadline,
        bytes32 privacyPolicyId,
        bytes32 verificationProfileId,
        bytes32 providerConstraintHash
    ) external {
        if (
            requestId == bytes32(0) || !ComputeIds420.isWorkload(workloadClass)
                || resourceRequirementId == bytes32(0) || inputCommitment == bytes32(0)
                || maxSpend420 == 0 || deadline <= block.timestamp
        ) revert InvalidRequest();
        if (_requests[requestId].exists) revert RequestExists();

        _requests[requestId] = Request({
            requester: msg.sender,
            workloadClass: workloadClass,
            resourceRequirementId: resourceRequirementId,
            inputCommitment: inputCommitment,
            maxSpend420: maxSpend420,
            deadline: deadline,
            privacyPolicyId: privacyPolicyId,
            verificationProfileId: verificationProfileId,
            providerConstraintHash: providerConstraintHash,
            fundingRef: bytes32(0),
            fundedAmount: 0,
            createdAt: uint64(block.timestamp),
            state: State.CREATED,
            exists: true
        });
        emit RequestCreated(requestId, msg.sender, workloadClass, maxSpend420, deadline);
    }

    function confirmFunding(bytes32 requestId, bytes32 fundingRef, uint256 amount) external {
        Request storage r = _get(requestId);
        if (r.state != State.CREATED || fundingRef == bytes32(0) || amount == 0 || amount > r.maxSpend420) {
            revert FundingExceedsMaximum();
        }
        if (
            msg.sender != r.requester
                && !authorization.isRequestAuthorized(
                    msg.sender, requestId, ComputeIds420.ACTION_FUND_REQUEST, amount
                )
        ) revert Unauthorized();
        r.fundingRef = fundingRef;
        r.fundedAmount = amount;
        r.state = State.FUNDED;
        emit RequestFunded(requestId, fundingRef, amount);
    }

    function markMatched(bytes32 requestId) external {
        Request storage r = _get(requestId);
        if (r.state != State.FUNDED) revert InvalidState();
        if (
            !authorization.isRequestAuthorized(msg.sender, requestId, ComputeIds420.ACTION_ACCEPT_MATCH, r.fundedAmount)
        ) revert Unauthorized();
        r.state = State.MATCHED;
        emit RequestMatched(requestId);
    }

    function cancel(bytes32 requestId) external {
        Request storage r = _get(requestId);
        if (msg.sender != r.requester) revert Unauthorized();
        if (r.state != State.CREATED) revert InvalidState();
        r.state = State.CANCELLED;
        emit RequestCancelled(requestId);
    }

    function expire(bytes32 requestId) external {
        Request storage r = _get(requestId);
        if (block.timestamp <= r.deadline) revert InvalidRequest();
        if (r.state != State.CREATED && r.state != State.FUNDED) revert InvalidState();
        r.state = State.EXPIRED;
        emit RequestExpired(requestId);
    }

    function getRequest(bytes32 requestId) external view returns (Request memory) { return _get(requestId); }

    function isFunded(bytes32 requestId) external view returns (bool) {
        Request memory r = _requests[requestId];
        return r.exists && r.state == State.FUNDED && block.timestamp <= r.deadline;
    }

    function _get(bytes32 requestId) private view returns (Request storage r) {
        r = _requests[requestId];
        if (!r.exists) revert RequestNotFound();
    }
}
