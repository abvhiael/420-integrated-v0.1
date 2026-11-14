// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Bitcoin mainnet compact-target and header SHA256d proof-of-work primitive.
/// @dev Does not establish canonical header-chain ancestry, chainwork, finality, a trusted
///      checkpoint, transaction inclusion or gateway custody. Not a stand-alone bridge verifier.
library BitcoinHeaderPow420 {
    uint256 internal constant MAINNET_POW_LIMIT =
        0x00000000ffff0000000000000000000000000000000000000000000000000000;

    error InvalidHeaderLength();
    error InvalidDifficultyTarget();

    /// @return headerHash Raw double SHA256 digest; Bitcoin display hash reverses these 32 bytes.
    function verify(bytes memory header) internal pure returns (bytes32 headerHash) {
        if (header.length != 80) revert InvalidHeaderLength();
        uint32 bits =
            uint32(uint8(header[72]))
                | (uint32(uint8(header[73])) << 8)
                | (uint32(uint8(header[74])) << 16)
                | (uint32(uint8(header[75])) << 24);
        uint256 target = decodeTarget(bits);
        headerHash = sha256(abi.encodePacked(sha256(header)));

        // Bitcoin's uint256 hash comparison interprets the 32 digest bytes little-endian.
        uint256 littleEndianHash;
        for (uint256 i = 0; i < 32; ++i) {
            littleEndianHash |= uint256(uint8(headerHash[i])) << (8 * i);
        }
        if (littleEndianHash > target) revert InvalidDifficultyTarget();
    }

    /// @dev Decode Bitcoin Core compact difficulty with negative, overflow and pow-limit rejection.
    ///      Only mainnet-target-compatible compact encodings are permitted.
    function decodeTarget(uint32 compact) internal pure returns (uint256 target) {
        uint256 exponent = uint8(compact >> 24);
        uint256 mantissa = compact & 0x007fffff;
        if (mantissa == 0 || (compact & 0x00800000) != 0 || exponent < 3 || exponent > 32) {
            revert InvalidDifficultyTarget();
        }

        target = mantissa << (8 * (exponent - 3));
        if (target == 0 || target > MAINNET_POW_LIMIT) revert InvalidDifficultyTarget();
    }
}
