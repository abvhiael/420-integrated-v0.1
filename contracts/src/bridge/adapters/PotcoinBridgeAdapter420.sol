// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/IPotcoinFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

/// @notice Canonical native PotCoin mainnet adapter for 420Bridge.
/// @dev The verifier owns PotCoin PoS/header/finality validation. This adapter independently pins
///      mainnet identity, post-bootstrap PoS policy, gateway scripts, POT binding and replay invariants.
contract PotcoinBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/POTCOIN/MAINNET/V12.5.9");
    bytes32 public constant POT_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/POT");
    uint64 public constant POT_ROUTE_CHAIN_ID = 0x504f540000000001; // "POT" + profile version 1
    bytes32 public constant POT_MAINNET_NETWORK_ID = keccak256("POTCOIN/MAINNET");
    uint64 public constant POT_LAST_POW_BLOCK = 500;
    uint8 public constant POT_P2PKH_VERSION = 55;
    uint8 public constant POT_P2SH_VERSION = 110;

    address public immutable gatewayRouter;
    IPotcoinFinalityVerifier420 public verifier;
    bytes32 public potAssetId;
    bytes32 public potRouteId;

    mapping(bytes32 => bool) public gatewayScripts;
    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bool) public consumedSourceOutputs;
    uint256 public outboundNonce;

    error InvalidAddress();
    error InvalidVerifier();
    error WrongNetwork();
    error NotProofOfStake();
    error BootstrapBlockRejected();
    error Unfinalized();
    error InvalidProof();
    error GatewayNotAllowed();
    error AssetNotConfigured();
    error RouteNotConfigured();
    error Replay();
    error OnlyRouter();
    error InvalidOutbound();

    event VerifierSet(address indexed verifier);
    event GatewayScriptSet(bytes32 indexed scriptHash, bool allowed);
    event PotBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event PotcoinInboundConsumed(
        bytes32 indexed messageId,
        bytes32 indexed transactionHash,
        bytes32 indexed sourceOutput
    );
    event PotcoinOutboundRequested(
        bytes32 indexed messageId,
        bytes32 indexed routeId,
        bytes32 indexed assetId,
        address sender,
        bytes recipientHash160,
        uint256 amountPotSatoshis,
        uint8 scriptType,
        uint8 addressVersion
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

    function adapterId() external pure returns (bytes32) { return ADAPTER_ID; }
    function setVerifier(address verifier_) external onlyGovernance { _setVerifier(verifier_); }

    function setGatewayScript(bytes32 scriptHash, bool allowed) external onlyGovernance {
        if (scriptHash == bytes32(0)) revert InvalidProof();
        gatewayScripts[scriptHash] = allowed;
        emit GatewayScriptSet(scriptHash, allowed);
    }

    function setPotBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0) || routeId == bytes32(0)) revert InvalidProof();
        potAssetId = assetId;
        potRouteId = routeId;
        emit PotBindingSet(assetId, routeId);
    }

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        IPotcoinFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.finalized) revert Unfinalized();
        if (p.networkId != POT_MAINNET_NETWORK_ID) revert WrongNetwork();
        if (p.blockHeight <= POT_LAST_POW_BLOCK) revert BootstrapBlockRejected();
        if (!p.proofOfStake) revert NotProofOfStake();
        if (
            p.blockHash == bytes32(0) || p.transactionHash == bytes32(0) || p.messageId == bytes32(0)
                || p.gatewayScriptHash == bytes32(0) || p.sourceOutput == bytes32(0)
                || p.recipient == address(0) || p.amountPotSatoshis == 0
        ) revert InvalidProof();
        if (!gatewayScripts[p.gatewayScriptHash]) revert GatewayNotAllowed();
        if (potAssetId == bytes32(0)) revert AssetNotConfigured();
        if (potRouteId == bytes32(0)) revert RouteNotConfigured();
        if (consumedMessages[p.messageId] || consumedSourceOutputs[p.sourceOutput]) revert Replay();

        consumedMessages[p.messageId] = true;
        consumedSourceOutputs[p.sourceOutput] = true;
        emit PotcoinInboundConsumed(p.messageId, p.transactionHash, p.sourceOutput);

        address syntheticSender = address(uint160(uint256(keccak256(abi.encodePacked(p.sourceOutput)))));
        if (syntheticSender == address(0)) revert InvalidProof();

        v = VerifiedTransfer({
            routeId: potRouteId,
            assetId: potAssetId,
            sender: syntheticSender,
            recipient: p.recipient,
            amount: p.amountPotSatoshis,
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
        if (
            routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0)
                || recipient.length != 20 || amount == 0 || msg.value != 0
                || extra.length != 1 || uint8(extra[0]) > 1
        ) revert InvalidOutbound();
        if (assetId != potAssetId) revert AssetNotConfigured();
        if (routeId != potRouteId) revert RouteNotConfigured();

        uint8 scriptType = uint8(extra[0]); // 0=P2PKH, 1=P2SH
        uint8 addressVersion = scriptType == 0 ? POT_P2PKH_VERSION : POT_P2SH_VERSION;
        uint256 nonce = ++outboundNonce;
        sourceMessageId = keccak256(
            abi.encode(
                ADAPTER_ID,
                block.chainid,
                routeId,
                assetId,
                sender,
                recipient,
                amount,
                scriptType,
                addressVersion,
                nonce
            )
        );
        emit PotcoinOutboundRequested(
            sourceMessageId,
            routeId,
            assetId,
            sender,
            recipient,
            amount,
            scriptType,
            addressVersion
        );
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = IPotcoinFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
