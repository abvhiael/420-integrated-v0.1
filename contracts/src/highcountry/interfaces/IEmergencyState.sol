// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IEmergencyState {
    event EmergencyRestrictionChanged(bytes32 indexed domain, bool restricted);

    function isAllowedDomain(bytes32 domain) external pure returns (bool);
    function isRestricted(bytes32 domain) external view returns (bool);
    function setRestricted(bytes32 domain, bool restricted) external;
}
