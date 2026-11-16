// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/IEthereumOutboundMessage420.sol";
import "../../interfaces/IEthereumFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";
import "../../interfaces/IBridgeTokenRoutePolicy420.sol";
import "../tokens/SupportedTokenRoutes420.sol";

/// @notice Canonical Ethereum mainnet adapter for 420Bridge.
contract EthereumBridgeAdapter420 is IBridgeAdapter420, IEthereumOutboundMessage420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/ETHEREUM/MAINNET/V12.5.4");
    bytes32 public constant ETH_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/ETH");
    uint64 public constant ETH_ROUTE_CHAIN_ID = 0x4554484d41494e01; // "ETHMAIN" + profile version 1
    uint256 public constant ETHEREUM_MAINNET_CHAIN_ID = 1;
    bytes32 public constant ETH_NATIVE_SOURCE_ASSET = keccak256("420/BRIDGE/ETHEREUM/NATIVE/ETH");

    address public immutable gatewayRouter;
    IEthereumFinalityVerifier420 public verifier;
    mapping(address => bool) public gateways;
    mapping(bytes32 => bytes32) public assetIdBySourceAsset;
    mapping(bytes32 => bytes32) public sourceAssetByAssetId;
    mapping(bytes32 => bytes32) public routeIdByAssetId;
    mapping(bytes32 => bool) public consumedMessages;

    struct SourceProofContext {
        bytes32 gateway;
        bytes32 sourceAsset;
    }
    mapping(bytes32 => SourceProofContext) public verifiedSourceContext;
    address public tokenRoutePolicy;
    event TokenRoutePolicySet(address indexed policy);

    function setTokenRoutePolicy(address policy) external onlyGovernance {
        if (
            policy.code.length == 0
                || IBridgeTokenRoutePolicy420(policy).componentId() != keccak256("420/APP/420BRIDGE/ASSET_REGISTRY")
        ) revert InvalidVerifier();
        tokenRoutePolicy = policy;
        emit TokenRoutePolicySet(policy);
    }

    function _tokenAmount(bytes32 route, bytes32 asset, bytes32 source, bytes32 gateway, uint256 amount, bool inbound)
        private
        view
        returns (uint256)
    {
        if (source == ETH_NATIVE_SOURCE_ASSET && !SupportedTokenRoutes420.isTokenAsset(asset)) return amount;
        if (tokenRoutePolicy.code.length == 0) revert AssetNotAllowed();
        return IBridgeTokenRoutePolicy420(tokenRoutePolicy)
            .qualifyTokenTransfer(route, asset, source, ADAPTER_ID, address(verifier), gateway, amount, inbound);
    }
    uint256 public outboundNonce;

    bool public inboundHalted;
    bool public outboundHalted;
    bytes32 public inboundIncidentHash;
    bytes32 public outboundIncidentHash;
    mapping(bytes32 => OutboundMessage) private outboundMessages;
    event EthereumOutboundPayloadStored(bytes32 indexed messageId, uint256 indexed nonce);

    function outboundMessage(bytes32 messageId) external view returns (OutboundMessage memory) {
        if (outboundMessages[messageId].nonce == 0) revert InvalidOutbound();
        return outboundMessages[messageId];
    }


    error InvalidAddress();
    error InvalidVerifier();
    error WrongChain();
    error Unfinalized();
    error InvalidProof();
    error GatewayNotAllowed();
    error AssetNotAllowed();
    error RouteNotAllowed();
    error Replay();
    error OnlyRouter();
    error InvalidOutbound();
    error InboundHalted();
    error OutboundHalted();
    error InvalidIncident();

    event VerifierSet(address indexed verifier);
    event GatewaySet(address indexed gateway, bool allowed);
    event AssetMappingSet(bytes32 indexed sourceAsset, bytes32 indexed assetId, bool allowed);
    event RouteBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event EmergencyHaltSet(bool indexed inbound, bool halted, bytes32 indexed incidentHash);
    event EthereumInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionHash, uint64 blockNumber);
    event EthereumOutboundRequested(
        bytes32 indexed messageId,
        bytes32 indexed routeId,
        bytes32 indexed assetId,
        address sender,
        bytes recipient,
        uint256 amount,
        bytes32 sourceAsset
    );

    constructor(address governanceTimelock_, address gatewayRouter_, address verifier_)
        SystemAccess(governanceTimelock_)
    {
        if (gatewayRouter_ == address(0) || gatewayRouter_.code.length == 0) revert InvalidAddress();
        gatewayRouter = gatewayRouter_;
        _setVerifier(verifier_);
    }

    modifier onlyRouter() {
        if (msg.sender != gatewayRouter) revert OnlyRouter();
        _;
    }

    function adapterId() external pure returns (bytes32) {
        return ADAPTER_ID;
    }

    function setVerifier(address verifier_) external onlyGovernance {
        _setVerifier(verifier_);
    }

    function setGateway(address gateway, bool allowed) external onlyGovernance {
        if (gateway == address(0)) revert InvalidAddress();
        gateways[gateway] = allowed;
        emit GatewaySet(gateway, allowed);
    }

    function setEmergencyHalt(bool inbound, bool halted, bytes32 incidentHash_) external onlyGovernance {
        if (halted && incidentHash_ == bytes32(0)) revert InvalidIncident();
        bytes32 incident = halted ? incidentHash_ : bytes32(0);
        if (inbound) {
            inboundHalted = halted;
            inboundIncidentHash = incident;
        } else {
            outboundHalted = halted;
            outboundIncidentHash = incident;
        }
        emit EmergencyHaltSet(inbound, halted, incident);
    }

    function setAssetMapping(bytes32 sourceAsset, bytes32 assetId, bool allowed) external onlyGovernance {
        if (sourceAsset == bytes32(0) || assetId == bytes32(0)) revert InvalidProof();
        if (allowed) {
            bytes32 previousSource = sourceAssetByAssetId[assetId];
            if (previousSource != bytes32(0) && previousSource != sourceAsset) {
                delete assetIdBySourceAsset[previousSource];
            }
            bytes32 previousAsset = assetIdBySourceAsset[sourceAsset];
            if (previousAsset != bytes32(0) && previousAsset != assetId) delete sourceAssetByAssetId[previousAsset];
            assetIdBySourceAsset[sourceAsset] = assetId;
            sourceAssetByAssetId[assetId] = sourceAsset;
        } else {
            if (assetIdBySourceAsset[sourceAsset] == assetId) delete assetIdBySourceAsset[sourceAsset];
            if (sourceAssetByAssetId[assetId] == sourceAsset) delete sourceAssetByAssetId[assetId];
        }
        emit AssetMappingSet(sourceAsset, assetId, allowed);
    }

    function setRouteBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0)) revert InvalidProof();
        routeIdByAssetId[assetId] = routeId;
        emit RouteBindingSet(assetId, routeId);
    }

    function sourceAssetKey(address sourceToken) public pure returns (bytes32) {
        if (sourceToken == address(0)) return ETH_NATIVE_SOURCE_ASSET;
        return bytes32(uint256(uint160(sourceToken)));
    }

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        if (inboundHalted) revert InboundHalted();
        IEthereumFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.finalized) revert Unfinalized();
        if (p.sourceChainId != ETHEREUM_MAINNET_CHAIN_ID) revert WrongChain();
        if (p.destinationChainId != block.chainid) revert WrongChain();
        if (p.destinationRouter != gatewayRouter) revert InvalidProof();
        if (
            p.blockNumber == 0 || p.blockHash == bytes32(0) || p.receiptsRoot == bytes32(0)
                || p.transactionHash == bytes32(0) || p.messageId == bytes32(0) || p.gateway == address(0)
                || p.sourceSender == address(0) || p.recipient == address(0) || p.amount == 0
        ) revert InvalidProof();
        if (!gateways[p.gateway]) revert GatewayNotAllowed();
        bytes32 sourceAsset = sourceAssetKey(p.sourceToken);
        bytes32 assetId = assetIdBySourceAsset[sourceAsset];
        if (assetId == bytes32(0)) revert AssetNotAllowed();
        bytes32 routeId = routeIdByAssetId[assetId];
        if (routeId == bytes32(0)) revert RouteNotAllowed();
        if (p.routeId != routeId) revert RouteNotAllowed();
        uint256 localAmount =
            _tokenAmount(routeId, assetId, sourceAsset, bytes32(uint256(uint160(p.gateway))), p.amount, true);
        if (consumedMessages[p.messageId]) revert Replay();
        consumedMessages[p.messageId] = true;
        verifiedSourceContext[p.messageId] = SourceProofContext(bytes32(uint256(uint160(p.gateway))), sourceAsset);
        emit EthereumInboundConsumed(p.messageId, p.transactionHash, p.blockNumber);
        v = VerifiedTransfer({
            routeId: routeId,
            assetId: assetId,
            sender: p.sourceSender,
            recipient: p.recipient,
            amount: localAmount,
            sourceTxId: p.transactionHash,
            sourceMessageId: p.messageId
        });
    }

    function initiateOutbound(
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        bytes calldata recipient,
        uint256 amount,
        bytes calldata extra
    ) external payable onlyRouter returns (bytes32 sourceMessageId) {
        if (outboundHalted) revert OutboundHalted();
        if (
            routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0) || recipient.length != 20
                || amount == 0 || msg.value != 0
        ) revert InvalidOutbound();
        address recipientAddress;
        assembly ("memory-safe") { recipientAddress := shr(96, calldataload(recipient.offset)) }
        if (recipientAddress == address(0)) revert InvalidOutbound();
        bytes32 sourceAsset = sourceAssetByAssetId[assetId];
        if (sourceAsset == bytes32(0)) revert AssetNotAllowed();
        if (routeIdByAssetId[assetId] != routeId) revert RouteNotAllowed();
        uint256 sourceAmount = _tokenAmount(routeId, assetId, sourceAsset, bytes32(0), amount, false);
        uint256 nonce = ++outboundNonce;
        sourceMessageId = (sourceAsset == ETH_NATIVE_SOURCE_ASSET && !SupportedTokenRoutes420.isTokenAsset(assetId))
            ? keccak256(
                abi.encode(
                    ADAPTER_ID, block.chainid, routeId, assetId, sender, recipient, amount, sourceAsset, nonce, extra
                )
            )
            : keccak256(
                abi.encode(
                    ADAPTER_ID,
                    block.chainid,
                    routeId,
                    assetId,
                    sender,
                    recipient,
                    amount,
                    sourceAmount,
                    sourceAsset,
                    nonce,
                    extra
                )
            );
        OutboundMessage storage request = outboundMessages[sourceMessageId];
        request.sourceChainId = block.chainid;
        request.sourceRouter = gatewayRouter;
        request.sourceAdapter = address(this);
        request.messageId = sourceMessageId;
        request.routeId = routeId;
        request.assetId = assetId;
        request.sender = sender;
        request.recipient = recipientAddress;
        request.localAmount = amount;
        request.ethereumAmount = sourceAmount;
        request.ethereumAsset = sourceAsset;
        request.nonce = nonce;
        request.extra = extra;
        emit EthereumOutboundPayloadStored(sourceMessageId, nonce);
        emit EthereumOutboundRequested(sourceMessageId, routeId, assetId, sender, recipient, sourceAmount, sourceAsset);
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = IEthereumFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
