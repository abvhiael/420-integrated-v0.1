// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

contract TreasuryPolicyRegistry420 is I420System, SystemAccess {
    struct AssetPolicy {
        bool allowed;
        uint128 maxSingleDisbursement;
        uint128 maxEpochDisbursement;
        uint64 epochSeconds;
        uint32 revision;
    }

    mapping(address => AssetPolicy) private _assetPolicies;
    address public immutable genesisConfigurator;
    address public foundingAuthority;

    error EpochDurationImmutable();

    event AssetPolicySet(
        address indexed asset,
        bool allowed,
        uint128 maxSingleDisbursement,
        uint128 maxEpochDisbursement,
        uint64 epochSeconds,
        uint32 revision
    );

    constructor(
        address timelock_
    ) SystemAccess(timelock_) { genesisConfigurator = msg.sender; }

    function systemName() external pure returns (string memory) {
        return "TreasuryPolicyRegistry420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Genesis-only founding policy for native $420. This is not a free-form policy setter.
    function bindFoundingAuthority(address candidate) external {
        if (msg.sender != genesisConfigurator || foundingAuthority != address(0)
            || candidate.code.length == 0) revert Unauthorized();
        (bool ok, bytes memory data) = candidate.staticcall(abi.encodeWithSignature("policyRegistry()"));
        if (!ok || data.length != 32 || abi.decode(data, (address)) != address(this)) revert Unauthorized();
        foundingAuthority = candidate;
    }

    function initializeFoundingNativePolicy() external {
        if (msg.sender != foundingAuthority || foundingAuthority == address(0)) revert Unauthorized();
        (bool ok, bytes memory data) = foundingAuthority.staticcall(abi.encodeWithSignature("retired()"));
        if (!ok || data.length != 32 || abi.decode(data, (bool))) revert Unauthorized();
        AssetPolicy storage p = _assetPolicies[address(0)];
        if (p.revision != 0) revert EpochDurationImmutable();
        p.allowed = true;
        p.maxSingleDisbursement = 420_000 ether;
        p.maxEpochDisbursement = 1_260_000 ether;
        p.epochSeconds = 30 days;
        p.revision = 1;
        emit AssetPolicySet(address(0), true, p.maxSingleDisbursement, p.maxEpochDisbursement, p.epochSeconds, 1);
    }

    function setAssetPolicy(
        address asset,
        bool allowed,
        uint128 maxSingle,
        uint128 maxEpoch,
        uint64 epochSeconds
    ) external onlyGovernance {
        // address(0) is the canonical native $420 asset, not an uninitialized policy.
        // All assets (including native) remain default-deny until governance allows them.
        require(maxSingle > 0 && maxEpoch >= maxSingle && epochSeconds > 0, "policy");

        AssetPolicy storage p = _assetPolicies[asset];
        if (p.revision != 0 && p.epochSeconds != epochSeconds) revert EpochDurationImmutable();

        p.allowed = allowed;
        p.maxSingleDisbursement = maxSingle;
        p.maxEpochDisbursement = maxEpoch;
        p.epochSeconds = epochSeconds;
        p.revision += 1;

        emit AssetPolicySet(asset, allowed, maxSingle, maxEpoch, epochSeconds, p.revision);
    }

    function assetPolicy(
        address asset
    ) external view returns (AssetPolicy memory) {
        return _assetPolicies[asset];
    }

    function isAllowed(
        address asset,
        uint256 amount
    ) external view returns (bool) {
        AssetPolicy memory p = _assetPolicies[asset];
        return p.allowed && amount > 0 && amount <= p.maxSingleDisbursement;
    }
}
