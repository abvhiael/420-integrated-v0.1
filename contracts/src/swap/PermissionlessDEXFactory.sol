// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

/// @notice Permissionless market tier. Registration grants no canonical status or oracle eligibility.
contract PermissionlessDEXFactory is GenesisResidentAccess420 {
    struct PoolRecord {
        address creator;
        address token0;
        address token1;
        address pool;
        bytes32 implementationHash;
    }

    mapping(bytes32 => PoolRecord) public pools;
    address public immutable poolImplementation;

    event PermissionlessPoolCreated(
        bytes32 indexed poolId,
        address indexed creator,
        address indexed pool,
        address token0,
        address token1
    );

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_,
        address poolImplementation_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) {
        require(poolImplementation_ != address(0) && poolImplementation_.code.length != 0, "implementation");
        poolImplementation = poolImplementation_;
    }

    function componentId() public pure override returns (bytes32) { return SwapIds420.PERMISSIONLESS_DEX_FACTORY; }

    function registerExistingPool(
        bytes32 poolId,
        address token0,
        address token1,
        address pool,
        bytes32 implementationHash
    ) external {
        _requireOperational(
            SwapIds420.ACTION_REGISTER_POOL,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(poolId != bytes32(0) && pool != address(0) && pool.code.length != 0, "invalid");
        require(token0 != token1 && token0 != address(0) && token1 != address(0), "tokens");
        require(implementationHash != bytes32(0) && pool.codehash == implementationHash, "implementation hash");
        require(pools[poolId].pool == address(0), "exists");
        pools[poolId] = PoolRecord(msg.sender, token0, token1, pool, implementationHash);
        emit PermissionlessPoolCreated(poolId, msg.sender, pool, token0, token1);
    }
}
