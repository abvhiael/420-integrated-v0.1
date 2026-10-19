// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerCanonicalEvidence420.sol";
import "./PokerCanonicalRake420.sol";
import "./PokerActionDisputeClock420.sol";

/// @notice Permissionless, replay-protected application of canonical hand proof
///         to the actual ERC20-backed seat ledger.
/// @dev This contract must be bound by table governance only after the real
///      production shuffle+rules+reveal verifier versions have passed qualification.
///      Test doubles must never be registered for funded live tables.
contract PokerCanonicalSettlement420 {
    bytes32 public constant PAYOUT_DOMAIN=keccak256("420.BET.POKER.CANONICAL.PAYOUTS.V1");
    bytes32 public constant FINAL_DOMAIN=keccak256("420.BET.POKER.CANONICAL.FINAL.V1");

    PokerCanonicalEvidence420 public immutable canonical;
    PokerConfidentialDeal420 public immutable deals;
    PokerSeatLedger420 public immutable ledger;
    PokerCanonicalRake420 public immutable rakeEngine;
    PokerActionDisputeClock420 public immutable disputes;

    mapping(bytes32=>uint64) public reservedAt;
    mapping(bytes32=>bool) public cancelled;
    mapping(bytes32=>bool) public completed;

    error InvalidDependency();error InvalidHand();error InvalidProof();error InvalidRake();
    error InvalidSettlement();error TooEarly();error Disputed();

    event HandReservedForSettlement(bytes32 indexed handId,bytes32 indexed tableId,uint64 timestamp);
    event HandCancelledForWithheldShuffle(bytes32 indexed handId,bytes32 indexed tableId);
    event CanonicalHandSettled(bytes32 indexed handId,bytes32 indexed tableId,bytes32 payoutHash,uint256 rake);

    constructor(address evidence_,address rake_,address disputes_) {
        if(evidence_==address(0)||rake_==address(0)||disputes_==address(0))
            revert InvalidDependency();
        canonical=PokerCanonicalEvidence420(evidence_);
        deals=canonical.deals();
        ledger=deals.ledger();
        rakeEngine=PokerCanonicalRake420(rake_);
        disputes=PokerActionDisputeClock420(disputes_);
        if(address(rakeEngine.tables())!=address(deals.tables())||
           address(disputes.deals())!=address(deals))revert InvalidDependency();
    }

    /// @notice Reserve the exact hand snapshot without permitting chip movement.
    /// @dev Can be called by any seated hand participant or registered controller.
    ///      Escrow lock is essential before any card information is released.
    function reserve(bytes32 handId) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.AWAITING &&
           h.state!=PokerConfidentialDeal420.State.COMMITTED)revert InvalidHand();
        if(reservedAt[handId]!=0||cancelled[handId]||completed[handId])
            revert InvalidHand();
        PokerTableRegistry420.Table memory table=deals.tables().getTable(h.tableId);
        if(msg.sender!=table.controller){
            bool member=false;
            uint16 mask=deals.handSeatMask(handId);
            for(uint8 i=0;i<table.config.seats;i++)
                if((mask&(uint16(1)<<i))!=0 &&
                   ledger.seatOf(h.tableId,i).player==msg.sender)member=true;
            if(!member)revert InvalidHand();
        }
        uint16 mask=deals.handSeatMask(handId);
        if(mask==0 || ledger.seatingEpoch(h.tableId)!=h.epoch ||
           deals.snapshotFor(h.tableId,mask)!=h.seatSnapshotHash)
            revert InvalidHand();
        if(ledger.settlementCoordinator(h.tableId)!=address(this))
            revert InvalidDependency();
        ledger.reserveHand(h.tableId,handId,mask,h.epoch);
        reservedAt[handId]=uint64(block.timestamp);
        emit HandReservedForSettlement(handId,h.tableId,uint64(block.timestamp));
    }

    /// @notice Only an uncompleted shuffle can expire into a risk-free refund.
    /// @dev No board or betting should be released until both shuffle proofs pass.
    ///      Cannot cancel a completed encrypted shuffle or accepted terminal proof.
    function cancelWithheldShuffle(bytes32 handId) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(reservedAt[handId]==0||cancelled[handId]||completed[handId])
            revert InvalidHand();
        if(block.timestamp<h.deadline+1 hours)revert TooEarly();
        if(canonical.shuffle().isProofComplete(handId))revert InvalidProof();
        if(canonical.acceptedOf(handId).accepted)revert InvalidProof();
        ledger.cancelReservedHand(h.tableId,handId);
        cancelled[handId]=true;
        emit HandCancelledForWithheldShuffle(handId,h.tableId);
    }

    function payoutHash(bytes32 handId,uint256[9] calldata finalChips,uint256 rake,
        uint256 grossPot,bool flopSeen,bool uncontested) public view returns(bytes32) {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        bytes32 snapshot=ledger.lockedSnapshot(h.tableId);
        if(snapshot==bytes32(0)||ledger.activeHand(h.tableId)!=handId)revert InvalidHand();
        return keccak256(abi.encode(PAYOUT_DOMAIN,block.chainid,address(this),
            handId,h.tableId,h.configHash,h.seatSnapshotHash,snapshot,
            finalChips,rake,grossPot,flopSeen,uncontested,
            ledger.rakeDestination(h.tableId)));
    }
    function finalStateHash(bytes32 handId,bytes32 actionRoot,bytes32 boardRoot,
        bytes32 payoutRoot) public pure returns(bytes32){
        return keccak256(abi.encode(FINAL_DOMAIN,handId,actionRoot,boardRoot,payoutRoot));
    }

    /// @notice A single proof-bound transaction applies exactly the payouts
    ///         the canonical rules verifier accepted. No operator signoff.
    function settle(bytes32 handId,uint256[9] calldata finalChips,
        PokerCanonicalRake420.Policy calldata policy,uint256 grossPot,
        bool flopSeen,bool uncontested) external {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(reservedAt[handId]==0||cancelled[handId]||completed[handId])
            revert InvalidSettlement();
        if(disputes.isFrozen(handId))revert Disputed();
        PokerCanonicalEvidence420.Accepted memory accepted=canonical.acceptedOf(handId);
        if(!accepted.accepted)revert InvalidProof();
        if(!canonical.shuffle().isProofComplete(handId))revert InvalidProof();
        bytes32 policyHash=rakeEngine.policyHash(policy);
        if(policyHash!=accepted.rakePolicyHash)revert InvalidRake();
        uint256 fee=rakeEngine.rake(h.tableId,policy,grossPot,flopSeen,uncontested);
        bytes32 payout=payoutHash(handId,finalChips,fee,grossPot,flopSeen,uncontested);
        if(payout!=accepted.payoutVectorHash||
           finalStateHash(handId,accepted.actionTranscriptRoot,accepted.boardRevealRoot,payout)
             !=accepted.finalStateRoot)revert InvalidProof();
        // All ledger updates, rake transfer, replay marking and external effects
        // revert atomically if any proof binding or token transfer fails.
        completed[handId]=true;
        ledger.settleReservedHand(h.tableId,handId,finalChips,fee);
        emit CanonicalHandSettled(handId,h.tableId,payout,fee);
    }
}
