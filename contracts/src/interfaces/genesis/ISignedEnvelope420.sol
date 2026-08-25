// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";

interface ISignedEnvelope420 {
    struct Envelope {
        bytes32 domain;
        uint256 chainId;
        Types420.Version protocolVersion;
        bytes32 componentId;
        bytes32 messageType;
        address actor;
        uint256 nonce;
        uint64 validFrom;
        uint64 expiresAt;
        bytes32 payloadHash;
    }

    function envelopeHash(Envelope calldata envelope) external pure returns(bytes32);
}
