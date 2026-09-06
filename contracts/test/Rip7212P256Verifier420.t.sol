// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/Rip7212P256Verifier420.sol";

contract MockRawP256Precompile420 {
    bytes32 public expectedInputHash;
    bool public result = true;
    bool public malformed;
    bool public shouldRevert;

    function configure(bytes32 expectedInputHash_, bool result_, bool malformed_, bool shouldRevert_) external {
        expectedInputHash = expectedInputHash_;
        result = result_;
        malformed = malformed_;
        shouldRevert = shouldRevert_;
    }

    fallback() external {
        if (shouldRevert) revert("mock p256 failure");
        if (malformed) {
            assembly {
                return(0, 0)
            }
        }

        uint256 word = keccak256(msg.data) == expectedInputHash && result ? 1 : 0;
        assembly {
            mstore(0, word)
            return(0, 32)
        }
    }
}

contract Rip7212P256Verifier420Test {
    bytes32 private constant DIGEST =
        0x1111111111111111111111111111111111111111111111111111111111111111;
    uint256 private constant R = 2;
    uint256 private constant S = 3;
    uint256 private constant X = 4;
    uint256 private constant Y = 5;

    MockRawP256Precompile420 private mock;
    P256PrecompileVerifier420 private adapter;

    constructor() {
        mock = new MockRawP256Precompile420();
        adapter = new P256PrecompileVerifier420(address(mock));
    }

    function testUsesExactRip7212Raw160ByteLayout() public {
        bytes memory expectedInput = abi.encodePacked(DIGEST, R, S, X, Y);
        require(expectedInput.length == 160, "unexpected P256 input length");
        mock.configure(keccak256(expectedInput), true, false, false);
        require(adapter.verifyP256(DIGEST, R, S, X, Y), "valid raw P256 call rejected");
    }

    function testRejectsPrecompileFalseMalformedAndRevert() public {
        bytes32 expectedHash = keccak256(abi.encodePacked(DIGEST, R, S, X, Y));

        mock.configure(expectedHash, false, false, false);
        require(!adapter.verifyP256(DIGEST, R, S, X, Y), "zero result accepted");

        mock.configure(expectedHash, true, true, false);
        require(!adapter.verifyP256(DIGEST, R, S, X, Y), "malformed result accepted");

        mock.configure(expectedHash, true, false, true);
        require(!adapter.verifyP256(DIGEST, R, S, X, Y), "reverting precompile accepted");
    }

    function testRejectsWrongRawInput() public {
        bytes32 wrongHash = keccak256(abi.encodePacked(DIGEST, R, S, X, uint256(6)));
        mock.configure(wrongHash, true, false, false);
        require(!adapter.verifyP256(DIGEST, R, S, X, Y), "wrong P256 input accepted");
    }

    function testProductionAdapterPinsPrecompile0100() public {
        Rip7212P256Verifier420 production = new Rip7212P256Verifier420();
        require(production.RIP7212_PRECOMPILE() == address(0x0100), "wrong RIP-7212 address");
        require(production.precompile() == address(0x0100), "wrong production precompile");
    }
}
