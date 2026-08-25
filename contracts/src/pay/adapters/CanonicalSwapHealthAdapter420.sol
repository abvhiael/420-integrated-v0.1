// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/ICanonicalMarketHealth420.sol";
import "../../system/GenesisResidentAccess420.sol";
import "../PayIds420.sol";

/// @notice Legacy compatibility facade over frozen shared settlement-health semantics.
/// @dev This contract has no independent health state; it cannot diverge from shared truth.
contract CanonicalSwapHealthAdapter420 is GenesisResidentAccess420, ICanonicalMarketHealth420 {
    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return PayIds420.SWAP_HEALTH_ADAPTER; }

    function isSettlementAssetActive(address asset) external view returns (bool) {
        _canonicalSettlementAsset(asset);
        return true;
    }

    function isMarketHealthy(bytes32 marketId) external view returns (bool) {
        _requireHealthyMarket(marketId);
        return true;
    }
}
