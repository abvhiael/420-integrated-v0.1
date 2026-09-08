// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./GameRegistry420.sol";
import "./GameIdentity420.sol";

contract GameClaims420 is I420System {
    struct MigrationClaim {
        bytes32 claimId;
        bytes32 gameId;
        address targetAccount;
        bytes32 guestStateCommitment;
        bytes32 migrationPayloadHash;
        uint64 validUntil;
        bool consumed;
        bool cancelled;
        bool exists;
    }

    GameRegistry420 public immutable gameRegistry;
    GameIdentity420 public immutable identity;
    mapping(bytes32 => MigrationClaim) private _claims;

    error ZeroAddress();
    error InactiveGame();
    error NotGameOperator();
    error ClaimAlreadyExists();
    error ClaimNotFound();
    error ClaimUnavailable();
    error WrongAccount();
    error ProfileRequired();

    event MigrationClaimIssued(bytes32 indexed claimId, bytes32 indexed gameId, address indexed targetAccount, bytes32 guestStateCommitment, bytes32 migrationPayloadHash, uint64 validUntil);
    event MigrationClaimConsumed(bytes32 indexed claimId, bytes32 indexed profileId);
    event MigrationClaimCancelled(bytes32 indexed claimId);

    constructor(address gameRegistry_, address identity_) {
        if (gameRegistry_ == address(0) || identity_ == address(0)) revert ZeroAddress();
        gameRegistry = GameRegistry420(gameRegistry_);
        identity = GameIdentity420(identity_);
    }

    function systemName() external pure returns (string memory) { return "GameClaims420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function claim(bytes32 claimId) external view returns (MigrationClaim memory) {
        MigrationClaim memory record = _claims[claimId];
        if (!record.exists) revert ClaimNotFound();
        return record;
    }

    function issue(bytes32 claimId, bytes32 gameId, address targetAccount, bytes32 guestStateCommitment, bytes32 migrationPayloadHash, uint64 validUntil) external {
        if (!gameRegistry.isActive(gameId)) revert InactiveGame();
        if (gameRegistry.operatorOf(gameId) != msg.sender) revert NotGameOperator();
        if (_claims[claimId].exists) revert ClaimAlreadyExists();
        if (targetAccount == address(0)) revert ZeroAddress();

        _claims[claimId] = MigrationClaim({
            claimId: claimId,
            gameId: gameId,
            targetAccount: targetAccount,
            guestStateCommitment: guestStateCommitment,
            migrationPayloadHash: migrationPayloadHash,
            validUntil: validUntil,
            consumed: false,
            cancelled: false,
            exists: true
        });
        emit MigrationClaimIssued(claimId, gameId, targetAccount, guestStateCommitment, migrationPayloadHash, validUntil);
    }

    function consume(bytes32 claimId) external returns (bytes32 profileId) {
        MigrationClaim storage record = _claims[claimId];
        if (!record.exists) revert ClaimNotFound();
        if (record.consumed || record.cancelled || (record.validUntil != 0 && block.timestamp > record.validUntil)) revert ClaimUnavailable();
        if (record.targetAccount != msg.sender) revert WrongAccount();
        profileId = identity.profileIdOf(record.gameId, msg.sender);
        if (profileId == bytes32(0)) revert ProfileRequired();
        record.consumed = true;
        emit MigrationClaimConsumed(claimId, profileId);
    }

    function cancel(bytes32 claimId) external {
        MigrationClaim storage record = _claims[claimId];
        if (!record.exists) revert ClaimNotFound();
        if (gameRegistry.operatorOf(record.gameId) != msg.sender) revert NotGameOperator();
        if (record.consumed) revert ClaimUnavailable();
        record.cancelled = true;
        emit MigrationClaimCancelled(claimId);
    }
}
