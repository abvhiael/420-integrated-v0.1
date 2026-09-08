// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./GameRegistry420.sol";

contract GameIdentity420 is I420System {
    struct GameProfile {
        bytes32 profileId;
        bytes32 gameId;
        address account;
        bytes32 externalProfileCommitment;
        uint64 createdAt;
        bool exists;
    }

    GameRegistry420 public immutable gameRegistry;
    mapping(bytes32 => GameProfile) private _profiles;
    mapping(bytes32 => mapping(address => bytes32)) public profileIdOf;

    error ZeroAddress();
    error InactiveGame();
    error ProfileAlreadyExists();
    error ProfileNotFound();

    event GameProfileCreated(
        bytes32 indexed profileId,
        bytes32 indexed gameId,
        address indexed account,
        bytes32 externalProfileCommitment
    );

    constructor(address gameRegistry_) {
        if (gameRegistry_ == address(0)) revert ZeroAddress();
        gameRegistry = GameRegistry420(gameRegistry_);
    }

    function systemName() external pure returns (string memory) { return "GameIdentity420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function deriveProfileId(bytes32 gameId, address account) public pure returns (bytes32) {
        return keccak256(abi.encode("420/GAMING/PROFILE/V1", gameId, account));
    }

    function profile(bytes32 profileId) external view returns (GameProfile memory) {
        GameProfile memory record = _profiles[profileId];
        if (!record.exists) revert ProfileNotFound();
        return record;
    }

    function createProfile(bytes32 gameId, bytes32 externalProfileCommitment) external returns (bytes32 profileId) {
        if (!gameRegistry.isActive(gameId)) revert InactiveGame();
        if (profileIdOf[gameId][msg.sender] != bytes32(0)) revert ProfileAlreadyExists();

        profileId = deriveProfileId(gameId, msg.sender);
        _profiles[profileId] = GameProfile({
            profileId: profileId,
            gameId: gameId,
            account: msg.sender,
            externalProfileCommitment: externalProfileCommitment,
            createdAt: uint64(block.timestamp),
            exists: true
        });
        profileIdOf[gameId][msg.sender] = profileId;
        emit GameProfileCreated(profileId, gameId, msg.sender, externalProfileCommitment);
    }
}
