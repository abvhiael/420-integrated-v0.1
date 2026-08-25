// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

contract GenesisDEXFactory is GenesisResidentAccess420 {
    mapping(bytes32 => address) public pools;
    address public poolImplementation;

    event PoolImplementationSet(address indexed implementation);
    event PoolRegistered(bytes32 indexed poolId, address indexed pool);

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_,
        address implementation_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) {
        require(implementation_ != address(0) && implementation_.code.length != 0, "implementation");
        poolImplementation = implementation_;
    }

    function componentId() public pure override returns (bytes32) { return SwapIds420.GENESIS_DEX_FACTORY; }

    function setPoolImplementation(address implementation_) external {
        _requireGenesisGovernance(SwapIds420.ACTION_CONFIGURE);
        require(implementation_ != address(0) && implementation_.code.length != 0, "implementation");
        poolImplementation = implementation_;
        emit PoolImplementationSet(implementation_);
    }

    function registerPool(bytes32 poolId, address pool) external {
        _requireGenesisGovernance(SwapIds420.ACTION_REGISTER_POOL);
        _requireOperational(
            SwapIds420.ACTION_REGISTER_POOL,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(poolId != bytes32(0) && pool != address(0) && pool.code.length != 0, "invalid");
        require(pools[poolId] == address(0), "exists");
        pools[poolId] = pool;
        emit PoolRegistered(poolId, pool);
    }
}
