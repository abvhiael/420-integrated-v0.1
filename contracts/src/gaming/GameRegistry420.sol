// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./GamingAuthorization420.sol";
import "./GamingIds420.sol";

contract GameRegistry420 is I420System {
    struct GameRecord {
        bytes32 gameId;
        address operator;
        bytes32 metadataHash;
        uint64 registeredAt;
        bool active;
        bool exists;
    }

    GamingAuthorization420 public immutable authorization;
    mapping(bytes32 => GameRecord) private _games;

    error ZeroAddress();
    error InvalidGameId();
    error GameAlreadyExists();
    error GameNotFound();

    event GameRegistered(bytes32 indexed gameId, address indexed operator, bytes32 metadataHash);
    event GameUpdated(bytes32 indexed gameId, address indexed operator, bytes32 metadataHash);
    event GameStatusChanged(bytes32 indexed gameId, bool active);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = GamingAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "GameRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function game(bytes32 gameId) external view returns (GameRecord memory) {
        GameRecord memory record = _games[gameId];
        if (!record.exists) revert GameNotFound();
        return record;
    }

    function exists(bytes32 gameId) external view returns (bool) { return _games[gameId].exists; }
    function isActive(bytes32 gameId) external view returns (bool) { return _games[gameId].exists && _games[gameId].active; }
    function operatorOf(bytes32 gameId) external view returns (address) { return _games[gameId].operator; }

    function registerGame(bytes32 gameId, address operator, bytes32 metadataHash) external {
        if (gameId == bytes32(0)) revert InvalidGameId();
        if (operator == address(0)) revert ZeroAddress();
        if (_games[gameId].exists) revert GameAlreadyExists();
        authorization.requireAuthorized(msg.sender, gameId, GamingIds420.ACTION_REGISTER_GAME);

        _games[gameId] = GameRecord({
            gameId: gameId,
            operator: operator,
            metadataHash: metadataHash,
            registeredAt: uint64(block.timestamp),
            active: true,
            exists: true
        });
        emit GameRegistered(gameId, operator, metadataHash);
    }

    function updateGame(bytes32 gameId, address operator, bytes32 metadataHash) external {
        if (!_games[gameId].exists) revert GameNotFound();
        if (operator == address(0)) revert ZeroAddress();
        authorization.requireAuthorized(msg.sender, gameId, GamingIds420.ACTION_UPDATE_GAME);
        _games[gameId].operator = operator;
        _games[gameId].metadataHash = metadataHash;
        emit GameUpdated(gameId, operator, metadataHash);
    }

    function setGameStatus(bytes32 gameId, bool active) external {
        if (!_games[gameId].exists) revert GameNotFound();
        authorization.requireAuthorized(msg.sender, gameId, GamingIds420.ACTION_SET_GAME_STATUS);
        _games[gameId].active = active;
        emit GameStatusChanged(gameId, active);
    }
}
