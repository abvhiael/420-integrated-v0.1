// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../accounts/ECDSA420.sol";

/// @notice Shared proof arithmetic; hashes and signatures do not establish source consensus.
library BridgeCrypto420 {
    error InvalidSignature();
    error InvalidMerkleProof();

    function sha256d(bytes memory data) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(sha256(data)));
    }

    function hash160(bytes memory data) internal pure returns (bytes20) {
        return ripemd160(abi.encodePacked(sha256(data)));
    }

    function requireSignature(bytes32 digest, bytes memory signature, address expected) internal pure {
        if (expected == address(0) || ECDSA420.tryRecover(digest, signature) != expected)
            revert InvalidSignature();
    }

    /// @dev SSZ-style ordered SHA256 branch. Expected depth and root must be authenticated
    /// by the caller's consensus protocol. No sorted-pair or Bitcoin duplicate-leaf semantics.
    function verifySha256Branch(bytes32 leaf, bytes32 root, uint256 index, uint256 depth, bytes32[] memory branch)
        internal pure returns (bool)
    {
        if (depth > 64 || branch.length != depth || index >> depth != 0) revert InvalidMerkleProof();
        for (uint256 i; i < depth; ++i) {
            leaf = (index & 1) == 0
                ? sha256(abi.encodePacked(leaf, branch[i]))
                : sha256(abi.encodePacked(branch[i], leaf));
            index >>= 1;
        }
        return leaf == root;
    }
}
