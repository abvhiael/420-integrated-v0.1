// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./PlinkoV1420.sol";

/// @notice Immutable-by-version 12-row, 13-slot Plinko payout authority.
/// @dev A governance-approved schedule digest is committed at construction and
///      activated once; nothing may alter a live schedule.
contract PlinkoPaytableAuthority420 {
    BetAuthorization420 public immutable authorization;
    bytes32 public immutable gameVersionId;
    bytes32 public immutable rulesetId;
    bytes32 public immutable version;
    bytes32 public immutable manifestHash;
    bytes32 public immutable scheduleHash;
    bool public activated;
    uint256[13] private _multiplierBps;

    error InvalidSchedule();
    error Unauthorized();
    error AlreadyActivated();
    error NotActivated();

    constructor(address authorization_, bytes32 gameVersionId_, bytes32 rulesetId_,
        bytes32 version_, bytes32 manifestHash_, bytes32 scheduleHash_) {
        if (authorization_ == address(0) || gameVersionId_ == 0 || rulesetId_ == 0 ||
            version_ == 0 || manifestHash_ == 0 || scheduleHash_ == 0) revert InvalidSchedule();
        authorization = BetAuthorization420(authorization_);
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
        version = version_;
        manifestHash = manifestHash_;
        scheduleHash = scheduleHash_;
    }

    function activate(uint256[13] calldata multipliers) external {
        if (activated) revert AlreadyActivated();
        if (keccak256(abi.encode(multipliers)) != scheduleHash) revert InvalidSchedule();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_ACTIVATE,
            authorization.scopeForGame(keccak256("420BET.GAME.PLINKO"), gameVersionId), 0))
            revert Unauthorized();
        uint256 maximum;
        for (uint8 bucket = 0; bucket < 13; ++bucket) {
            uint256 m = multipliers[bucket];
            if (m != 0 && m < 10_000) revert InvalidSchedule();
            if (m > maximum) maximum = m;
            _multiplierBps[bucket] = m;
        }
        if (maximum == 0) revert InvalidSchedule();
        activated = true;
    }

    function multiplier(uint8 bucket) external view returns (uint256) {
        if (!activated) revert NotActivated();
        if (bucket >= 13) revert InvalidSchedule();
        return _multiplierBps[bucket];
    }

    function verify(uint256 stake, uint256 maxGrossPayout, bytes32 paramsHash,
        PlinkoV1420.Params calldata params, address resolver) external view {
        if (!activated) revert NotActivated();
        PlinkoV1420 plinko = PlinkoV1420(resolver);
        if (stake == 0 || plinko.gameVersionId() != gameVersionId ||
            plinko.rulesetId() != rulesetId || paramsHash != plinko.hashParams(params))
            revert InvalidSchedule();
        uint256 maximum;
        for (uint8 bucket = 0; bucket < 13; ++bucket) {
            uint256 expected = stake * _multiplierBps[bucket] / 10_000;
            if (params.grossPayoutByBucket[bucket] != expected) revert InvalidSchedule();
            if (expected > maximum) maximum = expected;
        }
        if (maximum == 0 || maximum != maxGrossPayout ||
            plinko.requiredMaxGrossPayout(stake, params) != maximum) revert InvalidSchedule();
    }
}
