// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";
import "./ReferenceSlotV1420.sol";

/// @notice Read-only reconstruction surface for the first-party Reference SlotV1 game.
/// @dev This contract has no custody, randomness, settlement, or admin authority.
contract ReferenceSlotV1View420 is I420System {
    struct Snapshot {
        BetTypes420.Wager wager;
        bool randomnessRequested;
        RandomnessRouter420.RandomnessRequest randomness;
        bool settlementExists;
        BetTypes420.Settlement settlement;
        bool paramsMatch;
        bool resultAvailable;
        ReferenceSlotV1420.Result result;
    }

    BetRegistry420 public immutable wagerRegistry;
    RandomnessRouter420 public immutable randomnessRouter;
    ReferenceSlotV1420 public immutable slot;

    error ZeroAddress();
    error DependencyMismatch();

    constructor(address wagerRegistry_, address randomnessRouter_, address slot_) {
        if (wagerRegistry_ == address(0) || randomnessRouter_ == address(0) || slot_ == address(0)) revert ZeroAddress();
        wagerRegistry = BetRegistry420(wagerRegistry_);
        randomnessRouter = RandomnessRouter420(randomnessRouter_);
        slot = ReferenceSlotV1420(slot_);
        if (address(slot.wagerRegistry()) != wagerRegistry_ || address(slot.randomnessRouter()) != randomnessRouter_) {
            revert DependencyMismatch();
        }
    }

    function systemName() external pure returns (string memory) { return "ReferenceSlotV1View420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function snapshot(bytes32 wagerId, ReferenceSlotV1420.Params calldata params)
        external
        view
        returns (Snapshot memory s)
    {
        s.wager = wagerRegistry.getWager(wagerId);
        s.paramsMatch = slot.hashParams(params) == s.wager.paramsHash;

        try randomnessRouter.getRequest(wagerId) returns (RandomnessRouter420.RandomnessRequest memory r) {
            s.randomnessRequested = true;
            s.randomness = r;
        } catch {}

        s.settlementExists = wagerRegistry.settlementExists(wagerId);
        if (s.settlementExists) s.settlement = wagerRegistry.getSettlement(wagerId);

        if (s.paramsMatch && s.randomness.fulfilled) {
            try slot.resolve(wagerId, params) returns (ReferenceSlotV1420.Result memory result) {
                s.resultAvailable = true;
                s.result = result;
            } catch {}
        }
    }
}
