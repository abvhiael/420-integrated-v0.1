// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";

contract DiceV1420 is I420System {
    uint16 public constant ROLL_SCALE = 10_000;
    bytes32 public constant PARAMS_DOMAIN = keccak256("420.BET.DICE.V1.PARAMS");
    bytes32 public constant ROLL_DOMAIN = keccak256("420.BET.DICE.V1.ROLL");

    struct Params {
        bool rollUnder;
        uint16 threshold;
        uint256 winGrossPayout;
    }

    struct Result {
        bytes32 wagerId;
        uint16 roll;
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

    function systemName() external pure returns (string memory) { return "DiceV1420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function hashParams(Params memory params) public view returns (bytes32) {
        _validateParams(params);
        return keccak256(abi.encode(PARAMS_DOMAIN, gameVersionId, rulesetId, params.rollUnder, params.threshold, params.winGrossPayout));
    }

    function resolve(bytes32 wagerId, Params calldata params) external view returns (Result memory result) {
        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        if (wager.gameId != gameId || wager.gameVersionId != gameVersionId) revert WrongGame();
        if (wager.rulesetId != rulesetId) revert WrongRuleset();
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED && wager.status != BetTypes420.WagerStatus.OUTCOME_READY) {
            revert InvalidWagerStatus();
        }

        bytes32 paramsHash = hashParams(params);
        if (paramsHash != wager.paramsHash) revert ParamsMismatch();
        if (params.winGrossPayout <= wager.stake || params.winGrossPayout > wager.maxGrossPayout) revert InvalidPayout();

        bytes32 root = randomnessRouter.rootOf(wagerId);
        uint16 roll = uint16((uint256(keccak256(abi.encode(ROLL_DOMAIN, wagerId, gameVersionId, rulesetId, root))) % ROLL_SCALE) + 1);
        bool won = params.rollUnder ? roll <= params.threshold : roll > params.threshold;

        result = Result({
            wagerId: wagerId,
            roll: roll,
            outcome: won ? BetTypes420.TerminalOutcome.WIN : BetTypes420.TerminalOutcome.LOSS,
            grossPayout: won ? params.winGrossPayout : 0,
            paramsHash: paramsHash,
            randomnessRoot: root
        });
    }

    function _validateParams(Params memory params) private pure {
        if (params.threshold == 0 || params.threshold >= ROLL_SCALE || params.winGrossPayout == 0) revert InvalidParams();
    }
}
