// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "./BridgeIds420.sol";

/// @notice Canonical identity registry for external networks admitted to 420Bridge.
/// @dev `routeChainId` is the compact identifier stored in BridgeRouteRegistry. `networkId` binds that
///      identifier to a network-specific fingerprint (for example genesis hash/network magic/config hash).
contract BridgeChainRegistry420 is GenesisResidentAccess420 {
    enum ChainFamily { NONE, EVM, SOLANA, UTXO, XRPL, TRON, SHIELDED, CUSTOM }

    struct Chain {
        uint64 routeChainId;
        bytes32 networkId;
        bytes32 nativeAssetId;
        bytes32 verifierFamily;
        ChainFamily family;
        bool active;
    }

    mapping(bytes32 => Chain) public chains;
    mapping(uint64 => bytes32) public chainKeyByRouteId;

    event ChainSet(
        bytes32 indexed chainKey,
        uint64 indexed routeChainId,
        bytes32 networkId,
        bytes32 nativeAssetId,
        bytes32 verifierFamily,
        ChainFamily family,
        bool active
    );

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return BridgeIds420.CHAIN_REGISTRY; }

    function setChain(bytes32 chainKey, Chain calldata c) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(chainKey != bytes32(0), "chain key");
        require(c.routeChainId != 0 && c.networkId != bytes32(0) && c.nativeAssetId != bytes32(0), "identity");
        require(c.verifierFamily != bytes32(0) && c.family != ChainFamily.NONE, "verifier");

        Chain memory previous = chains[chainKey];
        if (previous.routeChainId != 0 && previous.routeChainId != c.routeChainId) {
            if (chainKeyByRouteId[previous.routeChainId] == chainKey) delete chainKeyByRouteId[previous.routeChainId];
        }

        bytes32 existing = chainKeyByRouteId[c.routeChainId];
        require(existing == bytes32(0) || existing == chainKey, "route id bound");

        chains[chainKey] = c;
        chainKeyByRouteId[c.routeChainId] = chainKey;
        emit ChainSet(
            chainKey,
            c.routeChainId,
            c.networkId,
            c.nativeAssetId,
            c.verifierFamily,
            c.family,
            c.active
        );
    }

    function requireActive(bytes32 chainKey) external view returns (Chain memory c) {
        c = chains[chainKey];
        require(c.active && c.routeChainId != 0, "inactive chain");
    }

    function isActiveRoute(bytes32 chainKey, uint64 routeChainId) external view returns (bool) {
        Chain memory c = chains[chainKey];
        return c.active && c.routeChainId == routeChainId && chainKeyByRouteId[routeChainId] == chainKey;
    }
}
