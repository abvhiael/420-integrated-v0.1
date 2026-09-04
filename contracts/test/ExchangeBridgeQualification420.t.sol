// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeBridgeQualification420.sol";

contract BridgeQualificationAdapter420 is IBridgeAdapter420 {
    function adapterId() external pure returns (bytes32) { return keccak256("bridge/POT/adapter"); }
    function verifyInbound(bytes calldata) external pure returns (VerifiedTransfer memory) { revert("unused"); }
    function initiateOutbound(bytes32,bytes32,address,bytes calldata,uint256,bytes calldata) external payable returns(bytes32) { revert("unused"); }
}

contract BridgeQualificationWrongAdapter420 is IBridgeAdapter420 {
    function adapterId() external pure returns (bytes32) { return keccak256("wrong"); }
    function verifyInbound(bytes calldata) external pure returns (VerifiedTransfer memory) { revert("unused"); }
    function initiateOutbound(bytes32,bytes32,address,bytes calldata,uint256,bytes calldata) external payable returns(bytes32) { revert("unused"); }
}

contract BridgeQualificationExchangeAssets420 {
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
    function set(bytes32 id, Asset calldata a) external { assets[id] = a; }
}

contract BridgeQualificationBridgeAssets420 {
    struct Asset {
        address localToken;
        bytes32 assetId;
        bytes32 issuerId;
        bytes32 bridgeType;
        bytes32 metadataHash;
        BridgeAssetRegistry.Status status;
        bool canonicalRepresentation;
    }
    mapping(bytes32 => Asset) public assets;
    function set(bytes32 id, Asset calldata a) external { assets[id] = a; }
}

contract BridgeQualificationRoutes420 {
    struct Route {
        bytes32 assetId;
        uint64 sourceChainId;
        uint64 destinationChainId;
        bytes32 sourceAsset;
        bytes32 destinationAsset;
        bytes32 adapterId;
        bytes32 verifierConfigHash;
        uint32 version;
        BridgeRouteRegistry.Status status;
        bool inboundEnabled;
        bool outboundEnabled;
    }
    mapping(bytes32 => Route) public routes;
    function set(bytes32 id, Route calldata r) external { routes[id] = r; }
}

contract BridgeQualificationGateway420 {
    mapping(bytes32 => address) public adapters;
    function set(bytes32 id, address adapter) external { adapters[id] = adapter; }
}

contract BridgeQualificationToken420 {}

