// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/IPirateChainFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

/// @notice Canonical native Pirate Chain (ARRR) bridge adapter.
/// @dev ARRR transfers are shielded. The verifier must supply viewing-key-backed evidence for
///      amount/recipient while independently validating Pirate chain consensus/finality.
contract PirateChainBridgeAdapter420 is IBridgeAdapter420, SystemAccess {
    bytes32 public constant ADAPTER_ID = keccak256("420/BRIDGE/PIRATE/MAINNET/V12.5.12");
    bytes32 public constant ARRR_CHAIN_KEY = keccak256("420/BRIDGE/CHAIN/ARRR");
    uint64 public constant ARRR_ROUTE_CHAIN_ID = 0x4152525200000001; // "ARRR" + profile version 1
    bytes32 public constant PIRATE_MAINNET_NETWORK_ID = keccak256("PIRATE/MAINNET");
    uint32 public constant MIN_DPOW_CONFIRMATIONS = 3;
    uint8 public constant SAPLING_POOL = 0;
    uint8 public constant IRONWOOD_POOL = 1;

    address public immutable gatewayRouter;
    IPirateChainFinalityVerifier420 public verifier;
    bytes32 public arrrAssetId;
    bytes32 public arrrRouteId;

    mapping(bytes32 => bool) public gatewayKeys;
    mapping(bytes32 => bool) public consumedMessages;
    mapping(bytes32 => bool) public consumedNullifiers;
    mapping(bytes32 => bool) public consumedNotes;
    uint256 public outboundNonce;

    error InvalidAddress();
    error InvalidVerifier();
    error WrongNetwork();
    error InvalidShieldedPool();
    error Unfinalized();
    error InvalidConsensusProof();
    error InsufficientConfirmations();
    error InvalidProof();
    error AssetNotConfigured();
    error RouteNotConfigured();
    error Replay();
    error OnlyRouter();
    error InvalidOutbound();

    event VerifierSet(address indexed verifier);
    event ArrrBindingSet(bytes32 indexed assetId, bytes32 indexed routeId);
    event PirateInboundConsumed(
        bytes32 indexed messageId,
        bytes32 indexed transactionHash,
        bytes32 indexed nullifier,
        bytes32 noteCommitment,
        uint8 shieldedPool
    );
    event PirateOutboundRequested(
        bytes32 indexed messageId,
        bytes32 indexed routeId,
        bytes32 indexed assetId,
        address sender,
        bytes recipient,
        uint256 amountArrrtoshi,
        uint8 shieldedPool
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

    function setArrrBinding(bytes32 assetId, bytes32 routeId) external onlyGovernance {
        if (assetId == bytes32(0) || routeId == bytes32(0)) revert InvalidProof();
        arrrAssetId = assetId;
        arrrRouteId = routeId;
        emit ArrrBindingSet(assetId, routeId);
    }

    function setGatewayKey(bytes32 keyId,bool allowed) external onlyGovernance {if(keyId==0)revert InvalidProof();gatewayKeys[keyId]=allowed;}

    function verifyInbound(bytes calldata proof) external onlyRouter returns (VerifiedTransfer memory v) {
        IPirateChainFinalityVerifier420.FinalizedTransfer memory p = verifier.verifyFinalizedTransfer(proof);
        if (!p.finalized) revert Unfinalized();
        if (p.networkId != PIRATE_MAINNET_NETWORK_ID) revert WrongNetwork();
        if (!p.equihashValidated || !p.notarizationValidated) revert InvalidConsensusProof();
        if (p.confirmations < MIN_DPOW_CONFIRMATIONS) revert InsufficientConfirmations();
        if (p.shieldedPool > IRONWOOD_POOL) revert InvalidShieldedPool();
        if (
            p.blockHeight == 0 || p.blockHash == bytes32(0) || p.transactionHash == bytes32(0)
                || p.messageId == bytes32(0) || p.nullifier == bytes32(0) || p.noteCommitment == bytes32(0)
                || p.memoBindingHash == bytes32(0) || p.recipient == address(0) || p.amountArrrtoshi == 0
        ) revert InvalidProof();
        if (arrrAssetId == bytes32(0)) revert AssetNotConfigured();
        if (arrrRouteId == bytes32(0)) revert RouteNotConfigured();
        if(p.destinationChainId!=block.chainid||p.destinationRouter!=gatewayRouter||p.routeId!=arrrRouteId||!gatewayKeys[p.gatewayKeyId])revert InvalidProof();
        if (consumedMessages[p.messageId] || consumedNullifiers[p.nullifier] || consumedNotes[p.noteCommitment]) revert Replay();

        consumedMessages[p.messageId] = true;
        consumedNullifiers[p.nullifier] = true;
        consumedNotes[p.noteCommitment] = true;
        emit PirateInboundConsumed(p.messageId, p.transactionHash, p.nullifier, p.noteCommitment, p.shieldedPool);

        address syntheticSender = address(uint160(uint256(keccak256(abi.encodePacked(p.nullifier, p.noteCommitment)))));
        if (syntheticSender == address(0)) revert InvalidProof();

        v = VerifiedTransfer({
            routeId: arrrRouteId,
            assetId: arrrAssetId,
            sender: syntheticSender,
            recipient: p.recipient,
            amount: p.amountArrrtoshi,
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
                || recipient.length < 4 || recipient.length > 192 || amount == 0 || amount > 200_000_000 * 100_000_000 || msg.value != 0
                || extra.length != 1 || uint8(extra[0]) > IRONWOOD_POOL
        ) revert InvalidOutbound();
        if (assetId != arrrAssetId) revert AssetNotConfigured();
        if (routeId != arrrRouteId) revert RouteNotConfigured();

        uint8 shieldedPool = uint8(extra[0]);
        if (!_validRecipientPrefix(recipient, shieldedPool)) revert InvalidOutbound();

        uint256 nonce = ++outboundNonce;
        sourceMessageId = keccak256(
            abi.encode(ADAPTER_ID, block.chainid, routeId, assetId, sender, recipient, amount, shieldedPool, nonce)
        );
        emit PirateOutboundRequested(sourceMessageId, routeId, assetId, sender, recipient, amount, shieldedPool);
    }

    // Both native Pirate encoders use original Bech32 (checksum 1), including
    // Ironwood. Exact 43-byte payload; lowercase canonical form, no extra bits.
    function _step(uint32 c,uint8 value) private pure returns(uint32) {
        uint32 top=c>>25;c=((c&0x1ffffff)<<5)^value;
        uint32[5] memory gen=[uint32(0x3b6a57b2),0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
        for(uint8 i;i<5;++i)if((top>>i)&1!=0)c^=gen[i];return c;
    }
    function _validRecipientPrefix(bytes calldata recipient, uint8 pool) private pure returns(bool) {
        bytes memory hrp=pool==0?bytes("zs"):bytes("pirate");uint256 h=hrp.length;
        if(recipient.length!=h+1+69+6||recipient[h]!=0x31)return false;
        uint32 c=1;for(uint256 i;i<h;++i){if(recipient[i]!=hrp[i])return false;c=_step(c,uint8(hrp[i])>>5);}
        c=_step(c,0);for(uint256 i;i<h;++i)c=_step(c,uint8(hrp[i])&31);
        bytes memory alphabet=bytes("qpzry9x8gf2tvdw0s3jn54khce6mua7l");uint8 last;
        for(uint256 i=h+1;i<recipient.length;++i){uint8 value=32;for(uint8 j;j<32;++j)if(recipient[i]==alphabet[j]){value=j;break;}if(value==32)return false;c=_step(c,value);if(i==h+69)last=value;}
        return c==1&&(last&1)==0;
    }

    function _setVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        verifier = IPirateChainFinalityVerifier420(verifier_);
        emit VerifierSet(verifier_);
    }
}
