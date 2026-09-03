// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./DiceV1420.sol";
import "./RandomnessRouter420.sol";

contract DiceV1View420 is I420System {
    struct Snapshot {
        BetTypes420.Wager wager;
        bool randomnessRequested;
        RandomnessRouter420.RandomnessRequest randomness;
        bool settlementExists;
        BetTypes420.Settlement settlement;
        bool paramsMatch;
        bool resultAvailable;
        DiceV1420.Result result;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
    DiceV1420 public immutable dice;

    error ZeroAddress();
    error DependencyMismatch();

    constructor(address wagerRegistry_, address randomnessRouter_, address dice_) {
        if (wagerRegistry_ == address(0) || randomnessRouter_ == address(0) || dice_ == address(0)) revert ZeroAddress();

        wagerRegistry = BetRegistry420(wagerRegistry_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
        dice = DiceV1420(dice_);

        if (address(dice.wagerRegistry()) != wagerRegistry_ || address(dice.randomnessRouter()) != randomnessRouter_) {
            revert DependencyMismatch();
        }
    }

    function systemName() external pure returns (string memory) { return "DiceV1View420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function snapshot(bytes32 wagerId, DiceV1420.Params calldata params) external view returns (Snapshot memory s) {
        s.wager = wagerRegistry.getWager(wagerId);
        s.paramsMatch = dice.hashParams(params) == s.wager.paramsHash;

        try randomnessRouter.getRequest(wagerId) returns (RandomnessRouter420.RandomnessRequest memory r) {
            s.randomnessRequested = true;
            s.randomness = r;
        } catch {}

        s.settlementExists = wagerRegistry.settlementExists(wagerId);
        if (s.settlementExists) s.settlement = wagerRegistry.getSettlement(wagerId);

        if (s.paramsMatch && s.randomness.fulfilled) {
            try dice.resolve(wagerId, params) returns (DiceV1420.Result memory result) {
                s.resultAvailable = true;
                s.result = result;
            } catch {}
        }
    }
}
