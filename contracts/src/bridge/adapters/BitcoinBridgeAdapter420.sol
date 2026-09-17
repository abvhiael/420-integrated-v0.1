// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/IBitcoinFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

/// @notice Canonical Bitcoin mainnet adapter for 420Bridge.
contract BitcoinBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/BITCOIN/MAINNET/V12.5.14");
    bytes32 public constant BTC_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/BTC");
    uint64 public constant BTC_ROUTE_CHAIN_ID = 0x4254430000000001; // "BTC" + profile version 1
    bytes32 public constant BTC_MAINNET_GENESIS_HASH =
        0x000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f;
    bytes4 public constant BTC_MAINNET_MESSAGE_START = 0xf9beb4d9;
    uint32 public constant MIN_CONFIRMATIONS = 6;

    uint8 public constant SCRIPT_P2PKH = 0;
    uint8 public constant SCRIPT_P2SH = 1;
    uint8 public constant SCRIPT_P2WPKH = 2;
    uint8 public constant SCRIPT_P2WSH = 3;
    uint8 public constant SCRIPT_P2TR = 4;

    address public immutable gatewayRouter;
    IBitcoinFinalityVerifier420 public verifier;
    bytes32 public btcAssetId;
    bytes32 public btcRouteId;

    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bool) public consumedSourceOutputs;
    uint256 public outboundNonce;

    error InvalidAddress(); error InvalidVerifier(); error WrongNetwork(); error Unfinalized();
    error InvalidConsensusProof(); error InsufficientConfirmations(); error InvalidProof();
    error AssetNotConfigured(); error RouteNotConfigured(); error Replay(); error OnlyRouter(); error InvalidOutbound();

    event VerifierSet(address indexed verifier);
    event BtcBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event BitcoinInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionHash, bytes32 indexed sourceOutput);
    event BitcoinOutboundRequested(bytes32 indexed messageId, bytes32 indexed routeId, bytes32 indexed assetId,
        address sender, bytes recipientProgram, uint256 amountSatoshis, uint8 scriptType);

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

    function setBtcBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0) || routeId == bytes32(0)) revert InvalidProof();
        btcAssetId = assetId;
        btcRouteId = routeId;
        emit BtcBindingSet(assetId, routeId);
    }

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        IBitcoinFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.finalized) revert Unfinalized();
        if (p.genesisHash != BTC_MAINNET_GENESIS_HASH || p.messageStart != BTC_MAINNET_MESSAGE_START) revert WrongNetwork();
        if (!p.sha256dPowValidated || !p.chainWorkValidated) revert InvalidConsensusProof();
        if (p.confirmations < MIN_CONFIRMATIONS) revert InsufficientConfirmations();
        if (p.blockHeight == 0 || p.blockHash == bytes32(0) || p.transactionHash == bytes32(0)
            || p.messageId == bytes32(0) || p.sourceOutput == bytes32(0)
            || p.recipient == address(0) || p.amountSatoshis == 0) revert InvalidProof();
        if (btcAssetId == bytes32(0)) revert AssetNotConfigured();
        if (btcRouteId == bytes32(0)) revert RouteNotConfigured();
        if (consumedMessages[p.messageId] || consumedSourceOutputs[p.sourceOutput]) revert Replay();

        consumedMessages[p.messageId] = true;
        consumedSourceOutputs[p.sourceOutput] = true;
        emit BitcoinInboundConsumed(p.messageId, p.transactionHash, p.sourceOutput);

        address syntheticSender = address(uint160(uint256(keccak256(abi.encodePacked(p.sourceOutput)))));
        if (syntheticSender == address(0)) revert InvalidProof();
        v = VerifiedTransfer({routeId: btcRouteId, assetId: btcAssetId, sender: syntheticSender,
            recipient: p.recipient, amount: p.amountSatoshis, sourceTxId: p.transactionHash, sourceMessageId: p.messageId});
    }

    function initiateOutbound(bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient,
        uint256 amount, bytes calldata extra) external payable onlyRouter returns (bytes32 sourceMessageId)
    {
        if (routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0) || amount == 0
            || msg.value != 0 || extra.length != 1) revert InvalidOutbound();
        if (assetId != btcAssetId) revert AssetNotConfigured();
        if (routeId != btcRouteId) revert RouteNotConfigured();
        uint8 scriptType = uint8(extra[0]);
        if (!_validRecipientProgram(recipient, scriptType)) revert InvalidOutbound();

        uint256 nonce = ++outboundNonce;
        sourceMessageId = keccak256(abi.encode(ADAPTER_ID, block.chainid, routeId, assetId, sender,
            recipient, amount, scriptType, nonce));
        emit BitcoinOutboundRequested(sourceMessageId, routeId, assetId, sender, recipient, amount, scriptType);
    }

    function _validRecipientProgram(bytes calldata recipient, uint8 scriptType) private pure returns (bool) {
        if (scriptType == SCRIPT_P2PKH || scriptType == SCRIPT_P2SH || scriptType == SCRIPT_P2WPKH) {
            return recipient.length == 20;
        }
        if (scriptType == SCRIPT_P2WSH || scriptType == SCRIPT_P2TR) return recipient.length == 32;
        return false;
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = IBitcoinFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
