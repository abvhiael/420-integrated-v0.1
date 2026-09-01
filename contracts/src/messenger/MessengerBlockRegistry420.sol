// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./MessengerIds420.sol";
import "./MessengerAuthorization420.sol";

contract MessengerBlockRegistry420 is I420System {
    MessengerAuthorization420 public immutable authorization;
    mapping(address => mapping(address => bool)) public blocked;

    error ZeroAddress();
    error UnauthorizedBlock();
    error InvalidPeer();
    event BlockStatusChanged(address indexed account, address indexed peer, bool blockedStatus);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = MessengerAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "MessengerBlockRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setBlocked(address account, address peer, bool status) external {
        if (msg.sender != account && !authorization.isAuthorized(msg.sender, account, MessengerIds420.ACTION_SET_BLOCK)) revert UnauthorizedBlock();
        if (account == address(0) || peer == address(0) || account == peer) revert InvalidPeer();
        blocked[account][peer] = status;
        emit BlockStatusChanged(account, peer, status);
    }
}
