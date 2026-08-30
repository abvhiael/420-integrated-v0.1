// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

contract GovernanceTimelock {
    enum Class { G1, G2, G3, G4 }

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

    event Scheduled(bytes32 indexed id, address indexed target, Class class_, uint64 executeAfter);
    event Executed(bytes32 indexed id);
    event Cancelled(bytes32 indexed id);
    event CivicAuthorityActivated(address indexed previousScheduler, address indexed civicGovernor);

    constructor(address bootstrapGovernor_) {
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

    function delayFor(Class c) public pure returns (uint64) {
        if (c == Class.G1) return G1_DELAY;
        if (c == Class.G2) return G2_DELAY;
        if (c == Class.G3) return G3_DELAY;
        return G4_DELAY;
    }

    /// @notice Irreversibly transfer scheduling/cancellation authority from bootstrap governance to 420Civic.
    function activateCivicAuthority(address civicGovernor) external onlyBootstrapGovernor {
        require(!civicAuthorityActivated, "already activated");
        require(civicGovernor != address(0) && civicGovernor.code.length != 0, "invalid governor");
        address previous = scheduler;
        scheduler = civicGovernor;
        civicAuthorityActivated = true;
        emit CivicAuthorityActivated(previous, civicGovernor);
    }

    /// @notice Legacy-compatible scheduling surface using the immutable class delay floor.
    function schedule(bytes32 id, address target, uint256 value, bytes calldata data, Class class_)
        external
        onlyScheduler
    {
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

    function cancel(bytes32 id) external onlyScheduler {
        Operation storage op = operations[id];
        require(op.target != address(0) && !op.executed && !op.cancelled, "invalid");
        op.cancelled = true;
        emit Cancelled(id);
    }

    function execute(bytes32 id) external payable returns (bytes memory result) {
        Operation storage op = operations[id];
        require(op.target != address(0), "unknown");
        require(!op.executed && !op.cancelled, "closed");
        require(block.timestamp >= op.executeAfter, "timelocked");
        require(address(this).balance >= op.value, "insufficient balance");

        op.executed = true;
        (bool ok, bytes memory out) = op.target.call{value: op.value}(op.data);
        require(ok, "execution failed");
        emit Executed(id);
        return out;
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

    receive() external payable {}
}
