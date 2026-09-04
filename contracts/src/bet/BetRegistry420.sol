// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./BetTypes420.sol";

contract BetRegistry420 is I420System {
    BetAuthorization420 public immutable authorization;
    mapping(bytes32 => BetTypes420.Wager) private _wagers;
    mapping(bytes32 => BetTypes420.Settlement) private _settlements;

    error ZeroAddress();
    error InvalidId();
    error InvalidWager();
    error InvalidSettlement();
    error AlreadyExists();
    error AlreadySettled();
    error NotFound();
    error Unauthorized();

    event WagerAccepted(
        bytes32 indexed wagerId,
        address indexed player,
        bytes32 indexed gameVersionId,
        bytes32 operatorId,
        bytes32 vaultId,
        address asset,
        uint256 stake,
        uint256 maxGrossPayout,
        bytes32 paramsHash,
        uint64 acceptedAt,
        uint64 deadline
    );
    event WagerSettled(bytes32 indexed wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout, uint64 settledAt);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "BetRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function recordAccepted(BetTypes420.Wager calldata input) external {
        if (
            input.wagerId == bytes32(0) || input.gameId == bytes32(0) || input.gameVersionId == bytes32(0)
                || input.operatorId == bytes32(0) || input.vaultId == bytes32(0)
        ) revert InvalidId();
        if (input.player == address(0) || input.stake == 0 || input.maxGrossPayout < input.stake) revert InvalidWager();
        if (
            input.randomnessProfileId == bytes32(0) || input.riskProfileId == bytes32(0)
                || input.settlementProfileId == bytes32(0) || input.accessPolicyId == bytes32(0)
                || input.rulesetId == bytes32(0) || input.deadline <= block.timestamp
        ) revert InvalidWager();
        if (_wagers[input.wagerId].wagerId != bytes32(0)) revert AlreadyExists();
        if (
            !authorization.isAuthorized(
                msg.sender,
                BetIds420.ACTION_WAGER_RECORD,
                authorization.scopeForVault(input.vaultId),
                input.stake
            )
        ) revert Unauthorized();

        BetTypes420.Wager memory wager = input;
        wager.acceptedAt = uint64(block.timestamp);
        wager.status = BetTypes420.WagerStatus.ACCEPTED;
        _wagers[wager.wagerId] = wager;

        emit WagerAccepted(
            wager.wagerId,
            wager.player,
            wager.gameVersionId,
            wager.operatorId,
            wager.vaultId,
            wager.asset,
            wager.stake,
            wager.maxGrossPayout,
            wager.paramsHash,
            wager.acceptedAt,
            wager.deadline
        );
    }

    function recordSettlement(bytes32 wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout)
        external
        returns (bool created)
    {
        BetTypes420.Wager storage wager = _wagers[wagerId];
        if (wager.wagerId == bytes32(0)) revert NotFound();
        if (outcome == BetTypes420.TerminalOutcome.NONE || grossPayout > wager.maxGrossPayout) revert InvalidSettlement();
        BetTypes420.Settlement storage prior = _settlements[wagerId];
        if (prior.wagerId != bytes32(0)) {
            if (prior.outcome == outcome && prior.grossPayout == grossPayout) return false;
            revert AlreadySettled();
        }
        if (
            !authorization.isAuthorized(
                msg.sender,
                BetIds420.ACTION_WAGER_SETTLE_RECORD,
                authorization.scopeForWager(wagerId),
                grossPayout
            )
        ) revert Unauthorized();

        uint64 settledAt = uint64(block.timestamp);
        _settlements[wagerId] = BetTypes420.Settlement(wagerId, outcome, grossPayout, settledAt);
        wager.status = outcome == BetTypes420.TerminalOutcome.VOID
            ? BetTypes420.WagerStatus.VOID
            : BetTypes420.WagerStatus.SETTLED;
        emit WagerSettled(wagerId, outcome, grossPayout, settledAt);
        return true;
    }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        wager = _wagers[wagerId];
        if (wager.wagerId == bytes32(0)) revert NotFound();
    }

    function getSettlement(bytes32 wagerId) external view returns (BetTypes420.Settlement memory settlement) {
        settlement = _settlements[wagerId];
        if (settlement.wagerId == bytes32(0)) revert NotFound();
    }

    function settlementExists(bytes32 wagerId) external view returns (bool) {
        return _settlements[wagerId].wagerId != bytes32(0);
    }

    function exists(bytes32 wagerId) external view returns (bool) {
        return _wagers[wagerId].wagerId != bytes32(0);
    }
}
