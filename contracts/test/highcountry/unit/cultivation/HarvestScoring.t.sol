// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HarvestScoring } from "../../../../src/highcountry/harvest/HarvestScoring.sol";

contract HarvestScoringTest {
    function score(bytes32 genome, uint16 quality) external pure returns (HarvestScoring.Result memory) {
        return HarvestScoring.calculate(genome, quality);
    }

    function testZeroAndMaximumBoundaries() public {
        HarvestScoring.Result memory zero = this.score(bytes32(uint256(1)), 0);
        require(zero.yieldGrams == 0 && zero.grade == HarvestScoring.Grade.NONE, "zero output");
        HarvestScoring.Result memory maxScore = this.score(bytes32(uint256(2000)), 10000);
        require(maxScore.yieldGrams <= 1000 && maxScore.yieldGrams > 0, "maximum bound");
        require(maxScore.grade == HarvestScoring.Grade.PREMIUM, "premium grade");
    }

    function testGradeCutoffsAndDeterminism() public {
        bytes32 genome = bytes32(uint256(1));
        uint16[8] memory qualities = [uint16(1), 4999, 5000, 7499, 7500, 8999, 9000, 10000];
        for (uint256 i; i < qualities.length; ++i) {
            HarvestScoring.Result memory a = this.score(genome, qualities[i]);
            HarvestScoring.Result memory b = this.score(genome, qualities[i]);
            require(keccak256(abi.encode(a)) == keccak256(abi.encode(b)), "nondeterministic output");
            require(a.yieldGrams <= 1000 && a.geneticBps >= 9000 && a.geneticBps <= 11000, "out of bounds");
            if (qualities[i] >= 9000) require(a.grade == HarvestScoring.Grade.PREMIUM, "premium threshold");
            else if (qualities[i] >= 7500) require(a.grade == HarvestScoring.Grade.A, "A threshold");
            else if (qualities[i] >= 5000) require(a.grade == HarvestScoring.Grade.B, "B threshold");
            else if (a.yieldGrams != 0) require(a.grade == HarvestScoring.Grade.C, "C threshold");
        }
    }

    function testFloorRoundingAndGenetics() public {
        HarvestScoring.Result memory a = this.score(bytes32(uint256(2001)), 10000);
        require(a.geneticBps == 9000 && a.yieldGrams == 450, "floor lower boundary");
        HarvestScoring.Result memory b = this.score(bytes32(uint256(2000)), 10000);
        require(b.geneticBps == 11000 && b.yieldGrams == 550, "upper genetics boundary");
        HarvestScoring.Result memory c = this.score(bytes32(uint256(1)), 1);
        require(c.yieldGrams == 0 && c.grade == HarvestScoring.Grade.NONE, "small output rounds to zero");
    }

    function testInvalidInputsFailClosed() public {
        (bool badGenome,) = address(this).call(abi.encodeCall(this.score, (bytes32(0), uint16(10000))));
        require(!badGenome, "zero genome");
        (bool badQuality,) = address(this).call(abi.encodeCall(this.score, (bytes32(uint256(1)), uint16(10001))));
        require(!badQuality, "oversized quality");
    }
}
