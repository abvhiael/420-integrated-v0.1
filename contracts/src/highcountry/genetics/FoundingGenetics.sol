// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library FoundingGenetics {
    uint8 internal constant LOCUS_COUNT = 28;
    uint8 internal constant FOUNDING_LINE_COUNT = 16;

    function lineId(uint8 index) internal pure returns (bytes32) {
        if (index == 0 || index > FOUNDING_LINE_COUNT) return bytes32(0);
        return keccak256(abi.encodePacked("HC.FOUNDING.GENETIC_LINE.", index));
    }
}
