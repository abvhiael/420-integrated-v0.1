// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/ISolanaOutboundMessage420.sol";
import "../solana/SolanaOutboundWire420.sol";
import "../../interfaces/ISolanaFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";
import "../../interfaces/IBridgeTokenRoutePolicy420.sol";
import "../tokens/SupportedTokenRoutes420.sol";

/// @notice Canonical Solana mainnet adapter for 420Bridge.
/// @dev The adapter does not trust arbitrary RPC responses. It consumes only messages returned by a
///      governance-configured finality verifier and independently rechecks canonical cluster/program/asset bindings.
contract SolanaBridgeAdapter420 is IBridgeAdapter420, ISolanaOutboundMessage420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/SOLANA/MAINNET/V12.5.2");
    bytes32 public constant SOLANA_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/SOL");
    uint64 public constant SOLANA_ROUTE_CHAIN_ID = 0x534f4c414e410001; // "SOLANA" + profile version 1
    bytes32 public constant SOL_NATIVE_SOURCE_ASSET = keccak256("420/BRIDGE/SOLANA/NATIVE/SOL");
    bytes32 public constant SOLANA_MAINNET_GENESIS_HASH =
        0x45296998a6f8e2a784db5d9f95e18fc23f70441a1039446801089879b08c7ef0;

    address public immutable gatewayRouter;
    ISolanaFinalityVerifier420 public verifier;

    mapping(bytes32 => bool) public gatewayPrograms;
    mapping(bytes32 => bytes32) public assetIdBySourceAsset;
    mapping(bytes32 => bytes32) public sourceAssetByAssetId;
    mapping(bytes32 => bytes32) public routeIdByAssetId;
    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bytes32) public sourceOwnerByMessage;

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
        if (source == SOL_NATIVE_SOURCE_ASSET && !SupportedTokenRoutes420.isTokenAsset(asset)) return amount;
        if (tokenRoutePolicy.code.length == 0) revert AssetNotAllowed();
        return IBridgeTokenRoutePolicy420(tokenRoutePolicy)
            .qualifyTokenTransfer(route, asset, source, ADAPTER_ID, address(verifier), gateway, amount, inbound);
    }
    uint256 public outboundNonce;
    bool public inboundHalted;
    bool public outboundHalted;
    bytes32 public inboundIncidentHash;
    bytes32 public outboundIncidentHash;

    struct SourceProofContext {bytes32 gateway;bytes32 sourceAsset;}
    mapping(bytes32=>SourceProofContext) public verifiedSourceContext;
    mapping(bytes32 => OutboundMessage) private outboundMessages;
    event SolanaOutboundPayloadStored(bytes32 indexed messageId, uint256 indexed nonce);

    function outboundMessage(bytes32 messageId) external view returns (OutboundMessage memory) {
        if (outboundMessages[messageId].nonce == 0) revert InvalidOutbound();
        return outboundMessages[messageId];
    }

    function outboundMessageData(bytes32 messageId) external view returns (bytes memory) {
        OutboundMessage storage r = outboundMessages[messageId];
        if (r.nonce == 0 || r.extra.length > type(uint32).max) revert InvalidOutbound();
        return SolanaOutboundWire420.encode(r);
    }

    error InvalidAddress();
    error InvalidVerifier();
    error WrongCluster();
    error Unfinalized();
    error InvalidProof();
    error ProgramNotAllowed();
    error AssetNotAllowed();
    error RouteNotAllowed();
    error Replay();
    error OnlyRouter();
    error InvalidOutbound();
    error InboundHalted();
    error OutboundHalted();
    error InvalidIncident();

    event VerifierSet(address indexed verifier);
    event GatewayProgramSet(bytes32 indexed programId, bool allowed);
    event AssetMappingSet(bytes32 indexed sourceAsset, bytes32 indexed assetId, bool allowed);
    event RouteBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event EmergencyHaltSet(bool indexed inbound, bool halted, bytes32 indexed incidentHash);
    event SolanaInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionSignature, uint64 slot);
    event SolanaOutboundRequested(
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

    function setGatewayProgram(bytes32 programId, bool allowed) external onlyGovernance {
        if (programId == bytes32(0)) revert InvalidProof();
        gatewayPrograms[programId] = allowed;
        emit GatewayProgramSet(programId, allowed);
    }

    function setAssetMapping(bytes32 sourceAsset, bytes32 assetId, bool allowed) external onlyGovernance {
        if (sourceAsset == bytes32(0) || assetId == bytes32(0)) revert InvalidProof();
        if (allowed) {
            bytes32 previousSource = sourceAssetByAssetId[assetId];
            if (previousSource != bytes32(0) && previousSource != sourceAsset) {
                delete assetIdBySourceAsset[previousSource];
            }
            bytes32 previousAsset = assetIdBySourceAsset[sourceAsset];
            if (previousAsset != bytes32(0) && previousAsset != assetId) {
                delete sourceAssetByAssetId[previousAsset];
            }
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

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        if (inboundHalted) revert InboundHalted();
        ISolanaFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.finalized) revert Unfinalized();
        if (p.genesisHash != SOLANA_MAINNET_GENESIS_HASH) revert WrongCluster();
        if (
            p.slot == 0 || p.transactionSignature == bytes32(0) || p.messageId == bytes32(0)
                || p.gatewayProgram == bytes32(0) || p.sourceAsset == bytes32(0) || p.sourceOwner == bytes32(0)
                || p.recipient == address(0) || p.amount == 0
        ) revert InvalidProof();
        if (!gatewayPrograms[p.gatewayProgram]) revert ProgramNotAllowed();
        bytes32 assetId = assetIdBySourceAsset[p.sourceAsset];
        if (assetId == bytes32(0)) revert AssetNotAllowed();
        bytes32 routeId = routeIdByAssetId[assetId];
        if (routeId == bytes32(0)) revert RouteNotAllowed();
        if (p.destinationChainId != block.chainid || p.destinationRouter != gatewayRouter || p.routeId != routeId) {
            revert InvalidProof();
        }
        uint256 localAmount = _tokenAmount(routeId, assetId, p.sourceAsset, p.gatewayProgram, p.amount, true);
        if (consumedMessages[p.messageId]) revert Replay();

        address sourceSender = address(uint160(uint256(p.sourceOwner)));
        if (sourceSender == address(0)) revert InvalidProof();

        consumedMessages[p.messageId] = true;
        sourceOwnerByMessage[p.messageId] = p.sourceOwner;
        emit SolanaInboundConsumed(p.messageId, p.transactionSignature, p.slot);

        verifiedSourceContext[p.messageId]=SourceProofContext(p.gatewayProgram,p.sourceAsset);
        v = VerifiedTransfer({
            routeId: routeId,
            assetId: assetId,
            sender: sourceSender,
            recipient: p.recipient,
            amount: localAmount,
            sourceTxId: p.transactionSignature,
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
            routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0) || recipient.length != 32
                || amount == 0 || msg.value != 0
        ) revert InvalidOutbound();
        bytes32 sourceAsset = sourceAssetByAssetId[assetId];
        if (sourceAsset == bytes32(0)) revert AssetNotAllowed();
        if (routeIdByAssetId[assetId] != routeId) revert RouteNotAllowed();

        uint256 sourceAmount = _tokenAmount(routeId, assetId, sourceAsset, bytes32(0), amount, false);
        if (sourceAmount > type(uint64).max || extra.length > type(uint32).max) revert InvalidOutbound();
        uint256 nonce = ++outboundNonce;
        sourceMessageId = (sourceAsset == SOL_NATIVE_SOURCE_ASSET && !SupportedTokenRoutes420.isTokenAsset(assetId))
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
        bytes32 recipientKey;
        assembly ("memory-safe") { recipientKey := calldataload(recipient.offset) }
        OutboundMessage storage request = outboundMessages[sourceMessageId];
        request.sourceChainId = block.chainid;
        request.sourceRouter = gatewayRouter;
        request.sourceAdapter = address(this);
        request.messageId = sourceMessageId;
        request.routeId = routeId;
        request.assetId = assetId;
        request.sender = sender;
        request.recipient = recipientKey;
        request.localAmount = amount;
        request.solanaAmount = uint64(sourceAmount);
        request.solanaAsset = sourceAsset;
        request.nonce = nonce;
        request.extra = extra;
        emit SolanaOutboundPayloadStored(sourceMessageId, nonce);
        emit SolanaOutboundRequested(sourceMessageId, routeId, assetId, sender, recipient, sourceAmount, sourceAsset);
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = ISolanaFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
