// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IReplayProtection420 {
    function nonce(address actor,bytes32 domain) external view returns(uint256);
    function isConsumed(bytes32 objectId) external view returns(bool);
    function objectDomain(bytes32 objectId) external view returns(bytes32);
}
