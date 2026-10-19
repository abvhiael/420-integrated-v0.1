// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerConfidentialDeal420.sol";

/// @notice Player-owned, epoch-bound secp256k1 action signer authority.
/// @dev Distinct from X25519 encryption keys and off-chain Ed25519 test keys.
///      Signature verification uses ecrecover with a low-s canonical signature.
contract PokerActionKeys420 {
    bytes32 public constant ACTION_DOMAIN = keccak256("420.BET.POKER.PLAYER.ACTION.V1");
    uint256 private constant HALF_ORDER =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    PokerConfidentialDeal420 public immutable deals;
    struct Binding { address signer; uint64 seatEpoch; uint64 serial; }
    mapping(bytes32 => mapping(address => Binding)) public keys;
    mapping(bytes32 => mapping(uint8 => uint64)) public lastActionNonce;
    error Unauthorized(); error InvalidSigner(); error InvalidSeat(); error InvalidSignature();
    error Replay(); error InvalidHand();
    event ActionSignerBound(bytes32 indexed tableId,address indexed player,address signer,uint64 epoch,uint64 serial);
    event ActionVerified(bytes32 indexed handId,uint8 indexed seat,uint64 nonce,bytes32 actionHash);
    constructor(address deals_) {
        if(deals_==address(0)) revert InvalidSigner();
        deals=PokerConfidentialDeal420(deals_);
    }
    function bindSigner(bytes32 tableId,address signer) external {
        if(signer==address(0)) revert InvalidSigner();
        uint8 plusOne=deals.ledger().playerSeatPlusOne(tableId,msg.sender);
        if(plusOne==0) revert InvalidSeat();
        PokerSeatLedger420.Seat memory s=deals.ledger().seatOf(tableId,plusOne-1);
        if(s.player!=msg.sender || s.epoch==0) revert InvalidSeat();
        Binding storage bound=keys[tableId][msg.sender];
        bound.signer=signer; bound.seatEpoch=s.epoch; ++bound.serial;
        emit ActionSignerBound(tableId,msg.sender,signer,s.epoch,bound.serial);
    }
    function actionDigest(bytes32 handId,uint8 seat,uint64 nonce,bytes32 expectedState,
        bytes32 moveHash,uint64 expiry) public view returns(bytes32) {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED || nonce==0 ||
           expectedState==bytes32(0) || moveHash==bytes32(0)) revert InvalidHand();
        PokerSeatLedger420.Seat memory s=deals.ledger().seatOf(h.tableId,seat);
        Binding memory bound=keys[h.tableId][s.player];
        if(s.player==address(0) || bound.signer==address(0) || bound.seatEpoch!=s.epoch)
            revert InvalidSeat();
        return keccak256(abi.encode(ACTION_DOMAIN,block.chainid,address(this),handId,
            h.tableId,h.configHash,h.rulesetId,h.versionId,h.epoch,h.seatSnapshotHash,
            seat,s.player,s.epoch,bound.serial,nonce,expectedState,moveHash,expiry));
    }
    function verifyAndConsume(bytes32 handId,uint8 seat,uint64 nonce,bytes32 expectedState,
        bytes32 moveHash,uint64 expiry,bytes calldata signature) external returns(bytes32 digest) {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        // This is an authentication primitive, not a full betting legality or settlement gate.
        if(expiry<block.timestamp || deals.ledger().seatingEpoch(h.tableId)!=h.epoch ||
            deals.snapshotFor(h.tableId,deals.handSeatMask(handId))!=h.seatSnapshotHash)
            revert InvalidHand();
        if(nonce!=lastActionNonce[handId][seat]+1) revert Replay();
        digest=actionDigest(handId,seat,nonce,expectedState,moveHash,expiry);
        if(signature.length!=65) revert InvalidSignature();
        bytes32 rr; bytes32 ss; uint8 vv;
        assembly {
            rr := calldataload(signature.offset)
            ss := calldataload(add(signature.offset,32))
            vv := byte(0,calldataload(add(signature.offset,64)))
        }
        if(uint256(ss)==0 || uint256(ss)>HALF_ORDER || uint256(rr)==0 ||
            (vv!=27&&vv!=28)) revert InvalidSignature();
        address recovered=ecrecover(digest,vv,rr,ss);
        PokerSeatLedger420.Seat memory s=deals.ledger().seatOf(h.tableId,seat);
        if(recovered==address(0) || recovered!=keys[h.tableId][s.player].signer)
            revert InvalidSignature();
        lastActionNonce[handId][seat]=nonce;
        emit ActionVerified(handId,seat,nonce,digest);
    }
}
