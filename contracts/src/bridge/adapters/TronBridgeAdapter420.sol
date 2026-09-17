// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/ITronFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

/// @notice Canonical TRON mainnet adapter for 420Bridge.
/// @dev A governance-approved verifier proves solidified TRON inclusion and execution status.
///      The adapter independently pins the mainnet domain, gateway, route, asset and replay invariants.
contract TronBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/TRON/MAINNET/V12.5.7");
    bytes32 public constant TRX_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/TRX");
    bytes32 public constant TRON_MAINNET_NETWORK_ID = keccak256("TRON/MAINNET");
    uint64 public constant TRX_ROUTE_CHAIN_ID = 0x5452580000000001; // "TRX" + profile version 1
    uint8 public constant TRON_MAINNET_ADDRESS_PREFIX = 0x41;

    address public immutable gatewayRouter;
    ITronFinalityVerifier420 public verifier;
    bytes32 public trxAssetId;
    bytes32 public trxRouteId;

    mapping(bytes20 => bool) public gatewayAccounts;
    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bool) public consumedTransactions;
    uint256 public outboundNonce;

    error InvalidAddress();
    error InvalidVerifier();
    error WrongNetwork();
    error Unsolidified();
    error ExecutionFailed();
    error InvalidProof();
    error GatewayNotAllowed();
    error AssetNotConfigured();
    error RouteNotConfigured();
    error Replay();
    error OnlyRouter();
    error InvalidOutbound();

    event VerifierSet(address indexed verifier);
    event GatewayAccountSet(bytes20 indexed gatewayAccount, bool allowed);
    event TrxBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event TronInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionHash, bytes20 indexed sourceAccount);
    event TronOutboundRequested(
        bytes32 indexed messageId,
        bytes32 indexed routeId,
        bytes32 indexed assetId,
        address sender,
        bytes recipient,
        uint256 amountSun
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

    function setGatewayAccount(bytes20 gatewayAccount, bool allowed) external onlyGovernance {
        if (gatewayAccount == bytes20(0)) revert InvalidProof();
        gatewayAccounts[gatewayAccount] = allowed;
        emit GatewayAccountSet(gatewayAccount, allowed);
    }

    function setTrxBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0) || routeId == bytes32(0)) revert InvalidProof();
        trxAssetId = assetId;
        trxRouteId = routeId;
        emit TrxBindingSet(assetId, routeId);
    }

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        ITronFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.solidified) revert Unsolidified();
        if (!p.executionSuccess) revert ExecutionFailed();
        if (p.networkId != TRON_MAINNET_NETWORK_ID) revert WrongNetwork();
        if (
            p.blockNumber == 0 || p.blockHash == bytes32(0) || p.transactionHash == bytes32(0)
                || p.messageId == bytes32(0) || p.gatewayAccount == bytes20(0) || p.sourceAccount == bytes20(0)
                || p.recipient == address(0) || p.amountSun == 0
        ) revert InvalidProof();
        if (!gatewayAccounts[p.gatewayAccount]) revert GatewayNotAllowed();
        if (trxAssetId == bytes32(0)) revert AssetNotConfigured();
        if (trxRouteId == bytes32(0)) revert RouteNotConfigured();
        if (consumedMessages[p.messageId] || consumedTransactions[p.transactionHash]) revert Replay();

        consumedMessages[p.messageId] = true;
        consumedTransactions[p.transactionHash] = true;
        emit TronInboundConsumed(p.messageId, p.transactionHash, p.sourceAccount);

        v = VerifiedTransfer({
            routeId: trxRouteId,
            assetId: trxAssetId,
            sender: address(p.sourceAccount),
            recipient: p.recipient,
            amount: p.amountSun,
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
            routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0) || recipient.length != 21
                || amount == 0 || msg.value != 0 || extra.length != 0
        ) revert InvalidOutbound();
        if (uint8(recipient[0]) != TRON_MAINNET_ADDRESS_PREFIX) revert WrongNetwork();
        if (assetId != trxAssetId) revert AssetNotConfigured();
        if (routeId != trxRouteId) revert RouteNotConfigured();

        uint256 nonce = ++outboundNonce;
        sourceMessageId = keccak256(
            abi.encode(ADAPTER_ID, block.chainid, routeId, assetId, sender, recipient, amount, nonce)
        );
        emit TronOutboundRequested(sourceMessageId, routeId, assetId, sender, recipient, amount);
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = ITronFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
