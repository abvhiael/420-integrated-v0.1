// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/IBridgeAdapter420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/ICanonicalAssetRegistry420.sol";
import "../interfaces/genesis/ISettlementHealth420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./BridgeIds420.sol";

interface IBridgeRiskConsumer420 { function consume(bytes32, bytes32, bool, uint256) external; }
interface IBridgeTransferCreate420 {
    function create(bytes32, bytes32, address, address, uint256, bytes32, bytes32) external returns (bytes32);
}
interface IBridgeRouteRegistryView420 {
    function routes(bytes32) external view returns (bytes32,uint64,uint64,bytes32,bytes32,bytes32,bytes32,uint32,uint8,bool,bool);
}

contract GatewayRouter420 is GenesisResidentAccess420 {
    mapping(bytes32 => address) public adapters;

    event AdapterSet(bytes32 indexed adapterId, address indexed adapter);
    event InboundAccepted(bytes32 indexed transferId, bytes32 indexed adapterId);
    event OutboundInitiated(bytes32 indexed routeId, bytes32 indexed adapterId, bytes32 sourceMessageId);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return BridgeIds420.GATEWAY_ROUTER; }

    function setAdapter(bytes32 id, address adapter) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(id != bytes32(0) && adapter != address(0) && adapter.code.length != 0, "invalid");
        require(IBridgeAdapter420(adapter).adapterId() == id, "adapter id");
        adapters[id] = adapter;
        emit AdapterSet(id, adapter);
    }

    function _requireBridgeAsset(bytes32 assetId) internal view {
        ICanonicalAssetRegistry420 assets = ICanonicalAssetRegistry420(
            _resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY)
        );
        require(assetId != bytes32(0) && assets.isUsable(assetId), "asset unusable");
    }

    function _requireRouteHealthy(bytes32 routeId) internal view {
        ISettlementHealth420 health = ISettlementHealth420(_resolveRequired(GenesisInterfaceIds420.SETTLEMENT_HEALTH));
        require(health.routeHealthy(routeId), "route unhealthy");
    }

    function _requireRouteDirection(bytes32 routeId, bytes32 assetId, bool inbound) internal view {
        (bytes32 configuredAsset,,,,,,,, uint8 status, bool inboundEnabled, bool outboundEnabled) =
            IBridgeRouteRegistryView420(_resolveRequired(BridgeIds420.ROUTE_REGISTRY)).routes(routeId);
        require(status == 2 && configuredAsset == assetId, "inactive route"); // ACTIVE
        require(inbound ? inboundEnabled : outboundEnabled, "direction disabled");
    }

    function acceptInbound(bytes32 adapterId_, bytes calldata proof) external returns (bytes32 transferId) {
        _requireOperational(
            BridgeIds420.ACTION_INBOUND,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        address adapter = adapters[adapterId_];
        require(adapter != address(0) && adapter.code.length != 0, "adapter");
        IBridgeAdapter420.VerifiedTransfer memory v = IBridgeAdapter420(adapter).verifyInbound(proof);
        require(v.sender != address(0) && v.recipient != address(0) && v.amount > 0, "transfer");
        _requireBridgeAsset(v.assetId);
        _requireRouteHealthy(v.routeId);
        _requireRouteDirection(v.routeId, v.assetId, true);

        IBridgeRiskConsumer420(_resolveRequired(BridgeIds420.RISK_MANAGER)).consume(v.routeId, v.assetId, true, v.amount);
        transferId = IBridgeTransferCreate420(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY)).create(
            v.routeId, v.assetId, v.sender, v.recipient, v.amount, v.sourceTxId, v.sourceMessageId
        );
        emit InboundAccepted(transferId, adapterId_);
    }

    function initiateOutbound(
        bytes32 adapterId_,
        bytes32 routeId,
        bytes32 assetId,
        bytes calldata recipient,
        uint256 amount,
        bytes calldata extra
    ) external payable returns (bytes32 sourceMessageId) {
        _requireOperational(
            BridgeIds420.ACTION_OUTBOUND,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.OUTBOUND
        );
        address adapter = adapters[adapterId_];
        require(adapter != address(0) && adapter.code.length != 0, "adapter");
        require(recipient.length != 0 && amount > 0, "transfer");
        _requireBridgeAsset(assetId);
        _requireRouteHealthy(routeId);
        _requireRouteDirection(routeId, assetId, false);
        IBridgeRiskConsumer420(_resolveRequired(BridgeIds420.RISK_MANAGER)).consume(routeId, assetId, false, amount);
        sourceMessageId = IBridgeAdapter420(adapter).initiateOutbound{ value: msg.value }(
            routeId, assetId, msg.sender, recipient, amount, extra
        );
        require(sourceMessageId != bytes32(0), "message id");
        emit OutboundInitiated(routeId, adapterId_, sourceMessageId);
    }
}
