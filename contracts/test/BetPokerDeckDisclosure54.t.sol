// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerDeckDisclosure420.sol";

contract PokerDeckDisclosure54Test is PokerConfidentialDeal54Test {
    PokerDeckDisclosure420 disclosure;
    constructor() { disclosure = new PokerDeckDisclosure420(address(deal)); }

    function _ready() internal returns(bytes32 id) {
        _prepared();
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
        cheat54.prank(PROVIDER_A); disclosure.bindEnvelope(id,0,keccak256("encrypted seat 0"));
        cheat54.prank(PROVIDER_B); disclosure.bindEnvelope(id,1,keccak256("encrypted seat 1"));
        cheat54.prank(PLAYER); disclosure.acknowledge(id,0,keccak256("authenticated receipt 0"));
        cheat54.prank(PLAYER_B); disclosure.acknowledge(id,1,keccak256("authenticated receipt 1"));
        require(disclosure.allAcknowledged(id),"all private receipts");
        require(disclosure.verifyOpenedDeck(id,cards,keccak256("salt")),"deck verified");
        cheat54.expectRevert(PokerDeckDisclosure420.InvalidState.selector);
        disclosure.disclose(id,cards,keccak256("salt"));
    }
    function testWrongPlayerAndMissingReceiptRejected() public {
        bytes32 id=_ready();
        uint8[52] memory cards=_cards();
        cheat54.prank(PROVIDER_A);
        disclosure.publish(id,disclosure.hashDeck(id,cards,keccak256("salt")),keccak256("encrypted manifest"));
        cheat54.prank(PROVIDER_A); disclosure.bindEnvelope(id,0,keccak256("encrypted seat 0"));
        cheat54.expectRevert(PokerDeckDisclosure420.NotRecipient.selector);
        cheat54.prank(OTHER); disclosure.acknowledge(id,0,keccak256("forgery"));
        require(!disclosure.allAcknowledged(id),"incomplete");
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
        cheat54.prank(PROVIDER_A);
        disclosure.publish(id,disclosure.hashDeck(id,cards,keccak256("salt")),keccak256("manifest"));
        cards[2]=cards[1];
        cheat54.expectRevert(PokerDeckDisclosure420.InvalidDeck.selector);
        disclosure.verifyOpenedDeck(id,cards,keccak256("salt"));
    }
    function testWrongSaltRejected() public {
        bytes32 id=_ready(); uint8[52] memory cards=_cards();
        cheat54.prank(PROVIDER_A);
        disclosure.publish(id,disclosure.hashDeck(id,cards,keccak256("salt")),keccak256("manifest"));
        cheat54.expectRevert(PokerDeckDisclosure420.InvalidDeck.selector);
        disclosure.verifyOpenedDeck(id,cards,keccak256("other"));
    }
}
