// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Pure Bitcoin-family transaction Merkle-branch arithmetic (consensus byte order).
/// @dev This library proves membership ONLY relative to a supplied root. It does not establish
///      the authenticity of that root, header proof of work, canonical chain, confirmations,
///      gateway script, tx output or finality. Never use a caller-supplied root for mint/release.
library BitcoinMerkleBranch420 {
    error InvalidMerkleBranch();

    /// @param txid Internal Bitcoin 32-byte hash representation (SHA256d digest byte order).
    /// @param merkleRoot Authenticated block-header Merkle root in the same internal byte order.
    /// @param index Zero-based transaction position within the block.
    /// @param transactionCount Independently authenticated count from the containing block.
    /// @param siblings Branch hashes from leaf upwards, in internal Bitcoin byte order.
    function verify(
        bytes32 txid,
        bytes32 merkleRoot,
        uint256 index,
        uint256 transactionCount,
        bytes32[] memory siblings
    ) internal pure returns (bool) {
        if (
            txid == bytes32(0) || merkleRoot == bytes32(0)
                || transactionCount == 0 || index >= transactionCount
                || siblings.length > 32
        ) revert InvalidMerkleBranch();

        uint256 width = transactionCount;
        uint256 i = index;
        uint256 level = 0;
        bytes32 computed = txid;

        while (width > 1) {
            if (level >= siblings.length) revert InvalidMerkleBranch();
            bytes32 sibling = siblings[level];
            if (sibling == bytes32(0)) revert InvalidMerkleBranch();

            // Bitcoin duplicates the final odd node at each level; an attacker cannot
            // substitute an unrelated hash in its place.
            if ((i ^ 1) >= width) {
                if (sibling != computed) revert InvalidMerkleBranch();
            } else {
                // Distinct full subtrees with identical roots are not valid Bitcoin
                // transaction trees (duplicate transaction malleation safeguard).
                if (sibling == computed) revert InvalidMerkleBranch();
            }

            computed = (i & 1) == 0 ? _sha256d(computed, sibling) : _sha256d(sibling, computed);
            i >>= 1;
            width = (width + 1) >> 1;
            ++level;
        }

        if (level != siblings.length) revert InvalidMerkleBranch();
        return computed == merkleRoot;
    }

    function _sha256d(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return sha256(abi.encodePacked(sha256(abi.encodePacked(a, b))));
    }
}
