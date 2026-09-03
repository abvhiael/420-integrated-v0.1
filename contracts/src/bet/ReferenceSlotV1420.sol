// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";
import "./SlotRandomStream420.sol";

/// @notice First production-quality first-party 5x4 ways-to-win slot title for 420Bet.
/// @dev Outcome authority is entirely on-chain and deterministic from one canonical randomness root.
contract ReferenceSlotV1420 is I420System {
    uint8 public constant REEL_COUNT = 5;
    uint8 public constant ROW_COUNT = 4;
    uint8 public constant SYMBOL_COUNT = 7;
    uint8 public constant WILD = 5;
    uint8 public constant SCATTER = 6;
    uint8 public constant BASE_FREE_SPINS = 6;
    uint8 public constant RETRIGGER_SPINS = 3;
    uint8 public constant MAX_RETRIGGERS = 2;
    uint8 public constant FEATURE_MULTIPLIER = 2;
    uint16 public constant STRIP_LENGTH = 32;
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.SLOT.REFERENCE.V1.PARAMS");

    struct Params {
        uint8[REEL_COUNT][STRIP_LENGTH] baseReels;
        uint8[REEL_COUNT][STRIP_LENGTH] featureReels;
        uint256[SYMBOL_COUNT] payoutPerWay;
        uint256 scatter3;
        uint256 scatter4;
        uint256 scatter5;
        uint256 maxGrossPayout;
    }

    struct Result {
        bytes32 wagerId;
        bytes32 paramsHash;
        bytes32 randomnessRoot;
        uint16[REEL_COUNT] baseStops;
        uint8[REEL_COUNT * ROW_COUNT] baseGrid;
        uint256 basePayout;
        uint8 baseScatterCount;
        uint8 freeSpinsPlayed;
        uint8 retriggers;
        uint256 featurePayout;
        uint256 grossPayout;
        bool capped;
        BetTypes420.TerminalOutcome outcome;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
    SlotRandomStream420 public immutable randomStream;
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

    constructor(address registry_, address randomness_, address stream_, bytes32 gameId_, bytes32 gameVersionId_, bytes32 rulesetId_) {
        if (registry_ == address(0) || randomness_ == address(0) || stream_ == address(0)) revert ZeroAddress();
        if (gameId_ == bytes32(0) || gameVersionId_ == bytes32(0) || rulesetId_ == bytes32(0)) revert InvalidId();
        wagerRegistry = BetRegistry420(registry_);
        randomnessRouter = RandomnessRouter420(randomness_);
        randomStream = SlotRandomStream420(stream_);
        gameId = gameId_;
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
    }

    function systemName() external pure returns (string memory) { return "ReferenceSlotV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory p) public view returns (bytes32) {
        _validateParams(p);
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, p));
    }

    function requiredMaxGrossPayout(uint256 stake, Params memory p) public view returns (uint256) {
        if (stake == 0) revert InvalidPayout();
        _validateParams(p);
        if (p.maxGrossPayout < stake) revert InvalidPayout();
        return p.maxGrossPayout;
    }

    function resolve(bytes32 wagerId, Params calldata p) external view returns (Result memory r) {
        BetTypes420.Wager memory w = wagerRegistry.getWager(wagerId);
        if (w.gameId != gameId || w.gameVersionId != gameVersionId) revert WrongGame();
        if (w.rulesetId != rulesetId) revert WrongRuleset();
        if (w.status != BetTypes420.WagerStatus.ACCEPTED && w.status != BetTypes420.WagerStatus.OUTCOME_READY && w.status != BetTypes420.WagerStatus.SETTLED) revert InvalidWagerStatus();

        bytes32 paramsHash = hashParams(p);
        if (paramsHash != w.paramsHash) revert ParamsMismatch();
        if (w.maxGrossPayout != requiredMaxGrossPayout(w.stake, p)) revert InvalidPayout();

        bytes32 root = randomnessRouter.rootOf(wagerId);
        r.wagerId = wagerId;
        r.paramsHash = paramsHash;
        r.randomnessRoot = root;

        for (uint8 reel = 0; reel < REEL_COUNT; ++reel) {
            uint16 stop = randomStream.reelStop(root, wagerId, gameVersionId, rulesetId, randomStream.BASE_PHASE(), 0, reel, STRIP_LENGTH);
            r.baseStops[reel] = stop;
            for (uint8 row = 0; row < ROW_COUNT; ++row) {
                r.baseGrid[reel * ROW_COUNT + row] = p.baseReels[(uint256(stop) + row) % STRIP_LENGTH][reel];
            }
        }

        (r.basePayout, r.baseScatterCount) = _evaluate(r.baseGrid, w.stake, p);
        if (r.baseScatterCount >= 3) {
            uint8 spinsRemaining = BASE_FREE_SPINS;
            uint16 spinIndex;
            while (spinsRemaining > 0) {
                uint8[REEL_COUNT * ROW_COUNT] memory grid;
                for (uint8 reel = 0; reel < REEL_COUNT; ++reel) {
                    uint16 stop = randomStream.reelStop(root, wagerId, gameVersionId, rulesetId, randomStream.FEATURE_PHASE(), spinIndex, reel, STRIP_LENGTH);
                    for (uint8 row = 0; row < ROW_COUNT; ++row) {
                        grid[reel * ROW_COUNT + row] = p.featureReels[(uint256(stop) + row) % STRIP_LENGTH][reel];
                    }
                }
                (uint256 spinPayout, uint8 scatters) = _evaluate(grid, w.stake, p);
                r.featurePayout += spinPayout * FEATURE_MULTIPLIER;
                r.freeSpinsPlayed += 1;
                spinsRemaining -= 1;
                if (scatters >= 3 && r.retriggers < MAX_RETRIGGERS) {
                    r.retriggers += 1;
                    spinsRemaining += RETRIGGER_SPINS;
                }
                spinIndex += 1;
            }
        }

        uint256 total = r.basePayout + r.featurePayout;
        if (total > p.maxGrossPayout) {
            total = p.maxGrossPayout;
            r.capped = true;
        }
        r.grossPayout = total;
        r.outcome = total == 0 ? BetTypes420.TerminalOutcome.LOSS : total == w.stake ? BetTypes420.TerminalOutcome.PUSH : BetTypes420.TerminalOutcome.WIN;
    }

    function _evaluate(uint8[REEL_COUNT * ROW_COUNT] memory grid, uint256 stake, Params memory p) private pure returns (uint256 payout, uint8 scatterCount) {
        uint8[REEL_COUNT] memory scatterByReel;
        for (uint8 i = 0; i < REEL_COUNT * ROW_COUNT; ++i) {
            if (grid[i] == SCATTER) {
                scatterCount += 1;
                scatterByReel[i / ROW_COUNT] = 1;
            }
        }
        uint8 scatterReels;
        for (uint8 r = 0; r < REEL_COUNT; ++r) scatterReels += scatterByReel[r];
        if (scatterReels == 3) payout += p.scatter3;
        else if (scatterReels == 4) payout += p.scatter4;
        else if (scatterReels >= 5) payout += p.scatter5;

        for (uint8 symbol = 0; symbol < WILD; ++symbol) {
            uint256 ways = 1;
            uint8 matchedReels;
            for (uint8 reel = 0; reel < REEL_COUNT; ++reel) {
                uint8 matches;
                for (uint8 row = 0; row < ROW_COUNT; ++row) {
                    uint8 s = grid[reel * ROW_COUNT + row];
                    if (s == symbol || s == WILD) matches += 1;
                }
                if (matches == 0) break;
                ways *= matches;
                matchedReels += 1;
            }
            if (matchedReels >= 3 && p.payoutPerWay[symbol] > 0) payout += ways * p.payoutPerWay[symbol];
        }

        // Payout tables are denominated in absolute gross units for V1; stake is only used to validate terminal economics.
        stake;
    }

    function _validateParams(Params memory p) private pure {
        if (p.maxGrossPayout == 0) revert InvalidParams();
        if (p.scatter3 > p.scatter4 || p.scatter4 > p.scatter5 || p.scatter5 > p.maxGrossPayout) revert InvalidParams();
        bool hasWin;
        for (uint8 s = 0; s < WILD; ++s) {
            if (p.payoutPerWay[s] > p.maxGrossPayout) revert InvalidParams();
            if (p.payoutPerWay[s] > 0) hasWin = true;
        }
        if (!hasWin && p.scatter5 == 0) revert InvalidParams();
        for (uint16 pos = 0; pos < STRIP_LENGTH; ++pos) {
            for (uint8 reel = 0; reel < REEL_COUNT; ++reel) {
                if (p.baseReels[pos][reel] >= SYMBOL_COUNT || p.featureReels[pos][reel] >= SYMBOL_COUNT) revert InvalidParams();
            }
        }
    }
}
