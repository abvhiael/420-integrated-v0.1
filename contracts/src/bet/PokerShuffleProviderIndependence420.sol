// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Governance-attested control separation for confidential poker shufflers.
/// @dev Attestation authority must independently verify beneficial control and
/// operational separation off-chain; distinct addresses alone do not suffice.
/// Revocable attestations bind provider, control group, evidence hash and expiry.
contract PokerShuffleProviderIndependence420 {
    address public immutable attestor;
    address public immutable independentReviewer;
    struct Attestation {
        bytes32 controller;
        bytes32 evidenceHash;
        uint64 validUntil;
        bool revoked;
    }
    mapping(address => Attestation) public attestations;
    mapping(address => Attestation) public independentReviews;
    error Unauthorized();
    error InvalidAttestation();
    event ProviderAttested(address indexed provider, bytes32 indexed controller, bytes32 evidenceHash, uint64 validUntil);
    event ProviderRevoked(address indexed provider);
    event IndependentReview(address indexed provider,bytes32 indexed controller,bytes32 evidenceHash,uint64 validUntil);
    event IndependentReviewRevoked(address indexed provider);
    constructor(address attestor_,address reviewer_) {
        if (attestor_ == address(0) || reviewer_ == address(0) || attestor_ == reviewer_) revert InvalidAttestation();
        attestor = attestor_;
        independentReviewer = reviewer_;
    }
    function attest(address provider, bytes32 controller, bytes32 evidenceHash, uint64 validUntil) external {
        if (msg.sender != attestor) revert Unauthorized();
        if (provider == msg.sender) revert InvalidAttestation();
        if (provider == address(0) || controller == bytes32(0) || evidenceHash == bytes32(0)
            || validUntil <= block.timestamp) revert InvalidAttestation();
        attestations[provider] = Attestation(controller,evidenceHash,validUntil,false);
        emit ProviderAttested(provider,controller,evidenceHash,validUntil);
    }
    /// @notice A second, independently governed reviewer must attest the same
    /// beneficial controller using independently published verification evidence.
    function review(address provider,bytes32 controller,bytes32 evidenceHash,uint64 validUntil) external {
        if (msg.sender != independentReviewer) revert Unauthorized();
        if (provider == address(0) || provider == msg.sender || controller == bytes32(0)
            || evidenceHash == bytes32(0) || validUntil <= block.timestamp) revert InvalidAttestation();
        independentReviews[provider]=Attestation(controller,evidenceHash,validUntil,false);
        emit IndependentReview(provider,controller,evidenceHash,validUntil);
    }
    function revokeIndependentReview(address provider) external {
        if (msg.sender != independentReviewer) revert Unauthorized();
        independentReviews[provider].revoked=true;
        emit IndependentReviewRevoked(provider);
    }
    function revoke(address provider) external {
        if (msg.sender != attestor) revert Unauthorized();
        attestations[provider].revoked = true;
        emit ProviderRevoked(provider);
    }
    function independentlyEligible(address a, address b) external view returns (bool) {
        Attestation memory x = attestations[a];
        Attestation memory y = attestations[b];
        Attestation memory rx = independentReviews[a];
        Attestation memory ry = independentReviews[b];
        return a != address(0) && b != address(0) && a != b
            && x.controller != bytes32(0) && y.controller != bytes32(0)
            && x.controller != y.controller
            && rx.controller == x.controller && ry.controller == y.controller
            && rx.evidenceHash != bytes32(0) && ry.evidenceHash != bytes32(0)
            && !rx.revoked && !ry.revoked
            && rx.validUntil > block.timestamp && ry.validUntil > block.timestamp
            && x.evidenceHash != bytes32(0) && y.evidenceHash != bytes32(0)
            && !x.revoked && !y.revoked
            && x.validUntil > block.timestamp && y.validUntil > block.timestamp;
    }
}
