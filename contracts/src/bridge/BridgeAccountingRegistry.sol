// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/ICanonicalAssetRegistry420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./BridgeIds420.sol";

/// @notice Canonical bridge supply reconciliation evidence.
/// @dev This registry records observed/authorized supply; it does not mint, burn, or repair balances.
contract BridgeAccountingRegistry is GenesisResidentAccess420 {
    enum HealthState { UNKNOWN, HEALTHY, AUTHORIZED_EXCEEDS_OBSERVED, OBSERVED_EXCEEDS_AUTHORIZED }

    struct Reconciliation {
        uint256 authorizedSupply;
        uint256 observedSupply;
        uint64 observedAt;
        bytes32 evidenceHash;
        bool healthy;
    }

    mapping(bytes32 => Reconciliation) public reconciliations;
    mapping(bytes32 => bool) public usedEvidenceHash;

    event Reconciled(
        bytes32 indexed assetId,
        uint256 authorizedSupply,
        uint256 observedSupply,
        bool healthy,
        bytes32 evidenceHash
    );
    event ReconciliationHealth(bytes32 indexed assetId, HealthState indexed state, uint64 observedAt, bytes32 evidenceHash);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return BridgeIds420.ACCOUNTING_REGISTRY; }

    function applyReconciliation(
        bytes32 assetId,
        uint256 authorizedSupply,
        uint256 observedSupply,
        uint64 observedAt,
        bytes32 evidenceHash
    ) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_RECONCILE);
        _requireOperational(
            BridgeIds420.ACTION_RECONCILE,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.NONE
        );
        require(assetId != bytes32(0) && evidenceHash != bytes32(0), "invalid");
        require(!usedEvidenceHash[evidenceHash], "evidence replay");
        require(observedAt > 0 && observedAt <= block.timestamp, "observation time");
        Reconciliation storage previous = reconciliations[assetId];
        require(previous.observedAt == 0 || observedAt > previous.observedAt, "stale observation");
        ICanonicalAssetRegistry420 assets = ICanonicalAssetRegistry420(
            _resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY)
        );
        require(assets.isCanonical(assetId), "noncanonical asset");

        bool healthy = authorizedSupply == observedSupply;
        usedEvidenceHash[evidenceHash] = true;
        reconciliations[assetId] = Reconciliation(
            authorizedSupply, observedSupply, observedAt, evidenceHash, healthy
        );
        emit Reconciled(assetId, authorizedSupply, observedSupply, healthy, evidenceHash);
        emit ReconciliationHealth(assetId, healthState(assetId), observedAt, evidenceHash);
    }

    function healthState(bytes32 assetId) public view returns (HealthState) {
        Reconciliation memory reconciliation = reconciliations[assetId];
        if (reconciliation.observedAt == 0) return HealthState.UNKNOWN;
        if (reconciliation.authorizedSupply == reconciliation.observedSupply) return HealthState.HEALTHY;
        if (reconciliation.authorizedSupply > reconciliation.observedSupply) {
            return HealthState.AUTHORIZED_EXCEEDS_OBSERVED;
        }
        return HealthState.OBSERVED_EXCEEDS_AUTHORIZED;
    }

    function movementHealthy(bytes32 assetId) external view returns (bool) {
        return healthState(assetId) == HealthState.HEALTHY;
    }
}
