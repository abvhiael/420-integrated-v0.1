// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IPasskeyVerifier420.sol";

/// @notice Strict adapter from IP256Verifier420 to a native P-256 verification precompile.
/// @dev The precompile ABI is the RIP/EIP-7212 160-byte input:
///      digest || r || s || publicKeyX || publicKeyY, each exactly 32 bytes.
///      Only an exact 32-byte word equal to 1 is accepted. Reverts, empty output,
///      malformed output, or any other value fail closed.
contract P256PrecompileVerifier420 is IP256Verifier420 {
    address public immutable precompile;

    error InvalidP256Precompile();

    constructor(address precompile_) {
        if (precompile_ == address(0)) revert InvalidP256Precompile();
        // Native precompiles intentionally have no EVM bytecode, so code.length
        // must not be used as an availability check here.
        precompile = precompile_;
    }

    function verifyP256(
        bytes32 digest,
        uint256 r,
        uint256 s,
        uint256 publicKeyX,
        uint256 publicKeyY
    ) external view returns (bool) {
        bytes memory input = abi.encodePacked(digest, r, s, publicKeyX, publicKeyY);
        (bool ok, bytes memory output) = precompile.staticcall(input);
        if (!ok || output.length != 32) return false;

        uint256 result;
        assembly {
            result := mload(add(output, 32))
        }
        return result == 1;
    }
}

/// @notice Production node420 adapter for the P-256 precompile at 0x0100.
/// @dev node420's maintained execution patch enables Geth's existing p256Verify
///      implementation at this address for the chain's Cancun-at-genesis rules.
contract Rip7212P256Verifier420 is P256PrecompileVerifier420 {
    address public constant RIP7212_PRECOMPILE = address(0x0100);

    constructor() P256PrecompileVerifier420(RIP7212_PRECOMPILE) {}
}
