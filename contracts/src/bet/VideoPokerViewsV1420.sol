// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./VideoPokerResolverV1420.sol";

/// @notice Stateless public inspection of the immutable Video Poker V1 lifecycle.
/// @dev Does not reveal unrevealed entropy or cards, submit transactions, or infer a settlement.
contract VideoPokerViewsV1420 {
    VideoPokerResolverV1420 public immutable resolver;
    VideoPokerDrawV1420 public immutable draw;
    VideoPokerDealV1420 public immutable dealer;
    VideoPokerV1420 public immutable poker;
    BetRegistry420 public immutable registry;

    enum Stage { UNCOMMITTED, COMMITTED, DEALT, HELD, DRAWN, WITHHELD, SETTLED, VOID }
    struct View {
        bytes32 wagerId;
        address player;
        bytes32 gameVersionId;
        bytes32 rulesetId;
        bytes32 paytableId;
        bytes32 paytableCommitment;
        uint8 credits;
        uint256 stake;
        uint256 maximumGross;
        uint64 deadline;
        Stage stage;
        bool hasInitialDeal;
        uint8[5] initialCards;
        bool hasHold;
        uint8 heldMask;
        bool hasFinalHand;
        uint8[5] finalCards;
        bytes32 dealCommitment;
        bytes32 replacementCommitment;
        bytes32 seedRevealHash;
        bool hasSettlement;
        BetTypes420.TerminalOutcome recordedOutcome;
        uint256 recordedGross;
        uint64 settledAt;
    }
    error WrongPaytable();
    error InconsistentState();
    error NotDrawn();
    error NotSettled();
    error ResultMismatch();

    constructor(address resolver_) {
        if (resolver_ == address(0)) revert InconsistentState();
        resolver = VideoPokerResolverV1420(resolver_);
        draw = resolver.draw();
        dealer = draw.dealer();
        poker = resolver.poker();
        registry = poker.wagerRegistry();
    }

    function inspect(bytes32 wagerId, VideoPokerV1420.Params calldata params) external view returns (View memory v) {
        if (params.paytableId != VideoPokerJacksOrBetter420.PAYTABLE_ID) revert WrongPaytable();
        BetTypes420.Wager memory wager = poker.validateWager(wagerId, params);
        v.wagerId = wagerId;
        v.player = wager.player;
        v.gameVersionId = wager.gameVersionId;
        v.rulesetId = wager.rulesetId;
        v.paytableId = params.paytableId;
        v.paytableCommitment = VideoPokerJacksOrBetter420.paytableCommitment();
        v.credits = params.credits;
        v.stake = wager.stake;
        v.maximumGross = VideoPokerJacksOrBetter420.maximumGross(wager.stake, params.credits);
        v.deadline = wager.deadline;
        if (wager.maxGrossPayout < v.maximumGross) revert InconsistentState();
        VideoPokerDrawV1420.Session memory s = draw.getSession(wagerId);
        v.replacementCommitment = s.seedCommitment;
        v.dealCommitment = s.dealCommitment;
        v.hasHold = s.held;
        v.heldMask = s.heldMask;
        v.seedRevealHash = s.seedRevealHash;
        // The initial deal is visible only after the deal contract has persisted it.
        try dealer.initialDeal(wagerId) returns (VideoPokerDealV1420.InitialDeal memory d) {
            v.hasInitialDeal = true;
            v.initialCards = d.cards;
            if (s.held && d.deckCommitment != s.dealCommitment) revert InconsistentState();
        } catch (bytes memory reason) {
            bytes4 selector;
            if (reason.length >= 4) {
                assembly { selector := mload(add(reason, 32)) }
            }
            if (reason.length != 4 || selector != VideoPokerDealV1420.DealMissing.selector)
                revert InconsistentState();
        }
        v.hasFinalHand = s.revealed;
        if (s.revealed) v.finalCards = s.finalCards;
        if (s.revealed && (!s.held || s.timedOut)) revert InconsistentState();
        if (s.held && !v.hasInitialDeal) revert InconsistentState();
        if (registry.settlementExists(wagerId)) {
            BetTypes420.Settlement memory settlement = registry.getSettlement(wagerId);
            v.hasSettlement = true;
            v.recordedOutcome = settlement.outcome;
            v.recordedGross = settlement.grossPayout;
            v.settledAt = settlement.settledAt;
            // Read-only clients must never present an inconsistent recorded result as verified.
            if (settlement.outcome == BetTypes420.TerminalOutcome.VOID) {
                if (settlement.grossPayout != wager.stake) revert ResultMismatch();
            } else {
                if (!s.revealed || s.timedOut) revert InconsistentState();
                (, uint256 computedGross) =
                    VideoPokerJacksOrBetter420.grossPayout(s.finalCards, wager.stake, params.credits);
                BetTypes420.TerminalOutcome computedOutcome =
                    computedGross == 0 ? BetTypes420.TerminalOutcome.LOSS :
                    computedGross == wager.stake ? BetTypes420.TerminalOutcome.PUSH :
                    computedGross > wager.stake ? BetTypes420.TerminalOutcome.WIN :
                    BetTypes420.TerminalOutcome.LOSS;
                if (settlement.grossPayout != computedGross || settlement.outcome != computedOutcome)
                    revert ResultMismatch();
            }
        }
        if (wager.status == BetTypes420.WagerStatus.VOID) {
            if (!v.hasSettlement || v.recordedOutcome != BetTypes420.TerminalOutcome.VOID) revert InconsistentState();
            v.stage = Stage.VOID;
        } else if (wager.status == BetTypes420.WagerStatus.SETTLED) {
            if (!v.hasSettlement || !s.revealed) revert InconsistentState();
            v.stage = Stage.SETTLED;
        } else if (v.hasSettlement) {
            revert InconsistentState();
        } else if (s.timedOut) v.stage = Stage.WITHHELD;
        else if (s.revealed) v.stage = Stage.DRAWN;
        else if (s.held) v.stage = Stage.HELD;
        else if (v.hasInitialDeal) v.stage = Stage.DEALT;
        else if (s.committed) v.stage = Stage.COMMITTED;
        else v.stage = Stage.UNCOMMITTED;
    }

    /// @notice Recalculate the official payout from persisted final cards and recorded wager.
    /// @dev A successful local quote is not proof the transaction was settled or externally audited.
    function verifyResult(bytes32 wagerId, VideoPokerV1420.Params calldata params)
        external view returns (VideoPokerJacksOrBetter420.Category category,
            BetTypes420.TerminalOutcome expectedOutcome, uint256 expectedGross, bool settlementMatches)
    {
        if (params.paytableId != VideoPokerJacksOrBetter420.PAYTABLE_ID) revert WrongPaytable();
        BetTypes420.Wager memory wager = poker.validateWager(wagerId, params);
        VideoPokerDrawV1420.Session memory s = draw.getSession(wagerId);
        if (!s.revealed || s.timedOut) revert NotDrawn();
        if (wager.maxGrossPayout < VideoPokerJacksOrBetter420.maximumGross(wager.stake, params.credits))
            revert InconsistentState();
        (category, expectedGross) = VideoPokerJacksOrBetter420.grossPayout(s.finalCards, wager.stake, params.credits);
        expectedOutcome = expectedGross == 0 ? BetTypes420.TerminalOutcome.LOSS :
            expectedGross == wager.stake ? BetTypes420.TerminalOutcome.PUSH :
            expectedGross > wager.stake ? BetTypes420.TerminalOutcome.WIN : BetTypes420.TerminalOutcome.LOSS;
        if (registry.settlementExists(wagerId)) {
            BetTypes420.Settlement memory settlement = registry.getSettlement(wagerId);
            settlementMatches = settlement.outcome == expectedOutcome && settlement.grossPayout == expectedGross;
            if (!settlementMatches) revert ResultMismatch();
        }
    }
}
