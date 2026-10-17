// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Versioned 9/6 Jacks-or-Better evaluator and five-credit royal bonus.
/// @dev Multipliers are based on one-credit stake units. Independent RTP review required.
library VideoPokerJacksOrBetter420 {
    enum Category { NOTHING, JACKS_OR_BETTER, TWO_PAIR, THREE_OF_A_KIND, STRAIGHT, FLUSH,
        FULL_HOUSE, FOUR_OF_A_KIND, STRAIGHT_FLUSH, ROYAL_FLUSH }
    bytes32 internal constant PAYTABLE_ID = keccak256("420BET.PAYTABLE.VIDEO_POKER.JACKS_OR_BETTER.V1");

    error InvalidCard();
    error DuplicateCard();
    error InvalidCredits();
    error InvalidStake();

    /// @dev Card i: suit = i/13; rank = i%13 (0 ace, 1 deuce, ..., 12 king).
    function evaluate(uint8[5] memory cards) internal pure returns (Category category) {
        uint8[14] memory count; // index 1=ace, 2-13 as naturally numbered ranks
        uint256 used;
        uint8 suit = cards[0] / 13;
        bool flushHand = true;
        for (uint256 i; i < 5; ++i) {
            uint8 card = cards[i];
            if (card >= 52) revert InvalidCard();
            uint256 bit = uint256(1) << card;
            if ((used & bit) != 0) revert DuplicateCard();
            used |= bit;
            if (card / 13 != suit) flushHand = false;
            uint8 rank = card % 13;
            count[rank == 0 ? 1 : rank + 1]++;
        }
        uint8 pairCount;
        bool highPair;
        bool three;
        bool four;
        for (uint8 rank = 1; rank <= 13; ++rank) {
            if (count[rank] == 4) four = true;
            if (count[rank] == 3) three = true;
            if (count[rank] == 2) { pairCount++; if (rank == 1 || rank >= 11) highPair = true; }
        }
        bool straight;
        bool royal = count[1] == 1 && count[10] == 1 && count[11] == 1 && count[12] == 1 && count[13] == 1;
        if (royal) straight = true;
        for (uint8 start = 1; start <= 9; ++start) {
            bool sequence = true;
            for (uint8 step; step < 5; ++step) {
                if (count[start + step] != 1) { sequence = false; break; }
            }
            if (sequence) { straight = true; break; }
        }
        if (straight && flushHand) return royal ? Category.ROYAL_FLUSH : Category.STRAIGHT_FLUSH;
        if (four) return Category.FOUR_OF_A_KIND;
        if (three && pairCount == 1) return Category.FULL_HOUSE;
        if (flushHand) return Category.FLUSH;
        if (straight) return Category.STRAIGHT;
        if (three) return Category.THREE_OF_A_KIND;
        if (pairCount == 2) return Category.TWO_PAIR;
        if (pairCount == 1 && highPair) return Category.JACKS_OR_BETTER;
        return Category.NOTHING;
    }

    /// @notice Total returned credits, not profit; 5-credit royal pays 4000 credits.
    function payoutCredits(Category category, uint8 credits) internal pure returns (uint256) {
        if (credits < 1 || credits > 5) revert InvalidCredits();
        if (category == Category.ROYAL_FLUSH) return credits == 5 ? 4000 : uint256(credits) * 250;
        uint256[9] memory factors = [uint256(0), 1, 2, 3, 4, 6, 9, 25, 50];
        return uint256(credits) * factors[uint8(category)];
    }

    function maximumGross(uint256 stake, uint8 credits) internal pure returns (uint256) {
        if (stake == 0 || credits < 1 || credits > 5 || stake % credits != 0) revert InvalidStake();
        uint256 maxUnits = payoutCredits(Category.ROYAL_FLUSH, credits);
        if (stake / credits > type(uint256).max / maxUnits) revert InvalidStake();
        return (stake / credits) * maxUnits;
    }

    function grossPayout(uint8[5] memory cards, uint256 stake, uint8 credits)
        internal pure returns (Category category, uint256 gross)
    {
        if (stake == 0 || credits < 1 || credits > 5 || stake % credits != 0) revert InvalidStake();
        category = evaluate(cards);
        gross = (stake / credits) * payoutCredits(category, credits);
    }
}

/// @notice Game-specific external pure selectors for qualification and live integration.
contract VideoPokerEconomics420 {
    function evaluate(uint8[5] memory hand) external pure returns (VideoPokerJacksOrBetter420.Category) {
        return VideoPokerJacksOrBetter420.evaluate(hand);
    }
    function payoutCredits(VideoPokerJacksOrBetter420.Category category, uint8 credits) external pure returns (uint256) {
        return VideoPokerJacksOrBetter420.payoutCredits(category, credits);
    }
    function maximumGross(uint256 stake, uint8 credits) external pure returns (uint256) {
        return VideoPokerJacksOrBetter420.maximumGross(stake, credits);
    }
    function quote(uint8[5] memory hand, uint256 stake, uint8 credits)
        external pure returns (VideoPokerJacksOrBetter420.Category, uint256)
    {
        return VideoPokerJacksOrBetter420.grossPayout(hand, stake, credits);
    }
}
