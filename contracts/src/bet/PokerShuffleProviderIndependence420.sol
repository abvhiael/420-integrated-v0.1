// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Governance-attested control separation for confidential poker shufflers.
/// @dev Attestation authority must independently verify beneficial control and
/// operational separation off-chain; distinct addresses alone do not suffice.
/// Revocable attestations bind provider, control group, evidence hash and expiry.
contract PokerShuffleProviderIndependence420 {
    address public immutable attestor;
    struct Attestation {
        bytes32 controller;
        bytes32 evidenceHash;
        uint64 validUntil;
        bool revoked;
    }
    mapping(address => Attestation) public attestations;
    error Unauthorized();
    error InvalidAttestation();
    event ProviderAttested(address indexed provider, bytes32 indexed controller, bytes32 evidenceHash, uint64 validUntil);
    event ProviderRevoked(address indexed provider);
    constructor(address attestor_) {
        if (attestor_ == address(0)) revert InvalidAttestation();
        attestor = attestor_;
    }
    function attest(address provider, bytes32 controller, bytes32 evidenceHash, uint64 validUntil) external {
        if (msg.sender != attestor) revert Unauthorized();
        if (provider == address(0) || controller == bytes32(0) || evidenceHash == bytes32(0)
            || validUntil <= block.timestamp) revert InvalidAttestation();
        attestations[provider] = Attestation(controller,evidenceHash,validUntil,false);
        emit ProviderAttested(provider,controller,evidenceHash,validUntil);
    }
    function revoke(address provider) external {
        if (msg.sender != attestor) revert Unauthorized();
        attestations[provider].revoked = true;
        emit ProviderRevoked(provider);
    }
    function independentlyEligible(address a, address b) external view returns (bool) {
        Attestation memory x = attestations[a];
        Attestation memory y = attestations[b];
        return a != address(0) && b != address(0) && a != b
            && x.controller != bytes32(0) && y.controller != bytes32(0)
            && x.controller != y.controller
            && x.evidenceHash != bytes32(0) && y.evidenceHash != bytes32(0)
            && !x.revoked && !y.revoked
            && x.validUntil > block.timestamp && y.validUntil > block.timestamp;
    }
}
