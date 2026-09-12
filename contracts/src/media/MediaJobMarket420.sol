// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

interface IMediaOperatorJobs420 {
    function isOperationalFor(bytes32 operatorId, bytes32 capabilityId) external view returns (bool);
    function operatorAccountOf(bytes32 operatorId) external view returns (address);
    function settlementAccountOf(bytes32 operatorId) external view returns (address);
}

interface IMediaSLAJobs420 {
    function isActive(bytes32 policyId) external view returns (bool);
    function hasAttestation(bytes32 jobId) external view returns (bool);
    function passed(bytes32 jobId) external view returns (bool);
    function failed(bytes32 jobId) external view returns (bool);
}

interface IMediaSettlementJobs420 {
    function resolve(bytes32 jobId, bool claimable, bytes32 resolutionRef) external;
}

contract MediaJobMarket420 is SystemAccess, I420System {
    enum Status {
        NONE,
        CREATED,
        ACCEPTED,
        FUNDED,
        RUNNING,
        RESULT_COMMITTED,
        VERIFIED,
        FAILED,
        SETTLED,
        CANCELLED,
        EXPIRED,
        REFUNDED
    }

    struct Job {
        address requester;
        bytes32 streamId;
        bytes32 jobKind;
        bytes32 capabilityId;
        bytes32 slaPolicyId;
        bytes32 inputRef;
        bytes32 outputRef;
        bytes32 operatorId;
        bytes32 fundingRef;
        uint256 maxSpend;
        uint256 fundedAmount;
        uint64 deadline;
        Status status;
    }

    struct CreateParams {
        bytes32 jobId;
        bytes32 streamId;
        bytes32 jobKind;
        bytes32 capabilityId;
        bytes32 slaPolicyId;
        bytes32 inputRef;
        uint256 maxSpend;
        uint64 deadline;
    }

    mapping(bytes32 => Job) public jobs;
    mapping(bytes32 => bytes32) public reservedOperatorId;

    address public operatorRegistry;
    address public slaRegistry;
    address public settlement;
    bool public dependenciesBound;

    error InvalidJob();
    error JobExists();
    error JobNotFound();
    error InvalidTransition();
    error InvalidDeadline();
    error InvalidAmount();
    error InvalidOperator();
    error NotRequester();
    error NotOperator();
    error NotSettlement();
    error InvalidSLA();
    error DependenciesAlreadyBound();
    error MissingAttestation();
    error OperatorReserved();

    event DependenciesBound(address indexed operatorRegistry, address indexed slaRegistry, address indexed settlement);
    event JobCreated(bytes32 indexed jobId, address indexed requester, bytes32 indexed capabilityId, bytes32 streamId, bytes32 jobKind, bytes32 slaPolicyId, uint256 maxSpend, uint64 deadline);
    event JobAssigned(bytes32 indexed jobId, bytes32 indexed operatorId);
    event JobFunded(bytes32 indexed jobId, bytes32 fundingRef, uint256 amount);
    event JobAccepted(bytes32 indexed jobId, bytes32 indexed operatorId, address indexed operatorAccount);
    event JobStatusChanged(bytes32 indexed jobId, Status previousStatus, Status nextStatus);
    event ResultCommitted(bytes32 indexed jobId, bytes32 outputRef);
    event JobResolved(bytes32 indexed jobId, bool slaPassed, bytes32 resolutionRef);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "MediaJobMarket420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindDependencies(address operatorRegistry_, address slaRegistry_, address settlement_) external onlyGovernance {
        if (dependenciesBound) revert DependenciesAlreadyBound();
        if (operatorRegistry_ == address(0) || slaRegistry_ == address(0) || settlement_ == address(0)) revert ZeroAddress();
        operatorRegistry = operatorRegistry_;
        slaRegistry = slaRegistry_;
        settlement = settlement_;
        dependenciesBound = true;
        emit DependenciesBound(operatorRegistry_, slaRegistry_, settlement_);
    }

    function createJob(
        bytes32 jobId,
        bytes32 streamId,
        bytes32 jobKind,
        bytes32 capabilityId,
        bytes32 slaPolicyId,
        bytes32 inputRef,
        uint256 maxSpend,
        uint64 deadline
    ) external {
        CreateParams memory p = CreateParams(jobId, streamId, jobKind, capabilityId, slaPolicyId, inputRef, maxSpend, deadline);
        _createJob(p, bytes32(0));
    }

    function createAssignedJob(
        bytes32 jobId,
        bytes32 streamId,
        bytes32 jobKind,
        bytes32 capabilityId,
        bytes32 slaPolicyId,
        bytes32 inputRef,
        uint256 maxSpend,
        uint64 deadline,
        bytes32 operatorId
    ) external {
        if (operatorId == bytes32(0)) revert InvalidOperator();
        _requireOperational(operatorId, capabilityId);
        CreateParams memory p = CreateParams(jobId, streamId, jobKind, capabilityId, slaPolicyId, inputRef, maxSpend, deadline);
        _createJob(p, operatorId);
    }

    function _requireOperational(bytes32 operatorId, bytes32 capabilityId) private view {
        if (!dependenciesBound) revert InvalidOperator();
        if (!IMediaOperatorJobs420(operatorRegistry).isOperationalFor(operatorId, capabilityId)) revert InvalidOperator();
    }

    function _createJob(CreateParams memory p, bytes32 operatorId) private {
        if (!dependenciesBound) revert InvalidJob();
        if (p.jobId == bytes32(0) || p.jobKind == bytes32(0) || p.capabilityId == bytes32(0) || p.inputRef == bytes32(0) || p.maxSpend == 0) revert InvalidJob();
        if (jobs[p.jobId].status != Status.NONE) revert JobExists();
        if (p.deadline <= block.timestamp) revert InvalidDeadline();
        if (p.slaPolicyId != bytes32(0) && !IMediaSLAJobs420(slaRegistry).isActive(p.slaPolicyId)) revert InvalidSLA();

        Job storage j = jobs[p.jobId];
        j.requester = msg.sender;
        j.streamId = p.streamId;
        j.jobKind = p.jobKind;
        j.capabilityId = p.capabilityId;
        j.slaPolicyId = p.slaPolicyId;
        j.inputRef = p.inputRef;
        j.maxSpend = p.maxSpend;
        j.deadline = p.deadline;
        j.status = Status.CREATED;

        if (operatorId != bytes32(0)) {
            reservedOperatorId[p.jobId] = operatorId;
            emit JobAssigned(p.jobId, operatorId);
        }
        emit JobCreated(p.jobId, msg.sender, p.capabilityId, p.streamId, p.jobKind, p.slaPolicyId, p.maxSpend, p.deadline);
    }

    function acceptJob(bytes32 jobId, bytes32 operatorId) external {
        Job storage j = _get(jobId);
        if (j.status != Status.CREATED) revert InvalidTransition();
        if (block.timestamp > j.deadline) revert InvalidDeadline();
        bytes32 reserved = reservedOperatorId[jobId];
        if (reserved != bytes32(0) && reserved != operatorId) revert OperatorReserved();
        IMediaOperatorJobs420 registry = IMediaOperatorJobs420(operatorRegistry);
        if (!registry.isOperationalFor(operatorId, j.capabilityId)) revert InvalidOperator();
        address operatorAccount = registry.operatorAccountOf(operatorId);
        if (msg.sender != operatorAccount) revert NotOperator();
        j.operatorId = operatorId;
        _setStatus(jobId, j, Status.ACCEPTED);
        emit JobAccepted(jobId, operatorId, operatorAccount);
    }

    function settlementTerms(bytes32 jobId) external view returns (address payer, bytes32 operatorId, address beneficiary, uint256 maxSpend, Status status) {
        Job storage j = _get(jobId);
        payer = j.requester;
        operatorId = j.operatorId;
        maxSpend = j.maxSpend;
        status = j.status;
        if (operatorId != bytes32(0)) beneficiary = IMediaOperatorJobs420(operatorRegistry).settlementAccountOf(operatorId);
    }

    function confirmFunding(bytes32 jobId, bytes32 fundingRef, uint256 amount) external {
        if (!dependenciesBound || msg.sender != settlement) revert NotSettlement();
        Job storage j = _get(jobId);
        if (j.status != Status.ACCEPTED) revert InvalidTransition();
        if (fundingRef == bytes32(0) || amount == 0 || amount > j.maxSpend) revert InvalidAmount();
        j.fundingRef = fundingRef;
        j.fundedAmount = amount;
        _setStatus(jobId, j, Status.FUNDED);
        emit JobFunded(jobId, fundingRef, amount);
    }

    function markRunning(bytes32 jobId) external {
        Job storage j = _operator(jobId);
        if (j.status != Status.FUNDED) revert InvalidTransition();
        if (block.timestamp > j.deadline) revert InvalidDeadline();
        _setStatus(jobId, j, Status.RUNNING);
    }

    function commitResult(bytes32 jobId, bytes32 outputRef) external {
        Job storage j = _operator(jobId);
        if (j.status != Status.RUNNING) revert InvalidTransition();
        if (outputRef == bytes32(0)) revert InvalidJob();
        j.outputRef = outputRef;
        _setStatus(jobId, j, Status.RESULT_COMMITTED);
        emit ResultCommitted(jobId, outputRef);
    }

    function finalize(bytes32 jobId, bytes32 resolutionRef) external {
        Job storage j = _get(jobId);
        if (j.status != Status.RESULT_COMMITTED) revert InvalidTransition();
        if (resolutionRef == bytes32(0)) revert InvalidJob();

        bool pass;
        if (j.slaPolicyId == bytes32(0)) {
            if (msg.sender != j.requester) revert NotRequester();
            pass = true;
        } else {
            IMediaSLAJobs420 sla = IMediaSLAJobs420(slaRegistry);
            if (!sla.hasAttestation(jobId)) revert MissingAttestation();
            if (sla.passed(jobId)) pass = true;
            else if (sla.failed(jobId)) pass = false;
            else revert MissingAttestation();
        }

        _setStatus(jobId, j, pass ? Status.VERIFIED : Status.FAILED);
        IMediaSettlementJobs420(settlement).resolve(jobId, pass, resolutionRef);
        emit JobResolved(jobId, pass, resolutionRef);
    }

    function cancel(bytes32 jobId) external {
        Job storage j = _requester(jobId);
        if (j.status != Status.CREATED) revert InvalidTransition();
        _setStatus(jobId, j, Status.CANCELLED);
    }

    function expire(bytes32 jobId) external {
        Job storage j = _get(jobId);
        if (block.timestamp <= j.deadline) revert InvalidDeadline();
        if (j.status != Status.CREATED && j.status != Status.ACCEPTED && j.status != Status.FUNDED) revert InvalidTransition();
        _setStatus(jobId, j, Status.EXPIRED);
        if (j.fundedAmount != 0) IMediaSettlementJobs420(settlement).resolve(jobId, false, keccak256(abi.encode("MEDIA_EXPIRED", jobId, j.deadline)));
    }

    function confirmSettlement(bytes32 jobId) external {
        if (!dependenciesBound || msg.sender != settlement) revert NotSettlement();
        Job storage j = _get(jobId);
        if (j.status != Status.VERIFIED) revert InvalidTransition();
        _setStatus(jobId, j, Status.SETTLED);
    }

    function confirmRefund(bytes32 jobId) external {
        if (!dependenciesBound || msg.sender != settlement) revert NotSettlement();
        Job storage j = _get(jobId);
        if (j.status != Status.FAILED && j.status != Status.EXPIRED) revert InvalidTransition();
        _setStatus(jobId, j, Status.REFUNDED);
    }

    function _operator(bytes32 jobId) private view returns (Job storage j) {
        j = _get(jobId);
        if (j.operatorId == bytes32(0)) revert InvalidOperator();
        if (msg.sender != IMediaOperatorJobs420(operatorRegistry).operatorAccountOf(j.operatorId)) revert NotOperator();
    }

    function _requester(bytes32 jobId) private view returns (Job storage j) {
        j = _get(jobId);
        if (msg.sender != j.requester) revert NotRequester();
    }

    function _get(bytes32 jobId) private view returns (Job storage j) {
        j = jobs[jobId];
        if (j.status == Status.NONE) revert JobNotFound();
    }

    function _setStatus(bytes32 jobId, Job storage j, Status next) private {
        Status previous = j.status;
        j.status = next;
        emit JobStatusChanged(jobId, previous, next);
    }
}
