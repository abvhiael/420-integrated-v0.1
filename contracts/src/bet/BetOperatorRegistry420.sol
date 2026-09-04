// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";

contract BetOperatorRegistry420 is I420System {
    enum OperatorStatus { NONE, REGISTERED, ACTIVE, PAUSED, REVOKED }

    struct Operator {
        bytes32 operatorId;
        address operatorAccount;
        bytes32 manifestHash;
        uint64 registeredAt;
        OperatorStatus status;
        bool exists;
    }

    BetAuthorization420 public immutable authorization;
    mapping(bytes32 => Operator) private _operators;
    mapping(address => bytes32) public operatorIdForAccount;

    error ZeroAddress();
    error InvalidId();
    error AlreadyExists();
    error AccountAlreadyRegistered();
    error NotFound();
    error Unauthorized();
    error InvalidTransition();

    event OperatorRegistered(bytes32 indexed operatorId, address indexed operatorAccount, bytes32 manifestHash);
    event OperatorStatusChanged(bytes32 indexed operatorId, OperatorStatus previousStatus, OperatorStatus newStatus);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "BetOperatorRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerOperator(bytes32 operatorId, address operatorAccount, bytes32 manifestHash) external {
        if (operatorId == bytes32(0)) revert InvalidId();
        if (operatorAccount == address(0)) revert ZeroAddress();
        if (_operators[operatorId].exists) revert AlreadyExists();
        if (operatorIdForAccount[operatorAccount] != bytes32(0)) revert AccountAlreadyRegistered();
        _requireAuth(operatorId, BetIds420.ACTION_OPERATOR_REGISTER);
        _operators[operatorId] = Operator(operatorId, operatorAccount, manifestHash, uint64(block.timestamp), OperatorStatus.REGISTERED, true);
        operatorIdForAccount[operatorAccount] = operatorId;
        emit OperatorRegistered(operatorId, operatorAccount, manifestHash);
    }

    function activate(bytes32 operatorId) external { _transition(operatorId, OperatorStatus.REGISTERED, OperatorStatus.ACTIVE, BetIds420.ACTION_OPERATOR_ACTIVATE); }
    function pause(bytes32 operatorId) external { _transition(operatorId, OperatorStatus.ACTIVE, OperatorStatus.PAUSED, BetIds420.ACTION_OPERATOR_PAUSE); }
    function resume(bytes32 operatorId) external { _transition(operatorId, OperatorStatus.PAUSED, OperatorStatus.ACTIVE, BetIds420.ACTION_OPERATOR_RESUME); }

    function revoke(bytes32 operatorId) external {
        Operator storage op = _get(operatorId);
        if (op.status == OperatorStatus.REVOKED || op.status == OperatorStatus.NONE) revert InvalidTransition();
        _requireAuth(operatorId, BetIds420.ACTION_OPERATOR_REVOKE);
        OperatorStatus old = op.status;
        op.status = OperatorStatus.REVOKED;
        emit OperatorStatusChanged(operatorId, old, OperatorStatus.REVOKED);
    }

    function getOperator(bytes32 operatorId) external view returns (Operator memory) { return _get(operatorId); }
    function isActive(bytes32 operatorId) external view returns (bool) { return _get(operatorId).status == OperatorStatus.ACTIVE; }

    function _transition(bytes32 operatorId, OperatorStatus expected, OperatorStatus next, bytes32 action) private {
        Operator storage op = _get(operatorId);
        if (op.status != expected) revert InvalidTransition();
        _requireAuth(operatorId, action);
        op.status = next;
        emit OperatorStatusChanged(operatorId, expected, next);
    }

    function _get(bytes32 operatorId) private view returns (Operator storage op) {
        op = _operators[operatorId];
        if (!op.exists) revert NotFound();
    }

    function _requireAuth(bytes32 operatorId, bytes32 action) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForOperator(operatorId), 0)) revert Unauthorized();
    }
}
