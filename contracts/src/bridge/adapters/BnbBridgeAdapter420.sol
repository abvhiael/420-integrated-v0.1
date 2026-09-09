// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/IBnbFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

contract BnbBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/BNB/MAINNET/V12.5.3");
    bytes32 public constant BNB_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/BNB");
    uint64 public constant BNB_ROUTE_CHAIN_ID = 0x424e424d41494e01;
    uint256 public constant BNB_MAINNET_CHAIN_ID = 56;
    bytes32 public constant BNB_NATIVE_SOURCE_ASSET = keccak256("420/BRIDGE/BNB/NATIVE/BNB");

    address public immutable gatewayRouter;
    IBnbFinalityVerifier420 public verifier;
    mapping(address => bool) public gateways;
    mapping(bytes32 => bytes32) public assetIdBySourceAsset;
    mapping(bytes32 => bytes32) public sourceAssetByAssetId;
    mapping(bytes32 => bytes32) public routeIdByAssetId;
    mapping(bytes32 => bool) public consumedMessages;
    uint256 public outboundNonce;

    error InvalidAddress(); error InvalidVerifier(); error WrongChain(); error Unfinalized(); error InvalidProof();
    error GatewayNotAllowed(); error AssetNotAllowed(); error RouteNotAllowed(); error Replay(); error OnlyRouter(); error InvalidOutbound();

    event VerifierSet(address indexed verifier);
    event GatewaySet(address indexed gateway, bool allowed);
    event AssetMappingSet(bytes32 indexed sourceAsset, bytes32 indexed assetId, bool allowed);
    event RouteBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event BnbInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionHash, uint64 blockNumber);
    event BnbOutboundRequested(bytes32 indexed messageId, bytes32 indexed routeId, bytes32 indexed assetId, address sender, bytes recipient, uint256 amount, bytes32 sourceAsset);

    constructor(address governanceTimelock_, address gatewayRouter_, address verifier_) SystemAccess(governanceTimelock_) {
        if (gatewayRouter_ == address(0) || gatewayRouter_.code.length == 0) revert InvalidAddress();
        gatewayRouter = gatewayRouter_;
        _setVerifier(verifier_);
    }
    modifier onlyRouter() { if (msg.sender != gatewayRouter) revert OnlyRouter(); _; }
    function adapterId() external pure returns (bytes32) { return ADAPTER_ID; }
    function setVerifier(address verifier_) external onlyGovernance { _setVerifier(verifier_); }
    function setGateway(address gateway, bool allowed) external onlyGovernance { if (gateway == address(0)) revert InvalidAddress(); gateways[gateway]=allowed; emit GatewaySet(gateway,allowed); }
    function setAssetMapping(bytes32 sourceAsset, bytes32 assetId, bool allowed) external onlyGovernance {
        if (sourceAsset==bytes32(0)||assetId==bytes32(0)) revert InvalidProof();
        if (allowed) {
            bytes32 previousSource=sourceAssetByAssetId[assetId]; if(previousSource!=bytes32(0)&&previousSource!=sourceAsset) delete assetIdBySourceAsset[previousSource];
            bytes32 previousAsset=assetIdBySourceAsset[sourceAsset]; if(previousAsset!=bytes32(0)&&previousAsset!=assetId) delete sourceAssetByAssetId[previousAsset];
            assetIdBySourceAsset[sourceAsset]=assetId; sourceAssetByAssetId[assetId]=sourceAsset;
        } else {
            if(assetIdBySourceAsset[sourceAsset]==assetId) delete assetIdBySourceAsset[sourceAsset];
            if(sourceAssetByAssetId[assetId]==sourceAsset) delete sourceAssetByAssetId[assetId];
        }
        emit AssetMappingSet(sourceAsset,assetId,allowed);
    }
    function setRouteBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance { if(assetId==bytes32(0)) revert InvalidProof(); routeIdByAssetId[assetId]=routeId; emit RouteBindingSet(assetId,routeId); }
    function sourceAssetKey(address sourceToken) public pure returns(bytes32){ if(sourceToken==address(0)) return BNB_NATIVE_SOURCE_ASSET; return bytes32(uint256(uint160(sourceToken))); }
    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        IBnbFinalityVerifier420.FinalizedTransfer memory p=verifier.verifyFinalizedTransfer(proof);
        if(!p.finalized) revert Unfinalized(); if(p.sourceChainId!=BNB_MAINNET_CHAIN_ID) revert WrongChain();
        if(p.blockNumber==0||p.blockHash==bytes32(0)||p.transactionHash==bytes32(0)||p.messageId==bytes32(0)||p.gateway==address(0)||p.sourceSender==address(0)||p.recipient==address(0)||p.amount==0) revert InvalidProof();
        if(!gateways[p.gateway]) revert GatewayNotAllowed();
        bytes32 sourceAsset=sourceAssetKey(p.sourceToken); bytes32 assetId=assetIdBySourceAsset[sourceAsset]; if(assetId==bytes32(0)) revert AssetNotAllowed();
        bytes32 routeId=routeIdByAssetId[assetId]; if(routeId==bytes32(0)) revert RouteNotAllowed(); if(consumedMessages[p.messageId]) revert Replay();
        consumedMessages[p.messageId]=true; emit BnbInboundConsumed(p.messageId,p.transactionHash,p.blockNumber);
        v=VerifiedTransfer({routeId:routeId,assetId:assetId,sender:p.sourceSender,recipient:p.recipient,amount:p.amount,sourceTxId:p.transactionHash,sourceMessageId:p.messageId});
    }
    function initiateOutbound(bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient, uint256 amount, bytes calldata extra) external payable onlyRouter returns(bytes32 sourceMessageId){
        if(routeId==bytes32(0)||assetId==bytes32(0)||sender==address(0)||recipient.length!=20||amount==0||msg.value!=0) revert InvalidOutbound();
        bytes32 sourceAsset=sourceAssetByAssetId[assetId]; if(sourceAsset==bytes32(0)) revert AssetNotAllowed(); if(routeIdByAssetId[assetId]!=routeId) revert RouteNotAllowed();
        uint256 nonce=++outboundNonce; sourceMessageId=keccak256(abi.encode(ADAPTER_ID,block.chainid,routeId,assetId,sender,recipient,amount,sourceAsset,nonce,extra));
        emit BnbOutboundRequested(sourceMessageId,routeId,assetId,sender,recipient,amount,sourceAsset);
    }
    function _setVerifier(address verifier_) private { if(verifier_==address(0)||verifier_.code.length==0) revert InvalidVerifier(); verifier=IBnbFinalityVerifier420(verifier_); emit VerifierSet(verifier_); }
}
