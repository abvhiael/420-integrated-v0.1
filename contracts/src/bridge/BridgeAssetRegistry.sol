// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/ICanonicalAssetRegistry420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./BridgeIds420.sol";

contract BridgeAssetRegistry is GenesisResidentAccess420 {
    enum Status { NONE, APPROVED_INACTIVE, ACTIVE, SUSPENDED }
    struct Asset {
        address localToken;
        bytes32 assetId;
        bytes32 issuerId;
        bytes32 bridgeType;
        bytes32 metadataHash;
        Status status;
        bool canonicalRepresentation;
    }
    mapping(bytes32 => Asset) public assets;
    event AssetSet(bytes32 indexed assetId, address indexed localToken, Status status, bool canonicalRepresentation);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}
    function componentId() public pure override returns (bytes32) { return BridgeIds420.ASSET_REGISTRY; }

    function setAsset(
        bytes32 assetId,
        address localToken,
        bytes32 issuerId,
        bytes32 bridgeType,
        bytes32 metadataHash,
        Status status,
        bool canonicalRepresentation
    ) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(assetId != bytes32(0), "id");
        if (status == Status.ACTIVE) {
            require(localToken != address(0), "token");
            ICanonicalAssetRegistry420 sharedAssets = ICanonicalAssetRegistry420(
                _resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY)
            );
            require(sharedAssets.assetIdOf(localToken) == assetId && sharedAssets.isUsable(assetId), "shared asset");
        }
        assets[assetId] = Asset(localToken, assetId, issuerId, bridgeType, metadataHash, status, canonicalRepresentation);
        emit AssetSet(assetId, localToken, status, canonicalRepresentation);
    }
}
