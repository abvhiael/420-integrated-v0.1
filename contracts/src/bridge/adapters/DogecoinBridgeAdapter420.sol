// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/IDogecoinFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

/// @notice Canonical Dogecoin mainnet adapter for 420Bridge.
/// @dev Finality/SPV/AuxPoW validation is delegated to a governance-approved verifier, while this
///      adapter independently pins network identity, bridge script, asset/route and replay invariants.
contract DogecoinBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/DOGECOIN/MAINNET/V12.5.5");
    bytes32 public constant DOGE_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/DOGE");
    uint64 public constant DOGE_ROUTE_CHAIN_ID = 0x444f474500000001; // "DOGE" + profile version 1
    bytes32 public constant DOGE_MAINNET_GENESIS_HASH =
        0x1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691;
    bytes4 public constant DOGE_MAINNET_MESSAGE_START = 0xc0c0c0c0;

    address public immutable gatewayRouter;
    IDogecoinFinalityVerifier420 public verifier;
    bytes32 public dogeAssetId;
    bytes32 public dogeRouteId;

    mapping(bytes32 => bool) public gatewayScripts;
    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bool) public consumedSourceOutputs;
    uint256 public outboundNonce;

    error InvalidAddress();
    error InvalidVerifier();
    error WrongNetwork();
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
    event DogeBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event DogecoinInboundConsumed(bytes32 indexed messageId, bytes32 indexed transactionHash, bytes32 indexed sourceOutput);
    event DogecoinOutboundRequested(bytes32 indexed messageId, bytes32 indexed routeId, bytes32 indexed assetId, address sender, bytes recipientHash160, uint256 amount, uint8 scriptType);

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

    function setDogeBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0) || routeId == bytes32(0)) revert InvalidProof();
        dogeAssetId = assetId;
        dogeRouteId = routeId;
        emit DogeBindingSet(assetId, routeId);
    }

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        IDogecoinFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.finalized) revert Unfinalized();
        if (p.genesisHash != DOGE_MAINNET_GENESIS_HASH || p.messageStart != DOGE_MAINNET_MESSAGE_START) revert WrongNetwork();
        if (
            p.blockHeight == 0 || p.blockHash == bytes32(0) || p.transactionHash == bytes32(0)
                || p.messageId == bytes32(0) || p.gatewayScriptHash == bytes32(0) || p.sourceOutput == bytes32(0)
                || p.recipient == address(0) || p.amount == 0
        ) revert InvalidProof();
        if (!gatewayScripts[p.gatewayScriptHash]) revert GatewayNotAllowed();
        if (dogeAssetId == bytes32(0)) revert AssetNotConfigured();
        if (dogeRouteId == bytes32(0)) revert RouteNotConfigured();
        if (consumedMessages[p.messageId] || consumedSourceOutputs[p.sourceOutput]) revert Replay();

        consumedMessages[p.messageId] = true;
        consumedSourceOutputs[p.sourceOutput] = true;
        emit DogecoinInboundConsumed(p.messageId, p.transactionHash, p.sourceOutput);

        address syntheticSender = address(uint160(uint256(keccak256(abi.encodePacked(p.sourceOutput)))));
        if (syntheticSender == address(0)) revert InvalidProof();
        v = VerifiedTransfer({
            routeId: dogeRouteId,
            assetId: dogeAssetId,
            sender: syntheticSender,
            recipient: p.recipient,
            amount: p.amount,
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
            routeId == bytes32(0) || assetId == bytes32(0) || sender == address(0) || recipient.length != 20
                || amount == 0 || msg.value != 0 || extra.length != 1 || uint8(extra[0]) > 1
        ) revert InvalidOutbound();
        if (assetId != dogeAssetId) revert AssetNotConfigured();
        if (routeId != dogeRouteId) revert RouteNotConfigured();

        uint8 scriptType = uint8(extra[0]); // 0=P2PKH, 1=P2SH
        uint256 nonce = ++outboundNonce;
        sourceMessageId = keccak256(
            abi.encode(ADAPTER_ID, block.chainid, routeId, assetId, sender, recipient, amount, scriptType, nonce)
        );
        emit DogecoinOutboundRequested(sourceMessageId, routeId, assetId, sender, recipient, amount, scriptType);
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = IDogecoinFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
