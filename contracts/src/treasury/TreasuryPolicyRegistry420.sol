// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

contract TreasuryPolicyRegistry420 is I420System, SystemAccess {
    struct AssetPolicy { bool allowed; uint128 maxSingleDisbursement; uint128 maxEpochDisbursement; uint64 epochSeconds; uint32 revision; }
    mapping(address => AssetPolicy) private _assetPolicies;
    event AssetPolicySet(address indexed asset, bool allowed, uint128 maxSingleDisbursement, uint128 maxEpochDisbursement, uint64 epochSeconds, uint32 revision);
    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "TreasuryPolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function setAssetPolicy(address asset, bool allowed, uint128 maxSingle, uint128 maxEpoch, uint64 epochSeconds) external onlyGovernance {
        require(asset != address(0) && maxSingle > 0 && maxEpoch >= maxSingle && epochSeconds > 0, "policy");
        AssetPolicy storage p = _assetPolicies[asset]; p.allowed = allowed; p.maxSingleDisbursement = maxSingle; p.maxEpochDisbursement = maxEpoch; p.epochSeconds = epochSeconds; p.revision += 1;
        emit AssetPolicySet(asset, allowed, maxSingle, maxEpoch, epochSeconds, p.revision);
    }
    function assetPolicy(address asset) external view returns (AssetPolicy memory) { return _assetPolicies[asset]; }
    function isAllowed(address asset, uint256 amount) external view returns (bool) { AssetPolicy memory p = _assetPolicies[asset]; return p.allowed && amount > 0 && amount <= p.maxSingleDisbursement; }
}
