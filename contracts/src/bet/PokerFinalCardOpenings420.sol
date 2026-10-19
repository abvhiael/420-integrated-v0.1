// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerVerifiedTerminalGate420.sol";

/// @notice Post-hand authenticity check of opened card positions against a
/// hand-scoped Merkle tree. Not a substitute for a shuffle re-encryption proof.
/// No pre-finality public reveals are permitted here.
contract PokerFinalCardOpenings420 {
    bytes32 public constant LEAF_DOMAIN=keccak256("420.BET.POKER.CARD.OPEN.V1");
    PokerVerifiedTerminalGate420 public immutable terminalGate;
    struct Root {bytes32 treeRoot;bytes32 transcriptRoot;uint64 publishedAt;}
    mapping(bytes32=>Root) public roots;
    mapping(bytes32=>uint256) public revealedPositions;
    mapping(bytes32=>uint256) public revealedCards;
    error InvalidRoot(); error InvalidOpening(); error NotFinal(); error Duplicate();
    event OpeningRootPublished(bytes32 indexed handId,bytes32 root,bytes32 transcript);
    event CardOpened(bytes32 indexed handId,uint8 position,uint8 card);
    constructor(address gate_){if(gate_==address(0))revert InvalidRoot();terminalGate=PokerVerifiedTerminalGate420(gate_);}
    function publishRoot(bytes32 handId,bytes32 root,bytes32 transcript) external {
        if(!terminalGate.isVerifiedTerminal(handId)) revert NotFinal();
        if(root==bytes32(0)||transcript==bytes32(0)) revert InvalidRoot();
        if(roots[handId].treeRoot!=bytes32(0)) revert Duplicate();
        PokerHandAccountingProof420.State memory s=terminalGate.accounting().stateOf(handId);
        if(s.transcriptRoot!=transcript) revert InvalidRoot();
        roots[handId]=Root(root,transcript,uint64(block.timestamp));
        emit OpeningRootPublished(handId,root,transcript);
    }
    function leaf(bytes32 handId,uint8 position,uint8 card,bytes32 salt) public view returns(bytes32){
        return keccak256(abi.encode(LEAF_DOMAIN,block.chainid,address(this),handId,position,card,salt));
    }
    function open(bytes32 handId,uint8 position,uint8 card,bytes32 salt,bytes32[6] calldata siblings) external {
        Root memory rec=roots[handId];
        if(rec.treeRoot==bytes32(0) || !terminalGate.isVerifiedTerminal(handId))revert NotFinal();
        if(position>=52||card>=52||salt==bytes32(0)) revert InvalidOpening();
        uint256 p=uint256(1)<<position,q=uint256(1)<<card;
        if((revealedPositions[handId]&p)!=0||(revealedCards[handId]&q)!=0)revert Duplicate();
        bytes32 node=leaf(handId,position,card,salt);
        uint256 index=position;
        for(uint256 j=0;j<6;j++){
            if((index&1)==0) node=keccak256(abi.encodePacked(node,siblings[j]));
            else node=keccak256(abi.encodePacked(siblings[j],node));
            index>>=1;
        }
        if(node!=rec.treeRoot)revert InvalidOpening();
        revealedPositions[handId]|=p;revealedCards[handId]|=q;
        emit CardOpened(handId,position,card);
    }
}
