// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Frozen catalogue identities; symbols and caller-supplied decimals grant no authority.
library SupportedTokenRoutes420 {
    bytes32 internal constant ETH = keccak256("420/BRIDGE/ETHEREUM/MAINNET/V12.5.4");
    bytes32 internal constant SOL = keccak256("420/BRIDGE/SOLANA/MAINNET/V12.5.2");

    struct Profile {
        bytes32 assetId;
        bytes32 routeId;
        bytes32 sourceAsset;
        uint8 decimals;
        uint64 sourceChainId;
    }
    error UnsupportedToken();

    function profile(bytes32 adapter, bytes32 source) internal pure returns (Profile memory p) {
        string memory symbol;
        string memory network;
        if (adapter == ETH) {
            network = "ETHEREUM";
            p.sourceChainId = 0x4554484d41494e01;
            if (source == bytes32(uint256(uint160(0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998)))) {
                symbol = "AUDIO";
                p.decimals = 18;
            } else if (source == bytes32(uint256(uint160(0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984)))) {
                symbol = "UNI";
                p.decimals = 18;
            } else if (source == bytes32(uint256(uint160(0x514910771AF9Ca656af840dff83E8264EcF986CA)))) {
                symbol = "LINK";
                p.decimals = 18;
            } else if (source == bytes32(uint256(uint160(0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9)))) {
                symbol = "AAVE";
                p.decimals = 18;
            } else if (source == bytes32(uint256(uint160(0xdAC17F958D2ee523a2206206994597C13D831ec7)))) {
                symbol = "USDT";
                p.decimals = 6;
            } else if (source == bytes32(uint256(uint160(0x3Fa142dD3f384414e05E71Ad0939274EdC82EC0A)))) {
                symbol = "QCAD";
                p.decimals = 6;
            } else if (source == bytes32(uint256(uint160(0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c)))) {
                symbol = "EURC";
                p.decimals = 6;
            } else {
                revert UnsupportedToken();
            }
        } else if (adapter == SOL) {
            network = "SOLANA";
            p.sourceChainId = 0x534f4c414e410001;
            p.decimals = 6;
            if (source == 0xfc931a2b58cd23db2d91d296d96505a06f80942083f841e8a887f138ac030437) symbol = "EURC";
            else if (source == 0x37998ccbf2d0458b615cbcc6b1a367c4749e9fef7306622e1b1b58910120bc9a) symbol = "RAY";
            else revert UnsupportedToken();
        } else {
            revert UnsupportedToken();
        }
        p.assetId = keccak256(abi.encodePacked("420/BRIDGE/ASSET/", symbol));
        p.routeId = keccak256(abi.encodePacked("420/BRIDGE/ROUTE/", symbol, "/", network, "/MAINNET"));
        p.sourceAsset = source;
    }

    function convert(uint256 amount, uint8 from, uint8 to) internal pure returns (uint256) {
        if (amount == 0 || from > 77 || to > 77) revert UnsupportedToken();
        if (to >= from) return amount * (10 ** uint256(to - from));
        uint256 divisor = 10 ** uint256(from - to);
        if (amount % divisor != 0) revert UnsupportedToken();
        return amount / divisor;
    }

    function isTokenAsset(bytes32 asset) internal pure returns (bool) {
        return asset == keccak256("420/BRIDGE/ASSET/AUDIO") || asset == keccak256("420/BRIDGE/ASSET/UNI")
            || asset == keccak256("420/BRIDGE/ASSET/LINK") || asset == keccak256("420/BRIDGE/ASSET/AAVE")
            || asset == keccak256("420/BRIDGE/ASSET/USDT") || asset == keccak256("420/BRIDGE/ASSET/QCAD")
            || asset == keccak256("420/BRIDGE/ASSET/EURC") || asset == keccak256("420/BRIDGE/ASSET/RAY")
            || asset == keccak256("420/BRIDGE/ASSET/USDC") || asset == keccak256("420/BRIDGE/ASSET/CADC");
    }
}
