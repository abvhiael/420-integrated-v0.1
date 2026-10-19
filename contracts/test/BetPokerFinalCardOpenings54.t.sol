// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerVerifiedTerminalGate54.t.sol";
import "../src/bet/PokerFinalCardOpenings420.sol";
contract PokerFinalCardOpenings54Test is PokerVerifiedTerminalGate54Test {
    PokerFinalCardOpenings420 cardOpenings;
    constructor(){cardOpenings=new PokerFinalCardOpenings420(address(gate));}
    function _terminalHand() internal returns(bytes32 id){
        id=_hand();
        cheat54.prank(ADMIN);proof.initialize(id,800,keccak256("initial"));
        cheat54.prank(ADMIN);proof.markTerminal(id,keccak256("finish"));
        PokerHandAccountingProof420.State memory s=proof.stateOf(id);
        cheat54.prank(J1);adjudication.attest(id,s.transcriptRoot,s.transcriptRoot);
        cheat54.prank(J2);adjudication.attest(id,s.transcriptRoot,s.transcriptRoot);
        cheat54.warp(block.timestamp+1 days);
        adjudication.finalize(id);
    }
    function _tree(bytes32 id) internal view returns(bytes32[64] memory layer){
        for(uint256 i=0;i<64;i++){
            layer[i]=i<52?cardOpenings.leaf(id,uint8(i),uint8(i),keccak256("salt")):bytes32(0);
        }
    }
    function testPostFinalityMerkleOpeningAndDuplicateCardRejected() public {
        bytes32 id=_terminalHand();
        bytes32[64] memory tree=_tree(id);
        bytes32[6] memory path;
        uint256 idx=0,width=64;
        for(uint256 depth=0;depth<6;depth++){
            path[depth]=tree[idx^1];
            for(uint256 i=0;i<width/2;i++)
                tree[i]=keccak256(abi.encodePacked(tree[2*i],tree[2*i+1]));
            width/=2;idx/=2;
        }
        PokerHandAccountingProof420.State memory s=proof.stateOf(id);
        cardOpenings.publishRoot(id,tree[0],s.transcriptRoot);
        cardOpenings.open(id,0,0,keccak256("salt"),path);
        cheat54.expectRevert(PokerFinalCardOpenings420.Duplicate.selector);
        cardOpenings.open(id,0,0,keccak256("salt"),path);
    }
    function testCannotPublishBeforeFinality() public {
        bytes32 id=_hand();
        cheat54.expectRevert(PokerFinalCardOpenings420.NotFinal.selector);
        cardOpenings.publishRoot(id,keccak256("root"),keccak256("transcript"));
    }
}
