// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/IBridgeAdapter420.sol";
import "../interfaces/IBridgeSettlementEvidence420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/ICanonicalAssetRegistry420.sol";
import "../interfaces/genesis/ISettlementHealth420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./BridgeIds420.sol";
import "./BridgeProofEnvelope420.sol";
import "../interfaces/IBridgeVerifiedSourceContext420.sol";
import "./BridgeVerifierRegistry420.sol";
import "../interfaces/IBridgeValueCustody420.sol";
import "../interfaces/IBridgeExposureEvidence420.sol";
import "./BridgeRiskManager.sol";
import "./BridgeTransferRegistry.sol";

interface IBridgeRiskConsumer420 { function consume(bytes32, bytes32, bool, uint256) external; }
interface IBridgeAccountingHealth420 { function movementHealthy(bytes32) external view returns (bool); }
interface IBridgeTransferCreate420 {
    function create(bytes32, bytes32, address, address, uint256, bytes32, bytes32) external returns (bytes32);
    function createOutbound(bytes32, bytes32, address, bytes32, uint256, bytes32) external returns (bytes32);
    function markSourcePending(bytes32, bytes32) external;
    function markSourceFinalized(bytes32, bytes32) external;
    function markProofPending(bytes32, bytes32) external;
    function markVerified(bytes32, bytes32) external;
    function markDestinationPending(bytes32,bytes32) external;
    function markCompleted(bytes32,bytes32) external;
    function transferDirection(bytes32) external view returns(uint8);
    function transfers(bytes32) external view returns(bytes32,bytes32,address,address,uint256,bytes32,bytes32,uint8,uint64,uint64);
}
interface IBridgeRouteRegistryView420 {
    function routes(bytes32) external view returns (bytes32,uint64,uint64,bytes32,bytes32,bytes32,bytes32,uint32,uint8,bool,bool);
    function chainBindings(bytes32) external view returns(bytes32,bytes32,bytes32,bytes32);
    function requireRouteChainsCurrent(bytes32) external view;
    function requireRouteVerifierCurrent(bytes32) external view;
}

