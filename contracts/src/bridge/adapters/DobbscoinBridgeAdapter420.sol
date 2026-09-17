// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/IDobbscoinFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

/// @notice Canonical Dobbscoin mainnet adapter for 420Bridge.
contract DobbscoinBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/DOBBSCOIN/MAINNET/V12.5.10");
    bytes32 public constant BOB_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/BOB");
    uint64 public constant BOB_ROUTE_CHAIN_ID = 0x424f420000000001; // "BOB" + profile version 1
    bytes32 public constant BOB_MAINNET_GENESIS_HASH =
        0x6d2d7d525900712451b9697d0b5b2304ebae6efb349540da445bf575c0159969;
    bytes4 public constant BOB_MAINNET_MESSAGE_START = 0xa0fb1783;
    uint32 public constant MIN_CONFIRMATIONS = 288;
    uint64 public constant AUXPOW_ACTIVATION_HEIGHT = 2_000_000;

    address public immutable gatewayRouter;
    IDobbscoinFinalityVerifier420 public verifier;
    bytes32 public bobAssetId;
    bytes32 public bobRouteId;

    mapping(bytes32 => bool) public gatewayScripts;
    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bool) public consumedSourceOutputs;
    uint256 public outboundNonce;

    error InvalidAddress(); error InvalidVerifier(); error WrongNetwork(); error Unfinalized();
    error InsufficientConfirmations(); error InvalidProof(); error AuxPowRequired(); error GatewayNotAllowed();
    error AssetNotConfigured(); error RouteNotConfigured(); error Replay(); error OnlyRouter(); error InvalidOutbound();

    event VerifierSet(address indexed verifier);
    event GatewayScriptSet(bytes32 indexed scriptHash, bool allowed);
    event BobBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event DobbscoinInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionHash, bytes32 indexed sourceOutput);
    event DobbscoinOutboundRequested(bytes32 indexed messageId, bytes32 indexed routeId, bytes32 indexed assetId, address sender, bytes recipientHash160, uint256 amount, uint8 scriptType);

    constructor(address governanceTimelock_, address gatewayRouter_, address verifier_)
        SystemAccess(governanceTimelock_)
    {
        if (gatewayRouter_ == address(0) || gatewayRouter_.code.length == 0) revert InvalidAddress();
        gatewayRouter = gatewayRouter_;
        _setVerifier(verifier_);
    }

    modifier onlyRouter() { if (msg.sender != gatewayRouter) revert OnlyRouter(); _; }
    function adapterId() external pure returns (bytes32) { return ADAPTER_ID; }
    function setVerifier(address verifier_) external onlyGovernance { _setVerifier(verifier_); }

    function setGatewayScript(bytes32 scriptHash, bool allowed) external onlyGovernance {
        if (scriptHash == bytes32(0)) revert InvalidProof();
        gatewayScripts[scriptHash] = allowed;
        emit GatewayScriptSet(scriptHash, allowed);
    }

    function setBobBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0) || routeId == bytes32(0)) revert InvalidProof();
        bobAssetId = assetId;
        bobRouteId = routeId;
        emit BobBindingSet(assetId, routeId);
    }

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        IDobbscoinFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.finalized) revert Unfinalized();
        if (p.genesisHash != BOB_MAINNET_GENESIS_HASH || p.messageStart != BOB_MAINNET_MESSAGE_START) revert WrongNetwork();
        if (p.confirmations < MIN_CONFIRMATIONS) revert InsufficientConfirmations();
        if (p.blockHeight >= AUXPOW_ACTIVATION_HEIGHT && !p.auxPowValidated) revert AuxPowRequired();
        if (p.blockHeight == 0 || p.blockHash == bytes32(0) || p.transactionHash == bytes32(0)
            || p.messageId == bytes32(0) || p.gatewayScriptHash == bytes32(0) || p.sourceOutput == bytes32(0)
            || p.recipient == address(0) || p.amount == 0) revert InvalidProof();
        if (!gatewayScripts[p.gatewayScriptHash]) revert GatewayNotAllowed();
        if (bobAssetId == bytes32(0)) revert AssetNotConfigured();
        if (bobRouteId == bytes32(0)) revert RouteNotConfigured();
        if (consumedMessages[p.messageId] || consumedSourceOutputs[p.sourceOutput]) revert Replay();

        consumedMessages[p.messageId] = true;
        consumedSourceOutputs[p.sourceOutput] = true;
        emit DobbscoinInboundConsumed(p.messageId, p.transactionHash, p.sourceOutput);

        address syntheticSender = address(uint160(uint256(keccak256(abi.encodePacked(p.sourceOutput)))));
        if (syntheticSender == address(0)) revert InvalidProof();
        v = VerifiedTransfer({routeId: bobRouteId, assetId: bobAssetId, sender: syntheticSender,
            recipient: p.recipient, amount: p.amount, sourceTxId: p.transactionHash, sourceMessageId: p.messageId});
    }

    function initiateOutbound(bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient,
        uint256 amount, bytes calldata extra) external payable onlyRouter returns (bytes32 sourceMessageId)
    {
        if (routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0) || recipient.length != 20
            || amount == 0 || msg.value != 0 || extra.length != 1 || uint8(extra[0]) > 1) revert InvalidOutbound();
        if (assetId != bobAssetId) revert AssetNotConfigured();
        if (routeId != bobRouteId) revert RouteNotConfigured();
        uint8 scriptType = uint8(extra[0]); // 0=P2PKH, 1=P2SH
        uint256 nonce = ++outboundNonce;
        sourceMessageId = keccak256(abi.encode(ADAPTER_ID, block.chainid, routeId, assetId, sender, recipient, amount, scriptType, nonce));
        emit DobbscoinOutboundRequested(sourceMessageId, routeId, assetId, sender, recipient, amount, scriptType);
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = IDobbscoinFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
