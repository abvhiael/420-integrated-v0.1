// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerDeckDisclosure420.sol";

/// @dev Scope-isolated receipt tests use a stub proof-completion seam.
/// Genuine proof soundness and the funded multi-proof book are tested separately.
contract FakeProofBookDisclosure54 is IPokerDeliveryProofBook420 {
    PokerConfidentialDeal420 public immutable deals;
    PokerRecipientKeys420 public immutable keys;
    constructor(address deal,address registry){deals=PokerConfidentialDeal420(deal);keys=PokerRecipientKeys420(registry);}
    mapping(bytes32=>mapping(uint8=>bytes32)) public expectedEnvelope;
    function allowEnvelope(bytes32 handId,uint8 seat,bytes32 digest) external {
        expectedEnvelope[handId][seat]=digest;
    }
    function envelopeHashFor(bytes32 handId,uint8 seat) external view returns(bytes32){
        return expectedEnvelope[handId][seat];
    }
    function allVerified(bytes32) external pure returns(bool){return true;}
}
contract PokerDeckDisclosure54Test is PokerConfidentialDeal54Test {
    PokerDeckDisclosure420 disclosure;
    PokerRecipientKeys420 keyRegistry;
    FakeProofBookDisclosure54 proofScope;
    bytes32 constant KEY_A = keccak256("registered player A key");
    bytes32 constant KEY_B = keccak256("registered player B key");
    constructor() {
        keyRegistry = new PokerRecipientKeys420(address(ledger));
        disclosure = new PokerDeckDisclosure420(address(deal),address(keyRegistry));
        proofScope=new FakeProofBookDisclosure54(address(deal),address(keyRegistry));
        cap.grant(ADMIN,disclosure.ACTION_BIND_PROOF_BOOK(),auth.scopeForTable(TABLE),true);
        cheat54.prank(ADMIN);disclosure.bindProofBook(TABLE,address(proofScope));
    }

    function _ready() internal returns(bytes32 id) {
        _prepared();
        cheat54.prank(PLAYER); keyRegistry.bindKey(TABLE,KEY_A);
        cheat54.prank(PLAYER_B); keyRegistry.bindKey(TABLE,KEY_B);
        id=_begin(1);
        cheat54.prank(PROVIDER_A); deal.commit(id,keccak256("provider A root"));
        cheat54.prank(PROVIDER_B); deal.commit(id,keccak256("provider B root"));
    }
    function _cards() internal pure returns(uint8[52] memory cards) {
        for(uint8 i=0;i<52;++i) cards[i]=i;
    }
    function testPostHandDeckCommitmentAndAllCardsUnique() public {
        bytes32 id=_ready();
        uint8[52] memory cards=_cards();
        bytes32 digest=disclosure.hashDeck(id,cards,keccak256("salt"));
        cheat54.prank(PROVIDER_A); disclosure.publish(id,digest,keccak256("encrypted manifest"));
        proofScope.allowEnvelope(id,0,keccak256("encrypted seat 0"));

        cheat54.prank(PROVIDER_A); disclosure.bindEnvelope(id,0,keccak256("encrypted seat 0"),KEY_A);
        proofScope.allowEnvelope(id,1,keccak256("encrypted seat 1"));

        cheat54.prank(PROVIDER_B); disclosure.bindEnvelope(id,1,keccak256("encrypted seat 1"),KEY_B);
        bytes32 expectedReceipt0=disclosure.receiptDigest(id,0);

        cheat54.prank(PLAYER); disclosure.acknowledge(id,0,expectedReceipt0);
        bytes32 expectedReceipt1=disclosure.receiptDigest(id,1);

        cheat54.prank(PLAYER_B); disclosure.acknowledge(id,1,expectedReceipt1);
        require(disclosure.allAcknowledged(id),"all private receipts");
        require(disclosure.verifyOpenedDeck(id,cards,keccak256("salt")),"deck verified");
        cheat54.expectRevert(PokerDeckDisclosure420.InvalidState.selector);
        disclosure.disclose(id,cards,keccak256("salt"));
    }
    function testReceiptInvalidatedByRecipientKeyRotation() public {
        bytes32 id=_ready();
        uint8[52] memory cards=_cards();
        bytes32 deckHash=disclosure.hashDeck(id,cards,keccak256("salt"));
        cheat54.prank(PROVIDER_A);disclosure.publish(id,deckHash,keccak256("manifest"));
        proofScope.allowEnvelope(id,0,keccak256("envelope A"));

        cheat54.prank(PROVIDER_A); disclosure.bindEnvelope(id,0,keccak256("envelope A"),KEY_A);
        proofScope.allowEnvelope(id,1,keccak256("envelope B"));

        cheat54.prank(PROVIDER_B); disclosure.bindEnvelope(id,1,keccak256("envelope B"),KEY_B);
        bytes32 expectedReceipt0=disclosure.receiptDigest(id,0);

        cheat54.prank(PLAYER); disclosure.acknowledge(id,0,expectedReceipt0);
        bytes32 expectedReceipt1=disclosure.receiptDigest(id,1);

        cheat54.prank(PLAYER_B); disclosure.acknowledge(id,1,expectedReceipt1);
        require(disclosure.allAcknowledged(id),"initial delivery accepted");
        cheat54.prank(PLAYER);keyRegistry.bindKey(TABLE,keccak256("rotated player key"));
        require(!disclosure.allAcknowledged(id),"stale envelope must block hand start");
    }
    function testWrongPlayerAndMissingReceiptRejected() public {
        bytes32 id=_ready();
        uint8[52] memory cards=_cards();
        bytes32 deckHash=disclosure.hashDeck(id,cards,keccak256("salt"));
        cheat54.prank(PROVIDER_A);
        disclosure.publish(id,deckHash,keccak256("encrypted manifest"));
        proofScope.allowEnvelope(id,0,keccak256("encrypted seat 0"));

        cheat54.prank(PROVIDER_A); disclosure.bindEnvelope(id,0,keccak256("encrypted seat 0"),KEY_A);
        cheat54.expectRevert(PokerDeckDisclosure420.NotRecipient.selector);
        cheat54.prank(OTHER); disclosure.acknowledge(id,0,keccak256("forgery"));
        require(!disclosure.allAcknowledged(id),"incomplete");
    }
    function testForgedOrSwappedReceiptRejected() public {
        bytes32 id=_ready();
        cheat54.prank(PROVIDER_A);
        disclosure.publish(id,keccak256("deck root"),keccak256("manifest"));
        proofScope.allowEnvelope(id,0,keccak256("envelope 0"));

        cheat54.prank(PROVIDER_A); disclosure.bindEnvelope(id,0,keccak256("envelope 0"),KEY_A);
        proofScope.allowEnvelope(id,1,keccak256("envelope 1"));

        cheat54.prank(PROVIDER_B); disclosure.bindEnvelope(id,1,keccak256("envelope 1"),KEY_B);
        bytes32 receipt0=disclosure.receiptDigest(id,0);
        bytes32 receipt1=disclosure.receiptDigest(id,1);
        cheat54.expectRevert(PokerDeckDisclosure420.InvalidValue.selector);
        cheat54.prank(PLAYER);
        disclosure.acknowledge(id,0,receipt1);
        cheat54.expectRevert(PokerDeckDisclosure420.InvalidValue.selector);
        cheat54.prank(PLAYER);
        disclosure.acknowledge(id,0,keccak256("dealer forged receipt"));
        require(!disclosure.allAcknowledged(id),"forged receipts cannot start betting");
        cheat54.prank(PLAYER);
        disclosure.acknowledge(id,0,receipt0);
        require(!disclosure.allAcknowledged(id),"second player receipt required");
    }
    function testWrongOrMissingKeyBindingRejected() public {
        bytes32 id=_ready(); uint8[52] memory cards=_cards();
        bytes32 deckHash=disclosure.hashDeck(id,cards,keccak256("salt"));
        cheat54.prank(PROVIDER_A);
        disclosure.publish(id,deckHash,keccak256("manifest"));
        cheat54.expectRevert(PokerDeckDisclosure420.NotRecipient.selector);
        proofScope.allowEnvelope(id,0,keccak256("envelope"));

        cheat54.prank(PROVIDER_A); disclosure.bindEnvelope(id,0,keccak256("envelope"),KEY_B);
    }
    function testDuplicateDeckRejected() public {
        bytes32 id=_ready(); uint8[52] memory cards=_cards();
        bytes32 root=disclosure.hashDeck(id,cards,keccak256("salt"));
        cheat54.prank(PROVIDER_A); disclosure.publish(id,root,keccak256("manifest"));
        cheat54.expectRevert(PokerDeckDisclosure420.Duplicate.selector);
        cheat54.prank(PROVIDER_A); disclosure.publish(id,root,keccak256("manifest"));
    }
    function testTamperedDeckRejected() public {
        bytes32 id=_ready(); uint8[52] memory cards=_cards();
        bytes32 deckHash=disclosure.hashDeck(id,cards,keccak256("salt"));
        cheat54.prank(PROVIDER_A);
        disclosure.publish(id,deckHash,keccak256("manifest"));
        cards[2]=cards[1];
        cheat54.expectRevert(PokerDeckDisclosure420.InvalidDeck.selector);
        disclosure.verifyOpenedDeck(id,cards,keccak256("salt"));
    }
    function testWrongSaltRejected() public {
        bytes32 id=_ready(); uint8[52] memory cards=_cards();
        bytes32 deckHash=disclosure.hashDeck(id,cards,keccak256("salt"));
        cheat54.prank(PROVIDER_A);
        disclosure.publish(id,deckHash,keccak256("manifest"));
        cheat54.expectRevert(PokerDeckDisclosure420.InvalidDeck.selector);
        disclosure.verifyOpenedDeck(id,cards,keccak256("other"));
    }
}
