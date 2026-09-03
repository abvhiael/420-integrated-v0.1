// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./BetTypes420.sol";
import "./BetModuleRegistry420.sol";
import "./BetProfileRegistry420.sol";

contract BetGameRegistry420 is I420System {
    enum GameStatus { NONE, REGISTERED, ACTIVE, PAUSED, DEPRECATED }

    struct GameVersion {
        bytes32 gameId;
        bytes32 gameVersionId;
        bytes32 moduleVersionId;
        bytes32 rulesetId;
        bytes32 randomnessProfileId;
        bytes32 riskProfileId;
        bytes32 settlementProfileId;
        bytes32 accessPolicyId;
        bytes32 manifestHash;
        BetTypes420.ProductClass productClass;
        BetTypes420.GameMode gameMode;
        uint64 registeredAt;
        GameStatus status;
        bool exists;
    }

    BetAuthorization420 public immutable authorization;
    BetModuleRegistry420 public immutable modules;
    BetProfileRegistry420 public immutable profiles;
    mapping(bytes32 => GameVersion) private _versions;

    error ZeroAddress();
    error InvalidId();
    error InvalidConfiguration();
    error AlreadyExists();
    error NotFound();
    error Unauthorized();
    error InvalidTransition();

    event GameRegistered(bytes32 indexed gameId, bytes32 indexed gameVersionId, bytes32 indexed moduleVersionId, bytes32 manifestHash);
    event GameStatusChanged(bytes32 indexed gameVersionId, GameStatus previousStatus, GameStatus newStatus);

    constructor(address authorization_, address modules_, address profiles_) {
        if (authorization_ == address(0) || modules_ == address(0) || profiles_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
        modules = BetModuleRegistry420(modules_);
        profiles = BetProfileRegistry420(profiles_);
    }

    function systemName() external pure returns (string memory) { return "BetGameRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerGame(GameVersion calldata input) external {
        if (input.gameId == bytes32(0) || input.gameVersionId == bytes32(0) || input.moduleVersionId == bytes32(0)) revert InvalidId();
        if (_versions[input.gameVersionId].exists) revert AlreadyExists();
        if (input.productClass == BetTypes420.ProductClass.NONE || input.gameMode == BetTypes420.GameMode.NONE) revert InvalidConfiguration();
        if (!modules.isApproved(input.moduleVersionId)) revert InvalidConfiguration();
        _requireActiveProfile(input.randomnessProfileId);
        _requireActiveProfile(input.riskProfileId);
        _requireActiveProfile(input.settlementProfileId);
        _requireActiveProfile(input.accessPolicyId);
        _requireAuth(input.gameId, input.gameVersionId, BetIds420.ACTION_GAME_REGISTER);

        GameVersion memory v = input;
        v.registeredAt = uint64(block.timestamp);
        v.status = GameStatus.REGISTERED;
        v.exists = true;
        _versions[input.gameVersionId] = v;
        emit GameRegistered(input.gameId, input.gameVersionId, input.moduleVersionId, input.manifestHash);
    }

    function activate(bytes32 gameVersionId) external { _transition(gameVersionId, GameStatus.REGISTERED, GameStatus.ACTIVE, BetIds420.ACTION_GAME_ACTIVATE); }
    function pause(bytes32 gameVersionId) external { _transition(gameVersionId, GameStatus.ACTIVE, GameStatus.PAUSED, BetIds420.ACTION_GAME_PAUSE); }
    function resume(bytes32 gameVersionId) external { _transition(gameVersionId, GameStatus.PAUSED, GameStatus.ACTIVE, BetIds420.ACTION_GAME_RESUME); }

    function deprecate(bytes32 gameVersionId) external {
        GameVersion storage v = _get(gameVersionId);
        if (v.status == GameStatus.DEPRECATED || v.status == GameStatus.NONE) revert InvalidTransition();
        _requireAuth(v.gameId, v.gameVersionId, BetIds420.ACTION_GAME_DEPRECATE);
        GameStatus old = v.status;
        v.status = GameStatus.DEPRECATED;
        emit GameStatusChanged(gameVersionId, old, GameStatus.DEPRECATED);
    }

    function getGame(bytes32 gameVersionId) external view returns (GameVersion memory) { return _get(gameVersionId); }
    function isActive(bytes32 gameVersionId) external view returns (bool) { return _get(gameVersionId).status == GameStatus.ACTIVE; }

    function _transition(bytes32 id, GameStatus expected, GameStatus next, bytes32 action) private {
        GameVersion storage v = _get(id);
        if (v.status != expected) revert InvalidTransition();
        _requireAuth(v.gameId, v.gameVersionId, action);
        v.status = next;
        emit GameStatusChanged(id, expected, next);
    }

    function _get(bytes32 id) private view returns (GameVersion storage v) {
        v = _versions[id];
        if (!v.exists) revert NotFound();
    }

    function _requireActiveProfile(bytes32 profileId) private view {
        if (profileId == bytes32(0) || !profiles.isActive(profileId)) revert InvalidConfiguration();
    }

    function _requireAuth(bytes32 gameId, bytes32 gameVersionId, bytes32 action) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForGame(gameId, gameVersionId), 0)) revert Unauthorized();
    }
}
