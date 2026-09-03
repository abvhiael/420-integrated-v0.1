// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";

contract BetModuleRegistry420 is I420System {
    enum ModuleStatus { NONE, REGISTERED, APPROVED, PAUSED, DEPRECATED }

    struct ModuleVersion {
        bytes32 moduleId;
        bytes32 moduleVersionId;
        address implementation;
        bytes32 manifestHash;
        bytes32 codeHash;
        uint64 registeredAt;
        ModuleStatus status;
        bool exists;
    }

    BetAuthorization420 public immutable authorization;
    mapping(bytes32 => ModuleVersion) private _versions;

    error ZeroAddress();
    error InvalidId();
    error AlreadyExists();
    error NotFound();
    error Unauthorized();
    error InvalidTransition();

    event ModuleRegistered(bytes32 indexed moduleId, bytes32 indexed moduleVersionId, address indexed implementation, bytes32 manifestHash, bytes32 codeHash);
    event ModuleStatusChanged(bytes32 indexed moduleVersionId, ModuleStatus previousStatus, ModuleStatus newStatus);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "BetModuleRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerModule(bytes32 moduleId, bytes32 moduleVersionId, address implementation, bytes32 manifestHash, bytes32 codeHash) external {
        if (moduleId == bytes32(0) || moduleVersionId == bytes32(0)) revert InvalidId();
        if (implementation == address(0)) revert ZeroAddress();
        if (_versions[moduleVersionId].exists) revert AlreadyExists();
        _requireAuth(moduleId, moduleVersionId, BetIds420.ACTION_MODULE_REGISTER);
        _versions[moduleVersionId] = ModuleVersion(moduleId, moduleVersionId, implementation, manifestHash, codeHash, uint64(block.timestamp), ModuleStatus.REGISTERED, true);
        emit ModuleRegistered(moduleId, moduleVersionId, implementation, manifestHash, codeHash);
    }

    function approve(bytes32 moduleVersionId) external { _transition(moduleVersionId, ModuleStatus.REGISTERED, ModuleStatus.APPROVED, BetIds420.ACTION_MODULE_APPROVE); }
    function pause(bytes32 moduleVersionId) external { _transition(moduleVersionId, ModuleStatus.APPROVED, ModuleStatus.PAUSED, BetIds420.ACTION_MODULE_PAUSE); }
    function resume(bytes32 moduleVersionId) external { _transition(moduleVersionId, ModuleStatus.PAUSED, ModuleStatus.APPROVED, BetIds420.ACTION_MODULE_RESUME); }

    function deprecate(bytes32 moduleVersionId) external {
        ModuleVersion storage v = _get(moduleVersionId);
        if (v.status == ModuleStatus.DEPRECATED || v.status == ModuleStatus.NONE) revert InvalidTransition();
        _requireAuth(v.moduleId, v.moduleVersionId, BetIds420.ACTION_MODULE_DEPRECATE);
        ModuleStatus old = v.status;
        v.status = ModuleStatus.DEPRECATED;
        emit ModuleStatusChanged(moduleVersionId, old, ModuleStatus.DEPRECATED);
    }

    function getModule(bytes32 moduleVersionId) external view returns (ModuleVersion memory) { return _get(moduleVersionId); }
    function isApproved(bytes32 moduleVersionId) external view returns (bool) { return _get(moduleVersionId).status == ModuleStatus.APPROVED; }

    function _transition(bytes32 id, ModuleStatus expected, ModuleStatus next, bytes32 action) private {
        ModuleVersion storage v = _get(id);
        if (v.status != expected) revert InvalidTransition();
        _requireAuth(v.moduleId, v.moduleVersionId, action);
        v.status = next;
        emit ModuleStatusChanged(id, expected, next);
    }

    function _get(bytes32 id) private view returns (ModuleVersion storage v) {
        v = _versions[id];
        if (!v.exists) revert NotFound();
    }

    function _requireAuth(bytes32 moduleId, bytes32 moduleVersionId, bytes32 action) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForModule(moduleId, moduleVersionId), 0)) revert Unauthorized();
    }
}
