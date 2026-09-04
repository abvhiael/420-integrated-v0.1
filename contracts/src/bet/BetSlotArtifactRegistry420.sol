// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetGameRegistry420.sol";
import "./BetIds420.sol";
import "./BetTypes420.sol";

/// @notice Append-only slot-specific artifact commitments layered on the canonical 420Bet game registry.
/// @dev This intentionally does not introduce a second slot lifecycle or vault authorization path.
contract BetSlotArtifactRegistry420 is I420System {
    struct SlotArtifacts {
        bytes32 gameVersionId;
        bytes32 moduleVersionId;
        bytes32 reelSetHash;
        bytes32 paytableHash;
        bytes32 rtpArtifactHash;
        bytes32 liabilityArtifactHash;
        uint256 maxMultiplier;
        uint64 registeredAt;
        bool exists;
    }

    BetAuthorization420 public immutable authorization;
    BetGameRegistry420 public immutable games;

    mapping(bytes32 => SlotArtifacts) private _artifacts;

    error ZeroAddress();
    error InvalidId();
    error InvalidCommitment();
    error InvalidMaxMultiplier();
    error NotCasinoGame();
    error AlreadyExists();
    error NotFound();
    error Unauthorized();

    event SlotArtifactsRegistered(
        bytes32 indexed gameId,
        bytes32 indexed gameVersionId,
        bytes32 indexed moduleVersionId,
        bytes32 reelSetHash,
        bytes32 paytableHash,
        bytes32 rtpArtifactHash,
        bytes32 liabilityArtifactHash,
        uint256 maxMultiplier
    );

    constructor(address authorization_, address games_) {
        if (authorization_ == address(0) || games_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
        games = BetGameRegistry420(games_);
    }

    function systemName() external pure returns (string memory) { return "BetSlotArtifactRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerSlotArtifacts(
        bytes32 gameVersionId,
        bytes32 reelSetHash,
        bytes32 paytableHash,
        bytes32 rtpArtifactHash,
        bytes32 liabilityArtifactHash,
        uint256 maxMultiplier
    ) external {
        if (gameVersionId == bytes32(0)) revert InvalidId();
        if (
            reelSetHash == bytes32(0) || paytableHash == bytes32(0) || rtpArtifactHash == bytes32(0)
                || liabilityArtifactHash == bytes32(0)
        ) revert InvalidCommitment();
        if (maxMultiplier == 0) revert InvalidMaxMultiplier();
        if (_artifacts[gameVersionId].exists) revert AlreadyExists();

        BetGameRegistry420.GameVersion memory game = games.getGame(gameVersionId);
        if (game.productClass != BetTypes420.ProductClass.CASINO) revert NotCasinoGame();
        if (
            !authorization.isAuthorized(
                msg.sender,
                BetIds420.ACTION_SLOT_ARTIFACT_REGISTER,
                authorization.scopeForGame(game.gameId, game.gameVersionId),
                0
            )
        ) revert Unauthorized();

        _artifacts[gameVersionId] = SlotArtifacts({
            gameVersionId: game.gameVersionId,
            moduleVersionId: game.moduleVersionId,
            reelSetHash: reelSetHash,
            paytableHash: paytableHash,
            rtpArtifactHash: rtpArtifactHash,
            liabilityArtifactHash: liabilityArtifactHash,
            maxMultiplier: maxMultiplier,
            registeredAt: uint64(block.timestamp),
            exists: true
        });

        emit SlotArtifactsRegistered(
            game.gameId,
            game.gameVersionId,
            game.moduleVersionId,
            reelSetHash,
            paytableHash,
            rtpArtifactHash,
            liabilityArtifactHash,
            maxMultiplier
        );
    }

    function getSlotArtifacts(bytes32 gameVersionId) external view returns (SlotArtifacts memory) {
        SlotArtifacts storage artifacts = _artifacts[gameVersionId];
        if (!artifacts.exists) revert NotFound();
        return artifacts;
    }

    function hasSlotArtifacts(bytes32 gameVersionId) external view returns (bool) {
        return _artifacts[gameVersionId].exists;
    }
}
