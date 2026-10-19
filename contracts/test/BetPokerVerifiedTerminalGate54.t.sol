// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerHandAccountingProof54.t.sol";
import "../src/bet/PokerHandFinality420.sol";
import "../src/bet/PokerVerifiedTerminalGate420.sol";

contract PokerVerifiedTerminalGate54Test is PokerHandAccountingProof54Test {
    address constant J1=address(0xF101);
    address constant J2=address(0xF202);
    PokerHandFinality420 adjudication;
    PokerVerifiedTerminalGate420 gate;
    constructor() {
        adjudication=new PokerHandFinality420(address(deal),J1,J2);
        gate=new PokerVerifiedTerminalGate420(address(proof),address(adjudication));
        cap.grant(J1,adjudication.ACTION_ATTEST(),auth.scopeForTable(TABLE),true);
        cap.grant(J2,adjudication.ACTION_ATTEST(),auth.scopeForTable(TABLE),true);
    }
    function testMatchingAccountedRootAfterChallengeWindow() public {
        bytes32 id=_hand();
        cheat54.prank(ADMIN);proof.initialize(id,800,keccak256("initial"));
        cheat54.prank(ADMIN);proof.markTerminal(id,keccak256("no betting"));
        PokerHandAccountingProof420.State memory s=proof.stateOf(id);
        cheat54.prank(J1);adjudication.attest(id,s.transcriptRoot,s.transcriptRoot);
        cheat54.prank(J2);adjudication.attest(id,s.transcriptRoot,s.transcriptRoot);
        require(!gate.isVerifiedTerminal(id),"premature");
        cheat54.warp(block.timestamp+1 days);
        adjudication.finalize(id);
        require(gate.isVerifiedTerminal(id),"joint terminal");
    }
    function testWrongTranscriptCannotBecomeVerified() public {
        bytes32 id=_hand();
        cheat54.prank(ADMIN);proof.initialize(id,800,keccak256("initial"));
        cheat54.prank(ADMIN);proof.markTerminal(id,keccak256("final"));
        cheat54.prank(J1);adjudication.attest(id,keccak256("forged"),keccak256("forged"));
        cheat54.prank(J2);adjudication.attest(id,keccak256("forged"),keccak256("forged"));
        cheat54.warp(block.timestamp+1 days);
        adjudication.finalize(id);
        require(!gate.isVerifiedTerminal(id),"must bind accounting transcript");
    }
}
