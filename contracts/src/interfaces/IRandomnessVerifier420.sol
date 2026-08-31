// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Versioned proof-verifier adapter used by 420Random routes.
/// @dev A route may represent a native threshold VRF, commit-reveal committee,
/// external VRF, or another governance-approved provider mechanism.
interface IRandomnessVerifier420 {
    function verifyRandomness(
        bytes32 requestId,
        bytes32 domain,
        bytes32 purpose,
        bytes32 providerRandomness,
        bytes calldata proof
    ) external view returns (bool);
}