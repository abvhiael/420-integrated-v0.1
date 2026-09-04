// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

/// @notice Canonical read-only binding surface shared by first-party 420Bet casino game modules.
/// @dev Game-specific parameter encoding and resolution remain versioned behind each module.
///      This interface deliberately exposes no custody, randomness fulfillment, wager mutation,
///      settlement, lifecycle, or administrative authority.
interface ICasinoGame420 is I420System {
    function gameId() external view returns (bytes32);
    function gameVersionId() external view returns (bytes32);
    function rulesetId() external view returns (bytes32);
}
