// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "./ExchangeTypes420.sol";

contract ExchangeAssetRegistry420 is SystemAccess {
    struct Asset {
        bytes16 symbol;
        bytes32 canonicalChain;
        bytes32 canonicalAsset;
        address exchangeToken;
        ExchangeTypes420.AssetCategory category;
        ExchangeTypes420.AssetStatus status;
        bytes32 verificationHash;
        bytes32 metadataHash;
        uint256 moderationFlags;
    }

    mapping(bytes32 => Asset) public assets;

    event AssetConfigured(
        bytes32 indexed assetId,
        bytes16 indexed symbol,
        ExchangeTypes420.AssetCategory category,
        ExchangeTypes420.AssetStatus status,
        address exchangeToken
    );
    event AssetStatusChanged(bytes32 indexed assetId, ExchangeTypes420.AssetStatus oldStatus, ExchangeTypes420.AssetStatus newStatus);
    event AssetModerated(bytes32 indexed assetId, ExchangeTypes420.ModerationReason reason, bytes32 evidenceHash, uint256 moderationFlags);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function configureAsset(
        bytes32 assetId,
        bytes16 symbol,
        bytes32 canonicalChain,
        bytes32 canonicalAsset,
        address exchangeToken,
        ExchangeTypes420.AssetCategory category,
        ExchangeTypes420.AssetStatus status,
        bytes32 verificationHash,
        bytes32 metadataHash
    ) external onlyGovernance {
        require(assetId != bytes32(0), "asset id");
        require(symbol != bytes16(0), "symbol");
        require(category != ExchangeTypes420.AssetCategory.NONE, "category");
        require(status != ExchangeTypes420.AssetStatus.NONE, "status");
        if (status == ExchangeTypes420.AssetStatus.VERIFIED) {
            require(verificationHash != bytes32(0), "verification");
        }

        uint256 flags = assets[assetId].moderationFlags;
        assets[assetId] = Asset({
            symbol: symbol,
            canonicalChain: canonicalChain,
            canonicalAsset: canonicalAsset,
            exchangeToken: exchangeToken,
            category: category,
            status: status,
            verificationHash: verificationHash,
            metadataHash: metadataHash,
            moderationFlags: flags
        });

        emit AssetConfigured(assetId, symbol, category, status, exchangeToken);
    }

    function setStatus(bytes32 assetId, ExchangeTypes420.AssetStatus newStatus) external onlyGovernance {
        Asset storage asset = assets[assetId];
        require(asset.status != ExchangeTypes420.AssetStatus.NONE, "unknown asset");
        require(newStatus != ExchangeTypes420.AssetStatus.NONE, "status");
        if (newStatus == ExchangeTypes420.AssetStatus.VERIFIED) {
            require(asset.verificationHash != bytes32(0), "verification");
        }
        ExchangeTypes420.AssetStatus oldStatus = asset.status;
        asset.status = newStatus;
        emit AssetStatusChanged(assetId, oldStatus, newStatus);
    }

    function moderate(
        bytes32 assetId,
        ExchangeTypes420.ModerationReason reason,
        bytes32 evidenceHash,
        bool suspend
    ) external onlyGovernance {
        Asset storage asset = assets[assetId];
        require(asset.status != ExchangeTypes420.AssetStatus.NONE, "unknown asset");
        require(reason != ExchangeTypes420.ModerationReason.NONE, "reason");
        uint256 flag = uint256(1) << uint8(reason);
        asset.moderationFlags |= flag;
        if (suspend && asset.status != ExchangeTypes420.AssetStatus.DELISTED) {
            asset.status = ExchangeTypes420.AssetStatus.SUSPENDED;
        }
        emit AssetModerated(assetId, reason, evidenceHash, asset.moderationFlags);
    }

    function isVerified(bytes32 assetId) external view returns (bool) {
        return assets[assetId].status == ExchangeTypes420.AssetStatus.VERIFIED;
    }

    function isTradeEligible(bytes32 assetId) external view returns (bool) {
        Asset storage asset = assets[assetId];
        return asset.status == ExchangeTypes420.AssetStatus.VERIFIED && asset.moderationFlags == 0;
    }
}