contract ExchangeBridgeQualification420Test {
    bytes32 private constant EXCHANGE_ASSET = keccak256("exchange/ePOT");
    bytes32 private constant BRIDGE_ASSET = keccak256("bridge/POT");
    bytes32 private constant ROUTE = keccak256("bridge/POT/canonical");
    bytes32 private constant ADAPTER = keccak256("bridge/POT/adapter");
    bytes32 private constant CANONICAL_CHAIN = keccak256("potcoin/canonical");
    bytes32 private constant CANONICAL_ASSET = keccak256("potcoin/native/POT");
    bytes32 private constant PROVENANCE = keccak256("potcoin/canonical/provenance/v1");

    BridgeQualificationExchangeAssets420 private exchangeAssets;
    BridgeQualificationBridgeAssets420 private bridgeAssets;
    BridgeQualificationRoutes420 private routes;
    BridgeQualificationGateway420 private gateway;
    BridgeQualificationAdapter420 private adapter;
    BridgeQualificationToken420 private token;
    ExchangeBridgeQualification420 private qualification;

    constructor() {
        exchangeAssets = new BridgeQualificationExchangeAssets420();
        bridgeAssets = new BridgeQualificationBridgeAssets420();
        routes = new BridgeQualificationRoutes420();
        gateway = new BridgeQualificationGateway420();
        adapter = new BridgeQualificationAdapter420();
        token = new BridgeQualificationToken420();

        qualification = new ExchangeBridgeQualification420(
            address(this), address(exchangeAssets), address(bridgeAssets), address(routes), address(gateway)
        );
        _configureHealthy();
    }

    function testCanonicalQualificationPassesAndRevalidates() public {
        qualification.setQualification(EXCHANGE_ASSET, BRIDGE_ASSET, ROUTE, ADAPTER, PROVENANCE, true, true, true);
        require(qualification.isQualified(EXCHANGE_ASSET), "not qualified");

        ExchangeBridgeQualification420.Qualification memory q = qualification.requireQualified(EXCHANGE_ASSET);
        require(q.bridgeAssetId == BRIDGE_ASSET, "bridge asset");
        require(q.routeId == ROUTE, "route");
        require(q.adapterId == ADAPTER, "adapter");
        require(q.provenanceHash == PROVENANCE, "provenance");
    }

    function testQualificationFailsWhenExchangeVerificationChanges() public {
        qualification.setQualification(EXCHANGE_ASSET, BRIDGE_ASSET, ROUTE, ADAPTER, PROVENANCE, true, true, true);
        _setExchangeAsset(keccak256("changed verification"), 0);
        require(!qualification.isQualified(EXCHANGE_ASSET), "stale verification accepted");
    }

    function testQualificationFailsWhenRouteDirectionCloses() public {
        qualification.setQualification(EXCHANGE_ASSET, BRIDGE_ASSET, ROUTE, ADAPTER, PROVENANCE, true, true, true);
        _setRoute(true, false, ADAPTER, address(token));
        require(!qualification.isQualified(EXCHANGE_ASSET), "closed outbound accepted");
    }

    function testQualificationFailsWhenCanonicalPairChanges() public {
        qualification.setQualification(EXCHANGE_ASSET, BRIDGE_ASSET, ROUTE, ADAPTER, PROVENANCE, true, true, true);
        _setRoute(true, true, ADAPTER, address(0x1234));
        require(!qualification.isQualified(EXCHANGE_ASSET), "wrong representation accepted");
    }

    function testQualificationFailsWhenGatewayAdapterChanges() public {
        qualification.setQualification(EXCHANGE_ASSET, BRIDGE_ASSET, ROUTE, ADAPTER, PROVENANCE, true, true, true);
        BridgeQualificationWrongAdapter420 wrong = new BridgeQualificationWrongAdapter420();
        gateway.set(ADAPTER, address(wrong));
        require(!qualification.isQualified(EXCHANGE_ASSET), "wrong adapter accepted");
    }

    function testCannotActivateWithModeratedExchangeAsset() public {
        _setExchangeAsset(PROVENANCE, 1);
        (bool ok,) = address(qualification).call(
            abi.encodeWithSelector(
                qualification.setQualification.selector,
                EXCHANGE_ASSET,
                BRIDGE_ASSET,
                ROUTE,
                ADAPTER,
                PROVENANCE,
                true,
                true,
                true
            )
        );
        require(!ok, "moderated asset qualified");
    }

    function _configureHealthy() private {
        _setExchangeAsset(PROVENANCE, 0);
        bridgeAssets.set(
            BRIDGE_ASSET,
            BridgeQualificationBridgeAssets420.Asset({
                localToken: address(token),
                assetId: BRIDGE_ASSET,
                issuerId: keccak256("potcoin/issuer"),
                bridgeType: keccak256("canonical-proof"),
                metadataHash: keccak256("bridge metadata"),
                status: BridgeAssetRegistry.Status.ACTIVE,
                canonicalRepresentation: true
            })
        );
        _setRoute(true, true, ADAPTER, address(token));
        gateway.set(ADAPTER, address(adapter));
    }

    function _setExchangeAsset(bytes32 verificationHash, uint256 flags) private {
        exchangeAssets.set(
            EXCHANGE_ASSET,
            BridgeQualificationExchangeAssets420.Asset({
                symbol: bytes16("ePOT"),
                canonicalChain: CANONICAL_CHAIN,
                canonicalAsset: CANONICAL_ASSET,
                exchangeToken: address(token),
                category: ExchangeTypes420.AssetCategory.CANNABIS,
                status: ExchangeTypes420.AssetStatus.VERIFIED,
                verificationHash: verificationHash,
                metadataHash: keccak256("exchange metadata"),
                moderationFlags: flags
            })
        );
    }

    function _setRoute(bool inbound, bool outbound, bytes32 adapterId, address localRepresentation) private {
        routes.set(
            ROUTE,
            BridgeQualificationRoutes420.Route({
                assetId: BRIDGE_ASSET,
                sourceChainId: 42001,
                destinationChainId: uint64(block.chainid),
                sourceAsset: CANONICAL_ASSET,
                destinationAsset: bytes32(uint256(uint160(localRepresentation))),
                adapterId: adapterId,
                verifierConfigHash: keccak256("verifier config"),
                version: 1,
                status: BridgeRouteRegistry.Status.ACTIVE,
                inboundEnabled: inbound,
                outboundEnabled: outbound
            })
        );
    }
}
