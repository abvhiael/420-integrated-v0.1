// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

contract GovernanceTimelock {
    enum Class {
        G1,
        G2,
        G3,
        G4
    }

    address public immutable bootstrapGovernor;
    address public scheduler;
    bool public civicAuthorityActivated;

    uint64 public constant G1_DELAY = 7 days;
    uint64 public constant G2_DELAY = 14 days;
    uint64 public constant G3_DELAY = 14 days;
    uint64 public constant G4_DELAY = 42 days;

    struct Operation {
        address target;
        uint256 value;
        bytes data;
        uint64 executeAfter;
        Class class_;
        bool executed;
        bool cancelled;
    }

    mapping(bytes32 => Operation) public operations;

    // Historical storage slots are reserved verbatim for predeploy layout compatibility.
    // Runtime execution context must never depend on restoring persistent state after
    // calling a foreign action: Cancun EIP-1153 transaction-local slots hold the
    // live Civic operation and the cross-proposal execution lock instead.
    bytes32 private _legacyExecutingCivicOperation;
    bool private _legacyOperationExecuting;
    bytes32 private constant _CIVIC_CONTEXT_SLOT = keccak256("420/GOV/TIMELOCK/ACTIVE_CIVIC_OPERATION/TRANSIENT/V1");
    bytes32 private constant _EXECUTION_LOCK_SLOT = keccak256("420/GOV/TIMELOCK/EXECUTION_LOCK/TRANSIENT/V1");

    function executingCivicOperation() public view returns (bytes32 operation) {
        bytes32 slot = _CIVIC_CONTEXT_SLOT;
        assembly { operation := tload(slot) }
    }

    function _operationIsExecuting() private view returns (bool locked) {
        bytes32 slot = _EXECUTION_LOCK_SLOT;
        assembly { locked := iszero(iszero(tload(slot))) }
    }

    function _setOperationExecuting(
        bool executing
    ) private {
        bytes32 slot = _EXECUTION_LOCK_SLOT;
        assembly { tstore(slot, executing) }
    }

    function _setCivicContext(
        bytes32 id
    ) private {
        bytes32 slot = _CIVIC_CONTEXT_SLOT;
        assembly { tstore(slot, id) }
    }

    error ReentrantOperation();

    event Scheduled(bytes32 indexed id, address indexed target, Class class_, uint64 executeAfter);
    event Executed(bytes32 indexed id);
    event Cancelled(bytes32 indexed id);
    event CivicAuthorityActivated(address indexed previousScheduler, address indexed civicGovernor);

    constructor(
        address bootstrapGovernor_
    ) {
        require(bootstrapGovernor_ != address(0), "zero governor");
        bootstrapGovernor = bootstrapGovernor_;
        scheduler = bootstrapGovernor_;
    }

    modifier onlyBootstrapGovernor() {
        require(msg.sender == bootstrapGovernor, "unauthorized");
        _;
    }

    modifier onlyScheduler() {
        require(msg.sender == scheduler, "unauthorized");
        _;
    }

    function delayFor(
        Class c
    ) public pure returns (uint64) {
        if (c == Class.G1) return G1_DELAY;
        if (c == Class.G2) return G2_DELAY;
        if (c == Class.G3) return G3_DELAY;
        return G4_DELAY;
    }

    /// @notice Irreversibly transfer scheduling authority from bootstrap governance to 420Civic.
    /// @dev Civic v1 proposal cancellation is intentionally unsupported; bootstrap cancellation retires here.
    function activateCivicAuthority(
        address civicGovernor
    ) external onlyBootstrapGovernor {
        require(!civicAuthorityActivated, "already activated");
        require(_isCanonicalCivicGovernor(civicGovernor), "invalid governor");
        address previous = scheduler;
        scheduler = civicGovernor;
        civicAuthorityActivated = true;
        emit CivicAuthorityActivated(previous, civicGovernor);
    }

    function _isCanonicalCivicGovernor(
        address civicGovernor
    ) private view returns (bool) {
        if (civicGovernor == address(0) || civicGovernor.code.length == 0) return false;
        (bool ok, bytes memory data) = civicGovernor.staticcall(abi.encodeWithSignature("timelock()"));
        return ok && data.length >= 32 && abi.decode(data, (address)) == address(this);
    }

    /// @notice Legacy-compatible scheduling surface using the immutable class delay floor.
    function schedule(
        bytes32 id,
        address target,
        uint256 value,
        bytes calldata data,
        Class class_
    ) external onlyScheduler {
        _schedule(id, target, value, data, class_, delayFor(class_));
    }

    /// @notice Schedule with the proposal's frozen constitutional delay, never below the class floor.
    function scheduleWithDelay(
        bytes32 id,
        address target,
        uint256 value,
        bytes calldata data,
        Class class_,
        uint64 requestedDelay
    ) external onlyScheduler {
        require(requestedDelay >= delayFor(class_), "delay below floor");
        _schedule(id, target, value, data, class_, requestedDelay);
    }

    /// @notice Cancel a legacy/bootstrap operation before Civic authority activation.
    /// @dev Civic v1 proposals are immutable after creation; no post-activation cancellation authority exists.
    function cancel(
        bytes32 id
    ) external onlyBootstrapGovernor {
        require(!civicAuthorityActivated, "civic active");
        Operation storage op = operations[id];
        require(op.target != address(0) && !op.executed && !op.cancelled, "invalid");
        op.cancelled = true;
        emit Cancelled(id);
    }

    function execute(
        bytes32 id
    ) external payable returns (bytes memory result) {
        if (_operationIsExecuting()) revert ReentrantOperation();
        _setOperationExecuting(true);
        Operation storage op = operations[id];
        require(op.target != address(0), "unknown");
        require(!op.executed && !op.cancelled, "closed");
        require(block.timestamp >= op.executeAfter, "timelocked");
        require(address(this).balance >= op.value, "insufficient balance");

        op.executed = true;
        bytes32 previousOperation = executingCivicOperation();
        _setCivicContext(civicAuthorityActivated && op.target == scheduler ? id : bytes32(0));
        (bool ok, bytes memory out) = op.target.call{ value: op.value }(op.data);
        _setCivicContext(previousOperation);
        require(ok, "execution failed");
        _setOperationExecuting(false);
        emit Executed(id);
        return out;
    }

    /// @notice Dispatch one committed action from an executing Civic batch as the canonical Timelock.
    /// @dev The Governor verifies the exact batch hash, value and proposal state. Suspend the context while
    /// calling the target so neither a callback nor an action targeting the Governor can reuse it.
    function executeCivicAction(
        bytes32 id,
        address target,
        bytes calldata data
    ) external payable returns (bool success) {
        require(civicAuthorityActivated && msg.sender == scheduler, "unauthorized");
        require(id != bytes32(0) && executingCivicOperation() == id, "not executing civic operation");
        require(target != address(0), "target");
        _setCivicContext(bytes32(0));
        (success,) = target.call{ value: msg.value }(data);
        _setCivicContext(id);
    }

    function _schedule(
        bytes32 id,
        address target,
        uint256 value,
        bytes calldata data,
        Class class_,
        uint64 delay
    ) private {
        require(operations[id].target == address(0), "exists");
        require(target != address(0), "target");
        require(block.timestamp <= type(uint64).max - delay, "timestamp overflow");
        uint64 executeAfter = uint64(block.timestamp) + delay;
        operations[id] = Operation(target, value, data, executeAfter, class_, false, false);
        emit Scheduled(id, target, class_, executeAfter);
    }

    receive() external payable { }
}
