// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./ResourceIds420.sol";

contract ResourcePolicyRegistry420 is SystemAccess, I420System {
    struct Policy { bytes32 termsHash; uint64 maxSessionSeconds; uint128 maxUnits; uint32 revision; bool active; bool exists; }
    mapping(bytes32 => Policy) private _policies;
    error InvalidPolicy(); error PolicyNotFound();
    event PolicyConfigured(bytes32 indexed serviceId, bytes32 termsHash, uint64 maxSessionSeconds, uint128 maxUnits, uint32 revision, bool active);
    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "ResourcePolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function setPolicy(bytes32 serviceId, bytes32 termsHash, uint64 maxSessionSeconds, uint128 maxUnits, bool active) external onlyGovernance {
        if (!ResourceIds420.isService(serviceId) || termsHash == bytes32(0) || maxSessionSeconds == 0 || maxUnits == 0) revert InvalidPolicy();
        Policy storage p = _policies[serviceId]; p.termsHash=termsHash; p.maxSessionSeconds=maxSessionSeconds; p.maxUnits=maxUnits; p.revision=p.exists?p.revision+1:1; p.active=active; p.exists=true;
        emit PolicyConfigured(serviceId,termsHash,maxSessionSeconds,maxUnits,p.revision,active);
    }
    function getPolicy(bytes32 serviceId) external view returns (Policy memory p) { p=_policies[serviceId]; if(!p.exists) revert PolicyNotFound(); }
    function isActive(bytes32 serviceId) external view returns (bool) { return _policies[serviceId].exists && _policies[serviceId].active; }
}
