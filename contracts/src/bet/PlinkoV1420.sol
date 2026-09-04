// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";

/// @notice First-party deterministic 12-row Plinko resolver for 420Bet.
/// @dev PlinkoV1 has no custody, transfer, randomness-provider selection, or settlement authority.
///      One canonical randomness root deterministically produces exactly one left/right decision per row.
///      The terminal bucket and complete gross-payout schedule are bound to immutable wager terms.
contract PlinkoV1420 is I420System {
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.PLINKO.V1.PARAMS");
    bytes32 public constant PATH_DOMAIN = keccak256("420.BET.PLINKO.V1.PATH");
    uint8 public constant ROW_COUNT = 12;
    uint8 public constant BUCKET_COUNT = ROW_COUNT + 1;

    struct Params {
        uint256[BUCKET_COUNT] grossPayoutByBucket;
    }

    struct Result {
        bytes32 wagerId;
        uint16 pathBits;
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

    function systemName() external pure returns (string memory) { return "PlinkoV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        _validateParams(params);
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, params.grossPayoutByBucket));
    }

    function requiredMaxGrossPayout(uint256 stake, Params memory params) public pure returns (uint256 requiredMax) {
        if (stake == 0) revert InvalidPayout();
        _validateParams(params);
        for (uint8 bucket = 0; bucket < BUCKET_COUNT; ++bucket) {
            uint256 payout = params.grossPayoutByBucket[bucket];
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
        (uint16 pathBits, uint8 rightMoves) = _path(wagerId, root);
        uint8 bucket = rightMoves;
        uint256 grossPayout = params.grossPayoutByBucket[bucket];
        BetTypes420.TerminalOutcome outcome = grossPayout == 0
            ? BetTypes420.TerminalOutcome.LOSS
            : grossPayout == wager.stake
                ? BetTypes420.TerminalOutcome.PUSH
                : BetTypes420.TerminalOutcome.WIN;

        result = Result({
            wagerId: wagerId,
            pathBits: pathBits,
            rightMoves: rightMoves,
            bucket: bucket,
            outcome: outcome,
            grossPayout: grossPayout,
            paramsHash: paramsHash,
            randomnessRoot: root
        });
    }

    function _path(bytes32 wagerId, bytes32 root) private view returns (uint16 pathBits, uint8 rightMoves) {
        for (uint8 row = 0; row < ROW_COUNT; ++row) {
            uint256 draw = uint256(keccak256(abi.encode(PATH_DOMAIN, wagerId, gameVersionId, rulesetId, root, row)));
            if ((draw & 1) == 1) {
                pathBits |= uint16(1) << row;
                rightMoves += 1;
            }
        }
    }

    function _validateParams(Params memory params) private pure {
        bool hasPayout;
        for (uint8 bucket = 0; bucket < BUCKET_COUNT; ++bucket) {
            if (params.grossPayoutByBucket[bucket] != 0) hasPayout = true;
        }
        if (!hasPayout) revert InvalidParams();
    }
}
