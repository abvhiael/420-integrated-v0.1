// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./GameRegistry420.sol";
import "./GameIdentity420.sol";

contract GameEntitlements420 is I420System {
    struct Entitlement {
        bytes32 entitlementId;
        bytes32 profileId;
        bytes32 gameId;
        bytes32 entitlementType;
        bytes32 contentId;
        uint64 validFrom;
        uint64 validUntil;
        bool revoked;
        bool exists;
    }

    GameRegistry420 public immutable gameRegistry;
    GameIdentity420 public immutable identity;
    mapping(bytes32 => Entitlement) private _entitlements;

    error ZeroAddress();
    error InactiveGame();
    error NotGameOperator();
    error EntitlementAlreadyExists();
    error EntitlementNotFound();
    error InvalidProfile();

    event EntitlementIssued(bytes32 indexed entitlementId, bytes32 indexed profileId, bytes32 indexed gameId, bytes32 entitlementType, bytes32 contentId);
    event EntitlementRevoked(bytes32 indexed entitlementId);

    constructor(address gameRegistry_, address identity_) {
        if (gameRegistry_ == address(0) || identity_ == address(0)) revert ZeroAddress();
        gameRegistry = GameRegistry420(gameRegistry_);
        identity = GameIdentity420(identity_);
    }

    function systemName() external pure returns (string memory) { return "GameEntitlements420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function entitlement(bytes32 entitlementId) external view returns (Entitlement memory) {
        Entitlement memory record = _entitlements[entitlementId];
        if (!record.exists) revert EntitlementNotFound();
        return record;
    }

    function issue(bytes32 entitlementId, bytes32 profileId, bytes32 entitlementType, bytes32 contentId, uint64 validFrom, uint64 validUntil) external {
        GameIdentity420.GameProfile memory p = identity.profile(profileId);
        if (!gameRegistry.isActive(p.gameId)) revert InactiveGame();
        if (gameRegistry.operatorOf(p.gameId) != msg.sender) revert NotGameOperator();
        if (_entitlements[entitlementId].exists) revert EntitlementAlreadyExists();

        _entitlements[entitlementId] = Entitlement({
            entitlementId: entitlementId,
            profileId: profileId,
            gameId: p.gameId,
            entitlementType: entitlementType,
            contentId: contentId,
            validFrom: validFrom,
            validUntil: validUntil,
            revoked: false,
            exists: true
        });
        emit EntitlementIssued(entitlementId, profileId, p.gameId, entitlementType, contentId);
    }

    function revoke(bytes32 entitlementId) external {
        Entitlement storage record = _entitlements[entitlementId];
        if (!record.exists) revert EntitlementNotFound();
        if (gameRegistry.operatorOf(record.gameId) != msg.sender) revert NotGameOperator();
        record.revoked = true;
        emit EntitlementRevoked(entitlementId);
    }

    function isActive(bytes32 entitlementId) external view returns (bool) {
        Entitlement memory e = _entitlements[entitlementId];
        if (!e.exists || e.revoked) return false;
        if (e.validFrom != 0 && block.timestamp < e.validFrom) return false;
        if (e.validUntil != 0 && block.timestamp > e.validUntil) return false;
        return true;
    }
}
