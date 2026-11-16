// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../BridgeWire420.sol";

/// @notice Circle CCTP V2 header/body (wire version 1), not CCTP V1.
/// Decoding is not authentication: only the issuer MessageTransmitter accepts
/// attestations and the issuer TokenMessenger/Minter executes native USDC minting.
library CCTPV2Message420 {
    error InvalidMessage();
    struct Message {
        uint32 sourceDomain;
        uint32 destinationDomain;
        bytes32 nonce;
        bytes32 sender;
        bytes32 recipient;
        bytes32 destinationCaller;
        uint32 minFinality;
        uint32 executedFinality;
        bytes32 burnToken;
        address mintRecipient;
        uint256 amount;
        bytes32 messageSender;
        uint256 maxFee;
        uint256 fee;
        uint256 expirationBlock;
    }
    function evmAddress(bytes32 value) internal pure returns(address a) {
        if(uint256(value)>>160!=0)revert InvalidMessage();
        a=address(uint160(uint256(value)));if(a==address(0))revert InvalidMessage();
    }
    function decode(bytes memory raw) internal pure returns(Message memory m) {
        if(raw.length<376||BridgeWire420.readBE(raw,0,4)!=1||BridgeWire420.readBE(raw,148,4)!=1)revert InvalidMessage();
        m.sourceDomain=uint32(BridgeWire420.readBE(raw,4,4));
        m.destinationDomain=uint32(BridgeWire420.readBE(raw,8,4));
        m.nonce=bytes32(BridgeWire420.readBE(raw,12,32));
        m.sender=bytes32(BridgeWire420.readBE(raw,44,32));
        m.recipient=bytes32(BridgeWire420.readBE(raw,76,32));
        m.destinationCaller=bytes32(BridgeWire420.readBE(raw,108,32));
        m.minFinality=uint32(BridgeWire420.readBE(raw,140,4));
        m.executedFinality=uint32(BridgeWire420.readBE(raw,144,4));
        m.burnToken=bytes32(BridgeWire420.readBE(raw,152,32));
        m.mintRecipient=evmAddress(bytes32(BridgeWire420.readBE(raw,184,32)));
        m.amount=BridgeWire420.readBE(raw,216,32);
        m.messageSender=bytes32(BridgeWire420.readBE(raw,248,32));
        m.maxFee=BridgeWire420.readBE(raw,280,32);
        m.fee=BridgeWire420.readBE(raw,312,32);
        m.expirationBlock=BridgeWire420.readBE(raw,344,32);
        uint32 normalized=m.minFinality<=1000?1000:2000;
        if(m.sourceDomain==m.destinationDomain||m.nonce==0||m.sender==0||m.recipient==0||m.burnToken==0||m.messageSender==0||m.amount==0||m.maxFee>=m.amount||m.fee>=m.amount||m.fee>m.maxFee||m.executedFinality<normalized)revert InvalidMessage();
        // The remaining bytes are authenticated opaque hookData. The adapter
        // never executes it; Circle's native core does not execute hooks either.
    }
}
