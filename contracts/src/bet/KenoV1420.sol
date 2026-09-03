// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";

/// @notice First-party deterministic 80-number / 20-draw Keno resolver for 420Bet.
/// @dev KenoV1 has no custody, transfer, randomness-provider selection, or settlement authority.
///      Player picks and the complete gross-payout schedule are bound into immutable wager params.
///      Twenty unique draw numbers are produced from the canonical wager randomness root using a
///      deterministic partial Fisher-Yates shuffle; no draw is rerolled, skipped, or replaced.
contract KenoV1420 is I420System {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.KENO.V1.PARAMS");
    bytes32 public constant DRAW_DOMAIN = keccak256("420.BET.KENO.V1.DRAW");
    uint8 public constant NUMBER_COUNT = 80;
    uint8 public constant DRAW_COUNT = 20;
    uint8 public constant MAX_PICKS = 10;

    struct Params {
        uint8 pickCount;
        uint8[MAX_PICKS] picks;
        uint256[MAX_PICKS + 1] grossPayoutByHits;
    }

    struct Result {
        bytes32 wagerId;
        uint8[DRAW_COUNT] draw;
        uint8 hits;
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

    function systemName() external pure returns (string memory) { return "KenoV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        _validateParams(params);
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, params.pickCount, params.picks, params.grossPayoutByHits));
    }

    function requiredMaxGrossPayout(uint256 stake, Params memory params) public pure returns (uint256 requiredMax) {
        if (stake == 0) revert InvalidPayout();
        _validateParams(params);
        for (uint8 hits = 0; hits <= params.pickCount; ++hits) {
            uint256 payout = params.grossPayoutByHits[hits];
            if (payout != 0 && payout < stake) revert InvalidPayout();
            if (payout > requiredMax) requiredMax = payout;
        }
        if (requiredMax == 0) revert InvalidPayout();
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
        uint8[DRAW_COUNT] memory draw = _draw(wagerId, root);
        uint8 hits = _countHits(params, draw);
        uint256 grossPayout = params.grossPayoutByHits[hits];
        BetTypes420.TerminalOutcome outcome = grossPayout == 0
            ? BetTypes420.TerminalOutcome.LOSS
            : grossPayout == wager.stake
                ? BetTypes420.TerminalOutcome.PUSH
                : BetTypes420.TerminalOutcome.WIN;

        result = Result({
            wagerId: wagerId,
            draw: draw,
            hits: hits,
            outcome: outcome,
            grossPayout: grossPayout,
            paramsHash: paramsHash,
            randomnessRoot: root
        });
    }

    function _draw(bytes32 wagerId, bytes32 root) private view returns (uint8[DRAW_COUNT] memory draw) {
        uint8[NUMBER_COUNT] memory pool;
        for (uint8 i = 0; i < NUMBER_COUNT; ++i) pool[i] = i + 1;

        for (uint8 i = 0; i < DRAW_COUNT; ++i) {
            uint256 remaining = uint256(NUMBER_COUNT - i);
            uint256 offset = uint256(keccak256(abi.encode(DRAW_DOMAIN, wagerId, gameVersionId, rulesetId, root, i))) % remaining;
            uint256 j = uint256(i) + offset;
            uint8 selected = pool[j];
            pool[j] = pool[i];
            pool[i] = selected;
            draw[i] = selected;
        }
    }

    function _countHits(Params memory params, uint8[DRAW_COUNT] memory draw) private pure returns (uint8 hits) {
        for (uint8 i = 0; i < params.pickCount; ++i) {
            for (uint8 j = 0; j < DRAW_COUNT; ++j) {
                if (params.picks[i] == draw[j]) {
                    hits += 1;
                    break;
                }
            }
        }
    }

    function _validateParams(Params memory params) private pure {
        if (params.pickCount == 0 || params.pickCount > MAX_PICKS) revert InvalidParams();
        if (params.grossPayoutByHits[0] != 0) revert InvalidParams();

        for (uint8 i = 0; i < MAX_PICKS; ++i) {
            uint8 pick = params.picks[i];
            if (i < params.pickCount) {
                if (pick == 0 || pick > NUMBER_COUNT) revert InvalidParams();
                for (uint8 j = 0; j < i; ++j) {
                    if (params.picks[j] == pick) revert InvalidParams();
                }
            } else if (pick != 0) {
                revert InvalidParams();
            }
        }

        for (uint8 hits = params.pickCount + 1; hits <= MAX_PICKS; ++hits) {
            if (params.grossPayoutByHits[hits] != 0) revert InvalidParams();
        }
    }
}
