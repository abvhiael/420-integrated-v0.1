// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Versioned, deterministic harvest quote calculator. All quantities are integer grams.
/// @dev R03.2 fixed V1 gameplay policy, not botanical yield prediction or an inventory mint.
library HarvestScoring {
    uint256 internal constant BPS = 10_000;
    uint256 internal constant MAX_GRAMS = 1_000;
    uint256 internal constant BASE_GRAMS = 500;

    enum Grade { NONE, C, B, A, PREMIUM }
    struct Result {
        uint32 yieldGrams;
        uint16 qualityBps;
        uint16 geneticBps;
        Grade grade;
    }

    /// @notice Floor rounding at each integer division. Quality 0 yields 0 grams and NONE.
    /// @dev The low 16 bits of a sealed genome ID provide a reproducible 9000–11000 bps
    ///      game modifier; this is an explicit V1 game rule, not an independently validated
    ///      genotype-to-yield prediction.
    function calculate(bytes32 genomeId, uint16 qualityBps) internal pure returns (Result memory result) {
        require(genomeId != bytes32(0), "HARVEST_INVALID_GENOME");
        require(qualityBps <= BPS, "HARVEST_QUALITY_RANGE");
        uint16 genetics = uint16(9_000 + (uint256(genomeId) % 2_001));
        uint256 grams = (BASE_GRAMS * qualityBps) / BPS;
        grams = (grams * genetics) / BPS;
        if (grams > MAX_GRAMS) grams = MAX_GRAMS;
        Grade grade = Grade.NONE;
        if (qualityBps != 0 && grams != 0) {
            if (qualityBps >= 9_000) grade = Grade.PREMIUM;
            else if (qualityBps >= 7_500) grade = Grade.A;
            else if (qualityBps >= 5_000) grade = Grade.B;
            else grade = Grade.C;
        }
        result = Result(uint32(grams), qualityBps, genetics, grade);
    }
}
