// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical, versioned inbound-proof transport envelope.
/// @dev The envelope is NOT evidence of source consensus; the selected adapter/verifier must
///      authenticate innerProof. The router independently checks the declared destination,
///      route/asset and verified transfer against canonical route/chain registries.
library BridgeProofEnvelope420 {
    uint256 internal constant VERSION = 1;
    uint256 internal constant MAX_AGE = 1 days;

    struct Envelope {
        uint256 version;
        bytes32 routeId;
        bytes32 adapterId;
        bytes32 assetId;
        uint64 sourceChainId;
        uint64 destinationChainId;
        bytes32 sourceNetworkId;
        bytes32 destinationNetworkId;
        bytes32 sourceGateway;
        bytes32 sourceAsset;
        bytes32 verifierConfigHash;
        uint256 destinationChainIdEvm;
        address destinationRouter;
        address recipient;
        uint256 amount;
        bytes32 sourceTxId;
        bytes32 sourceMessageId;
        uint64 observedAt;
        uint64 expiresAt;
        bytes innerProof;
    }

    error MalformedProofEnvelope();
    error ExpiredProofEnvelope();
    error InvalidProofEnvelope();

    /// @dev abi.decode rejects short and malformed data. Canonical re-encoding eliminates
    ///      trailing-byte and offset/alias ambiguity between envelope consumers.
    function decode(bytes calldata encoded) internal view returns (Envelope memory e) {
        if (encoded.length < 22 * 32 || encoded.length > 131072) revert MalformedProofEnvelope();
        e = abi.decode(encoded, (Envelope));
        if (keccak256(encoded) != keccak256(abi.encode(e))) revert MalformedProofEnvelope();
        if (
            e.version != VERSION || e.routeId == bytes32(0) || e.adapterId == bytes32(0)
                || e.assetId == bytes32(0) || e.sourceChainId == 0 || e.destinationChainId == 0
                || e.sourceChainId == e.destinationChainId || e.sourceNetworkId == bytes32(0)
                || e.destinationNetworkId == bytes32(0) || e.sourceGateway == bytes32(0)
                || e.sourceAsset == bytes32(0) || e.verifierConfigHash == bytes32(0)
                || e.destinationChainIdEvm != block.chainid || e.destinationRouter != msg.sender
                || e.recipient == address(0) || e.amount == 0 || e.sourceTxId == bytes32(0)
                || e.sourceMessageId == bytes32(0) || e.innerProof.length == 0
        ) revert InvalidProofEnvelope();
        if (
            e.observedAt == 0 || e.observedAt > block.timestamp || e.expiresAt <= block.timestamp
                || e.expiresAt < e.observedAt || block.timestamp - e.observedAt > MAX_AGE
                || uint256(e.expiresAt) - uint256(e.observedAt) > MAX_AGE
        ) revert ExpiredProofEnvelope();
    }
}
