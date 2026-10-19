// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerConfidentialDeal420.sol";

/// @notice Two independently authorized adjudicators attest terminal hand status.
/// @dev Only a challenge-window and terminality *attestation*, NOT proof that a hand
///      engine executed correct betting/pot conservation. No settlement permissions.
contract PokerHandFinality420 {
    bytes32 public constant ACTION_ATTEST = keccak256("BET_POKER_HAND_FINALITY_ATTEST");
    uint64 public constant CHALLENGE_WINDOW = 1 days;
    PokerConfidentialDeal420 public immutable deals;
    BetAuthorization420 public immutable auth;
    address public immutable adjudicatorA;
    address public immutable adjudicatorB;

    struct Terminal {
        bytes32 terminalStateHash;
        bytes32 transcriptHash;
        uint64 proposedAt;
        uint64 challengeUntil;
        bool attestedA;
        bool attestedB;
        bool challenged;
        bool finalized;
    }
    mapping(bytes32 => Terminal) public terminals;
    error InvalidInput(); error Unauthorized(); error InvalidState(); error Expired();
    event TerminalAttested(bytes32 indexed handId,address indexed adjudicator,bytes32 stateHash);
    event TerminalChallenged(bytes32 indexed handId,address indexed actor,bytes32 evidenceHash);
    event TerminalFinalized(bytes32 indexed handId,bytes32 stateHash);
    mapping(bytes32 => bytes32) public challengeEvidence;

    constructor(address deals_,address a,address b) {
        if(deals_==address(0)||a==address(0)||b==address(0)||a==b) revert InvalidInput();
        deals=PokerConfidentialDeal420(deals_);
        auth=deals.authorization();
        if(a==deals.providerA()||a==deals.providerB()||
            b==deals.providerA()||b==deals.providerB()) revert InvalidInput();
        adjudicatorA=a; adjudicatorB=b;
    }
    function attest(bytes32 handId,bytes32 stateHash,bytes32 transcriptHash) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED) revert InvalidState();
        if(msg.sender!=adjudicatorA && msg.sender!=adjudicatorB) revert Unauthorized();
        if(!auth.isAuthorized(msg.sender,ACTION_ATTEST,auth.scopeForTable(h.tableId),0)) revert Unauthorized();
        if(stateHash==bytes32(0)||transcriptHash==bytes32(0)) revert InvalidInput();
        Terminal storage t=terminals[handId];
        if(t.challenged||t.finalized) revert InvalidState();
        if(t.proposedAt==0){
            t.proposedAt=uint64(block.timestamp);
            t.challengeUntil=uint64(block.timestamp+CHALLENGE_WINDOW);
            t.terminalStateHash=stateHash;
            t.transcriptHash=transcriptHash;
        } else if(t.terminalStateHash!=stateHash||t.transcriptHash!=transcriptHash){
            revert InvalidInput();
        }
        if(msg.sender==adjudicatorA) {
            if(t.attestedA) revert InvalidState();
            t.attestedA=true;
        } else {
            if(t.attestedB) revert InvalidState();
            t.attestedB=true;
        }
        emit TerminalAttested(handId,msg.sender,stateHash);
    }
    function challenge(bytes32 handId,bytes32 evidenceHash) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        Terminal storage t=terminals[handId];
        if(t.proposedAt==0||t.challenged||t.finalized||block.timestamp>=t.challengeUntil)
            revert InvalidState();
        if(evidenceHash==bytes32(0)) revert InvalidInput();
        bool seated=false;
        uint16 mask=deals.handSeatMask(handId);
        for(uint8 i=0;i<9;++i){
            if((mask&(uint16(1)<<i))!=0 && deals.ledger().seatOf(h.tableId,i).player==msg.sender){
                seated=true;break;
            }
        }
        if(!seated) revert Unauthorized();
        t.challenged=true;
        challengeEvidence[handId]=evidenceHash;
        emit TerminalChallenged(handId,msg.sender,evidenceHash);
    }
    function finalize(bytes32 handId) external {
        Terminal storage t=terminals[handId];
        if(t.proposedAt==0||!t.attestedA||!t.attestedB||t.challenged||t.finalized)
            revert InvalidState();
        if(block.timestamp<t.challengeUntil) revert Expired();
        t.finalized=true;
        emit TerminalFinalized(handId,t.terminalStateHash);
    }
    function isFinal(bytes32 handId) external view returns(bool) {
        return terminals[handId].finalized;
    }
}
