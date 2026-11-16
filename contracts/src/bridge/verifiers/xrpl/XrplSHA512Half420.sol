// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../solana/vendor/Sha512.sol";

/// @notice Native SHA-512Half: the first 256 bits of SHA-512, not SHA-512/256.
contract XrplSHA512Half420 {
    function half(bytes memory input) external pure returns (bytes32) {
        uint64[8] memory h = Sha512.hash(input);
        return bytes32(abi.encodePacked(h[0], h[1], h[2], h[3]));
    }
}
