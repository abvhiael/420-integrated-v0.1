// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./TreasuryVaultBinding420.sol";
import "./TreasuryIds420.sol";

/// @notice Noncustodial, capability-scoped executor for the adopted commitment-only model.
/// @dev Deployment is an explicit governed candidate selection. No Registry/service ID or
///      Treasury write-authority changes. Its operator and Registry are immutable; both
///      Treasury and Vault must independently authorize this executor contract.
contract TreasuryReleaseExecutor420 {
    bytes32 public constant RELEASE_DOMAIN = keccak256("420/TREASURY/VAULT_RELEASE_COMMITMENT/V1");
    bytes32 public constant OPERATION_DOMAIN = keccak256("420/TREASURY/VAULT_RELEASE_OPERATION/V1");

    struct ReleaseEvidence {
        uint256 chainId;
        address protocolRegistry;
        address treasuryRouter;
        uint32 treasuryVersion;
        address vaultRouter;
        uint32 vaultVersion;
        address disbursementRegistry;
        address budgetRegistry;
        address vaultAccounting;
        bytes32 disbursementId;
        bytes32 budgetId;
        bytes32 vaultId;
        address vault;
        bytes32 vaultCodeHash;
        address asset;
        address recipient;
        uint128 amount;
        bytes32 civicActionHash;
        bytes32 purposeHash;
        address executor;
        address operator;
        bytes32 operationId;
    }

    ProtocolRegistry public immutable registry;
    address public immutable operator;
    uint256 private _entered;

    /// @notice Cumulative completed payments keyed by Treasury registry, budget and asset.
    mapping(address => mapping(bytes32 => mapping(address => uint256))) public paidByBudgetAsset;

    error InvalidConfiguration();
    error UnauthorizedOperator();
    error UnauthorizedRelease();
    error InvalidReleaseTarget();
    error CommitmentMismatch();
    error ExistingVaultOperation();
    error InvalidReleaseDelta();
    error ServiceBindingChanged();
    error ReentrantExecution();

    // The evidence is the static ABI-encoded ReleaseEvidence tuple. Receipt/block identity
    // is correlated AFTER inclusion: an EVM contract cannot know its own transaction hash.
    event VaultReleaseCommitted(
        bytes32 indexed disbursementId,
        bytes32 indexed operationId,
        bytes32 indexed commitment,
        bytes evidence
    );

    constructor(address registry_, address operator_) {
        if (registry_.code.length == 0 || operator_ == address(0)) revert InvalidConfiguration();
        registry = ProtocolRegistry(registry_);
        operator = operator_;
    }

    function operationId(address disbursementRegistry, bytes32 id) public view returns (bytes32) {
        // Stable across executor/operator rotation, for a given chain and disbursement registry.
        return keccak256(abi.encode(OPERATION_DOMAIN, block.chainid, disbursementRegistry, id));
    }

    function preview(bytes32 id) external view returns (bytes memory evidence, bytes32 commitment) {
        ReleaseEvidence memory e = _load(id);
        return (abi.encode(e), keccak256(abi.encode(RELEASE_DOMAIN, e)));
    }

    /// @notice Execute only the reviewed, current release target, in one transaction.
    /// @dev Expected commitment is a user-review guard, not evidence supplied by an untrusted caller.
    ///      The successful, exact Vault withdrawal precedes markExecuted. Any downstream failure
    ///      rolls the transfer, Vault accounting, operation consumption and Treasury accounting back.
    function execute(bytes32 id, bytes32 expectedCommitment) external returns (bytes32 commitment) {
        if (msg.sender != operator) revert UnauthorizedOperator();
        if (_entered != 0) revert ReentrantExecution();
        _entered = 1;
        ReleaseEvidence memory e = _load(id);
        commitment = keccak256(abi.encode(RELEASE_DOMAIN, e));
        if (commitment != expectedCommitment || commitment == bytes32(0)) revert CommitmentMismatch();

        AssetVault420 vault = AssetVault420(payable(e.vault));
        TreasuryDisbursementRegistry420 disb = TreasuryDisbursementRegistry420(e.disbursementRegistry);
        if (vault.executedOperation(e.operationId)) revert ExistingVaultOperation();
        if (!disb.authorization().isDisbursementAuthorized(
            address(this), id, TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, e.amount
        ) || !vault.authorization().isRouteAuthorized(
            address(this), e.vaultId, VaultIds420.ACTION_WITHDRAW, e.asset, e.recipient, e.amount
        )) revert UnauthorizedRelease();

        VaultAccounting420 accounting = VaultAccounting420(e.vaultAccounting);
        VaultAccounting420.AssetAccounting memory beforeRelease = accounting.getAccounting(e.vaultId, e.asset);
        vault.withdraw(e.operationId, e.asset, e.recipient, e.amount);
        VaultAccounting420.AssetAccounting memory afterRelease = accounting.getAccounting(e.vaultId, e.asset);
        if (
            !vault.executedOperation(e.operationId)
                || afterRelease.recordedBalance + e.amount != beforeRelease.recordedBalance
                || afterRelease.released != beforeRelease.released + e.amount
                || afterRelease.reserved != beforeRelease.reserved
                || afterRelease.claimable != beforeRelease.claimable
        ) revert InvalidReleaseDelta();
        // Recipient/token callbacks must not swap the approved service graph during execution.
        _requireCurrent(ServiceIds420.TREASURY, e.treasuryRouter, e.treasuryVersion);
        _requireCurrent(ServiceIds420.VAULT, e.vaultRouter, e.vaultVersion);
        if (
            e.vault.codehash != e.vaultCodeHash
                || vault.registry().vaultState(e.vaultId) != VaultRegistry420.VaultState.ACTIVE
                || !vault.authorization().isRouteAuthorized(
                    address(this), e.vaultId, VaultIds420.ACTION_WITHDRAW, e.asset, e.recipient, e.amount
                )
        ) revert InvalidReleaseTarget();

        disb.markExecuted(id, commitment);
        paidByBudgetAsset[e.disbursementRegistry][e.budgetId][e.asset] += e.amount;
        emit VaultReleaseCommitted(id, e.operationId, commitment, abi.encode(e));
        _entered = 0;
    }

    function _load(bytes32 id) private view returns (ReleaseEvidence memory e) {
        TreasuryVaultBinding420.ReleaseTarget memory target = TreasuryVaultBinding420.resolveRelease(registry, id);
        ProtocolRegistry.Service memory ts = registry.getService(ServiceIds420.TREASURY);
        ProtocolRegistry.Service memory vs = registry.getService(ServiceIds420.VAULT);
        TreasuryRouter420 router = TreasuryRouter420(ts.implementation);
        TreasuryDisbursementRegistry420 disb = router.disbursements();
        TreasuryDisbursementRegistry420.Disbursement memory d = disb.disbursement(id);
        TreasuryBudgetRegistry420.Budget memory b = router.budgets().budget(d.budgetId);
        if (d.civicActionHash != b.civicActionHash || target.recipient == address(this)
            || id != disb.canonicalId(d.budgetId, d.recipient, d.amount, d.notBefore, d.expiresAt,
                d.civicActionHash, d.purposeHash)) revert InvalidReleaseTarget();

        e.chainId = block.chainid;
        e.protocolRegistry = address(registry);
        e.treasuryRouter = ts.implementation;
        e.treasuryVersion = ts.version;
        e.vaultRouter = vs.implementation;
        e.vaultVersion = vs.version;
        e.disbursementRegistry = address(disb);
        e.budgetRegistry = address(router.budgets());
        e.vaultAccounting = address(target.vault.accounting());
        e.disbursementId = id;
        e.budgetId = d.budgetId;
        e.vaultId = target.vaultId;
        e.vault = address(target.vault);
        e.vaultCodeHash = address(target.vault).codehash;
        e.asset = target.asset;
        e.recipient = target.recipient;
        e.amount = target.amount;
        e.civicActionHash = d.civicActionHash;
        e.purposeHash = d.purposeHash;
        e.executor = address(this);
        e.operator = operator;
        e.operationId = operationId(address(disb), id);
    }

    function _requireCurrent(bytes32 serviceId, address implementation, uint32 version) private view {
        ProtocolRegistry.Service memory s = registry.getService(serviceId);
        if (!s.active || s.version != version || s.implementation != implementation
            || implementation.codehash != s.codeHash) revert ServiceBindingChanged();
    }
}
