// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./Types420.sol";
interface IGovernanceAuthority420 {
    function governanceClass(bytes32 actionId) external view returns (Types420.GovernanceClass);
    function isAuthorized(address caller,bytes32 actionId) external view returns (bool);
    function timelockSatisfied(bytes32 actionId) external view returns (bool);
    function emergencyCouncilAuthorized(address caller,bytes32 actionId) external view returns (bool);
}
