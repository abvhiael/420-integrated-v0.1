// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./RandomnessIds420.sol";

/// @notice Deterministic, domain-separated draw helpers derived from one canonical randomness root.
library RandomnessDraw420 {
    error InvalidBound();
    error InvalidRange();
    error InvalidWeights();
    error SampleTooLarge();

    function deriveDraw(bytes32 root, bytes32 domain, uint256 drawIndex) internal pure returns (bytes32) {
        return keccak256(abi.encode(RandomnessIds420.DRAW_TYPEHASH, root, domain, drawIndex));
    }

    function boundedUint(bytes32 root, bytes32 domain, uint256 drawIndex, uint256 upperExclusive)
        internal pure returns (uint256 value)
    {
        if (upperExclusive == 0) revert InvalidBound();
        uint256 rejectionFloor = addmod(type(uint256).max, 1, upperExclusive);
        uint256 nonce;
        while (true) {
            uint256 candidate = uint256(deriveDraw(root, domain, uint256(keccak256(abi.encode(drawIndex, nonce)))));
            if (candidate >= rejectionFloor) return candidate % upperExclusive;
            unchecked { ++nonce; }
        }
    }

    function rejectionSample(bytes32 root, bytes32 domain, uint256 drawIndex, uint256 upperExclusive)
        internal pure returns (uint256)
    {
        return boundedUint(root, domain, drawIndex, upperExclusive);
    }

    function uniformRange(bytes32 root, bytes32 domain, uint256 drawIndex, uint256 minInclusive, uint256 maxInclusive)
        internal pure returns (uint256)
    {
        if (maxInclusive < minInclusive) revert InvalidRange();
        if (minInclusive == 0 && maxInclusive == type(uint256).max) {
            return uint256(deriveDraw(root, domain, drawIndex));
        }
        uint256 width = maxInclusive - minInclusive + 1;
        return minInclusive + boundedUint(root, domain, drawIndex, width);
    }

    function weightedSelection(bytes32 root, bytes32 domain, uint256 drawIndex, uint256[] memory weights)
        internal pure returns (uint256 selectedIndex)
    {
        if (weights.length == 0) revert InvalidWeights();
        uint256 total;
        for (uint256 i; i < weights.length; ++i) total += weights[i];
        if (total == 0) revert InvalidWeights();
        uint256 ticket = boundedUint(root, domain, drawIndex, total);
        uint256 cumulative;
        for (uint256 i; i < weights.length; ++i) {
            cumulative += weights[i];
            if (ticket < cumulative) return i;
        }
        revert InvalidWeights();
    }

    function shuffle(bytes32 root, bytes32 domain, uint256 drawIndex, uint256[] memory values)
        internal pure returns (uint256[] memory)
    {
        for (uint256 i = values.length; i > 1; --i) {
            uint256 j = boundedUint(root, domain, drawIndex + (values.length - i), i);
            (values[i - 1], values[j]) = (values[j], values[i - 1]);
        }
        return values;
    }

    function sampleWithoutReplacement(
        bytes32 root,
        bytes32 domain,
        uint256 drawIndex,
        uint256 populationSize,
        uint256 sampleSize
    ) internal pure returns (uint256[] memory out) {
        if (sampleSize > populationSize) revert SampleTooLarge();
        uint256[] memory population = new uint256[](populationSize);
        for (uint256 i; i < populationSize; ++i) population[i] = i;
        shuffle(root, domain, drawIndex, population);
        out = new uint256[](sampleSize);
        for (uint256 i; i < sampleSize; ++i) out[i] = population[i];
    }
}