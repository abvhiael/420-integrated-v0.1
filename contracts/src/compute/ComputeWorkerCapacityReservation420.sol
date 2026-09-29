// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeWorkerRegistry420.sol";
import "./ComputeResourceRegistry420.sol";

/// @notice CMP-1.3.10 reservation accounting over canonical worker/resource identity.
/// @dev This contract never owns resources, custodies funds, meters work, settles jobs, or mutates
/// ResourceRegistry/WorkerRegistry. One accepted worker attempt consumes exactly one concurrency unit.
contract ComputeWorkerCapacityReservation420 {
    bytes32 public constant RESERVATION_DOMAIN_V1 =
        keccak256("420/COMPUTE/WORKER_CAPACITY_RESERVATION/V1");

    enum Status { NONE, RESERVED, RELEASED, EXPIRED, FAILED }

    struct Reservation {
        bytes32 jobId;
        bytes32 assignmentRef;
        bytes32 workerId;
        uint64 workerRevision;
        bytes32 resourceId;
        uint64 resourceRevision;
        uint64 expectedJobRevision;
        uint64 deadline;
        uint64 reservedAt;
        uint64 closedAt;
        uint64 revision;
        uint256 units;
        uint256 capacityLimit;
        bytes32 transitionRef;
        Status status;
    }

    ComputeWorkerRegistry420 public immutable workers;
    ComputeResourceRegistry420 public immutable resources;
    address public immutable bindingAdmin;
    address public controller;

    mapping(bytes32 => Reservation) private _current;
    mapping(bytes32 => mapping(uint64 => Reservation)) private _history;
    mapping(bytes32 => bytes32) public reservationForJob;

    // Aggregate counters prevent capacity from being recreated by worker/resource revision changes.
    mapping(bytes32 => uint256) public liveResourceUnits;
    mapping(bytes32 => uint256) public liveWorkerUnits;

    // Exact-revision counters preserve reconstructable admission/accounting evidence.
    mapping(bytes32 => mapping(uint64 => uint256)) public liveResourceRevisionUnits;
    mapping(bytes32 => mapping(uint64 => uint256)) public liveWorkerRevisionUnits;

    error InvalidReservation();
    error UnauthorizedController();
    error CapacityExhausted();
    error InvalidTransition();

    event ControllerBound(address indexed controller);
    event CapacityReserved(
        bytes32 indexed reservationId,
        bytes32 indexed jobId,
        bytes32 indexed workerId,
        bytes32 resourceId,
        uint64 workerRevision,
        uint64 resourceRevision,
        uint256 units,
        uint256 capacityLimit
    );
    event CapacityTransition(
        bytes32 indexed reservationId,
        Status indexed previous,
        Status indexed current,
        uint64 previousRevision,
        uint64 currentRevision,
        bytes32 transitionRef
    );

    constructor(address workers_) {
        if (workers_.code.length == 0) revert InvalidReservation();
        workers = ComputeWorkerRegistry420(workers_);
        resources = workers.resources();
        if (address(resources).code.length == 0) revert InvalidReservation();
        bindingAdmin = msg.sender;
    }

    function bindController(address controller_) external {
        if (
            msg.sender != bindingAdmin
                || controller != address(0)
                || controller_.code.length == 0
        ) revert UnauthorizedController();
        controller = controller_;
        emit ControllerBound(controller_);
    }

    function reservation(bytes32 reservationId) external view returns (Reservation memory r) {
        r = _current[reservationId];
        if (r.status == Status.NONE) revert InvalidReservation();
    }

    function revision(bytes32 reservationId, uint64 version) external view returns (Reservation memory r) {
        r = _history[reservationId][version];
        if (r.status == Status.NONE) revert InvalidReservation();
    }

    function isLive(bytes32 reservationId) external view returns (bool) {
        return _current[reservationId].status == Status.RESERVED;
    }

    function deriveReservationId(
        bytes32 jobId,
        bytes32 assignmentRef,
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 resourceId,
        uint64 resourceRevision,
        uint64 expectedJobRevision
    ) public view returns (bytes32) {
        if (
            jobId == bytes32(0)
                || assignmentRef == bytes32(0)
                || workerId == bytes32(0)
                || workerRevision == 0
                || resourceId == bytes32(0)
                || resourceRevision == 0
                || expectedJobRevision == 0
        ) revert InvalidReservation();
        return keccak256(
            abi.encode(
                RESERVATION_DOMAIN_V1,
                block.chainid,
                address(this),
                jobId,
                expectedJobRevision,
                assignmentRef,
                workerId,
                workerRevision,
                resourceId,
                resourceRevision,
                uint256(1)
            )
        );
    }

    function reserve(
        bytes32 jobId,
        bytes32 assignmentRef,
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 resourceId,
        uint64 resourceRevision,
        uint64 expectedJobRevision,
        uint64 deadline
    ) external returns (bytes32 reservationId) {
        _onlyController();
        if (
            jobId == bytes32(0)
                || assignmentRef == bytes32(0)
                || workerId == bytes32(0)
                || workerRevision == 0
                || resourceId == bytes32(0)
                || resourceRevision == 0
                || expectedJobRevision == 0
                || deadline <= block.timestamp
                || reservationForJob[jobId] != bytes32(0)
        ) revert InvalidReservation();

        // Admission must use the exact current eligible worker revision. Historical reservations remain
        // counted after later revisions, but stale revisions cannot create new capacity reservations.
        if (!workers.isEligible(workerId, workerRevision)) revert InvalidReservation();
        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);
        if (w.resourceId != resourceId || w.resourceRevision != resourceRevision) {
            revert InvalidReservation();
        }

        ComputeResourceRegistry420.Resource memory r = resources.revision(resourceId, resourceRevision);
        uint256 capacityLimit = r.capacityUnits;
        if (capacityLimit == 0) revert InvalidReservation();

        // One accepted worker attempt == one concurrency unit.
        uint256 units = 1;
        if (
            liveResourceUnits[resourceId] + units > capacityLimit
                || liveWorkerUnits[workerId] + units > capacityLimit
        ) revert CapacityExhausted();

        reservationId = deriveReservationId(
            jobId,
            assignmentRef,
            workerId,
            workerRevision,
            resourceId,
            resourceRevision,
            expectedJobRevision
        );
        if (_current[reservationId].status != Status.NONE) revert InvalidReservation();

        Reservation memory next = Reservation({
            jobId: jobId,
            assignmentRef: assignmentRef,
            workerId: workerId,
            workerRevision: workerRevision,
            resourceId: resourceId,
            resourceRevision: resourceRevision,
            expectedJobRevision: expectedJobRevision,
            deadline: deadline,
            reservedAt: uint64(block.timestamp),
            closedAt: 0,
            revision: 1,
            units: units,
            capacityLimit: capacityLimit,
            transitionRef: bytes32(0),
            status: Status.RESERVED
        });

        _current[reservationId] = next;
        _history[reservationId][1] = next;
        reservationForJob[jobId] = reservationId;

        liveResourceUnits[resourceId] += units;
        liveWorkerUnits[workerId] += units;
        liveResourceRevisionUnits[resourceId][resourceRevision] += units;
        liveWorkerRevisionUnits[workerId][workerRevision] += units;

        emit CapacityReserved(
            reservationId,
            jobId,
            workerId,
            resourceId,
            workerRevision,
            resourceRevision,
            units,
            capacityLimit
        );
    }

    function release(bytes32 reservationId, bytes32 transitionRef) external {
        _onlyController();
        _transition(reservationId, Status.RELEASED, transitionRef);
    }

    function expire(bytes32 reservationId, bytes32 transitionRef) external {
        _onlyController();
        Reservation memory r = _current[reservationId];
        if (r.status != Status.RESERVED || block.timestamp <= r.deadline) {
            revert InvalidTransition();
        }
        _transition(reservationId, Status.EXPIRED, transitionRef);
    }

    function fail(bytes32 reservationId, bytes32 transitionRef) external {
        _onlyController();
        _transition(reservationId, Status.FAILED, transitionRef);
    }

    function _transition(bytes32 reservationId, Status nextStatus, bytes32 transitionRef) private {
        if (
            nextStatus == Status.NONE
                || nextStatus == Status.RESERVED
                || transitionRef == bytes32(0)
        ) revert InvalidTransition();

        Reservation memory current = _current[reservationId];
        if (current.status != Status.RESERVED || current.revision == type(uint64).max) {
            revert InvalidTransition();
        }

        uint256 units = current.units;
        if (
            liveResourceUnits[current.resourceId] < units
                || liveWorkerUnits[current.workerId] < units
                || liveResourceRevisionUnits[current.resourceId][current.resourceRevision] < units
                || liveWorkerRevisionUnits[current.workerId][current.workerRevision] < units
        ) revert InvalidTransition();

        liveResourceUnits[current.resourceId] -= units;
        liveWorkerUnits[current.workerId] -= units;
        liveResourceRevisionUnits[current.resourceId][current.resourceRevision] -= units;
        liveWorkerRevisionUnits[current.workerId][current.workerRevision] -= units;

        uint64 oldRevision = current.revision;
        current.revision = oldRevision + 1;
        current.closedAt = uint64(block.timestamp);
        current.transitionRef = transitionRef;
        current.status = nextStatus;

        _current[reservationId] = current;
        _history[reservationId][current.revision] = current;

        emit CapacityTransition(
            reservationId,
            Status.RESERVED,
            nextStatus,
            oldRevision,
            current.revision,
            transitionRef
        );
    }

    function _onlyController() private view {
        if (controller == address(0) || msg.sender != controller) revert UnauthorizedController();
    }
}
