// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../bridge/BridgeAssetRegistry.sol";
import "../bridge/BridgeRouteRegistry.sol";
import "../bridge/GatewayRouter420.sol";
import "../interfaces/IBridgeAdapter420.sol";
import "../system/SystemAccess.sol";
import "./ExchangeAssetRegistry420.sol";
import "./ExchangeTypes420.sol";

/// @notice Binds 420Exchange external-asset listings to canonical 420Bridge provenance.
/// @dev This contract does not execute bridging. It qualifies an Exchange representation only when the
///      Exchange asset, canonical bridge asset, active route, gateway adapter, and canonical identifiers agree.
contract ExchangeBridgeQualification420 is SystemAccess {
    ExchangeAssetRegistry420 public immutable exchangeAssets;
    BridgeAssetRegistry public immutable bridgeAssets;
    BridgeRouteRegistry public immutable bridgeRoutes;
    GatewayRouter420 public immutable gatewayRouter;

    struct Qualification {
        bytes32 bridgeAssetId;
        bytes32 routeId;
        bytes32 adapterId;
        bytes32 provenanceHash;
        bool inboundRequired;
        bool outboundRequired;
        bool active;
    }

    mapping(bytes32 => Qualification) public qualifications;

    error InvalidAddress();
    error InvalidQualification();
    error ExchangeAssetIneligible();
    error BridgeAssetIneligible();
    error RouteIneligible();
    error AdapterMismatch();
    error ProvenanceMismatch();

    event BridgeQualificationSet(
        bytes32 indexed exchangeAssetId,
        bytes32 indexed bridgeAssetId,
        bytes32 indexed routeId,
        bytes32 adapterId,
        bytes32 provenanceHash,
        bool inboundRequired,
        bool outboundRequired,
        bool active
    );

    constructor(
        address governanceTimelock_,
        address exchangeAssets_,
        address bridgeAssets_,
        address bridgeRoutes_,
        address gatewayRouter_
    ) SystemAccess(governanceTimelock_) {
        if (
            exchangeAssets_ == address(0) || exchangeAssets_.code.length == 0 || bridgeAssets_ == address(0)
                || bridgeAssets_.code.length == 0 || bridgeRoutes_ == address(0) || bridgeRoutes_.code.length == 0
                || gatewayRouter_ == address(0) || gatewayRouter_.code.length == 0
        ) revert InvalidAddress();
        exchangeAssets = ExchangeAssetRegistry420(exchangeAssets_);
        bridgeAssets = BridgeAssetRegistry(bridgeAssets_);
        bridgeRoutes = BridgeRouteRegistry(bridgeRoutes_);
        gatewayRouter = GatewayRouter420(gatewayRouter_);
    }

    function setQualification(
        bytes32 exchangeAssetId,
        bytes32 bridgeAssetId,
        bytes32 routeId,
        bytes32 adapterId,
        bytes32 provenanceHash,
        bool inboundRequired,
        bool outboundRequired,
        bool active
    ) external onlyGovernance {
        if (
            exchangeAssetId == bytes32(0) || bridgeAssetId == bytes32(0) || routeId == bytes32(0)
                || adapterId == bytes32(0) || provenanceHash == bytes32(0) || (!inboundRequired && !outboundRequired)
        ) revert InvalidQualification();

        if (active) {
            _requireCanonicalBinding(
                exchangeAssetId,
                bridgeAssetId,
                routeId,
                adapterId,
                provenanceHash,
                inboundRequired,
                outboundRequired
            );
        }

        qualifications[exchangeAssetId] = Qualification({
            bridgeAssetId: bridgeAssetId,
            routeId: routeId,
            adapterId: adapterId,
            provenanceHash: provenanceHash,
            inboundRequired: inboundRequired,
            outboundRequired: outboundRequired,
            active: active
        });

        emit BridgeQualificationSet(
            exchangeAssetId,
            bridgeAssetId,
            routeId,
            adapterId,
            provenanceHash,
            inboundRequired,
            outboundRequired,
            active
        );
    }

    /// @notice Revalidates all live dependencies; qualification is not a stale governance assertion.
    function requireQualified(bytes32 exchangeAssetId) external view returns (Qualification memory q) {
        q = qualifications[exchangeAssetId];
        if (!q.active) revert InvalidQualification();
        _requireCanonicalBinding(
            exchangeAssetId,
            q.bridgeAssetId,
            q.routeId,
            q.adapterId,
            q.provenanceHash,
            q.inboundRequired,
            q.outboundRequired
        );
    }

    function isQualified(bytes32 exchangeAssetId) external view returns (bool) {
        Qualification memory q = qualifications[exchangeAssetId];
        if (!q.active) return false;
        try this.requireQualified(exchangeAssetId) returns (Qualification memory) {
            return true;
        } catch {
            return false;
        }
    }

    function _requireCanonicalBinding(
        bytes32 exchangeAssetId,
        bytes32 bridgeAssetId,
        bytes32 routeId,
        bytes32 adapterId,
        bytes32 provenanceHash,
        bool inboundRequired,
        bool outboundRequired
    ) private view {
        (
            ,
            bytes32 canonicalChain,
            bytes32 canonicalAsset,
            address exchangeToken,
            ,
            ExchangeTypes420.AssetStatus exchangeStatus,
            bytes32 verificationHash,
            ,
            uint256 moderationFlags
        ) = exchangeAssets.assets(exchangeAssetId);

        if (
            exchangeStatus != ExchangeTypes420.AssetStatus.VERIFIED || moderationFlags != 0 || exchangeToken == address(0)
                || canonicalChain == bytes32(0) || canonicalAsset == bytes32(0) || verificationHash == bytes32(0)
                || verificationHash != provenanceHash
        ) revert ExchangeAssetIneligible();

        (
            address localToken,
            bytes32 configuredBridgeAssetId,
            ,
            ,
            bytes32 bridgeMetadataHash,
            BridgeAssetRegistry.Status bridgeStatus,
            bool canonicalRepresentation
        ) = bridgeAssets.assets(bridgeAssetId);

        if (
            bridgeStatus != BridgeAssetRegistry.Status.ACTIVE || !canonicalRepresentation || localToken != exchangeToken
                || configuredBridgeAssetId != bridgeAssetId || bridgeMetadataHash == bytes32(0)
        ) revert BridgeAssetIneligible();

        (
            bytes32 routeAssetId,
            uint64 sourceChainId,
            uint64 destinationChainId,
            bytes32 sourceAsset,
            bytes32 destinationAsset,
            bytes32 configuredAdapterId,
            bytes32 verifierConfigHash,
            uint32 version,
            BridgeRouteRegistry.Status routeStatus,
            bool inboundEnabled,
            bool outboundEnabled
        ) = bridgeRoutes.routes(routeId);

        if (
            routeStatus != BridgeRouteRegistry.Status.ACTIVE || routeAssetId != bridgeAssetId || sourceChainId == destinationChainId
                || version == 0 || verifierConfigHash == bytes32(0) || configuredAdapterId != adapterId
                || (inboundRequired && !inboundEnabled) || (outboundRequired && !outboundEnabled)
        ) revert RouteIneligible();

        bytes32 localAsset = bytes32(uint256(uint160(exchangeToken)));
        bool canonicalToLocal = sourceAsset == canonicalAsset && destinationAsset == localAsset;
        bool localToCanonical = sourceAsset == localAsset && destinationAsset == canonicalAsset;
        if (!canonicalToLocal && !localToCanonical) revert ProvenanceMismatch();

        address adapter = gatewayRouter.adapters(adapterId);
        if (adapter == address(0) || adapter.code.length == 0) revert AdapterMismatch();
        try IBridgeAdapter420(adapter).adapterId() returns (bytes32 reportedId) {
            if (reportedId != adapterId) revert AdapterMismatch();
        } catch {
            revert AdapterMismatch();
        }
    }
}
