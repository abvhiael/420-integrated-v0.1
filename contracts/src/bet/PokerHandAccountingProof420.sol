// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerConfidentialDeal420.sol";

/// @notice Deterministic public-accounting transcript for poker hand verification.
/// @dev Does NOT prove card outcomes or legal betting order. No settlement or vault write access.
///      Binds each action to the exact preceding state, prevents replay, and checks
///      committed chips and stacked balances conserve funds.
contract PokerHandAccountingProof420 {
    PokerConfidentialDeal420 public immutable deals;
    bytes32 public constant ACTION_RECORD = keccak256("BET_POKER_HAND_ACCOUNTING_RECORD");
    struct State {
        bytes32 tableId;
        bytes32 transcriptRoot;
        uint64 nonce;
        uint256 initialChips;
        uint256 stackChips;
        uint256 potChips;
        uint256 rakeChips;
        bool initialized;
        bool terminal;
    }
    mapping(bytes32=>State) private states;
    error InvalidState(); error Unauthorized(); error Conservation(); error InvalidAction();
    event HandAccountingInitialized(bytes32 indexed handId,bytes32 root,uint256 initialChips);
    event HandActionRecorded(bytes32 indexed handId,uint64 nonce,bytes32 root,uint256 stacks,uint256 pots,uint256 rake);
    event HandAccountingTerminal(bytes32 indexed handId,bytes32 root);
    constructor(address deals_) {
        if(deals_==address(0)) revert InvalidState();
        deals=PokerConfidentialDeal420(deals_);
    }
    function stateOf(bytes32 handId) external view returns(State memory){return states[handId];}
    function initialize(bytes32 handId,uint256 initialChips,bytes32 snapshotRoot) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED || initialChips==0 || snapshotRoot==bytes32(0))
            revert InvalidState();
        if(msg.sender!=deals.tables().getTable(h.tableId).controller) revert Unauthorized();
        State storage s=states[handId];
        if(s.initialized) revert InvalidState();
        if(deals.ledger().seatingEpoch(h.tableId)!=h.epoch ||
            deals.snapshotFor(h.tableId,deals.handSeatMask(handId))!=h.seatSnapshotHash)
            revert InvalidState();
        uint256 sum;
        uint16 mask=deals.handSeatMask(handId);
        for(uint8 i=0;i<9;++i){
            if((mask&(uint16(1)<<i))!=0) sum+=deals.ledger().seatOf(h.tableId,i).chips;
        }
        if(sum!=initialChips) revert Conservation();
        s.tableId=h.tableId;s.transcriptRoot=snapshotRoot;s.initialChips=sum;
        s.stackChips=sum;s.initialized=true;
        emit HandAccountingInitialized(handId,snapshotRoot,sum);
    }
    /// @notice Submit independently replayable ordered chip-state transition.
    /// @dev The caller has no ability to inflate the pot: pot+rake+stacks == initial collateral.
    ///      Correct player authorization and actual poker rules still need hand-engine verification.
    function record(bytes32 handId,uint64 expectedNonce,bytes32 actionCommitment,
        uint256 newStacks,uint256 newPots,uint256 newRake) external {
        State storage s=states[handId];
        if(!s.initialized||s.terminal||expectedNonce!=s.nonce+1||actionCommitment==bytes32(0))
            revert InvalidAction();
        if(msg.sender!=deals.tables().getTable(s.tableId).controller) revert Unauthorized();
        if(newRake>newPots+newRake) revert Conservation();
        if(newStacks>s.initialChips||newPots>s.initialChips||newRake>s.initialChips ||
            newStacks+newPots+newRake!=s.initialChips) revert Conservation();
        s.transcriptRoot=keccak256(abi.encode(block.chainid,address(this),handId,
            s.transcriptRoot,expectedNonce,actionCommitment,newStacks,newPots,newRake));
        s.nonce=expectedNonce;s.stackChips=newStacks;s.potChips=newPots;s.rakeChips=newRake;
        emit HandActionRecorded(handId,expectedNonce,s.transcriptRoot,newStacks,newPots,newRake);
    }
    function markTerminal(bytes32 handId,bytes32 finalAction) external {
        State storage s=states[handId];
        if(!s.initialized||s.terminal||s.potChips!=0||finalAction==bytes32(0)) revert InvalidState();
        if(msg.sender!=deals.tables().getTable(s.tableId).controller) revert Unauthorized();
        s.transcriptRoot=keccak256(abi.encode(block.chainid,address(this),handId,s.transcriptRoot,
            s.nonce,finalAction,s.stackChips,s.rakeChips));
        s.terminal=true;
        emit HandAccountingTerminal(handId,s.transcriptRoot);
    }
}
