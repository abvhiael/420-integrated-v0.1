// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./KenoV1420.sol";

/// @notice Version-bound, capability-governed Keno paytable authorization.
contract KenoPaytableAuthority420 {
    BetAuthorization420 public immutable authorization;
    bytes32 public immutable gameVersionId;
    bytes32 public immutable rulesetId;
    bytes32 public immutable version;
    bytes32 public immutable manifestHash;
    bytes32 public immutable scheduleHash;
    bool public activated;
    uint256[11][11] private _multiplierBps;

    error Unauthorized();
    error InvalidSchedule();
    error AlreadyActivated();
    error NotActivated();

    constructor(address authorization_, bytes32 gameVersionId_, bytes32 rulesetId_,
        bytes32 version_, bytes32 manifestHash_, bytes32 scheduleHash_)
    {
        if (authorization_ == address(0) || gameVersionId_ == 0 || rulesetId_ == 0 ||
            version_ == 0 || manifestHash_ == 0 || scheduleHash_ == 0) revert InvalidSchedule();
        authorization = BetAuthorization420(authorization_);
        gameVersionId = gameVersionId_;
        rulesetId = rulesetId_;
        version = version_;
        manifestHash = manifestHash_;
        scheduleHash = scheduleHash_;
    }

    /// @notice A schedule can be installed only once, by the scoped game configuration authority.
    function activate(uint256[11][11] calldata multipliers) external {
        if (activated) revert AlreadyActivated();
        if (keccak256(abi.encode(multipliers)) != scheduleHash) revert InvalidSchedule();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_ACTIVATE,
            authorization.scopeForGame(keccak256("420BET.GAME.KENO"), gameVersionId), 0))
            revert Unauthorized();
        for (uint256 n=1;n<=10;++n) {
            uint256 maxMultiplier;
            for (uint256 h=0;h<=10;++h) {
                uint256 m=multipliers[n][h];
                if ((h==0 || h>n) && m!=0) revert InvalidSchedule();
                if (m!=0 && m<10_000) revert InvalidSchedule();
                if (m>maxMultiplier) maxMultiplier=m;
                _multiplierBps[n][h]=m;
            }
            if (maxMultiplier==0) revert InvalidSchedule();
        }
        activated=true;
    }

    function multiplier(uint8 picks,uint8 hits) external view returns(uint256) {
        if (!activated) revert NotActivated();
        if (picks==0 || picks>10 || hits>picks) revert InvalidSchedule();
        return _multiplierBps[picks][hits];
    }

    /// @notice Fail closed before accepting stake, creating a wager, or reserving bankroll risk.
    function verify(uint256 stake,uint256 maxGrossPayout,bytes32 paramsHash,
        KenoV1420.Params calldata params,address kenoAddress) external view
    {
        if (!activated) revert NotActivated();
        KenoV1420 keno=KenoV1420(kenoAddress);
        if (keno.gameVersionId()!=gameVersionId || keno.rulesetId()!=rulesetId ||
            stake==0 || paramsHash!=keno.hashParams(params)) revert InvalidSchedule();
        uint256 maximum;
        for (uint8 h=0;h<=10;++h) {
            uint256 expected= h<=params.pickCount
                ? stake*_multiplierBps[params.pickCount][h]/10_000 : 0;
            if (params.grossPayoutByHits[h]!=expected) revert InvalidSchedule();
            if (expected>maximum) maximum=expected;
        }
        if (maximum==0 || maximum!=maxGrossPayout ||
            keno.requiredMaxGrossPayout(stake,params)!=maximum) revert InvalidSchedule();
    }
}
