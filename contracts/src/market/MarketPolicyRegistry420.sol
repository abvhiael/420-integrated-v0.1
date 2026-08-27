// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./MarketIds420.sol";

/// @notice Governance-curated policy and adapter registry for the universal 420 Market protocol.
/// @dev This contract defines admissible protocol integrations; it does not custody funds or assets.
contract MarketPolicyRegistry420 is SystemAccess, I420System {
    struct Policy {
        bytes32 metadataHash;
        bytes32 requiredCredentialType;
        uint8 minimumTrustClass;
        bool active;
    }

    struct SettlementAdapter {
        address adapter;
        bytes32 serviceId;
        bytes32 metadataHash;
        bool active;
    }

    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => SettlementAdapter) public settlementAdapters;

    error InvalidPolicyId();
    error InvalidAdapterId();
    error InvalidAdapter();
    error InvalidTrustClass();

    event PolicySet(
        bytes32 indexed policyId,
        bytes32 metadataHash,
        bytes32 requiredCredentialType,
        uint8 minimumTrustClass,
        bool active
    );
    event SettlementAdapterSet(
        bytes32 indexed adapterId,
        address indexed adapter,
        bytes32 indexed serviceId,
        bytes32 metadataHash,
        bool active
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "MarketPolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setPolicy(
        bytes32 policyId,
        bytes32 metadataHash,
        bytes32 requiredCredentialType,
        uint8 minimumTrustClass,
        bool active
    ) external onlyGovernance {
        if (policyId == bytes32(0)) revert InvalidPolicyId();
        if (minimumTrustClass > 4) revert InvalidTrustClass();
        policies[policyId] = Policy(metadataHash, requiredCredentialType, minimumTrustClass, active);
        emit PolicySet(policyId, metadataHash, requiredCredentialType, minimumTrustClass, active);
    }

    function setSettlementAdapter(
        bytes32 adapterId,
        address adapter,
        bytes32 serviceId,
        bytes32 metadataHash,
        bool active
    ) external onlyGovernance {
        if (adapterId == bytes32(0)) revert InvalidAdapterId();
        if (adapter == address(0)) revert InvalidAdapter();
        settlementAdapters[adapterId] = SettlementAdapter(adapter, serviceId, metadataHash, active);
        emit SettlementAdapterSet(adapterId, adapter, serviceId, metadataHash, active);
    }

    function policyActive(bytes32 policyId) external view returns (bool) {
        return policies[policyId].active;
    }

    function settlementAdapterActive(bytes32 adapterId) external view returns (bool) {
        return settlementAdapters[adapterId].active;
    }

    function isSettlementReporter(bytes32 adapterId, address reporter) external view returns (bool) {
        SettlementAdapter memory adapter = settlementAdapters[adapterId];
        return adapter.active && adapter.adapter == reporter;
    }
}
