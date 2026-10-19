// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerCanonicalSettlement54.t.sol";
import "../src/bet/PokerSelectiveReveal420.sol";
import "../src/bet/PokerStreetProof420.sol";

/// @dev Contract-routing fixtures ONLY, not cryptographic proving systems.
contract StreetRulesFixture54 is IPokerStreetRulesVerifier420 {
    bytes32 public permitted;
    function permit(bytes32 digest) external {permitted=digest;}
    function verifyStreet(bytes32 digest,bytes calldata proof) external view returns(bool) {
        return digest==permitted&&keccak256(proof)==keccak256(hex"abcd");
    }
}
contract RevealShareFixture54 is IPokerSelectiveShareProof420 {
    bytes32 public permitted;
    function permit(bytes32 digest) external {permitted=digest;}
    function verifyShare(bytes32 digest,bytes32,bytes32,uint8,uint8,address,bytes32,bytes calldata proof)
        external view returns(bool) {
        return digest==permitted&&keccak256(proof)==keccak256(hex"abcd");
    }
}
contract PokerSelectiveReveal54Test is PokerCanonicalSettlement54Test {
    StreetRulesFixture54 streetFixture;
    RevealShareFixture54 shareFixture;
    PokerStreetProof420 streets;
    PokerSelectiveReveal420 reveal;
    constructor() {
        streetFixture=new StreetRulesFixture54();
        shareFixture=new RevealShareFixture54();
        verifierVersions.register(keccak256("STREET"),address(streetFixture),
            keccak256("STREET KEY"),keccak256("STREET CIRCUIT"),keccak256("STREET SCHEMA"));
        verifierVersions.register(keccak256("SHARE"),address(shareFixture),
            keccak256("SHARE KEY"),keccak256("SHARE CIRCUIT"),keccak256("SHARE SCHEMA"));
        streets=new PokerStreetProof420(address(gate),address(verifierVersions),
            address(streetFixture),keccak256("STREET"),keccak256("STREET CIRCUIT"),
            keccak256("STREET KEY"),keccak256("STREET SCHEMA"));
        reveal=new PokerSelectiveReveal420(address(gate),address(streets),
            address(verifierVersions),address(shareFixture),keccak256("SHARE"),
            keccak256("SHARE CIRCUIT"),keccak256("SHARE KEY"),keccak256("SHARE SCHEMA"));
    }
    function _readyForFlop() internal returns(bytes32 handId) {
        handId=_lockedHand();_completeShuffle(handId);
        PokerConfidentialDeal420.Hand memory h=deal.getHand(handId);
        bytes32 initial=keccak256(abi.encode(streets.DOMAIN(),block.chainid,address(streets),
            handId,h.tableId,h.configHash,h.rulesetId,h.seatSnapshotHash,
            ledger.lockedSnapshot(TABLE),ledger.lockedTotal(TABLE)));
        streets.initialize(handId,initial,h.transcriptCommitment);
        PokerPrivateShuffleGate420.Record memory rec=gate.recordOf(handId);
        bytes32 nextState=keccak256("closed preflop"),nextTranscript=keccak256("verified actions");
        bytes32 digest=keccak256(abi.encode(streets.DOMAIN(),block.chainid,address(streets),
            address(streetFixture),keccak256("STREET"),keccak256("STREET CIRCUIT"),
            keccak256("STREET KEY"),keccak256("STREET SCHEMA"),
            handId,rec.finalDeckRoot,uint8(0),initial,h.transcriptCommitment,
            nextState,nextTranscript));
        streetFixture.permit(digest);
        streets.submitStreet(handId,0,nextState,nextTranscript,hex"abcd");
    }
    function testCannotRevealBeforeVerifiedStreet() public {
        bytes32 handId=_lockedHand();_completeShuffle(handId);
        cheat54.expectRevert(PokerSelectiveReveal420.InvalidState.selector);
        cheat54.prank(PROVIDER_A);
        reveal.submitShare(handId,5,1,keccak256("cipher"),keccak256("share"),hex"abcd");
    }
    function testVerifiedFlopCannotRevealTurnOrRiverOrBurn() public {
        bytes32 handId=_readyForFlop();
        for(uint8 i=0;i<3;i++){
            uint8 future=i==0?4:i==1?9:11;
            cheat54.expectRevert(PokerSelectiveReveal420.InvalidState.selector);
            cheat54.prank(PROVIDER_A);
            reveal.submitShare(handId,future,1,keccak256("cipher"),keccak256("share"),hex"abcd");
        }
        // Heads-up: 4 hole cards, burn at 4, flop starts at 5.
        bytes32 cipher=keccak256("certified card ciphertext");
        bytes32 share=keccak256("partial proof A");
        bytes32 digest=reveal.statement(handId,5,1,PROVIDER_A,cipher,share);
        shareFixture.permit(digest);
        cheat54.prank(PROVIDER_A);reveal.submitShare(handId,5,1,cipher,share,hex"abcd");
        cheat54.expectRevert(PokerSelectiveReveal420.Duplicate.selector);
        cheat54.prank(PROVIDER_A);reveal.submitShare(handId,5,1,cipher,share,hex"abcd");
        bytes32 shareB=keccak256("partial proof B");
        shareFixture.permit(reveal.statement(handId,5,1,PROVIDER_B,cipher,shareB));
        cheat54.prank(PROVIDER_B);reveal.submitShare(handId,5,1,cipher,shareB,hex"abcd");
        require(reveal.openingOf(handId,5).completed,"two holder shares accepted");
    }
    function testInvalidShareAndUnauthorizedProviderFailClosed() public {
        bytes32 handId=_readyForFlop();
        cheat54.expectRevert(PokerSelectiveReveal420.Unauthorized.selector);
        cheat54.prank(OTHER);
        reveal.submitShare(handId,5,1,keccak256("cipher"),keccak256("share"),hex"abcd");
        cheat54.expectRevert(PokerSelectiveReveal420.InvalidProof.selector);
        cheat54.prank(PROVIDER_A);
        reveal.submitShare(handId,5,1,keccak256("cipher"),keccak256("share"),hex"abcd");
    }
}
