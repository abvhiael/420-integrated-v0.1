// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";

/// @notice Narrow exchange-specific emergency controls. No custody or confiscation authority.
contract ExchangeEmergencyControl420 is SystemAccess {
    enum Domain {
        NONE,
        SWAPS,
        LIMIT_ORDERS,
        BRIDGE_DEPOSITS,
        BRIDGE_WITHDRAWALS,
        MARKET_ACTIVATION,
        FEE_ROUTING
    }

    mapping(Domain => bool) public halted;
    mapping(Domain => bytes32) public incidentHash;

    event DomainHaltSet(Domain indexed domain, bool halted, bytes32 indexed incidentHash);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function setHalt(Domain domain, bool value, bytes32 incident) external onlyGovernance {
        require(domain != Domain.NONE, "domain");
        if (value) require(incident != bytes32(0), "incident");
        halted[domain] = value;
        incidentHash[domain] = value ? incident : bytes32(0);
        emit DomainHaltSet(domain, value, incidentHash[domain]);
    }

    function requireOpen(Domain domain) external view {
        require(!halted[domain], "exchange halted");
    }
}
