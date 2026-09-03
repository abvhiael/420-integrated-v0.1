// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

/// @notice Canonical deterministic random-stream expansion for first-party 420Bet slot titles.
/// @dev One fulfilled wager randomness root expands into immutable per-spin/per-reel draws.
///      Consumers must never reroll, skip, or selectively replace a draw.
contract SlotRandomStream420 is I420System {
    bytes32 public constant DRAW_DOMAIN = keccak256("420.BET.SLOT.RANDOM.STREAM.V1");
    bytes32 public constant BASE_PHASE = keccak256("420.BET.SLOT.PHASE.BASE");
    bytes32 public constant FEATURE_PHASE = keccak256("420.BET.SLOT.PHASE.FEATURE");

    error InvalidId();
    error InvalidRoot();
    error InvalidPhase();
    error InvalidStripLength();

    function systemName() external pure returns (string memory) { return "SlotRandomStream420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function draw(
        bytes32 root,
        bytes32 wagerId,
        bytes32 gameVersionId,
        bytes32 rulesetId,
        bytes32 phase,
        uint16 spinIndex,
        uint8 reelIndex
    ) public pure returns (uint256) {
        if (root == bytes32(0)) revert InvalidRoot();
        if (wagerId == bytes32(0) || gameVersionId == bytes32(0) || rulesetId == bytes32(0)) revert InvalidId();
        if (phase != BASE_PHASE && phase != FEATURE_PHASE) revert InvalidPhase();
        return uint256(
            keccak256(
                abi.encode(
                    DRAW_DOMAIN,
                    root,
                    wagerId,
                    gameVersionId,
                    rulesetId,
                    phase,
                    spinIndex,
                    reelIndex
                )
            )
        );
    }

    function reelStop(
        bytes32 root,
        bytes32 wagerId,
        bytes32 gameVersionId,
        bytes32 rulesetId,
        bytes32 phase,
        uint16 spinIndex,
        uint8 reelIndex,
        uint16 stripLength
    ) external pure returns (uint16) {
        if (stripLength == 0) revert InvalidStripLength();
        return uint16(draw(root, wagerId, gameVersionId, rulesetId, phase, spinIndex, reelIndex) % stripLength);
    }
}
