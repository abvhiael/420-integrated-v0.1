// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerConfidentialDeal420.sol";
import "./PokerRecipientKeys420.sol";

/// @notice Verification-only delivery commitments. Never receives ciphertext plaintext or private keys.
/// @dev Cryptographic confidentiality depends on off-chain authenticated encryption and recipient-controlled keys.
///      This verifier proves commitments and a collision-free 52-card plaintext opening at the end of a hand.
///      It CANNOT prove ciphertext matches hidden cards before opening or guarantee a fair secret shuffle.
interface IPokerDeliveryProofBook420 {
    function allVerified(bytes32 handId) external view returns(bool);
    function deals() external view returns(PokerConfidentialDeal420);
    function keys() external view returns(PokerRecipientKeys420);
}
contract PokerDeckDisclosure420 {
    bytes32 public constant DOMAIN = keccak256("420.BET.POKER.DECK.DISCLOSURE.V1");
    PokerConfidentialDeal420 public immutable deals;
    BetAuthorization420 public immutable authorization;
    PokerRecipientKeys420 public immutable keys;
    bytes32 public constant ACTION_BIND_PROOF_BOOK=keccak256("BET_POKER_BIND_PRIVATE_PROOF_BOOK.V1");
    mapping(bytes32=>IPokerDeliveryProofBook420) public proofBookForTable;
    event ProofBookBound(bytes32 indexed tableId,address proofBook);

    struct Deck {
        bytes32 commitment;
        bytes32 encryptedManifestHash;
        uint16 deliveryMask;
        uint16 receiptMask;
        bool published;
        bool disclosed;
    }
    mapping(bytes32 => Deck) public decks;
    mapping(bytes32 => mapping(uint8 => bytes32)) public recipientEnvelopeHash;
    mapping(bytes32 => mapping(uint8 => bytes32)) public receiptHash;
    mapping(bytes32 => mapping(uint8 => bytes32)) public recipientKeyFingerprint;

    error Unauthorized(); error InvalidState(); error InvalidValue(); error Duplicate();
    error InvalidDeck(); error NotRecipient();
    event DeckPublished(bytes32 indexed handId,bytes32 indexed deckCommitment,bytes32 encryptedManifestHash);
    event EnvelopeBound(bytes32 indexed handId,uint8 indexed seat,bytes32 envelopeHash);
    event EnvelopeAcknowledged(bytes32 indexed handId,uint8 indexed seat,bytes32 receipt);
    event DeckDisclosed(bytes32 indexed handId,bytes32 verificationHash);

    constructor(address deals_,address keys_) {
        if (deals_==address(0) || keys_==address(0)) revert InvalidValue();
        deals=PokerConfidentialDeal420(deals_);
        authorization=deals.authorization();
        keys=PokerRecipientKeys420(keys_);
        if(address(keys.ledger())!=address(deals.ledger())) revert InvalidValue();
    }
    /// @notice One-time governance binding; receipts without proof are never
    /// sufficient for funding-enabled game start.
    function bindProofBook(bytes32 tableId,address book) external {
        if(book==address(0)||book.code.length==0||
           address(proofBookForTable[tableId])!=address(0))revert InvalidValue();
        if(!authorization.isAuthorized(msg.sender,ACTION_BIND_PROOF_BOOK,
           authorization.scopeForTable(tableId),0))revert Unauthorized();
        IPokerDeliveryProofBook420 proofs=IPokerDeliveryProofBook420(book);
        if(address(proofs.deals())!=address(deals)||
           address(proofs.keys())!=address(keys))revert InvalidValue();
        proofBookForTable[tableId]=proofs;
        emit ProofBookBound(tableId,book);
    }
    function hashDeck(bytes32 handId,uint8[52] calldata order,bytes32 salt)
        public view returns(bytes32) {
        return keccak256(abi.encode(DOMAIN,block.chainid,address(this),handId,order,salt));
    }
    function publish(bytes32 handId,bytes32 commitment,bytes32 encryptedManifestHash) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if (h.state!=PokerConfidentialDeal420.State.COMMITTED) revert InvalidState();
        if (msg.sender!=deals.providerA() && msg.sender!=deals.providerB()) revert Unauthorized();
        if (!authorization.isAuthorized(msg.sender,deals.ACTION_PROVIDER_COMMIT(),
                authorization.scopeForTable(h.tableId),0)) revert Unauthorized();
        if (commitment==bytes32(0)||encryptedManifestHash==bytes32(0)) revert InvalidValue();
        if (decks[handId].published) revert Duplicate();
        decks[handId].commitment=commitment;
        decks[handId].encryptedManifestHash=encryptedManifestHash;
        decks[handId].published=true;
        emit DeckPublished(handId,commitment,encryptedManifestHash);
    }
    function bindEnvelope(bytes32 handId,uint8 seat,bytes32 envelopeHash,bytes32 fingerprint) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        Deck storage d=decks[handId];
        if (h.state!=PokerConfidentialDeal420.State.COMMITTED || !d.published || d.disclosed)
            revert InvalidState();
        uint16 seatBit=uint16(1)<<seat;
        if (seat>=9 || (deals.handSeatMask(handId)&seatBit)==0) revert NotRecipient();
        if (msg.sender!=deals.providerA() && msg.sender!=deals.providerB()) revert Unauthorized();
        if (!authorization.isAuthorized(msg.sender,deals.ACTION_PROVIDER_COMMIT(),
                authorization.scopeForTable(h.tableId),0)) revert Unauthorized();
        if (envelopeHash==bytes32(0) || fingerprint==bytes32(0)) revert InvalidValue();
        if (keys.fingerprintOf(h.tableId,seat) != fingerprint) revert NotRecipient();
        if ((d.deliveryMask&seatBit)!=0) revert Duplicate();
        d.deliveryMask|=seatBit;
        recipientEnvelopeHash[handId][seat]=envelopeHash;
        recipientKeyFingerprint[handId][seat]=fingerprint;
        emit EnvelopeBound(handId,seat,envelopeHash);
    }
    function acknowledge(bytes32 handId,uint8 seat,bytes32 receipt) external {
        Deck storage d=decks[handId];
        uint16 seatBit=uint16(1)<<seat;
        if (seat>=9 || (d.deliveryMask&seatBit)==0 || d.disclosed) revert InvalidState();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if (h.state!=PokerConfidentialDeal420.State.COMMITTED) revert InvalidState();
        PokerSeatLedger420.Seat memory s=deals.ledger().seatOf(h.tableId,seat);
        if (msg.sender!=s.player || s.player==address(0)) revert NotRecipient();
        if (receipt==bytes32(0) || (d.receiptMask&seatBit)!=0) revert InvalidValue();
        if (deals.ledger().seatingEpoch(h.tableId)!=h.epoch ||
            keys.fingerprintOf(h.tableId,seat)!=recipientKeyFingerprint[handId][seat]) revert InvalidState();
        d.receiptMask|=seatBit;
        receiptHash[handId][seat]=receipt;
        emit EnvelopeAcknowledged(handId,seat,receipt);
    }
    function getDeck(bytes32 handId) external view returns (Deck memory) { return decks[handId]; }
    function allAcknowledged(bytes32 handId) external view returns(bool) {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        uint16 mask=deals.handSeatMask(handId);
        Deck storage d=decks[handId];
        if(!d.published||d.disclosed||mask==0||
           (d.deliveryMask&mask)!=mask||(d.receiptMask&mask)!=mask||
           deals.ledger().seatingEpoch(h.tableId)!=h.epoch)return false;
        // A receipt does not remain valid after a recipient changes their key.
        // Re-evaluate the ownership/key binding immediately before hand start.
        for(uint8 i=0;i<9;i++)if((mask&(uint16(1)<<i))!=0){
            if(recipientEnvelopeHash[handId][i]==bytes32(0)||
               receiptHash[handId][i]==bytes32(0)||
               recipientKeyFingerprint[handId][i]==bytes32(0)||
               keys.fingerprintOf(h.tableId,i)!=recipientKeyFingerprint[handId][i])
                return false;
        }
        IPokerDeliveryProofBook420 proofs=proofBookForTable[h.tableId];
        if(address(proofs)==address(0)||!proofs.allVerified(handId))return false;
        return true;
    }

    /// @notice Public verifier is suitable ONLY for already-released/post-game cards.
    /// @dev Clients must not call with a secret deck before independently certified hand finality.
    function verifyOpenedDeck(bytes32 handId,uint8[52] calldata order,bytes32 salt) external view returns(bool) {
        Deck storage d=decks[handId];
        if (!d.published || salt==bytes32(0) || hashDeck(handId,order,salt)!=d.commitment) revert InvalidDeck();
        uint256 bitmap=0;
        for(uint256 i=0;i<52;++i) {
            if(order[i]>=52) revert InvalidDeck();
            uint256 flag=uint256(1)<<order[i];
            if((bitmap&flag)!=0) revert InvalidDeck();
            bitmap|=flag;
        }
        return true;
    }
    /// @notice Explicitly unavailable until a separately qualified hand-finality oracle exists.
    function disclose(bytes32,uint8[52] calldata,bytes32) external pure {
        revert InvalidState();
    }
}
