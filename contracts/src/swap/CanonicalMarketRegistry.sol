// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

contract CanonicalMarketRegistry is GenesisResidentAccess420 {
    enum Role { NONE, CANONICAL_USD, CANONICAL_CAD, CANONICAL_FX, APPROVED_SECONDARY }

    struct Market {
        address pool;
        address asset0;
        address asset1;
        Role role;
        bytes32 metadataHash;
        bool active;
    }

    mapping(bytes32 => Market) public markets;
    event MarketSet(bytes32 indexed marketId, address indexed pool, Role role, bool active);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return SwapIds420.CANONICAL_MARKET_REGISTRY; }

    function setMarket(
        bytes32 marketId,
        address pool,
        address asset0,
        address asset1,
        Role role,
        bytes32 metadataHash,
        bool active
    ) external {
        _requireGenesisGovernance(SwapIds420.ACTION_REGISTER_MARKET);
        _requireOperational(
            SwapIds420.ACTION_REGISTER_MARKET,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(marketId != bytes32(0) && pool != address(0) && pool.code.length != 0, "invalid");
        require(asset0 != asset1 && asset0 != address(0) && asset1 != address(0), "pair");
        require(role != Role.NONE, "role");
        markets[marketId] = Market(pool, asset0, asset1, role, metadataHash, active);
        emit MarketSet(marketId, pool, role, active);
    }
}
