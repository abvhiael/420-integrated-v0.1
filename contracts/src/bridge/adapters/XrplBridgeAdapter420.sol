// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/IXrplFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

/// @notice Canonical XRP Ledger mainnet adapter for 420Bridge.
contract XrplBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/XRPL/MAINNET/V12.5.15");
    bytes32 public constant XRP_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/XRP");
    uint64 public constant XRP_ROUTE_CHAIN_ID = 0x5852504c00000001;

    address public immutable gatewayRouter;
    IXrplFinalityVerifier420 public verifier;
    bytes32 public xrpAssetId;
    bytes32 public xrpRouteId;
    mapping(bytes20 => bool) public gatewayAccounts;
    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bool) public consumedTransactions;
    uint256 public outboundNonce;

    struct OutboundRequest {
        bytes32 routeId;
        bytes32 assetId;
        address sender;
        bytes20 destinationAccount;
        uint8 hasTag;
        uint32 destinationTag;
        uint256 amount;
    }

    error InvalidAddress();
    error InvalidVerifier();
    error InvalidBinding();
    error InvalidProof();
    error UnvalidatedLedger();
    error TransactionFailed();
    error GatewayNotAllowed();
    error Replay();
    error OnlyRouter();
    error InvalidOutbound();

    event VerifierSet(address indexed verifier);
    event GatewayAccountSet(bytes20 indexed accountId, bool allowed);
    event XrpBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event XrpInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionHash, uint32 ledgerIndex);
    event XrpOutboundRequested(bytes32 indexed messageId, bytes32 indexed routeId, bytes32 indexed assetId, address sender, bytes20 destinationAccount, bool hasDestinationTag, uint32 destinationTag, uint256 amountDrops);

    constructor(address governanceTimelock_, address gatewayRouter_, address verifier_) SystemAccess(governanceTimelock_) {
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

    function setGatewayAccount(bytes20 accountId, bool allowed) external onlyGovernance {
        if (accountId == bytes20(0)) revert InvalidBinding();
        gatewayAccounts[accountId] = allowed;
        emit GatewayAccountSet(accountId, allowed);
    }

    function setXrpBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0) || routeId == bytes32(0)) revert InvalidBinding();
        xrpAssetId = assetId;
        xrpRouteId = routeId;
        emit XrpBindingSet(assetId, routeId);
    }

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        IXrplFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.validated) revert UnvalidatedLedger();
        if (!p.tesSuccess) revert TransactionFailed();
        if (p.ledgerIndex == 0 || p.ledgerHash == bytes32(0) || p.transactionRoot == bytes32(0) || p.transactionHash == bytes32(0) || p.messageId == bytes32(0) || p.gatewayAccount == bytes20(0) || p.sourceAccount == bytes20(0) || p.recipient == address(0) || p.amountDrops == 0) revert InvalidProof();
        if (!gatewayAccounts[p.gatewayAccount]) revert GatewayNotAllowed();
        if (xrpAssetId == bytes32(0) || xrpRouteId == bytes32(0)) revert InvalidBinding();
        if (consumedMessages[p.messageId] || consumedTransactions[p.transactionHash]) revert Replay();

        consumedMessages[p.messageId] = true;
        consumedTransactions[p.transactionHash] = true;
        emit XrpInboundConsumed(p.messageId, p.transactionHash, p.ledgerIndex);

        v = VerifiedTransfer({routeId: xrpRouteId, assetId: xrpAssetId, sender: address(uint160(p.sourceAccount)), recipient: p.recipient, amount: p.amountDrops, sourceTxId: p.transactionHash, sourceMessageId: p.messageId});
    }

    function initiateOutbound(bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient, uint256 amount, bytes calldata extra) external payable onlyRouter returns (bytes32 sourceMessageId) {
        _validateOutboundBase(routeId, assetId, sender, recipient.length, amount);
        (bytes20 destinationAccount, uint8 hasTag, uint32 destinationTag) = _decodeRecipient(recipient);
        OutboundRequest memory request = OutboundRequest({routeId: routeId, assetId: assetId, sender: sender, destinationAccount: destinationAccount, hasTag: hasTag, destinationTag: destinationTag, amount: amount});
        uint256 nonce = ++outboundNonce;
        sourceMessageId = _deriveOutboundMessageId(request, nonce, extra);
        _emitOutbound(sourceMessageId, request);
    }

    function _validateOutboundBase(bytes32 routeId, bytes32 assetId, address sender, uint256 recipientLength, uint256 amount) private view {
        if (routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0) || recipientLength != 25 || amount == 0 || msg.value != 0 || routeId != xrpRouteId || assetId != xrpAssetId) revert InvalidOutbound();
    }

    function _decodeRecipient(bytes calldata recipient) private pure returns (bytes20 destinationAccount, uint8 hasTag, uint32 destinationTag) {
        assembly {
            destinationAccount := calldataload(recipient.offset)
            hasTag := byte(0, calldataload(add(recipient.offset, 20)))
            destinationTag := shr(224, calldataload(add(recipient.offset, 21)))
        }
        if (destinationAccount == bytes20(0) || hasTag > 1 || (hasTag == 0 && destinationTag != 0)) revert InvalidOutbound();
    }

    function _deriveOutboundMessageId(OutboundRequest memory request, uint256 nonce, bytes calldata extra) private view returns (bytes32) {
        bytes32 requestHash = keccak256(abi.encode(request.routeId, request.assetId, request.sender, request.destinationAccount, request.hasTag, request.destinationTag, request.amount, extra));
        return keccak256(abi.encode(ADAPTER_ID, block.chainid, nonce, requestHash));
    }

    function _emitOutbound(bytes32 sourceMessageId, OutboundRequest memory request) private {
        emit XrpOutboundRequested(sourceMessageId, request.routeId, request.assetId, request.sender, request.destinationAccount, request.hasTag == 1, request.destinationTag, request.amount);
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = IXrplFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
