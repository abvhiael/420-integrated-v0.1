// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";
interface IPauseRegistry420 {
    event PauseChanged(bytes32 indexed scopeId,Types420.Direction direction,bool paused,bytes32 reasonHash);
    function isPaused(bytes32 scopeId,Types420.Direction direction) external view returns (bool);
    function requireNotPaused(bytes32 scopeId,Types420.Direction direction) external view;
}
