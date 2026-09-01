// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./BetTypes420.sol";

/// @notice Narrow, capability-scoped emergency state for 420Bet.
/// @dev Emergency state is prospective. Consumers must not use it to disable
///      fulfilment, liability release, withdrawal claims, or refund/VOID paths.
contract BetEmergencyState420 is I420System {
    BetAuthorization420 public immutable authorization;

    mapping(bytes32 => bool) private _halted;

    error ZeroAddress();
    error InvalidDomain();
    error InvalidSubject();
    error Unauthorized();
    error NoStateChange();

    event EmergencyStateSet(
        BetTypes420.EmergencyDomain indexed domain,
        bytes32 indexed subject,
        bool halted,
        address indexed actor
    );

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "BetEmergencyState420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setEmergency(BetTypes420.EmergencyDomain domain, bytes32 subject, bool halted) external {
        _validate(domain, subject);
        bytes32 scope = authorization.scopeForEmergency(domain, subject);
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_EMERGENCY_SET, scope, 0)) revert Unauthorized();

        bytes32 key = emergencyKey(domain, subject);
        if (_halted[key] == halted) revert NoStateChange();
        _halted[key] = halted;
        emit EmergencyStateSet(domain, subject, halted, msg.sender);
    }

    function isHalted(BetTypes420.EmergencyDomain domain, bytes32 subject) public view returns (bool) {
        _validate(domain, subject);
        return _halted[emergencyKey(domain, subject)];
    }

    function emergencyKey(BetTypes420.EmergencyDomain domain, bytes32 subject) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.EMERGENCY.V1", domain, subject));
    }

    function _validate(BetTypes420.EmergencyDomain domain, bytes32 subject) private pure {
        if (domain == BetTypes420.EmergencyDomain.NONE) revert InvalidDomain();

        bool globalDomain = domain == BetTypes420.EmergencyDomain.NEW_WAGERS;
        if (globalDomain) {
            if (subject != bytes32(0)) revert InvalidSubject();
            return;
        }
        if (subject == bytes32(0)) revert InvalidSubject();
    }
}
