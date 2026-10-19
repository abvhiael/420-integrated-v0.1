// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerSeatLedger420.sol";

/// @notice Seat-owner-authorized public encryption key fingerprint registry.
/// @dev Stores hashes only: X25519 public keys and private key material remain off-chain.
///      Binding a fingerprint authenticates the owner address, not control of the secret key.
contract PokerRecipientKeys420 {
    PokerSeatLedger420 public immutable ledger;
    struct KeyBinding { bytes32 fingerprint; uint64 seatEpoch; }
    mapping(bytes32 => mapping(address => KeyBinding)) public bindings;
    error InvalidKey(); error NotSeated();
    event RecipientKeyBound(bytes32 indexed tableId,address indexed player,uint64 epoch,bytes32 fingerprint);

    constructor(address ledger_) {
        if (ledger_ == address(0)) revert InvalidKey();
        ledger=PokerSeatLedger420(ledger_);
    }
    function bindKey(bytes32 tableId,bytes32 fingerprint) external {
        if (fingerprint==bytes32(0)) revert InvalidKey();
        uint8 plusOne=ledger.playerSeatPlusOne(tableId,msg.sender);
        if (plusOne==0) revert NotSeated();
        PokerSeatLedger420.Seat memory seat=ledger.seatOf(tableId,plusOne-1);
        if(seat.player!=msg.sender || seat.epoch==0) revert NotSeated();
        bindings[tableId][msg.sender]=KeyBinding(fingerprint,seat.epoch);
        emit RecipientKeyBound(tableId,msg.sender,seat.epoch,fingerprint);
    }
    function fingerprintOf(bytes32 tableId,uint8 index) external view returns(bytes32 fingerprint) {
        PokerSeatLedger420.Seat memory seat=ledger.seatOf(tableId,index);
        if(seat.player==address(0)) revert NotSeated();
        KeyBinding memory bound=bindings[tableId][seat.player];
        if(bound.seatEpoch!=seat.epoch || bound.fingerprint==bytes32(0)) revert InvalidKey();
        return bound.fingerprint;
    }
}
