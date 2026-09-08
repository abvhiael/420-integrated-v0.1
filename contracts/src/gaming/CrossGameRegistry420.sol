// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./GameRegistry420.sol";
import "./GameIdentity420.sol";

contract CrossGameRegistry420 is I420System {
    struct Attestation {
        bytes32 attestationId;
        bytes32 sourceGameId;
        bytes32 profileId;
        bytes32 subjectType;
        bytes32 subjectId;
        bytes32 payloadHash;
        uint64 validUntil;
        bool revoked;
        bool exists;
    }

    GameRegistry420 public immutable gameRegistry;
    GameIdentity420 public immutable identity;
    mapping(bytes32 => Attestation) private _attestations;

    error ZeroAddress();
    error InactiveGame();
    error NotGameOperator();
    error AttestationAlreadyExists();
    error AttestationNotFound();

    event AttestationIssued(bytes32 indexed attestationId, bytes32 indexed sourceGameId, bytes32 indexed profileId, bytes32 subjectType, bytes32 subjectId, bytes32 payloadHash, uint64 validUntil);
    event AttestationRevoked(bytes32 indexed attestationId);

    constructor(address gameRegistry_, address identity_) {
        if (gameRegistry_ == address(0) || identity_ == address(0)) revert ZeroAddress();
        gameRegistry = GameRegistry420(gameRegistry_);
        identity = GameIdentity420(identity_);
    }

    function systemName() external pure returns (string memory) { return "CrossGameRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function attestation(bytes32 attestationId) external view returns (Attestation memory) {
        Attestation memory record = _attestations[attestationId];
        if (!record.exists) revert AttestationNotFound();
        return record;
    }

    function issue(bytes32 attestationId, bytes32 profileId, bytes32 subjectType, bytes32 subjectId, bytes32 payloadHash, uint64 validUntil) external {
        GameIdentity420.GameProfile memory p = identity.profile(profileId);
        if (!gameRegistry.isActive(p.gameId)) revert InactiveGame();
        if (gameRegistry.operatorOf(p.gameId) != msg.sender) revert NotGameOperator();
        if (_attestations[attestationId].exists) revert AttestationAlreadyExists();

        _attestations[attestationId] = Attestation({
            attestationId: attestationId,
            sourceGameId: p.gameId,
            profileId: profileId,
            subjectType: subjectType,
            subjectId: subjectId,
            payloadHash: payloadHash,
            validUntil: validUntil,
            revoked: false,
            exists: true
        });
        emit AttestationIssued(attestationId, p.gameId, profileId, subjectType, subjectId, payloadHash, validUntil);
    }

    function revoke(bytes32 attestationId) external {
        Attestation storage record = _attestations[attestationId];
        if (!record.exists) revert AttestationNotFound();
        if (gameRegistry.operatorOf(record.sourceGameId) != msg.sender) revert NotGameOperator();
        record.revoked = true;
        emit AttestationRevoked(attestationId);
    }

    function isActive(bytes32 attestationId) external view returns (bool) {
        Attestation memory a = _attestations[attestationId];
        if (!a.exists || a.revoked) return false;
        if (a.validUntil != 0 && block.timestamp > a.validUntil) return false;
        return true;
    }
}
