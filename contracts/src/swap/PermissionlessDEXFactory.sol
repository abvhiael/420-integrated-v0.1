// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

interface IPermissionlessPoolIntrospection420 {
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/// @notice Permissionless market-registration tier.
/// @dev Anyone may deploy a compatible pool outside this contract and register that existing
///      instance while the shared Swap component is operational. Registration grants no canonical
///      status, oracle eligibility, Wallet-default eligibility or protocol endorsement.
contract PermissionlessDEXFactory is GenesisResidentAccess420 {
    bool public constant REGISTRATION_ONLY = true;

    struct PoolRecord {
        address creator;
        address token0;
        address token1;
        address pool;
        bytes32 implementationHash;
    }

    mapping(bytes32 => PoolRecord) public pools;
    mapping(address => bytes32) public poolIdByAddress;

    /// @notice Reference implementation retained for deployment/provenance discovery.
    /// @dev Permissionless registration does not require runtime equality with this address because
    ///      concrete pools may embed immutable pair/executor/fee parameters in runtime bytecode.
    address public immutable poolImplementation;
    bytes32 public immutable poolImplementationCodeHash;

    event PermissionlessPoolRegistered(
        bytes32 indexed poolId,
        address indexed creator,
        address indexed pool,
        address token0,
        address token1,
        bytes32 implementationHash
    );

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_,
        address poolImplementation_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) {
        require(poolImplementation_ != address(0) && poolImplementation_.code.length != 0, "implementation");
        poolImplementation = poolImplementation_;
        poolImplementationCodeHash = poolImplementation_.codehash;
    }

    function componentId() public pure override returns (bytes32) { return SwapIds420.PERMISSIONLESS_DEX_FACTORY; }

    /// @notice Register an already-deployed permissionless pool.
    /// @param implementationHash Exact current runtime code hash of the submitted pool.
    /// @dev The supplied pair is checked against the pool's own token0/token1 getters. The same
    ///      pool address cannot be registered under multiple IDs. Distinct pools for the same pair
    ///      remain allowed because fee/strategy variants are not canonically restricted here.
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
        require(pools[poolId].pool == address(0), "pool id exists");
        require(poolIdByAddress[pool] == bytes32(0), "pool exists");

        bytes32 actualHash = pool.codehash;
        require(implementationHash != bytes32(0) && actualHash == implementationHash, "implementation hash");

        address actualToken0 = _readPoolToken(pool, IPermissionlessPoolIntrospection420.token0.selector);
        address actualToken1 = _readPoolToken(pool, IPermissionlessPoolIntrospection420.token1.selector);
        require(actualToken0 == token0 && actualToken1 == token1, "pair mismatch");

        pools[poolId] = PoolRecord(msg.sender, token0, token1, pool, actualHash);
        poolIdByAddress[pool] = poolId;

        emit PermissionlessPoolRegistered(poolId, msg.sender, pool, token0, token1, actualHash);
    }

    function _readPoolToken(address pool, bytes4 selector) private view returns (address token) {
        (bool ok, bytes memory data) = pool.staticcall(abi.encodeWithSelector(selector));
        require(ok && data.length == 32, "pair introspection");
        token = abi.decode(data, (address));
        require(token != address(0), "pair token");
    }
}
