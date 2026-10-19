// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerNLHEBetting54.t.sol";
import "../src/bet/PokerLiveCardReveals420.sol";

/// @dev These fixtures exercise Solidity public-input integration ONLY.
contract FakePartialGroth16Verifier54 {
    bool public accept=true;
    function verifyProof(uint256[8] calldata,uint256[13] calldata) external view returns(bool){
        return accept;
    }
}
contract FakeUnmaskGroth16Verifier54 {
    bool public accept=true;
    function verifyProof(uint256[8] calldata,uint256[17] calldata) external view returns(bool){
        return accept;
    }
}
contract PokerLiveCardReveals54Test is PokerNLHEBetting54Test {
    uint256 internal constant FR=
        21888242871839275222246405745257275088696311157297823662689037894645226208583;
    PokerVerifierVersions420 cardVersions;
    PokerGnarkPartialShareAdapter420 partialA;
    PokerGnarkPartialShareAdapter420 partialB;
    PokerGnarkCardUnmaskAdapter420 unmask;
    PokerLiveCardReveals420 live;
    FakePartialGroth16Verifier54 partialFixture;
    FakeUnmaskGroth16Verifier54 unmaskFixture;
    constructor(){
        cardVersions=new PokerVerifierVersions420(address(this));
        partialFixture=new FakePartialGroth16Verifier54();
        unmaskFixture=new FakeUnmaskGroth16Verifier54();
        cardVersions.register(keccak256("PARTIAL"),address(partialFixture),
            keccak256("PARTIALVK"),keccak256("PARTIALCIRCUIT"),keccak256("PARTIALSCHEMA"));
        cardVersions.register(keccak256("UNMASK"),address(unmaskFixture),
            keccak256("UNMASKVK"),keccak256("UNMASKCIRCUIT"),keccak256("UNMASKSCHEMA"));
        partialA=new PokerGnarkPartialShareAdapter420(address(partialFixture),address(cardVersions),
            keccak256("PARTIAL"),keccak256("PARTIALCIRCUIT"),keccak256("PARTIALVK"),
            keccak256("PARTIALSCHEMA"),keccak256(abi.encode(uint256(7),uint256(8))));
        partialB=new PokerGnarkPartialShareAdapter420(address(partialFixture),address(cardVersions),
            keccak256("PARTIAL"),keccak256("PARTIALCIRCUIT"),keccak256("PARTIALVK"),
            keccak256("PARTIALSCHEMA"),keccak256(abi.encode(uint256(11),uint256(12))));
        unmask=new PokerGnarkCardUnmaskAdapter420(address(unmaskFixture),address(cardVersions),
            keccak256("UNMASK"),keccak256("UNMASKCIRCUIT"),keccak256("UNMASKVK"),
            keccak256("UNMASKSCHEMA"),keccak256(abi.encode(uint256(19),uint256(20))));
        live=new PokerLiveCardReveals420(address(engine),address(partialA),address(partialB),
            address(unmask));
        cap.grant(ADMIN,engine.ACTION_BIND_REVEALS(),auth.scopeForTable(TABLE),true);
    }
    function _readyLive() internal returns(bytes32 id){
        id=_readyBetting();
        cheat54.prank(ADMIN);engine.bindReveals(TABLE,address(live));
    }
    function _points(uint8 pos,uint8 holder) internal pure returns(uint256[8] memory p){
        p[0]=uint256(201)+pos;p[1]=uint256(202)+pos;
        p[2]=uint256(203)+pos;p[3]=uint256(204)+pos;
        p[4]=holder==0?7:11;p[5]=holder==0?8:12;
        p[6]=uint256(holder==0?205:207)+pos;
        p[7]=uint256(holder==0?206:208)+pos;
    }
    function _shareProof(bytes32 handId,uint8 pos,uint8 holder,uint256[8] memory p)
        internal pure returns(bytes memory){
        uint256[13] memory input;
        input[0]=uint256(handId)%FR;input[1]=1000;
        input[2]=p[2];input[3]=p[3];input[4]=pos;input[5]=1;input[6]=holder;
        input[7]=p[0];input[8]=p[1];input[9]=p[4];input[10]=p[5];
        input[11]=p[6];input[12]=p[7];
        uint256[8] memory proof;
        return abi.encode(proof,input);
    }
    function _submit(bytes32 handId,uint8 position,uint8 holder) internal {
        uint256[8] memory points=_points(position,holder);
        live.submitShare(handId,1,position,holder,points,_shareProof(handId,position,holder,points));
    }
    function _open(bytes32 handId,uint8 pos,uint8 card) internal {
        PokerLiveCardReveals420.Slot memory s=live.slotOf(handId,pos);
        uint256[6] memory keys=[uint256(7),uint256(8),uint256(11),uint256(12),uint256(19),uint256(20)];
        uint256[17] memory pub;
        pub[0]=uint256(handId)%FR;pub[1]=1000;pub[2]=pos;pub[3]=1;pub[4]=card;
        pub[5]=s.c2x;pub[6]=s.c2y;
        pub[7]=s.dax;pub[8]=s.day;pub[9]=s.dbx;pub[10]=s.dby;
        pub[11]=keys[0];pub[12]=keys[1];pub[13]=keys[2];pub[14]=keys[3];
        pub[15]=keys[4];pub[16]=keys[5];
        uint256[8] memory proof;
        live.reveal(handId,1,pos,card,keys,abi.encode(proof,pub));
    }
    function _completePreflop(bytes32 id) internal {
        _signedAction(id,0,PokerNLHEBetting420.Move.CALL,10,PLAYER_KEY);
        _signedAction(id,1,PokerNLHEBetting420.Move.CHECK,0,OPPONENT_KEY);
    }
    function testNoPrematureDisclosureAndActualStageProgression() public {
        bytes32 id=_readyLive();
        uint256[8] memory p=_points(5,0);
        bytes memory proof=_shareProof(id,5,0,p);
        cheat54.expectRevert(PokerLiveCardReveals420.WrongStreet.selector);
        live.submitShare(id,1,5,0,p,proof);
        _completePreflop(id);
        require(engine.canRevealStreet(id,1),"flop revealed only after complete preflop");
        _submit(id,5,0);_submit(id,5,1);_open(id,5,10);
        cheat54.expectRevert(PokerLiveCardReveals420.Incomplete.selector);
        live.advance(id,1);
        _submit(id,6,0);_submit(id,6,1);_open(id,6,11);
        _submit(id,7,0);_submit(id,7,1);_open(id,7,12);
        require(live.isStageComplete(id,1),"three verified flop positions");
        cheat54.prank(OTHER);live.advance(id,1);
        require(engine.gameOf(id).phase==PokerNLHEBetting420.Phase.FLOP,"street opened");
        require(ledger.reservedInHand(TABLE)==800,"funds remain escrowed");
    }
    function testDuplicateAndInvalidThresholdSharesCannotOpenBoard() public {
        bytes32 id=_readyLive();_completePreflop(id);
        uint256[8] memory p=_points(5,0);
        _submit(id,5,0);
        cheat54.expectRevert(PokerLiveCardReveals420.Duplicate.selector);
        live.submitShare(id,1,5,0,p,_shareProof(id,5,0,p));
        uint256[8] memory bad=_points(5,1);
        bad[2]=999;
        cheat54.expectRevert(PokerLiveCardReveals420.InvalidProof.selector);
        live.submitShare(id,1,5,1,bad,_shareProof(id,5,1,bad));
        require(!live.slotOf(id,5).shareB,"incorrect ciphertext cannot add share");
        cheat54.expectRevert(PokerLiveCardReveals420.Incomplete.selector);
        _open(id,5,10);
    }
    function testHoleCardsNeverPubliclyRevealedBeforeShowdown() public {
        bytes32 id=_readyLive();_completePreflop(id);
        uint256[8] memory p=_points(0,0);
        cheat54.expectRevert(PokerLiveCardReveals420.WrongStreet.selector);
        live.submitShare(id,4,0,0,p,_shareProof(id,0,0,p));
    }
}
