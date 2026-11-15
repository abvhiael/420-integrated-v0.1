// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/ICanonicalAssetRegistry420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./BridgeIds420.sol";
import "./BridgeRouteRegistry.sol";
import "./tokens/SupportedTokenRoutes420.sol";
import "../interfaces/IBridgeAdapter420.sol";

contract BridgeAssetRegistry is GenesisResidentAccess420 {
    enum Status {
        NONE,
        APPROVED_INACTIVE,
        ACTIVE,
        SUSPENDED
    }

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

    function componentId() public pure override returns (bytes32) {
        return BridgeIds420.ASSET_REGISTRY;
    }

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
            ICanonicalAssetRegistry420 sharedAssets =
                ICanonicalAssetRegistry420(_resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY));
            require(sharedAssets.assetIdOf(localToken) == assetId && sharedAssets.isUsable(assetId), "shared asset");
        }
        assets[assetId] =
            Asset(localToken, assetId, issuerId, bridgeType, metadataHash, status, canonicalRepresentation);
        emit AssetSet(assetId, localToken, status, canonicalRepresentation);
    }

    struct TokenRoute {
        bytes32 sourceAsset;
        bytes32 adapterId;
        address adapter;
        address verifier;
        bytes32 gateway;
        bytes32 verifierSnapshot;
        bytes32 evidenceHash;
        uint8 destinationDecimals;
        bool enabled;
    }
    mapping(bytes32 => TokenRoute) public tokenRoutes;
    event TokenRouteSet(bytes32 indexed routeId, bytes32 indexed sourceAsset, bytes32 verifierSnapshot, bool enabled);

    /// @notice Pin actual dependency identities, not a caller's assertion of chain finality.
    function tokenVerifierSnapshot(address verifier, bytes32 adapterId) public view returns (bytes32) {
        require(verifier.code.length != 0, "verifier");
        if (adapterId == keccak256("420/BRIDGE/ETHEREUM/MAINNET/V12.5.4")) {
            address oracle = abi.decode(_tokenRead(verifier, "finalityOracle()"), (address));
            address messages = abi.decode(_tokenRead(verifier, "messageVerifier()"), (address));
            require(oracle.code.length != 0 && messages.code.length != 0, "verifier dependencies");
            return
                keccak256(abi.encode(verifier, verifier.codehash, oracle, oracle.codehash, messages, messages.codehash));
        }
        require(adapterId == keccak256("420/BRIDGE/SOLANA/MAINNET/V12.5.2"), "adapter");
        address quorum = abi.decode(_tokenRead(verifier, "quorum()"), (address));
        require(quorum.code.length != 0, "quorum");
        return keccak256(abi.encode(verifier, verifier.codehash, quorum, quorum.codehash));
    }

    function _tokenRead(address target, string memory signature) private view returns (bytes memory result) {
        (bool ok, bytes memory data) = target.staticcall(abi.encodeWithSignature(signature));
        require(ok && data.length == 32, "verifier profile");
        return data;
    }

    function setTokenRoute(bytes32 routeId, TokenRoute calldata c) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        SupportedTokenRoutes420.Profile memory p = SupportedTokenRoutes420.profile(c.adapterId, c.sourceAsset);
        require(
            routeId == p.routeId && c.adapter.code.length != 0 && c.gateway != 0 && c.evidenceHash != 0
                && c.destinationDecimals <= 77,
            "token config"
        );
        require(IBridgeAdapter420(c.adapter).adapterId() == c.adapterId, "adapter identity");
        require(c.verifierSnapshot == tokenVerifierSnapshot(c.verifier, c.adapterId), "verifier snapshot");
        tokenRoutes[routeId] = c;
        emit TokenRouteSet(routeId, c.sourceAsset, c.verifierSnapshot, c.enabled);
    }

    function qualifyTokenTransfer(
        bytes32 routeId,
        bytes32 assetId,
        bytes32 sourceAsset,
        bytes32 adapterId,
        address verifier,
        bytes32 gateway,
        uint256 amount,
        bool inbound
    ) external view returns (uint256) {
        TokenRoute memory c = tokenRoutes[routeId];
        SupportedTokenRoutes420.Profile memory p = SupportedTokenRoutes420.profile(adapterId, sourceAsset);
        require(
            c.enabled && msg.sender == c.adapter && c.adapterId == adapterId && c.sourceAsset == sourceAsset
                && p.routeId == routeId && p.assetId == assetId,
            "token route"
        );
        require(
            c.verifier == verifier && c.verifierSnapshot == tokenVerifierSnapshot(verifier, adapterId), "verifier drift"
        );
        require(!inbound || gateway == c.gateway, "token gateway");
        Asset memory a = assets[assetId];
        require(a.status == Status.ACTIVE && a.localToken.code.length != 0, "bridge asset");
        ICanonicalAssetRegistry420 shared =
            ICanonicalAssetRegistry420(_resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY));
        Types420.AssetRef memory local = shared.asset(assetId);
        require(
            shared.isUsable(assetId) && shared.assetIdOf(a.localToken) == assetId && local.token == a.localToken
                && local.assetId == assetId && local.decimals == c.destinationDecimals,
            "destination asset"
        );
        (bool ok, bytes memory dec) = a.localToken.staticcall(abi.encodeWithSignature("decimals()"));
        require(ok && dec.length == 32 && abi.decode(dec, (uint256)) == c.destinationDecimals, "destination decimals");
        BridgeRouteRegistry routes = BridgeRouteRegistry(_resolveRequired(BridgeIds420.ROUTE_REGISTRY));
        (
            bytes32 rid,
            uint64 sourceChain,
            uint64 destChain,
            bytes32 src,
            bytes32 dst,
            bytes32 adapter_,
            bytes32 config,,
            BridgeRouteRegistry.Status status,
            bool in_,
            bool out_
        ) = routes.routes(routeId);
        require(
            status == BridgeRouteRegistry.Status.ACTIVE && rid == assetId && sourceChain == p.sourceChainId
                && destChain == block.chainid && src == sourceAsset && dst == bytes32(uint256(uint160(a.localToken)))
                && adapter_ == adapterId && config == c.verifierSnapshot && (inbound ? in_ : out_),
            "registry route"
        );
        routes.requireRouteChainsCurrent(routeId);
        uint256 converted = inbound
            ? SupportedTokenRoutes420.convert(amount, p.decimals, c.destinationDecimals)
            : SupportedTokenRoutes420.convert(amount, c.destinationDecimals, p.decimals);
        if (adapterId == keccak256("420/BRIDGE/SOLANA/MAINNET/V12.5.2")) {
            require((inbound ? amount : converted) <= type(uint64).max, "SPL amount width");
        }
        return converted;
    }
}
