// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

/// @notice Governance-controlled registry for Genesis-qualified canonical pool instances.
/// @dev This frozen system contract is registration-only: it does not CREATE/CREATE2 pools.
///      Canonical pool instances are deployed by the qualified deployment process, then explicitly
///      registered here by Genesis governance. `poolImplementation` records the currently approved
///      implementation reference for deployment/provenance after governance binds one; it is not a runtime-codehash equality
///      gate because canonical pools may embed immutable market/executor parameters in runtime code.
contract GenesisDEXFactory is GenesisResidentAccess420 {
    bool public constant REGISTRATION_ONLY = true;

    mapping(bytes32 => address) public pools;
    address public poolImplementation;

    event PoolImplementationSet(address indexed implementation);
    event PoolRegistered(bytes32 indexed poolId, address indexed pool);

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) {}

    function componentId() public pure override returns (bytes32) { return SwapIds420.GENESIS_DEX_FACTORY; }

    function setPoolImplementation(address implementation_) external {
        _requireGenesisGovernance(SwapIds420.ACTION_CONFIGURE);
        require(implementation_ != address(0) && implementation_.code.length != 0, "implementation");
        poolImplementation = implementation_;
        emit PoolImplementationSet(implementation_);
    }

    /// @notice Register an already-deployed, code-bearing canonical pool instance.
    /// @dev Registration is one-shot per poolId and is blocked by shared operational safety.
    function registerPool(bytes32 poolId, address pool) external {
        _requireGenesisGovernance(SwapIds420.ACTION_REGISTER_POOL);
        _requireOperational(
            SwapIds420.ACTION_REGISTER_POOL,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(poolImplementation != address(0), "implementation unset");
        require(poolId != bytes32(0) && pool != address(0) && pool.code.length != 0, "invalid");
        require(pools[poolId] == address(0), "exists");
        pools[poolId] = pool;
        emit PoolRegistered(poolId, pool);
    }
}
