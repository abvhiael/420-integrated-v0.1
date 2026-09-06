// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Isolated WebAuthn/P-256 verification boundary for SmartAccount420.
/// @dev Implementations must fail closed and must bind the assertion to the exact
///      UserOperation hash, credential, RP ID, origin, and enrolled P-256 public key.
interface IPasskeyVerifier420 {
    function verifyPasskeyAssertion(
        bytes32 userOpHash,
        bytes calldata assertionEnvelope,
        bytes32 expectedCredentialIdHash,
        bytes32 expectedRpIdHash,
        bytes32 expectedOriginHash,
        uint256 publicKeyX,
        uint256 publicKeyY
    ) external view returns (bool);
}

/// @notice Minimal P-256 backend interface. A production deployment may point this
///         at a chain-native RIP-7212 verifier adapter or another audited verifier.
interface IP256Verifier420 {
    function verifyP256(
        bytes32 digest,
        uint256 r,
        uint256 s,
        uint256 publicKeyX,
        uint256 publicKeyY
    ) external view returns (bool);
}
