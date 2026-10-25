// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/fantasy/FantasyRankingBook420.sol";

contract FantasyRankingBook420Test {
    bytes32 constant POOL = keccak256("ranking-unit");

    function testFuzzMixedScoreGroupsMatchIndependentRationalAllocation(uint64 prize, uint8 seed) public {
        FantasyRankingBook420 book = new FantasyRankingBook420(address(this));
        uint16[] memory weights = new uint16[](3);
        weights[0] = 5000;
        weights[1] = 3000;
        weights[2] = 2000;
        book.initialize(POOL, 1, 10, prize, weights);
        int256[11] memory scores;
        uint64[10] memory order;
        for (uint64 i = 1; i <= 10; i++) {
            scores[i] = int256(uint256(keccak256(abi.encode(seed, i))) % 7) - 3;
            uint64 previous;
            uint64 cursor = book.workOf(POOL, 1).head;
            while (cursor != 0 && (scores[cursor] > scores[i] || (scores[cursor] == scores[i] && cursor < i))) {
                previous = cursor;
                cursor = book.nodeOf(POOL, 1, cursor).next;
            }
            book.insert(POOL, 1, i, scores[i], previous, cursor);
            order[i - 1] = i;
        }
        // Independently sort an in-memory array, rather than trusting the linked list.
        for (uint256 i; i < 10; i++) {
            for (uint256 j = i + 1; j < 10; j++) {
                if (
                    scores[order[j]] > scores[order[i]] || (scores[order[j]] == scores[order[i]] && order[j] < order[i])
                ) {
                    (order[i], order[j]) = (order[j], order[i]);
                }
            }
        }
        uint256[11] memory expected;
        bool[11] memory fractional;
        uint256 allocated;
        uint256 start;
        while (start < 10) {
            uint256 end = start + 1;
            while (end < 10 && scores[order[end]] == scores[order[start]]) end++;
            uint256 weight;
            for (uint256 i = start; i < end && i < 3; i++) {
                weight += weights[i];
            }
            uint256 numerator = uint256(prize) * weight;
            uint256 denominator = (end - start) * 10000;
            for (uint256 i = start; i < end; i++) {
                expected[order[i]] = numerator / denominator;
                fractional[order[i]] = numerator % denominator != 0;
                allocated += expected[order[i]];
            }
            start = end;
        }
        uint256 residual = prize - allocated;
        for (uint64 i = 1; i <= 10 && residual != 0; i++) {
            if (fractional[i]) {
                expected[i]++;
                residual--;
            }
        }
        while (!book.workOf(POOL, 1).walkedAll) book.walk(POOL, 1, uint8(1 + seed % 8));
        while (!book.workOf(POOL, 1).ready) book.allocate(POOL, 1, uint8(1 + seed % 7));
        uint256 sum;
        uint64 cursor = book.workOf(POOL, 1).head;
        for (uint64 i = 1; i <= 10; i++) {
            require(cursor == order[i - 1], "canonical ranking");
            cursor = book.nodeOf(POOL, 1, cursor).next;
            uint256 actual = book.payoutOf(POOL, 1, i);
            require(actual == expected[i], "independent rational payout");
            sum += actual;
        }
        require(sum == prize && cursor == 0 && book.rootOf(POOL, 1) != 0, "conserved and committed");
    }

    function testRevisionIsolation() public {
        FantasyRankingBook420 book = new FantasyRankingBook420(address(this));
        uint16[] memory weights = new uint16[](1);
        weights[0] = 10000;
        book.initialize(POOL, 1, 2, 100, weights);
        book.initialize(POOL, 2, 2, 100, weights);
        book.insert(POOL, 1, 1, 10, 0, 0);
        book.insert(POOL, 1, 2, 0, 1, 0);
        book.insert(POOL, 2, 2, 20, 0, 0);
        book.insert(POOL, 2, 1, 10, 2, 0);
        book.walk(POOL, 1, 1);
        book.walk(POOL, 2, 2);
        book.walk(POOL, 1, 1);
        book.allocate(POOL, 1, 2);
        book.allocate(POOL, 2, 2);
        require(book.payoutOf(POOL, 1, 1) == 100 && book.payoutOf(POOL, 2, 2) == 100, "revisions separate");
    }

    function testMaxUintPrizeRequiresNoOverflowingIntermediateProduct() public {
        FantasyRankingBook420 book = new FantasyRankingBook420(address(this));
        uint16[] memory weights = new uint16[](1);
        weights[0] = 10000;
        book.initialize(POOL, 1, 3, type(uint256).max, weights);
        for (uint64 i = 1; i <= 3; i++) {
            book.insert(POOL, 1, i, 0, i - 1, 0);
        }
        book.walk(POOL, 1, 2);
        book.walk(POOL, 1, 1);
        book.allocate(POOL, 1, 3);
        uint256 third = type(uint256).max / 3;
        require(
            book.payoutOf(POOL, 1, 1) == third && book.payoutOf(POOL, 1, 2) == third
                && book.payoutOf(POOL, 1, 3) == third,
            "full precision equal split"
        );
    }
}
