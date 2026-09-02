// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";
import "./KenoV1420.sol";

/// @notice Read-only reconstruction surface for the first-party KenoV1 game.
/// @dev This contract has no custody, randomness, settlement, or admin authority.
contract KenoV1View420 is I420System {
    struct Snapshot {
        BetTypes420.Wager wager;
        bool randomnessRequested;
        RandomnessRouter420.RandomnessRequest randomness;
        bool settlementExists;
        BetTypes420.Settlement settlement;
        bool paramsMatch;
        bool resultAvailable;
        KenoV1420.Result result;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
    KenoV1420 public immutable keno;

    error ZeroAddress();
    error DependencyMismatch();

    constructor(address wagerRegistry_, address randomnessRouter_, address keno_) {
        if (wagerRegistry_ == address(0) || randomnessRouter_ == address(0) || keno_ == address(0)) {
            revert ZeroAddress();
        }

        wagerRegistry = BetRegistry420(wagerRegistry_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
        keno = KenoV1420(keno_);

        if (
            address(keno.wagerRegistry()) != wagerRegistry_
                || address(keno.randomnessRouter()) != randomnessRouter_
        ) revert DependencyMismatch();
    }

    function systemName() external pure returns (string memory) { return "KenoV1View420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function snapshot(bytes32 wagerId, KenoV1420.Params calldata params)
        external
        view
        returns (Snapshot memory s)
    {
        s.wager = wagerRegistry.getWager(wagerId);
        s.paramsMatch = keno.hashParams(params) == s.wager.paramsHash;

        try randomnessRouter.getRequest(wagerId) returns (RandomnessRouter420.RandomnessRequest memory r) {
            s.randomnessRequested = true;
            s.randomness = r;
        } catch {}

        s.settlementExists = wagerRegistry.settlementExists(wagerId);
        if (s.settlementExists) s.settlement = wagerRegistry.getSettlement(wagerId);

        if (s.paramsMatch && s.randomness.fulfilled) {
            try keno.resolve(wagerId, params) returns (KenoV1420.Result memory result) {
                s.resultAvailable = true;
                s.result = result;
            } catch {}
        }
    }
}
