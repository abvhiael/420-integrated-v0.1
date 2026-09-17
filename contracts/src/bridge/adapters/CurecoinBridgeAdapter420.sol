// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/ICurecoinFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

contract CurecoinBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/CURECOIN/MAINNET/V12.5.11");
    bytes32 public constant CURE_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/CURE");
    uint64 public constant CURE_ROUTE_CHAIN_ID = 0x4355524500000001; // CURE + profile v1
    bytes32 public constant CURE_MAINNET_GENESIS_HASH = 0x00000ce427729d5393dbf9f464e7a1d2c039e393e881f93448516b1530b688fc;
    bytes4 public constant CURE_MAINNET_MESSAGE_START = 0xe4e8e9e5;
    uint8 public constant CURE_P2PKH_VERSION = 25;
    uint8 public constant CURE_P2SH_VERSION = 30;

    address public immutable gatewayRouter;
    ICurecoinFinalityVerifier420 public verifier;
    bytes32 public cureAssetId;
    bytes32 public cureRouteId;
    mapping(bytes32 => bool) public gatewayScripts;
    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bool) public consumedSourceOutputs;
    uint256 public outboundNonce;

    error InvalidAddress(); error InvalidVerifier(); error WrongNetwork(); error NotProofOfStake();
    error Unfinalized(); error InvalidProof(); error GatewayNotAllowed(); error AssetNotConfigured();
    error RouteNotConfigured(); error Replay(); error OnlyRouter(); error InvalidOutbound();

    event VerifierSet(address indexed verifier);
    event GatewayScriptSet(bytes32 indexed scriptHash, bool allowed);
    event CureBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event CurecoinInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionHash, bytes32 indexed sourceOutput);
    event CurecoinOutboundRequested(bytes32 indexed messageId, bytes32 indexed routeId, bytes32 indexed assetId, address sender, bytes recipientHash160, uint256 amount, uint8 scriptType, uint8 addressVersion);

    constructor(address governanceTimelock_, address gatewayRouter_, address verifier_) SystemAccess(governanceTimelock_) {
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

    function setCureBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0) || routeId == bytes32(0)) revert InvalidProof();
        cureAssetId = assetId; cureRouteId = routeId;
        emit CureBindingSet(assetId, routeId);
    }

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        ICurecoinFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.finalized) revert Unfinalized();
        if (p.genesisHash != CURE_MAINNET_GENESIS_HASH || p.messageStart != CURE_MAINNET_MESSAGE_START) revert WrongNetwork();
        if (!p.proofOfStake) revert NotProofOfStake();
        if (p.blockHeight == 0 || p.blockHash == bytes32(0) || p.transactionHash == bytes32(0) || p.messageId == bytes32(0)
            || p.gatewayScriptHash == bytes32(0) || p.sourceOutput == bytes32(0) || p.recipient == address(0) || p.amount == 0) revert InvalidProof();
        if (!gatewayScripts[p.gatewayScriptHash]) revert GatewayNotAllowed();
        if (cureAssetId == bytes32(0)) revert AssetNotConfigured();
        if (cureRouteId == bytes32(0)) revert RouteNotConfigured();
        if (consumedMessages[p.messageId] || consumedSourceOutputs[p.sourceOutput]) revert Replay();
        consumedMessages[p.messageId] = true; consumedSourceOutputs[p.sourceOutput] = true;
        emit CurecoinInboundConsumed(p.messageId, p.transactionHash, p.sourceOutput);
        address syntheticSender = address(uint160(uint256(keccak256(abi.encodePacked(p.sourceOutput)))));
        if (syntheticSender == address(0)) revert InvalidProof();
        v = VerifiedTransfer({routeId:cureRouteId, assetId:cureAssetId, sender:syntheticSender, recipient:p.recipient, amount:p.amount, sourceTxId:p.transactionHash, sourceMessageId:p.messageId});
    }

    function initiateOutbound(bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient, uint256 amount, bytes calldata extra)
        external payable onlyRouter returns (bytes32 sourceMessageId)
    {
        if (routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0) || recipient.length != 20 || amount == 0 || msg.value != 0 || extra.length != 1 || uint8(extra[0]) > 1) revert InvalidOutbound();
        if (assetId != cureAssetId) revert AssetNotConfigured();
        if (routeId != cureRouteId) revert RouteNotConfigured();
        uint8 scriptType = uint8(extra[0]);
        uint8 addressVersion = scriptType == 0 ? CURE_P2PKH_VERSION : CURE_P2SH_VERSION;
        sourceMessageId = keccak256(abi.encode(ADAPTER_ID, block.chainid, routeId, assetId, sender, recipient, amount, scriptType, addressVersion, ++outboundNonce));
        emit CurecoinOutboundRequested(sourceMessageId, routeId, assetId, sender, recipient, amount, scriptType, addressVersion);
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = ICurecoinFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
