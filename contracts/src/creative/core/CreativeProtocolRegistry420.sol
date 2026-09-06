// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../system/SystemAccess.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

contract CreativeProtocolRegistry420 is SystemAccess, CreativeEvents420 {
    enum ModuleLifecycle { ACTIVE, DEPRECATED, SETTLEMENT_ONLY, ARCHIVED }

    struct ModuleRef {
        address implementation;
        uint32 version;
        ModuleLifecycle lifecycle;
        bytes32 manifestHash;
        uint64 activatedAt;
    }

    mapping(bytes32 => ModuleRef) private _modules;

    constructor(address governanceTimelock_) SystemAccess(governanceTimelock_) {}

    function registerModule(
        bytes32 moduleKey,
        address implementation,
        uint32 version,
        bytes32 manifestHash
    ) external onlyGovernance {
        if (moduleKey == bytes32(0) || implementation == address(0) || version == 0) revert CreativeErrors420.InvalidId();
        _modules[moduleKey] = ModuleRef({
            implementation: implementation,
            version: version,
            lifecycle: ModuleLifecycle.ACTIVE,
            manifestHash: manifestHash,
            activatedAt: uint64(block.timestamp)
        });
        emit CreativeModuleRegistered(moduleKey, implementation, version);
    }

    function setLifecycle(bytes32 moduleKey, ModuleLifecycle lifecycle) external onlyGovernance {
        ModuleRef storage ref = _modules[moduleKey];
        if (ref.implementation == address(0)) revert CreativeErrors420.NotFound();
        ref.lifecycle = lifecycle;
    }

    function module(bytes32 moduleKey) external view returns (ModuleRef memory) {
        return _modules[moduleKey];
    }
}
