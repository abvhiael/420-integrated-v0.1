// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./VideoPokerDrawV1420.sol";
import "./VideoPokerJacksOrBetter420.sol";

/// @notice Immutable versioned canonical Video Poker settlement resolver.
/// @dev Authorized SettlementEngine420 performs actual vault/risk/registry/fee transitions.
contract VideoPokerResolverV1420 {
    bytes32 public constant APPROVED_RULES_DOMAIN = keccak256("420.BET.VIDEO_POKER.V1.9_6.JACKS_OR_BETTER");
    VideoPokerDrawV1420 public immutable draw;
    VideoPokerV1420 public immutable poker;
    error InvalidPaytable();
    error InvalidWagerStatus();
    error DrawNotComplete();
    error InsufficientReserve();

    constructor(address draw_) {
        if (draw_ == address(0)) revert InvalidPaytable();
        draw = VideoPokerDrawV1420(draw_);
        poker = draw.poker();
    }

    function gameId() external view returns (bytes32) { return poker.gameId(); }
    function gameVersionId() external view returns (bytes32) { return poker.gameVersionId(); }
    function rulesetId() external view returns (bytes32) { return poker.rulesetId(); }
    function wagerRegistry() external view returns (BetRegistry420) { return poker.wagerRegistry(); }

    function requiredGrossReserve(uint256 stake, uint8 credits) external pure returns (uint256) {
        return VideoPokerJacksOrBetter420.maximumGross(stake, credits);
    }

    function resolve(bytes32 wagerId, VideoPokerV1420.Params calldata params)
        external view returns (BetTypes420.TerminalOutcome outcome, uint256 gross)
    {
        if (params.paytableId != VideoPokerJacksOrBetter420.PAYTABLE_ID) revert InvalidPaytable();
        BetTypes420.Wager memory wager = poker.validateWager(wagerId, params);
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED &&
            wager.status != BetTypes420.WagerStatus.OUTCOME_READY) revert InvalidWagerStatus();
        VideoPokerDrawV1420.Session memory session = draw.getSession(wagerId);
        if (!session.revealed || session.timedOut) revert DrawNotComplete();
        uint256 required = VideoPokerJacksOrBetter420.maximumGross(wager.stake, params.credits);
        if (wager.maxGrossPayout < required) revert InsufficientReserve();
        (, gross) = VideoPokerJacksOrBetter420.grossPayout(session.finalCards, wager.stake, params.credits);
        if (gross > wager.maxGrossPayout) revert InsufficientReserve();
        if (gross == 0) return (BetTypes420.TerminalOutcome.LOSS, 0);
        if (gross == wager.stake) return (BetTypes420.TerminalOutcome.PUSH, gross);
        return (BetTypes420.TerminalOutcome.WIN, gross);
    }
}
