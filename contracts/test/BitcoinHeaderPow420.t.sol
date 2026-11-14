// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/verifiers/BitcoinHeaderPow420.sol";

contract BitcoinHeaderPow420Test {
    // Canonical Bitcoin mainnet genesis header, encoded in wire byte order.
    bytes constant GENESIS_HEADER =
        hex"01000000"
        hex"0000000000000000000000000000000000000000000000000000000000000000"
        hex"3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a"
        hex"29ab5f49"
        hex"ffff001d"
        hex"1dac2b7c";

    bytes32 constant GENESIS_SHA256D_RAW =
        0x6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000;

    function verifyExternal(bytes calldata header) external pure returns (bytes32) {
        return BitcoinHeaderPow420.verify(header);
    }

    function targetExternal(uint32 bits) external pure returns (uint256) {
        return BitcoinHeaderPow420.decodeTarget(bits);
    }

    function testCanonicalGenesisHeaderPoW() public pure {
        require(
            BitcoinHeaderPow420.verify(GENESIS_HEADER) == GENESIS_SHA256D_RAW,
            "Bitcoin genesis header SHA256d mismatch"
        );
        require(
            BitcoinHeaderPow420.decodeTarget(0x1d00ffff) == BitcoinHeaderPow420.MAINNET_POW_LIMIT,
            "Bitcoin mainnet compact target mismatch"
        );
    }

    function testModifiedNonceAndMerkleRootReject() public {
        bytes memory wrongNonce = GENESIS_HEADER;
        wrongNonce[79] = bytes1(uint8(wrongNonce[79]) ^ 1);
        (bool acceptedNonce,) = address(this).call(abi.encodeCall(this.verifyExternal, (wrongNonce)));
        require(!acceptedNonce, "modified nonce accepted");

        bytes memory wrongRoot = GENESIS_HEADER;
        wrongRoot[36] = bytes1(uint8(wrongRoot[36]) ^ 1);
        (bool acceptedRoot,) = address(this).call(abi.encodeCall(this.verifyExternal, (wrongRoot)));
        require(!acceptedRoot, "modified Merkle root accepted");
    }

    function testMalformedDifficultyAndHeaderReject() public {
        (bool shortHeader,) = address(this).call(abi.encodeCall(this.verifyExternal, (hex"0102")));
        require(!shortHeader, "short header accepted");

        (bool zeroTarget,) = address(this).call(abi.encodeCall(this.targetExternal, (uint32(0x1d000000))));
        require(!zeroTarget, "zero target accepted");

        (bool negativeTarget,) = address(this).call(abi.encodeCall(this.targetExternal, (uint32(0x1d80ffff))));
        require(!negativeTarget, "negative target accepted");

        (bool overflowTarget,) = address(this).call(abi.encodeCall(this.targetExternal, (uint32(0x2100ffff))));
        require(!overflowTarget, "overflow target accepted");

        (bool tooEasy,) = address(this).call(abi.encodeCall(this.targetExternal, (uint32(0x1d01ffff))));
        require(!tooEasy, "target above mainnet limit accepted");
    }
}
