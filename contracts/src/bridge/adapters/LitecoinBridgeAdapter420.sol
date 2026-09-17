// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/ILitecoinFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

/// @notice Canonical Litecoin mainnet adapter for 420Bridge.
contract LitecoinBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/LITECOIN/MAINNET/V12.5.13");
    bytes32 public constant LTC_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/LTC");
    uint64 public constant LTC_ROUTE_CHAIN_ID = 0x4c54430000000001; // "LTC" + profile version 1
    bytes32 public constant LTC_MAINNET_GENESIS_HASH =
        0x12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2;
    bytes4 public constant LTC_MAINNET_MESSAGE_START = 0xfbc0b6db;
    uint32 public constant MIN_CONFIRMATIONS = 12;

    uint8 public constant SCRIPT_P2PKH = 0;
    uint8 public constant SCRIPT_P2SH = 1;
    uint8 public constant SCRIPT_P2WPKH = 2;
    uint8 public constant SCRIPT_P2WSH = 3;
    uint8 public constant SCRIPT_P2TR = 4;

    address public immutable gatewayRouter;
    ILitecoinFinalityVerifier420 public verifier;
    bytes32 public ltcAssetId;
    bytes32 public ltcRouteId;

    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bool) public consumedSourceOutputs;
    uint256 public outboundNonce;

    error InvalidAddress(); error InvalidVerifier(); error WrongNetwork(); error Unfinalized();
    error InvalidConsensusProof(); error InsufficientConfirmations(); error MwebUnsupported(); error InvalidProof();
    error AssetNotConfigured(); error RouteNotConfigured(); error Replay(); error OnlyRouter(); error InvalidOutbound();

    event VerifierSet(address indexed verifier);
    event LtcBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event LitecoinInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionHash, bytes32 indexed sourceOutput);
    event LitecoinOutboundRequested(bytes32 indexed messageId, bytes32 indexed routeId, bytes32 indexed assetId,
        address sender, bytes recipientProgram, uint256 amountLitoshis, uint8 scriptType);

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

    function setLtcBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0) || routeId == bytes32(0)) revert InvalidProof();
        ltcAssetId = assetId;
        ltcRouteId = routeId;
        emit LtcBindingSet(assetId, routeId);
    }

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        ILitecoinFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.finalized) revert Unfinalized();
        if (p.genesisHash != LTC_MAINNET_GENESIS_HASH || p.messageStart != LTC_MAINNET_MESSAGE_START) revert WrongNetwork();
        if (!p.scryptPowValidated || !p.chainWorkValidated) revert InvalidConsensusProof();
        if (p.confirmations < MIN_CONFIRMATIONS) revert InsufficientConfirmations();
        if (p.mweb) revert MwebUnsupported();
        if (p.blockHeight == 0 || p.blockHash == bytes32(0) || p.transactionHash == bytes32(0)
            || p.messageId == bytes32(0) || p.sourceOutput == bytes32(0)
            || p.recipient == address(0) || p.amountLitoshis == 0) revert InvalidProof();
        if (ltcAssetId == bytes32(0)) revert AssetNotConfigured();
        if (ltcRouteId == bytes32(0)) revert RouteNotConfigured();
        if (consumedMessages[p.messageId] || consumedSourceOutputs[p.sourceOutput]) revert Replay();

        consumedMessages[p.messageId] = true;
        consumedSourceOutputs[p.sourceOutput] = true;
        emit LitecoinInboundConsumed(p.messageId, p.transactionHash, p.sourceOutput);

        address syntheticSender = address(uint160(uint256(keccak256(abi.encodePacked(p.sourceOutput)))));
        if (syntheticSender == address(0)) revert InvalidProof();
        v = VerifiedTransfer({routeId: ltcRouteId, assetId: ltcAssetId, sender: syntheticSender,
            recipient: p.recipient, amount: p.amountLitoshis, sourceTxId: p.transactionHash, sourceMessageId: p.messageId});
    }

    function initiateOutbound(bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient,
        uint256 amount, bytes calldata extra) external payable onlyRouter returns (bytes32 sourceMessageId)
    {
        if (routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0) || amount == 0
            || msg.value != 0 || extra.length != 1) revert InvalidOutbound();
        if (assetId != ltcAssetId) revert AssetNotConfigured();
        if (routeId != ltcRouteId) revert RouteNotConfigured();
        uint8 scriptType = uint8(extra[0]);
        if (!_validRecipientProgram(recipient, scriptType)) revert InvalidOutbound();

        uint256 nonce = ++outboundNonce;
        sourceMessageId = keccak256(abi.encode(ADAPTER_ID, block.chainid, routeId, assetId, sender,
            recipient, amount, scriptType, nonce));
        emit LitecoinOutboundRequested(sourceMessageId, routeId, assetId, sender, recipient, amount, scriptType);
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
        verifier = ILitecoinFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
