// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerActionKeys420.sol";
interface VmSignPoker54 {
    function addr(uint256 privateKey) external returns(address);
    function sign(uint256 privateKey,bytes32 digest) external returns(uint8,bytes32,bytes32);
}
contract PokerActionKeys54Test is PokerConfidentialDeal54Test {
    PokerActionKeys420 signerRegistry;
    VmSignPoker54 sig=VmSignPoker54(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant KEY=0x420420;
    constructor(){signerRegistry=new PokerActionKeys420(address(deal));}
    function _committed() internal returns(bytes32 id){
        _prepared();id=_begin(1);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("a"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("b"));
    }
    function testOwnerBoundSignatureAndNonceReplay() public {
        bytes32 id=_committed();
        address addressOfSigner=sig.addr(KEY);
        cheat54.prank(PLAYER);signerRegistry.bindSigner(TABLE,addressOfSigner);
        uint64 deadline=uint64(block.timestamp+90);
        bytes32 move=keccak256("call ten"),state=keccak256("previous state");
        bytes32 d=signerRegistry.actionDigest(id,0,1,state,move,deadline);
        (uint8 v,bytes32 rr,bytes32 ss)=sig.sign(KEY,d);
        bytes memory proof=abi.encodePacked(rr,ss,v);
        signerRegistry.verifyAndConsume(id,0,1,state,move,deadline,proof);
        require(signerRegistry.lastActionNonce(id,0)==1,"consumed");
        cheat54.expectRevert(PokerActionKeys420.Replay.selector);
        signerRegistry.verifyAndConsume(id,0,1,state,move,deadline,proof);
    }
    function testSignerRotationRevokesOldProof() public {
        bytes32 id=_committed();
        cheat54.prank(PLAYER);signerRegistry.bindSigner(TABLE,sig.addr(KEY));
        uint64 deadline=uint64(block.timestamp+90);
        bytes32 state=keccak256("state"),move=keccak256("raise");
        bytes32 d=signerRegistry.actionDigest(id,0,1,state,move,deadline);
        (uint8 v,bytes32 rr,bytes32 ss)=sig.sign(KEY,d);
        cheat54.prank(PLAYER);signerRegistry.bindSigner(TABLE,address(0x4000));
        cheat54.expectRevert(PokerActionKeys420.InvalidSignature.selector);
        signerRegistry.verifyAndConsume(id,0,1,state,move,deadline,abi.encodePacked(rr,ss,v));
    }
    function testOutOfHandSeatAndUnauthorizedBinding() public {
        bytes32 id=_committed();
        cheat54.expectRevert(PokerActionKeys420.InvalidSeat.selector);
        cheat54.prank(OTHER);signerRegistry.bindSigner(TABLE,address(0x1234));
        cheat54.expectRevert(PokerActionKeys420.InvalidSeat.selector);
        signerRegistry.actionDigest(id,2,1,keccak256("state"),keccak256("move"),uint64(block.timestamp+60));
    }
    function testMalformedSignatureRejected() public {
        bytes32 id=_committed();
        cheat54.prank(PLAYER);signerRegistry.bindSigner(TABLE,sig.addr(KEY));
        cheat54.expectRevert(PokerActionKeys420.InvalidSignature.selector);
        signerRegistry.verifyAndConsume(id,0,1,keccak256("state"),keccak256("move"),
           uint64(block.timestamp+60),hex"deadbeef");
    }
}
