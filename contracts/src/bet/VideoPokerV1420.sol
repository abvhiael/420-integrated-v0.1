// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./ICasinoGame420.sol";

/// @notice Canonical Video Poker V1 binding and wager-parameter foundation.
/// @dev E3.1 intentionally defines only immutable game bindings and committed wager parameters.
///      Deal randomness, hold/draw lifecycle, hand evaluation and settlement are added in later E3 steps.
contract VideoPokerV1420 is ICasinoGame420 {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.VIDEO_POKER.V1.PARAMS");
    uint8 public constant MIN_CREDITS = 1;
    uint8 public constant MAX_CREDITS = 5;

    struct Params {
        bytes32 paytableId;
        uint8 credits;
    }

    BetRegistry420 public immutable wagerRegistry;
    bytes32 public immutable gameId;
    bytes32 public immutable gameVersionId;
    bytes32 public immutable rulesetId;

    error ZeroAddress();
    error InvalidId();
    error InvalidParams();
    error WrongGame();
    error WrongRuleset();
    error InvalidWagerStatus();
    error ParamsMismatch();

    constructor(address wagerRegistry_, bytes32 gameId_, bytes32 gameVersionId_, bytes32 rulesetId_) {
        if (wagerRegistry_ == address(0)) revert ZeroAddress();
        if (gameId_ == bytes32(0) || gameVersionId_ == bytes32(0) || rulesetId_ == bytes32(0)) revert InvalidId();
        wagerRegistry = BetRegistry420(wagerRegistry_);
        gameId = gameId_;
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
    }

    function systemName() external pure returns (string memory) { return "VideoPokerV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        _validateParams(params);
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, params.paytableId, params.credits));
    }

    /// @notice Verifies that a canonical wager is bound to Video Poker V1 and the supplied committed params.
    /// @dev This is a read-only E3.1 foundation check, not a deal/session transition.
    function validateWager(bytes32 wagerId, Params calldata params) external view returns (BetTypes420.Wager memory wager) {
        wager = wagerRegistry.getWager(wagerId);
        if (wager.gameId != gameId || wager.gameVersionId != gameVersionId) revert WrongGame();
        if (wager.rulesetId != rulesetId) revert WrongRuleset();
        if (
            wager.status != BetTypes420.WagerStatus.ACCEPTED
                && wager.status != BetTypes420.WagerStatus.OUTCOME_READY
                && wager.status != BetTypes420.WagerStatus.SETTLED
        ) revert InvalidWagerStatus();
        if (hashParams(params) != wager.paramsHash) revert ParamsMismatch();
    }

    function _validateParams(Params memory params) private pure {
        if (params.paytableId == bytes32(0) || params.credits < MIN_CREDITS || params.credits > MAX_CREDITS) {
            revert InvalidParams();
        }
    }
}
