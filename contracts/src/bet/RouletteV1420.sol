// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";

/// @notice First-party European single-zero roulette resolver for 420Bet.
/// @dev RouletteV1 has no custody, transfer, randomness-provider selection, or settlement authority.
///      It deterministically derives one pocket (0..36) from the canonical wager randomness root
///      and computes the terminal result from immutable wager-bound parameters.
contract RouletteV1420 is I420System {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.ROULETTE.V1.PARAMS");
    bytes32 public constant SPIN_DOMAIN = keccak256("420.BET.ROULETTE.V1.SPIN");
    uint8 public constant MAX_POCKET = 36;

    enum BetKind {
        NONE,
        STRAIGHT,
        RED,
        BLACK,
        EVEN,
        ODD,
        LOW,
        HIGH,
        DOZEN,
        COLUMN
    }

    struct Params {
        BetKind kind;
        uint8 selection;
    }

    struct Result {
        bytes32 wagerId;
        uint8 pocket;
        BetKind kind;
        uint8 selection;
        BetTypes420.TerminalOutcome outcome;
        uint256 grossPayout;
        bytes32 paramsHash;
        bytes32 randomnessRoot;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
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
    error InvalidPayout();

    constructor(
        address wagerRegistry_,
        address randomnessRouter_,
        bytes32 gameId_,
        bytes32 gameVersionId_,
        bytes32 rulesetId_
    ) {
        if (wagerRegistry_ == address(0) || randomnessRouter_ == address(0)) revert ZeroAddress();
        if (gameId_ == bytes32(0) || gameVersionId_ == bytes32(0) || rulesetId_ == bytes32(0)) revert InvalidId();
        wagerRegistry = BetRegistry420(wagerRegistry_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
        gameId = gameId_;
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
    }

    function systemName() external pure returns (string memory) { return "RouletteV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        _validateParams(params);
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, params.kind, params.selection));
    }

    function requiredMaxGrossPayout(uint256 stake, Params memory params) public pure returns (uint256) {
        if (stake == 0) revert InvalidPayout();
        _validateParams(params);
        if (params.kind == BetKind.STRAIGHT) return stake * 36;
        if (params.kind == BetKind.DOZEN || params.kind == BetKind.COLUMN) return stake * 3;
        return stake * 2;
    }

    function resolve(bytes32 wagerId, Params calldata params) external view returns (Result memory result) {
        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        if (wager.gameId != gameId || wager.gameVersionId != gameVersionId) revert WrongGame();
        if (wager.rulesetId != rulesetId) revert WrongRuleset();
        if (
            wager.status != BetTypes420.WagerStatus.ACCEPTED
                && wager.status != BetTypes420.WagerStatus.OUTCOME_READY
                && wager.status != BetTypes420.WagerStatus.SETTLED
        ) revert InvalidWagerStatus();

        bytes32 paramsHash = hashParams(params);
        if (paramsHash != wager.paramsHash) revert ParamsMismatch();

        uint256 requiredMax = requiredMaxGrossPayout(wager.stake, params);
        if (wager.maxGrossPayout != requiredMax) revert InvalidPayout();

        bytes32 root = randomnessRouter.rootOf(wagerId);
        uint8 pocket = uint8(uint256(keccak256(abi.encode(SPIN_DOMAIN, wagerId, gameVersionId, rulesetId, root))) % 37);
        bool won = _wins(pocket, params);

        result = Result({
            wagerId: wagerId,
            pocket: pocket,
            kind: params.kind,
            selection: params.selection,
            outcome: won ? BetTypes420.TerminalOutcome.WIN : BetTypes420.TerminalOutcome.LOSS,
            grossPayout: won ? requiredMax : 0,
            paramsHash: paramsHash,
            randomnessRoot: root
        });
    }

    function isRed(uint8 pocket) public pure returns (bool) {
        if (pocket == 0 || pocket > MAX_POCKET) return false;
        return pocket == 1 || pocket == 3 || pocket == 5 || pocket == 7 || pocket == 9
            || pocket == 12 || pocket == 14 || pocket == 16 || pocket == 18
            || pocket == 19 || pocket == 21 || pocket == 23 || pocket == 25 || pocket == 27
            || pocket == 30 || pocket == 32 || pocket == 34 || pocket == 36;
    }

    function _wins(uint8 pocket, Params memory params) private pure returns (bool) {
        if (params.kind == BetKind.STRAIGHT) return pocket == params.selection;
        if (pocket == 0) return false;
        if (params.kind == BetKind.RED) return isRed(pocket);
        if (params.kind == BetKind.BLACK) return !isRed(pocket);
        if (params.kind == BetKind.EVEN) return pocket % 2 == 0;
        if (params.kind == BetKind.ODD) return pocket % 2 == 1;
        if (params.kind == BetKind.LOW) return pocket <= 18;
        if (params.kind == BetKind.HIGH) return pocket >= 19;
        if (params.kind == BetKind.DOZEN) return ((pocket - 1) / 12) + 1 == params.selection;
        if (params.kind == BetKind.COLUMN) return ((pocket - 1) % 3) + 1 == params.selection;
        return false;
    }

    function _validateParams(Params memory params) private pure {
        if (params.kind == BetKind.NONE) revert InvalidParams();
        if (params.kind == BetKind.STRAIGHT) {
            if (params.selection > MAX_POCKET) revert InvalidParams();
            return;
        }
        if (params.kind == BetKind.DOZEN || params.kind == BetKind.COLUMN) {
            if (params.selection == 0 || params.selection > 3) revert InvalidParams();
            return;
        }
        if (params.selection != 0) revert InvalidParams();
    }
}
