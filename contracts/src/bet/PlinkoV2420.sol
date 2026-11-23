// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";

/// @notice Versioned Plinko with 7–16 independent decisions and 8–17 landing buckets.
/// @dev Does not custody, settle, select randomness providers or authorize paytables.
///      Each wager binds its peg rows, risk tier, and all 17 payout slots in its params hash.
///      Slots above the chosen row count must be zero and are never reachable.
contract PlinkoV2420 is I420System {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.PLINKO.V2.PARAMS");
    bytes32 public constant PATH_DOMAIN = keccak256("420.BET.PLINKO.V2.PATH");
    uint8 public constant MIN_ROWS = 7;
    uint8 public constant MAX_ROWS = 16;
    uint8 public constant MAX_BUCKETS = MAX_ROWS + 1;
    uint8 public constant RISK_LEVELS = 3;

    struct Params {
        uint8 rows;
        uint8 risk;
        uint256[17] grossPayoutByBucket;
    }

    struct Result {
        bytes32 wagerId;
        uint16 pathBits;
        uint8 rows;
        uint8 risk;
        uint8 rightMoves;
        uint8 bucket;
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

    function systemName() external pure returns (string memory) { return "PlinkoV2420"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function validateParams(Params memory params) public pure {
        if (params.rows < MIN_ROWS || params.rows > MAX_ROWS || params.risk >= RISK_LEVELS) revert InvalidParams();
        bool hasPayout;
        for (uint8 bucket = 0; bucket < MAX_BUCKETS; ++bucket) {
            uint256 amount = params.grossPayoutByBucket[bucket];
            if (bucket > params.rows && amount != 0) revert InvalidParams();
            if (bucket <= params.rows && amount != 0) hasPayout = true;
        }
        if (!hasPayout) revert InvalidParams();
    }

    function hashParams(Params memory params) public view returns (bytes32) {
        validateParams(params);
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, params.rows, params.risk, params.grossPayoutByBucket));
    }

    function requiredMaxGrossPayout(uint256 stake, Params memory params) public pure returns (uint256 maximum) {
        if (stake == 0) revert InvalidPayout();
        validateParams(params);
        for (uint8 bucket = 0; bucket <= params.rows; ++bucket) {
            uint256 payout = params.grossPayoutByBucket[bucket];
            if (payout > maximum) maximum = payout;
        }
        if (maximum == 0) revert InvalidPayout();
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
        (uint16 bits, uint8 rights) = _path(wagerId, root, params.rows);
        uint256 payout = params.grossPayoutByBucket[rights];
        BetTypes420.TerminalOutcome outcome =
            payout < wager.stake ? BetTypes420.TerminalOutcome.LOSS
            : payout == wager.stake ? BetTypes420.TerminalOutcome.PUSH
            : BetTypes420.TerminalOutcome.WIN;

        result = Result({
            wagerId: wagerId,
            pathBits: bits,
            rows: params.rows,
            risk: params.risk,
            rightMoves: rights,
            bucket: rights,
            outcome: outcome,
            grossPayout: payout,
            paramsHash: paramsHash,
            randomnessRoot: root
        });
    }

    function _path(bytes32 wagerId, bytes32 root, uint8 rows)
        private view returns (uint16 pathBits, uint8 rightMoves)
    {
        for (uint8 row = 0; row < rows; ++row) {
            uint256 draw = uint256(keccak256(abi.encode(PATH_DOMAIN, wagerId, gameVersionId, rulesetId, root, row)));
            if ((draw & 1) == 1) {
                pathBits |= uint16(1) << row;
                rightMoves += 1;
            }
        }
    }
}
