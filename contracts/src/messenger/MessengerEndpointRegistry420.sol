// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./MessengerIds420.sol";
import "./MessengerAuthorization420.sol";

contract MessengerEndpointRegistry420 is I420System {
    struct Endpoint { bytes32 keyPackageHash; bytes32 transportHash; uint64 revision; bool active; }
    MessengerAuthorization420 public immutable authorization;
    mapping(address => Endpoint) private _endpoints;

    error ZeroAddress();
    error UnauthorizedEndpoint();
    error InvalidEndpoint();
    event EndpointUpdated(address indexed account, bytes32 keyPackageHash, bytes32 transportHash, uint64 revision);
    event EndpointDeactivated(address indexed account, uint64 revision);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = MessengerAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "MessengerEndpointRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setEndpoint(address account, bytes32 keyPackageHash, bytes32 transportHash) external {
        if (!_can(account, MessengerIds420.ACTION_MANAGE_ENDPOINT)) revert UnauthorizedEndpoint();
        if (account == address(0) || keyPackageHash == bytes32(0) || transportHash == bytes32(0)) revert InvalidEndpoint();
        Endpoint storage e = _endpoints[account];
        e.keyPackageHash = keyPackageHash;
        e.transportHash = transportHash;
        e.revision += 1;
        e.active = true;
        emit EndpointUpdated(account, keyPackageHash, transportHash, e.revision);
    }

    function deactivate(address account) external {
        if (!_can(account, MessengerIds420.ACTION_MANAGE_ENDPOINT)) revert UnauthorizedEndpoint();
        Endpoint storage e = _endpoints[account];
        if (!e.active) revert InvalidEndpoint();
        e.active = false;
        e.revision += 1;
        emit EndpointDeactivated(account, e.revision);
    }

    function endpoint(address account) external view returns (Endpoint memory) { return _endpoints[account]; }
    function isActive(address account) external view returns (bool) { return _endpoints[account].active; }

    function _can(address account, bytes32 actionId) private view returns (bool) {
        return msg.sender == account || authorization.isAuthorized(msg.sender, account, actionId);
    }
}
