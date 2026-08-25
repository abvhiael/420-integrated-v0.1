// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IAssetCapabilities420 {
    struct Capabilities {
        bool nativeAsset;
        bool transferExact;
        bool mintBurn;
        bool pausable;
        bool freezable;
        bool rebasing;
        bool feeOnTransfer;
        bool callbacks;
    }

    function capabilities(bytes32 assetId) external view returns(Capabilities memory);
    function eligibleForCanonicalSettlement(bytes32 assetId) external view returns(bool);
}
