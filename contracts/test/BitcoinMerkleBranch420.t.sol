// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/verifiers/BitcoinMerkleBranch420.sol";

/// @dev Fixture digests independently calculated with Python hashlib.sha256 twice.
contract BitcoinMerkleBranch420Test {
    bytes32 constant A = 0x1af381339a6b48e83f0ef78a726d9e77d92882ab67102f0942da7b591fadc6be;
    bytes32 constant B = 0xeb27a47c808edd2d5fc1aeef9947596f3558717ab6afba79862da3e8c1cf8244;
    bytes32 constant C = 0x71b0b5e79fe23ef98036b2169b422786c79dd288e5787d0a883ca53604f58ede;
    bytes32 constant ROOT_THREE = 0xe831dc107387ca45b23d4fbda5835c805d2e1c7f650f6c1088cb26e014d532d7;

    function _double(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(sha256(abi.encodePacked(left, right))));
    }

    function testThreeLeafProofAndIndependentSha256dVector() public pure {
        bytes32[] memory branch = new bytes32[](2);
        branch[0] = C;
        branch[1] = _double(A, B);
        require(_double(_double(A, B), _double(C, C)) == ROOT_THREE, "independent vector mismatch");
        require(BitcoinMerkleBranch420.verify(C, ROOT_THREE, 2, 3, branch), "valid leaf rejected");

        branch[0] = B;
        branch[1] = _double(C, C);
        require(BitcoinMerkleBranch420.verify(A, ROOT_THREE, 0, 3, branch), "valid first leaf rejected");
    }

    function testWrongRootRejected() public pure {
        bytes32[] memory branch = new bytes32[](2);
        branch[0] = B;
        branch[1] = _double(C, C);
        require(!BitcoinMerkleBranch420.verify(A, keccak256("wrong root"), 0, 3, branch), "wrong root accepted");
    }

    function testOneTransactionBlockBranch() public pure {
        bytes32[] memory branch = new bytes32[](0);
        require(BitcoinMerkleBranch420.verify(A, A, 0, 1, branch), "one-leaf branch failed");
    }

    function testMalformedTreeReverts() public {
        bytes32[] memory branch = new bytes32[](1);
        branch[0] = B;
        (bool invalidPosition,) = address(this).call(
            abi.encodeCall(this.verifyExternal, (A, ROOT_THREE, 3, 3, branch))
        );
        require(!invalidPosition, "out-of-bounds transaction index accepted");

        (bool incompleteBranch,) = address(this).call(
            abi.encodeCall(this.verifyExternal, (A, ROOT_THREE, 0, 3, branch))
        );
        require(!incompleteBranch, "short branch accepted");

        branch[0] = A;
        (bool duplicateSibling,) = address(this).call(
            abi.encodeCall(this.verifyExternal, (A, ROOT_THREE, 0, 2, branch))
        );
        require(!duplicateSibling, "duplicated sibling accepted");

        branch[0] = B;
        (bool extraBranch,) = address(this).call(
            abi.encodeCall(this.verifyExternal, (A, ROOT_THREE, 0, 1, branch))
        );
        require(!extraBranch, "extra branch accepted");

        branch[0] = B;
        (bool wrongOddSibling,) = address(this).call(
            abi.encodeCall(this.verifyExternal, (C, ROOT_THREE, 2, 3, branch))
        );
        require(!wrongOddSibling, "fake odd-level sibling accepted");
    }

    function verifyExternal(
        bytes32 txid, bytes32 root, uint256 index, uint256 transactionCount, bytes32[] calldata siblings
    ) external pure returns (bool) {
        return BitcoinMerkleBranch420.verify(txid, root, index, transactionCount, siblings);
    }
}
