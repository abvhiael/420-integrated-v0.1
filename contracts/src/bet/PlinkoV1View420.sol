// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";
import "./PlinkoV1420.sol";

/// @notice Read-only reconstruction surface for the first-party PlinkoV1 game.
/// @dev This contract has no custody, randomness, settlement, or admin authority.
contract PlinkoV1View420 is I420System {
    struct Snapshot {
        BetTypes420.Wager wager;
        bool randomnessRequested;
        RandomnessRouter420.RandomnessRequest randomness;
        bool settlementExists;
        BetTypes420.Settlement settlement;
        bool paramsMatch;
        bool resultAvailable;
        PlinkoV1420.Result result;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
    PlinkoV1420 public immutable plinko;

    error ZeroAddress();
    error DependencyMismatch();

    constructor(address wagerRegistry_, address randomnessRouter_, address plinko_) {
        if (wagerRegistry_ == address(0) || randomnessRouter_ == address(0) || plinko_ == address(0)) {
            revert ZeroAddress();
        }

        wagerRegistry = BetRegistry420(wagerRegistry_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
        plinko = PlinkoV1420(plinko_);

        if (
            address(plinko.wagerRegistry()) != wagerRegistry_
                || address(plinko.randomnessRouter()) != randomnessRouter_
        ) revert DependencyMismatch();
    }

    function systemName() external pure returns (string memory) { return "PlinkoV1View420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function snapshot(bytes32 wagerId, PlinkoV1420.Params calldata params)
        external
        view
        returns (Snapshot memory s)
    {
        s.wager = wagerRegistry.getWager(wagerId);
        s.paramsMatch = plinko.hashParams(params) == s.wager.paramsHash;

        try randomnessRouter.getRequest(wagerId) returns (RandomnessRouter420.RandomnessRequest memory r) {
            s.randomnessRequested = true;
            s.randomness = r;
        } catch {}

        s.settlementExists = wagerRegistry.settlementExists(wagerId);
        if (s.settlementExists) s.settlement = wagerRegistry.getSettlement(wagerId);

        if (s.paramsMatch && s.randomness.fulfilled) {
            try plinko.resolve(wagerId, params) returns (PlinkoV1420.Result memory result) {
                s.resultAvailable = true;
                s.result = result;
            } catch {}
        }
    }
}
