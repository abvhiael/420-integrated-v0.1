// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/randomness/RandomnessDraw420.sol";

contract RandomnessDrawHarness420 {
    function derive(bytes32 root, bytes32 domain, uint256 index) external pure returns (bytes32) {
        return RandomnessDraw420.deriveDraw(root, domain, index);
    }

    function bounded(bytes32 root, bytes32 domain, uint256 index, uint256 upperExclusive)
        external pure returns (uint256)
    {
        return RandomnessDraw420.boundedUint(root, domain, index, upperExclusive);
    }

    function range(bytes32 root, bytes32 domain, uint256 index, uint256 minInclusive, uint256 maxInclusive)
        external pure returns (uint256)
    {
        return RandomnessDraw420.uniformRange(root, domain, index, minInclusive, maxInclusive);
    }

    function weighted(bytes32 root, bytes32 domain, uint256 index, uint256[] memory weights)
        external pure returns (uint256)
    {
        return RandomnessDraw420.weightedSelection(root, domain, index, weights);
    }

    function sample(bytes32 root, bytes32 domain, uint256 index, uint256 population, uint256 count)
        external pure returns (uint256[] memory)
    {
        return RandomnessDraw420.sampleWithoutReplacement(root, domain, index, population, count);
    }
}

contract RandomnessDraw420Test {
    function testDrawDerivationIsDeterministicAndDomainSeparated() public {
        RandomnessDrawHarness420 harness = new RandomnessDrawHarness420();
        bytes32 root = keccak256("root");
        bytes32 domainA = keccak256("domain-a");
        bytes32 domainB = keccak256("domain-b");
        bytes32 a1 = harness.derive(root, domainA, 0);
        bytes32 a2 = harness.derive(root, domainA, 0);
        bytes32 b = harness.derive(root, domainB, 0);
        bytes32 next = harness.derive(root, domainA, 1);
        require(a1 == a2, "not deterministic");
        require(a1 != b, "domain collision");
        require(a1 != next, "draw collision");
    }

    function testBoundedUintAlwaysWithinRange() public {
        RandomnessDrawHarness420 harness = new RandomnessDrawHarness420();
        bytes32 root = keccak256("bounded-root");
        bytes32 domain = keccak256("bounded-domain");
        for (uint256 i; i < 64; ++i) {
            uint256 value = harness.bounded(root, domain, i, 7);
            require(value < 7, "out of bounds");
        }
    }

    function testUniformRangeIncludesOnlyRequestedInterval() public {
        RandomnessDrawHarness420 harness = new RandomnessDrawHarness420();
        bytes32 root = keccak256("range-root");
        bytes32 domain = keccak256("range-domain");
        for (uint256 i; i < 64; ++i) {
            uint256 value = harness.range(root, domain, i, 10, 20);
            require(value >= 10 && value <= 20, "bad range");
        }
    }

    function testWeightedSelectionReturnsExistingBucket() public {
        RandomnessDrawHarness420 harness = new RandomnessDrawHarness420();
        uint256[] memory weights = new uint256[](3);
        weights[0] = 1;
        weights[1] = 3;
        weights[2] = 6;
        for (uint256 i; i < 32; ++i) {
            uint256 selected = harness.weighted(keccak256("weighted-root"), keccak256("weighted-domain"), i, weights);
            require(selected < 3, "bad bucket");
        }
    }

    function testSampleWithoutReplacementContainsNoDuplicates() public {
        RandomnessDrawHarness420 harness = new RandomnessDrawHarness420();
        uint256[] memory sample_ = harness.sample(keccak256("sample-root"), keccak256("sample-domain"), 0, 20, 10);
        require(sample_.length == 10, "length");
        for (uint256 i; i < sample_.length; ++i) {
            require(sample_[i] < 20, "population");
            for (uint256 j = i + 1; j < sample_.length; ++j) {
                require(sample_[i] != sample_[j], "duplicate");
            }
        }
    }
}