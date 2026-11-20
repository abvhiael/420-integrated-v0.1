// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./PlinkoV2420.sol";

/// @notice One-way governance activation of each V2 Plinko rows/risk payout schedule.
/// @dev A separate immutable schedule is approved for every enabled configuration.
///      No player may supply unapproved multipliers or overwrite an activated table.
contract PlinkoPaytableAuthorityV2420 {
    BetAuthorization420 public immutable authorization;
    bytes32 public immutable gameVersionId;
    bytes32 public immutable rulesetId;
    bytes32 public immutable version;
    bytes32 public immutable manifestHash;

    mapping(uint8 => mapping(uint8 => bool)) public activated;
    mapping(uint8 => mapping(uint8 => bytes32)) public scheduleHash;
    mapping(uint8 => mapping(uint8 => uint256[17])) private _multiplierBps;

    error InvalidSchedule();
    error Unauthorized();
    error AlreadyActivated();
    error NotActivated();

    constructor(
        address authorization_,
        bytes32 gameVersionId_,
        bytes32 rulesetId_,
        bytes32 version_,
        bytes32 manifestHash_
    ) {
        if (
            authorization_ == address(0) || gameVersionId_ == 0 || rulesetId_ == 0
                || version_ == 0 || manifestHash_ == 0
        ) revert InvalidSchedule();
        authorization = BetAuthorization420(authorization_);
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
        version = version_;
        manifestHash = manifestHash_;
    }

    function activate(uint8 rows, uint8 risk, uint256[17] calldata multipliers) external {
        if (rows < 7 || rows > 16 || risk >= 3) revert InvalidSchedule();
        if (activated[rows][risk]) revert AlreadyActivated();
        if (!authorization.isAuthorized(
            msg.sender, BetIds420.ACTION_GAME_ACTIVATE,
            authorization.scopeForGame(keccak256("420BET.GAME.PLINKO"), gameVersionId), 0
        )) revert Unauthorized();

        uint256 maximum;
        for (uint8 bucket = 0; bucket < 17; ++bucket) {
            uint256 value = multipliers[bucket];
            if (bucket > rows && value != 0) revert InvalidSchedule();
            if (bucket <= rows && value > maximum) maximum = value;
        }
        if (maximum == 0) revert InvalidSchedule();
        scheduleHash[rows][risk] = keccak256(abi.encode(rows, risk, multipliers));
        for (uint8 bucket = 0; bucket < 17; ++bucket) {
            _multiplierBps[rows][risk][bucket] = multipliers[bucket];
        }
        activated[rows][risk] = true;
    }

    function multiplier(uint8 rows, uint8 risk, uint8 bucket) external view returns (uint256) {
        if (!activated[rows][risk]) revert NotActivated();
        if (bucket > rows) revert InvalidSchedule();
        return _multiplierBps[rows][risk][bucket];
    }

    function verify(
        uint256 stake,
        uint256 maxGrossPayout,
        bytes32 paramsHash,
        PlinkoV2420.Params calldata params,
        address resolver
    ) external view {
        if (!activated[params.rows][params.risk]) revert NotActivated();
        PlinkoV2420 plinko = PlinkoV2420(resolver);
        if (
            stake == 0 || plinko.gameVersionId() != gameVersionId ||
                plinko.rulesetId() != rulesetId ||
                paramsHash != plinko.hashParams(params)
        ) revert InvalidSchedule();

        uint256 maximum;
        for (uint8 bucket = 0; bucket < 17; ++bucket) {
            uint256 expected = stake * _multiplierBps[params.rows][params.risk][bucket] / 10_000;
            if (params.grossPayoutByBucket[bucket] != expected) revert InvalidSchedule();
            if (expected > maximum) maximum = expected;
        }
        if (
            maximum == 0 || maximum != maxGrossPayout ||
                plinko.requiredMaxGrossPayout(stake, params) != maximum
        ) revert InvalidSchedule();
    }
}
