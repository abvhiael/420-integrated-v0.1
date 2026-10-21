// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerSeatLedger420.sol";
import "./PokerGnarkRecipientKeyPoPAdapter420.sol";

/// @notice Seat-owner-authorized public encryption key fingerprint registry.
/// @dev Stores hashes only: X25519 public keys and private key material remain off-chain.
///      Binding a fingerprint authenticates the owner address, not control of the secret key.
contract PokerRecipientKeys420 {
    PokerSeatLedger420 public immutable ledger;
    struct KeyBinding { bytes32 fingerprint; uint64 seatEpoch; }
    mapping(bytes32 => mapping(address => KeyBinding)) public bindings;
    struct ProvenEncryptionKey {uint256 x;uint256 y;uint64 seatEpoch;bool proven;}
    mapping(bytes32 => mapping(address => ProvenEncryptionKey)) public provenKeys;
    IPokerRecipientKeyPoP420 public keyPoPVerifier;
    bytes32 public constant ACTION_BIND_KEY_POP=keccak256("BET_POKER_BIND_RECIPIENT_KEY_PROOF.V1");
    bytes32 public constant KEY_SCOPE_DOMAIN=keccak256("420.BET.POKER.RECIPIENT.KEY.POP.V1");
    uint256 private constant FR=21888242871839275222246405745257275088696311157297823662689037894645226208583;
    event RecipientProvenEncryptionKey(bytes32 indexed tableId,address indexed player,uint64 epoch,uint256 x,uint256 y);
    event KeyPoPVerifierBound(address verifier);

    error InvalidKey(); error NotSeated();error Unauthorized();
    event RecipientKeyBound(bytes32 indexed tableId,address indexed player,uint64 epoch,bytes32 fingerprint);

    constructor(address ledger_) {
        if (ledger_ == address(0)) revert InvalidKey();
        ledger=PokerSeatLedger420(ledger_);
    }
    function bindProofVerifier(address verifier) external {
        if(verifier==address(0)||verifier.code.length==0||address(keyPoPVerifier)!=address(0))
            revert InvalidKey();
        if(!ledger.authorization().isAuthorized(msg.sender,ACTION_BIND_KEY_POP,
            ledger.authorization().scopeForTable(bytes32(0)),0))revert Unauthorized();
        keyPoPVerifier=IPokerRecipientKeyPoP420(verifier);
        emit KeyPoPVerifierBound(verifier);
    }
    function scopeForKey(bytes32 tableId,address player,uint64 epoch)public view returns(uint256){
        return uint256(keccak256(abi.encode(KEY_SCOPE_DOMAIN,block.chainid,address(this),
            tableId,player,epoch)))%FR;
    }
    function bindVerifiedKey(bytes32 tableId,uint256 x,uint256 y,bytes calldata proof) external {
        if(address(keyPoPVerifier)==address(0)||x>=FR||y>=FR)revert InvalidKey();
        uint8 plusOne=ledger.playerSeatPlusOne(tableId,msg.sender);
        if(plusOne==0)revert NotSeated();
        PokerSeatLedger420.Seat memory seat=ledger.seatOf(tableId,plusOne-1);
        if(seat.player!=msg.sender||seat.epoch==0)revert NotSeated();
        uint256 scope=scopeForKey(tableId,msg.sender,seat.epoch);
        if(scope==0||!keyPoPVerifier.verifyKeyPossession(scope,x,y,proof))revert InvalidKey();
        bytes32 fingerprint=keccak256(abi.encode(KEY_SCOPE_DOMAIN,block.chainid,address(this),
            tableId,msg.sender,seat.epoch,x,y));
        bindings[tableId][msg.sender]=KeyBinding(fingerprint,seat.epoch);
        provenKeys[tableId][msg.sender]=ProvenEncryptionKey(x,y,seat.epoch,true);
        emit RecipientKeyBound(tableId,msg.sender,seat.epoch,fingerprint);
        emit RecipientProvenEncryptionKey(tableId,msg.sender,seat.epoch,x,y);
    }
    function encryptionKeyOf(bytes32 tableId,uint8 index)
        external view returns(uint256 x,uint256 y,bytes32 fingerprint){
        PokerSeatLedger420.Seat memory seat=ledger.seatOf(tableId,index);
        if(seat.player==address(0))revert NotSeated();
        ProvenEncryptionKey memory key=provenKeys[tableId][seat.player];
        KeyBinding memory binding=bindings[tableId][seat.player];
        if(!key.proven||key.seatEpoch!=seat.epoch||
           binding.seatEpoch!=seat.epoch||binding.fingerprint==bytes32(0))
           revert InvalidKey();
        return(key.x,key.y,binding.fingerprint);
    }
    function bindKey(bytes32 tableId,bytes32 fingerprint) external {
        if (fingerprint==bytes32(0)) revert InvalidKey();
        uint8 plusOne=ledger.playerSeatPlusOne(tableId,msg.sender);
        if (plusOne==0) revert NotSeated();
        PokerSeatLedger420.Seat memory seat=ledger.seatOf(tableId,plusOne-1);
        if(seat.player!=msg.sender || seat.epoch==0) revert NotSeated();
        bindings[tableId][msg.sender]=KeyBinding(fingerprint,seat.epoch);
        delete provenKeys[tableId][msg.sender];
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