contract GatewayRouter420 is GenesisResidentAccess420 {
    mapping(bytes32 => address) public adapters;
    mapping(bytes32 => bool) public consumedSourceMessages;
    mapping(bytes32=>bool) public consumedOutboundMessages;
    mapping(bytes32=>bytes32) public sourceKeyForTransfer;

    event AdapterSet(bytes32 indexed adapterId, address indexed adapter);
    event InboundAccepted(bytes32 indexed transferId, bytes32 indexed adapterId);
    event OutboundInitiated(bytes32 indexed routeId, bytes32 indexed adapterId, bytes32 sourceMessageId);
    event OutboundTransferRegistered(bytes32 indexed transferId, bytes32 indexed routeId, bytes32 sourceMessageId);

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

    function _requireAccountingHealthy(bytes32 assetId) internal view {
        IBridgeAccountingHealth420 accounting =
            IBridgeAccountingHealth420(_resolveRequired(BridgeIds420.ACCOUNTING_REGISTRY));
        require(accounting.movementHealthy(assetId), "accounting unhealthy");
    }

    function _requireRouteDirection(
        bytes32 routeId,
        bytes32 assetId,
        bytes32 adapterId_,
        bool inbound
    ) internal view {
        IBridgeRouteRegistryView420 routes =
            IBridgeRouteRegistryView420(_resolveRequired(BridgeIds420.ROUTE_REGISTRY));
        (bytes32 configuredAsset,,,,, bytes32 configuredAdapter,,, uint8 status, bool inboundEnabled, bool outboundEnabled) =
            routes.routes(routeId);
        require(status == 2 && configuredAsset == assetId, "inactive route"); // ACTIVE
        require(configuredAdapter == adapterId_, "route adapter");
        require(inbound ? inboundEnabled : outboundEnabled, "direction disabled");
        routes.requireRouteChainsCurrent(routeId);
        routes.requireRouteVerifierCurrent(routeId);
    }

    /// @notice Stable across verifier/approval/registry and canonical chain-key replacement.
    /// @notice Reuse canonical outbound safety/asset/route/qualification checks before custody signing.
    /// This observational guard never consumes risk, creates a transfer, burns or authorizes payment.
    function requireOutboundSigningAdmission(bytes32 adapterId_,bytes32 routeId,bytes32 assetId) external view returns(bytes32) {
        _requireOperational(BridgeIds420.ACTION_OUTBOUND,ISystemSafety420.ActionClass.NORMAL_ONLY,Types420.Direction.OUTBOUND);
        _requireBridgeAsset(assetId);_requireRouteHealthy(routeId);_requireAccountingHealthy(assetId);
        _requireRouteDirection(routeId,assetId,adapterId_,false);
        return BridgeVerifierRegistry420(_resolveRequired(BridgeIds420.VERIFIER_REGISTRY)).requireCurrent(adapters[adapterId_]);
    }

    function sourceReplayKey(bytes32 network,bytes32 message) public pure returns(bytes32){
        require(network!=0 && message!=0,"source identity");
        return keccak256(abi.encode("420/BRIDGE/SOURCE_MESSAGE/V1",network,message));
    }
    function acceptInbound(bytes32 adapterId_, bytes calldata proof) external returns (bytes32 transferId) {return _acceptInbound(adapterId_,proof);}
    /// @notice Atomic verification, native adapter delivery and authorized lifecycle completion.
    function acceptInboundAndSettle(bytes32 adapterId_,bytes calldata proof) external returns(bytes32 transferId){
        transferId=_acceptInbound(adapterId_,proof);_completeInbound(transferId);
    }
    /// @notice Complete a previously accepted native-delivery receipt without minting or consuming risk twice.
    function completeInboundSettlement(bytes32 transferId) external {_completeInbound(transferId);}
    event InboundSettled(bytes32 indexed transferId,bytes32 indexed evidenceHash,address indexed token,uint256 amount);
    function _completeInbound(bytes32 transferId) private {
        _requireOperational(BridgeIds420.ACTION_INBOUND,ISystemSafety420.ActionClass.NORMAL_ONLY,Types420.Direction.INBOUND);
        IBridgeTransferCreate420 transfers_=IBridgeTransferCreate420(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY));
        (bytes32 route,bytes32 asset,,address recipient,uint256 amount,,bytes32 message,uint8 status,,)=transfers_.transfers(transferId);
        require(transfers_.transferDirection(transferId)==1 && (status==5 || status==6),"settlement state");
        _requireBridgeAsset(asset);_requireRouteHealthy(route);_requireAccountingHealthy(asset);
        (,,,,,bytes32 adapterId_,,,,,)=IBridgeRouteRegistryView420(_resolveRequired(BridgeIds420.ROUTE_REGISTRY)).routes(route);
        _requireRouteDirection(route,asset,adapterId_,true);
        address token;address deliveredTo;uint256 delivered;bytes32 evidence;
        try IBridgeSettlementEvidence420(adapters[adapterId_]).settlementEvidence(message) returns(address t,address to,uint256 value,bytes32 e){token=t;deliveredTo=to;delivered=value;evidence=e;}catch{}
        if(evidence==0){evidence=_qualifiedValueCustody().settleInbound(transferId);token=ICanonicalAssetRegistry420(_resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY)).asset(asset).token;deliveredTo=recipient;delivered=amount;}
        ICanonicalAssetRegistry420 assets=ICanonicalAssetRegistry420(_resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY));
        require(evidence!=0 && token==assets.asset(asset).token && recipient==deliveredTo && amount==delivered,"settlement receipt");
        if(status==5)transfers_.markDestinationPending(transferId,evidence);
        transfers_.markCompleted(transferId,evidence);
        BridgeRiskManager(_resolveRequired(BridgeIds420.RISK_MANAGER)).completeInbound(transferId);
        _requireRouteDirection(route,asset,adapterId_,true);
        emit InboundSettled(transferId,evidence,token,amount);
    }
    function _requireProofRouteDomain(BridgeProofEnvelope420.Envelope memory e) internal view {
        IBridgeRouteRegistryView420 routeRegistry =
            IBridgeRouteRegistryView420(_resolveRequired(BridgeIds420.ROUTE_REGISTRY));
        (
            bytes32 configuredAsset,
            uint64 sourceChain,
            uint64 destinationChain,
            bytes32 configuredSourceAsset,
            ,
            bytes32 configuredAdapter,
            bytes32 configuredVerifierHash,
            ,
            ,
            ,
        ) = routeRegistry.routes(e.routeId);
        (,bytes32 sourceNetwork,,bytes32 destinationNetwork) = routeRegistry.chainBindings(e.routeId);
        require(
            configuredAsset == e.assetId && configuredAdapter == e.adapterId
                && configuredSourceAsset == e.sourceAsset
                && configuredVerifierHash == e.verifierConfigHash
                && sourceChain == e.sourceChainId && destinationChain == e.destinationChainId
                && sourceNetwork == e.sourceNetworkId && destinationNetwork == e.destinationNetworkId,
            "proof domain mismatch"
        );
    }


    function _acceptInbound(bytes32 adapterId_, bytes calldata proof) private returns (bytes32 transferId) {
        _requireOperational(
            BridgeIds420.ACTION_INBOUND,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        address adapter = adapters[adapterId_];
        require(adapter != address(0) && adapter.code.length != 0, "adapter");
        BridgeVerifierRegistry420 qualification=BridgeVerifierRegistry420(_resolveRequired(BridgeIds420.VERIFIER_REGISTRY));
        bytes32 approval=qualification.requireCurrent(adapter);
        require(IBridgeAdapter420(adapter).adapterId()==adapterId_,"adapter id changed");
        BridgeProofEnvelope420.Envelope memory envelope=BridgeProofEnvelope420.decode(proof);
        require(envelope.adapterId==adapterId_,"proof adapter mismatch");
        _requireProofRouteDomain(envelope);
        _requireRouteDirection(envelope.routeId,envelope.assetId,adapterId_,true);
        IBridgeAdapter420.VerifiedTransfer memory v = IBridgeAdapter420(adapter).verifyInbound(envelope.innerProof);
        (bytes32 verifiedGateway,bytes32 verifiedSourceAsset)=IBridgeVerifiedSourceContext420(adapter).verifiedSourceContext(v.sourceMessageId);
        require(verifiedGateway!=0 && verifiedSourceAsset!=0 && verifiedGateway==envelope.sourceGateway && verifiedSourceAsset==envelope.sourceAsset,"source proof context mismatch");
        require(v.routeId==envelope.routeId && v.assetId==envelope.assetId && v.recipient==envelope.recipient && v.amount==envelope.amount && v.sourceTxId==envelope.sourceTxId && v.sourceMessageId==envelope.sourceMessageId,"proof claim mismatch");
        bool nativeDelivered;
        try IBridgeSettlementEvidence420(adapter).settlementEvidence(v.sourceMessageId) returns(address deliveredToken,address deliveredTo,uint256 delivered,bytes32 receipt){
            if(receipt!=0){require(deliveredToken==ICanonicalAssetRegistry420(_resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY)).asset(v.assetId).token&&deliveredTo==v.recipient&&delivered==v.amount,"native receipt asset binding");nativeDelivered=true;}
        }catch{}
        require(qualification.requireCurrent(adapter)==approval,"qualification changed during proof");
        require(v.sender != address(0) && v.recipient != address(0) && v.amount > 0, "transfer");
        _requireBridgeAsset(v.assetId);
        _requireRouteHealthy(v.routeId);
        _requireAccountingHealthy(v.assetId);
        _requireRouteDirection(v.routeId, v.assetId, adapterId_, true);

        require(v.sourceMessageId!=0 && v.sourceTxId!=0,"source identity");
        (,bytes32 sourceNetwork,,)=IBridgeRouteRegistryView420(_resolveRequired(BridgeIds420.ROUTE_REGISTRY)).chainBindings(v.routeId);
        bytes32 sourceKey=sourceReplayKey(sourceNetwork,v.sourceMessageId);
        require(!consumedSourceMessages[sourceKey],"source replay");
        consumedSourceMessages[sourceKey]=true;
        uint256 exposure=v.amount;
        try IBridgeExposureEvidence420(adapter).exposureForMessage(v.sourceMessageId) returns(uint256 actual){require(actual>=v.amount,"exposure below delivery");exposure=actual;}catch{}
        IBridgeRiskConsumer420(_resolveRequired(BridgeIds420.RISK_MANAGER)).consume(v.routeId, v.assetId, true, exposure);
        IBridgeTransferCreate420 transferRegistry =
            IBridgeTransferCreate420(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY));
        transferId = transferRegistry.create(
            v.routeId, v.assetId, v.sender, v.recipient, v.amount, v.sourceTxId, v.sourceMessageId
        );
        sourceKeyForTransfer[transferId]=sourceKey;
        if(!nativeDelivered)BridgeRiskManager(_resolveRequired(BridgeIds420.RISK_MANAGER)).reserveInbound(transferId,v.routeId,v.assetId,exposure);
        bytes32 sourceEvidence = keccak256(abi.encode(v.sourceTxId, v.sourceMessageId));
        bytes32 proofEvidence = keccak256(proof);
        transferRegistry.markSourcePending(transferId, sourceEvidence);
        transferRegistry.markSourceFinalized(
            transferId, keccak256(abi.encode(sourceEvidence, keccak256("SOURCE_FINALIZED")))
        );
        transferRegistry.markProofPending(transferId, proofEvidence);
        transferRegistry.markVerified(
            transferId, keccak256(abi.encode(adapterId_, proofEvidence, keccak256("PROOF_VERIFIED")))
        );
        require(qualification.requireCurrent(adapter)==approval,"qualification changed during admission");
        _requireRouteDirection(v.routeId,v.assetId,adapterId_,true);
        emit InboundAccepted(transferId, adapterId_);
    }

    function initiateOutbound(bytes32 adapterId_,bytes32 routeId,bytes32 assetId,bytes calldata recipient,uint256 amount,bytes calldata extra) external payable returns(bytes32){
        return _fundedOutbound(adapterId_,routeId,assetId,recipient,amount,extra);
    }
    function initiateFundedOutbound(bytes32 adapterId_,bytes32 routeId,bytes32 assetId,bytes calldata recipient,uint256 amount,bytes calldata extra) external payable returns(bytes32 message){return _fundedOutbound(adapterId_,routeId,assetId,recipient,amount,extra);}
    function _fundedOutbound(bytes32 adapterId_,bytes32 routeId,bytes32 assetId,bytes calldata recipient,uint256 amount,bytes calldata extra) private returns(bytes32 message){
        this.requireOutboundSigningAdmission(adapterId_,routeId,assetId);
        IBridgeValueCustody420 custody=_qualifiedValueCustody();
        custody.reserve(routeId,assetId,msg.sender,amount);message=_initiateOutbound(adapterId_,routeId,assetId,recipient,amount,extra);
        bytes32 id=BridgeTransferRegistry(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY)).deriveOutboundTransferId(routeId,assetId,msg.sender,keccak256(recipient),amount,message);custody.bindOutbound(id);
    }
    function _qualifiedValueCustody() private view returns(IBridgeValueCustody420 custody){
        address target=_resolveRequired(BridgeIds420.VALUE_CUSTODY);
        BridgeVerifierRegistry420(_resolveRequired(BridgeIds420.VERIFIER_REGISTRY)).requireCurrent(target);
        return IBridgeValueCustody420(target);
    }
    function resolveFundedOutbound(bytes32 id,bytes calldata proof) external {
        _requireOperational(BridgeIds420.ACTION_WITHDRAWAL_RECOVERY,ISystemSafety420.ActionClass.WITHDRAWAL_ONLY,Types420.Direction.NONE);
        BridgeTransferRegistry tr=BridgeTransferRegistry(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY));
        (bytes32 route,bytes32 asset,,,uint256 amount,,,,,)=tr.transfers(id);
        _requireBridgeAsset(asset);_requireRouteHealthy(route);
        (bool paid,bytes32 e)=_qualifiedValueCustody().resolveOutbound(id,proof);
        BridgeRiskManager(_resolveRequired(BridgeIds420.RISK_MANAGER)).resolveOutbound(id,route,asset,amount,paid);
        if(paid)tr.recordPaidWithdrawal(id,e);else tr.refundTransfer(id,e);
    }
    function resolveSourceRefund(bytes32 id,bytes calldata proof) external {
        _requireOperational(BridgeIds420.ACTION_WITHDRAWAL_RECOVERY,ISystemSafety420.ActionClass.WITHDRAWAL_ONLY,Types420.Direction.NONE);
        bytes32 e=_qualifiedValueCustody().resolveInboundRefund(id,proof);
        BridgeRiskManager(_resolveRequired(BridgeIds420.RISK_MANAGER)).refundUnsettledInbound(id);
        BridgeTransferRegistry(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY)).refundTransfer(id,e);
    }
    function _initiateOutbound(bytes32 adapterId_,bytes32 routeId,bytes32 assetId,bytes calldata recipient,uint256 amount,bytes calldata extra) private returns(bytes32 sourceMessageId){
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
        _requireAccountingHealthy(assetId);
        _requireRouteDirection(routeId, assetId, adapterId_, false);
        IBridgeRiskConsumer420(_resolveRequired(BridgeIds420.RISK_MANAGER)).consume(routeId, assetId, false, amount);
        BridgeVerifierRegistry420 qualification=BridgeVerifierRegistry420(_resolveRequired(BridgeIds420.VERIFIER_REGISTRY));
        bytes32 approval=qualification.requireCurrent(adapter);
        require(IBridgeAdapter420(adapter).adapterId()==adapterId_,"adapter id changed");
        sourceMessageId = IBridgeAdapter420(adapter).initiateOutbound{ value: msg.value }(
            routeId, assetId, msg.sender, recipient, amount, extra
        );
        require(qualification.requireCurrent(adapter)==approval,"qualification changed during dispatch");
        _requireRouteDirection(routeId, assetId, adapterId_, false);
        require(sourceMessageId != bytes32(0), "message id");
        bytes32 outboundKey=keccak256(abi.encode(adapterId_,sourceMessageId));require(!consumedOutboundMessages[outboundKey],"outbound message replay");consumedOutboundMessages[outboundKey]=true;

        IBridgeTransferCreate420 transferRegistry =
            IBridgeTransferCreate420(_resolveRequired(BridgeIds420.TRANSFER_REGISTRY));
        bytes32 recipientHash = keccak256(recipient);
        bytes32 transferId = transferRegistry.createOutbound(
            routeId, assetId, msg.sender, recipientHash, amount, sourceMessageId
        );
        transferRegistry.markSourcePending(
            transferId, keccak256(abi.encode(adapterId_, sourceMessageId, recipientHash))
        );

        require(qualification.requireCurrent(adapter)==approval,"qualification changed during admission");
        _requireRouteDirection(routeId,assetId,adapterId_,false);
        emit OutboundInitiated(routeId, adapterId_, sourceMessageId);
        emit OutboundTransferRegistered(transferId, routeId, sourceMessageId);
    }
}
