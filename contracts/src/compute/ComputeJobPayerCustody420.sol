// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeJobSignedRequestAuthority420.sol";

/// @notice Limited custody gate for CMP-1.1.2: each accepted reservation is
/// a real native-420 transfer made by the signed request's payer, not a pooled
/// Vault accounting entry. Settlement, worker payment, and post-match refunds
/// are deliberately NOT implemented here; they require CMP-1.2 qualification.
contract ComputeJobPayerCustody420 is IComputeJobFundingEvidence420 {
    struct Reservation {
        bytes32 jobId;
        bytes32 requestId;
        address owner;
        address payer;
        address refundRecipient;
        uint256 amount;
        uint256 maximumSpend;
        uint64 deadline;
        bool live;
    }

    ComputeJobSignedRequestAuthority420 public immutable requests;
    ComputeJobRegistry420 public jobs;
    mapping(bytes32 => Reservation) private _reservations;
    uint256 public totalReserved;
    bool private entered;

    error InvalidCustody();
    error UnauthorizedPayer();
    error ReservationExists();
    error FundsLocked();
    error RefundFailed();
    event Reserved(bytes32 indexed jobId, bytes32 indexed requestId, address indexed payer,
        uint256 amount, address refundRecipient);
    event Refunded(bytes32 indexed jobId, address indexed recipient, uint256 amount);

    constructor(address signedRequestAuthority) {
        if (signedRequestAuthority.code.length == 0) revert InvalidCustody();
        requests = ComputeJobSignedRequestAuthority420(signedRequestAuthority);
    }

    /// @dev One-time binding avoids circular constructor dependencies. There is
    /// no privileged method that can create funding receipts without payment.
    function bindJobs(address jobRegistry) external {
        if (address(jobs) != address(0) || jobRegistry.code.length == 0) revert InvalidCustody();
        ComputeJobRegistry420 candidate = ComputeJobRegistry420(jobRegistry);
        if (address(candidate.fundingEvidence()) != address(this)
            || address(candidate.requestEvidence()) != address(requests)) revert InvalidCustody();
        jobs = candidate;
    }

    /// @notice The authorized payer personally transfers native 420 into a
    /// unique reservation. This cannot be funded from a pooled balance, by a
    /// relayer, through a raw receive, or using another job's transfer.
    function reserve(bytes32 jobId) external payable returns (bytes32 fundingRef) {
        if (entered || address(jobs) == address(0)) revert InvalidCustody();
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.CREATED || j.requestId == bytes32(0)
            || j.owner == address(0) || j.deadline <= block.timestamp || msg.value == 0)
            revert InvalidCustody();
        if (_reservations[jobId].amount != 0) revert ReservationExists();
        ComputeJobSignedRequestAuthority420.Request memory r = requests.getRequest(j.requestId);
        (address payer, uint256 ceiling) = requests.fundingTerms(j.requestId);
        if (!r.exists || r.owner != j.owner || r.requestCommitment != j.requestCommitment
            || r.manifestHash != j.manifestHash || r.deadline != j.deadline
            || r.payer != payer || r.maxSpend != ceiling || ceiling == 0
            || msg.value > ceiling || block.timestamp > r.authorizationExpiry) revert InvalidCustody();
        if (msg.sender != payer) revert UnauthorizedPayer();
        _reservations[jobId] = Reservation(jobId, j.requestId, j.owner, payer, payer,
            msg.value, ceiling, j.deadline, true);
        totalReserved += msg.value;
        fundingRef = jobId;
        emit Reserved(jobId, j.requestId, payer, msg.value, payer);
    }

    /// @notice Registry's recordFunding accepts this proof only while the
    /// exact job's native funds remain in custody and its signed cap is met.
    function funded(bytes32 jobId, address owner, bytes32 fundingRef) external view returns (bool) {
        Reservation storage r = _reservations[jobId];
        return address(jobs) != address(0) && fundingRef == jobId && r.live
            && r.jobId == jobId && r.owner == owner && owner != address(0)
            && r.payer != address(0) && r.refundRecipient == r.payer
            && r.amount > 0 && r.amount <= r.maximumSpend
            && totalReserved <= address(this).balance;
    }

    function reservation(bytes32 jobId) external view returns (Reservation memory) {
        return _reservations[jobId];
    }

    /// @notice Before matching, the payer may reclaim funds after the job's
    /// deadline. No early cancellation/third-party recipient is possible.
    /// Once matched, money stays locked until CMP-1.2 defines custody-safe
    /// settlement, cancellation, timeout and dispute evidence.
    function refundExpiredUnmatched(bytes32 jobId) external {
        if (entered || address(jobs) == address(0)) revert InvalidCustody();
        Reservation storage r = _reservations[jobId];
        if (!r.live || r.payer != msg.sender || block.timestamp <= r.deadline)
            revert FundsLocked();
        ComputeJobRegistry420.Status status = jobs.job(jobId).status;
        if (status != ComputeJobRegistry420.Status.CREATED
            && status != ComputeJobRegistry420.Status.FUNDED) revert FundsLocked();
        entered = true;
        uint256 amount = r.amount;
        address recipient = r.refundRecipient;
        r.live = false;
        totalReserved -= amount;
        (bool sent,) = payable(recipient).call{value: amount}("");
        if (!sent) revert RefundFailed();
        entered = false;
        emit Refunded(jobId, recipient, amount);
    }

    receive() external payable { revert InvalidCustody(); }
    fallback() external payable { revert InvalidCustody(); }
}
