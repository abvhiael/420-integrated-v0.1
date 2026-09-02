// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./BlackjackV1420.sol";
import "./RandomnessRouter420.sol";

/// @notice Read-only reconstruction surface for the first-party BlackjackV1 game.
/// @dev This contract has no custody, randomness, settlement, gameplay, or admin authority.
///      It exposes the canonical wager, randomness request, precommitted draw streams and
///      live/terminal hand state so clients do not need to invent off-chain game state.
contract BlackjackV1View420 is I420System {
    struct Snapshot {
        BetTypes420.Wager wager;
        bool randomnessRequested;
        RandomnessRouter420.RandomnessRequest randomness;
        bool settlementExists;
        BetTypes420.Settlement settlement;
        bool paramsMatch;
        bool primaryStreamCommitted;
        BlackjackV1420.StreamCommitment primaryStream;
        bool fallbackStreamCommitted;
        BlackjackV1420.StreamCommitment fallbackStream;
        bool handStarted;
        BlackjackV1420.HandState hand;
        bool terminal;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
    BlackjackV1420 public immutable blackjack;

    error ZeroAddress();
    error DependencyMismatch();

    constructor(address wagerRegistry_, address randomnessRouter_, address blackjack_) {
        if (wagerRegistry_ == address(0) || randomnessRouter_ == address(0) || blackjack_ == address(0)) {
            revert ZeroAddress();
        }

        wagerRegistry = BetRegistry420(wagerRegistry_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
        blackjack = BlackjackV1420(blackjack_);

        if (
            address(blackjack.wagerRegistry()) != wagerRegistry_
                || address(blackjack.randomnessRouter()) != randomnessRouter_
        ) revert DependencyMismatch();
    }

    function systemName() external pure returns (string memory) { return "BlackjackV1View420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function snapshot(bytes32 wagerId, BlackjackV1420.Params calldata params)
        external
        view
        returns (Snapshot memory s)
    {
        s.wager = wagerRegistry.getWager(wagerId);
        s.paramsMatch = blackjack.hashParams(params) == s.wager.paramsHash;

        try randomnessRouter.getRequest(wagerId) returns (RandomnessRouter420.RandomnessRequest memory r) {
            s.randomnessRequested = true;
            s.randomness = r;
        } catch {}

        s.settlementExists = wagerRegistry.settlementExists(wagerId);
        if (s.settlementExists) s.settlement = wagerRegistry.getSettlement(wagerId);

        try blackjack.getStream(wagerId, RandomnessRouter420.Source.PRIMARY)
            returns (BlackjackV1420.StreamCommitment memory stream)
        {
            s.primaryStreamCommitted = true;
            s.primaryStream = stream;
        } catch {}

        try blackjack.getStream(wagerId, RandomnessRouter420.Source.FALLBACK)
            returns (BlackjackV1420.StreamCommitment memory stream)
        {
            s.fallbackStreamCommitted = true;
            s.fallbackStream = stream;
        } catch {}

        try blackjack.getHand(wagerId) returns (BlackjackV1420.HandState memory hand) {
            s.handStarted = true;
            s.hand = hand;
            s.terminal = hand.phase == BlackjackV1420.Phase.TERMINAL;
        } catch {}
    }
}
