// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerNLHEBetting420.sol";

/// @notice Bounded canonical reconnect projection. No transport write authority,
/// private card material, key recovery, clock reset or cached-state acceptance.
contract PokerPlayerRecovery420 {
    PokerNLHEBetting420 public immutable engine;
    PokerSeatLedger420 public immutable ledger;
    struct Snapshot {
        uint256 chainId;
        address engineAddress;
        address ledgerAddress;
        uint256 blockNumber;
        uint256 timestamp;
        bytes32 previousBlockHash;
        bytes32 tableId;
        address player;
        uint8 seatPlusOne;
        PokerSeatLedger420.Seat seat;
        PokerSeatLedger420.PlayerLifecycle lifecycle;
        bool eligibleForNextHand;
        address signer;
        uint64 signerEpoch;
        uint64 signerSerial;
        bytes32 activeHand;
        bytes32 handId;
        bytes32 escrowSnapshot;
        uint16 lockedMask;
        uint64 seatingEpoch;
        PokerConfidentialDeal420.Hand deal;
        PokerNLHEStorage420.Game game;
        PokerNLHEStorage420.Player[9] players;
        PokerNLHEStorage420.Turn turn;
        bytes32 actionRoot;
        bytes32 terminalTranscript;
        bool settled;
        bool aborted;
        uint64 evidenceDueAt;
        uint64 recoveryOpenedAt;
        uint64 recoveryFinalizableAt;
        bytes32 recoveryStateRoot;
        PokerNLHEStorage420.Phase recoveryPhase;
        bool recoveryActive;
        PokerNLHEStorage420.SettlementReceipt receipt;
    }
    error InvalidContext();
    constructor(address engine_){
        if(engine_==address(0)||engine_.code.length==0)revert InvalidContext();
        engine=PokerNLHEBetting420(engine_);ledger=engine.ledger();
    }
    /// @dev Read via eth_call at a caller-selected canonical/finalized block.
    /// An explicit hand permits recovery of terminal receipts after cashout.
    function snapshot(bytes32 tableId,address player,bytes32 handId) external view returns(Snapshot memory s){
        if(player==address(0))revert InvalidContext();
        PokerTableRegistry420.Table memory table=ledger.tables().getTable(tableId);
        if(!table.exists)revert InvalidContext();
        s.chainId=block.chainid;s.engineAddress=address(engine);s.ledgerAddress=address(ledger);
        s.blockNumber=block.number;s.timestamp=block.timestamp;
        if(block.number!=0)s.previousBlockHash=blockhash(block.number-1);
        s.tableId=tableId;s.player=player;
        s.seatPlusOne=ledger.playerSeatPlusOne(tableId,player);
        if(s.seatPlusOne!=0){
            uint8 seat=s.seatPlusOne-1;
            s.seat=ledger.seatOf(tableId,seat);s.lifecycle=ledger.lifecycleOf(tableId,seat);
            s.eligibleForNextHand=ledger.eligibleForNextHand(tableId,seat);
        }
        (s.signer,s.signerEpoch,s.signerSerial)=engine.keys().keys(tableId,player);
        if(s.seatPlusOne<1||s.signerEpoch<s.seat.epoch||s.signerEpoch>s.seat.epoch)s.signer=address(0);
        s.activeHand=ledger.activeHand(tableId);s.handId=handId==bytes32(0)?s.activeHand:handId;
        s.escrowSnapshot=ledger.lockedSnapshot(tableId);s.lockedMask=ledger.lockedMask(tableId);
        s.seatingEpoch=ledger.seatingEpoch(tableId);
        if(uint256(s.handId)<1)return s;
        s.deal=engine.deals().getHand(s.handId);
        if(s.deal.tableId!=tableId||s.deal.state<PokerConfidentialDeal420.State.AWAITING)revert InvalidContext();
        s.game=engine.gameOf(s.handId);s.turn=engine.turnOf(s.handId);
        for(uint8 i;i<9;i++)s.players[i]=engine.playerOf(s.handId,i);
        s.actionRoot=engine.actionTranscriptRoot(s.handId);s.terminalTranscript=engine.terminalTranscript(s.handId);
        s.settled=engine.handSettled(s.handId);s.aborted=engine.handAborted(s.handId);
        s.evidenceDueAt=engine.evidenceDueAt(s.handId);
        (s.recoveryOpenedAt,s.recoveryFinalizableAt,s.recoveryStateRoot,s.recoveryPhase,s.recoveryActive)=engine.evidenceRecovery(s.handId);
        s.receipt=engine.settlementReceipt(s.handId);
    }
}
