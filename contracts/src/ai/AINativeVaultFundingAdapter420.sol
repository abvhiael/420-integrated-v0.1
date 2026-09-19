// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./AIJobManager.sol";
import "./AIProviderRegistry.sol";
import "./AIJobEscrow.sol";
import "../vault/AssetVault420.sol";
import "../vault/VaultAccounting420.sol";

/// @notice Native-asset, direct-payer funding. No relayers, signatures, ERC-20 or existing-deposit imports.
/// @dev Governance must bind this adapter to AIJobEscrow and grant this adapter only the
/// ACTION_CREATE_OBLIGATION capability for the approved Vault. Never grant generic withdrawal.
/// This adapter cannot settle or refund, and MUST NOT be deployed against an unverified manifest.
contract AINativeVaultFundingAdapter420 {
    AIJobManager public immutable manager;
    AIProviderRegistry public immutable providers;
    AIJobEscrow public immutable escrow;
    AssetVault420 public immutable vault;
    VaultAccounting420 public immutable accounting;
    bytes32 public immutable vaultRef;

    mapping(bytes32 => bool) public consumedJob;
    mapping(address => mapping(bytes32 => bool)) public consumedNonce;
    mapping(bytes32 => bytes32) public obligationForJob;
    mapping(bytes32 => bytes32) public depositOperationForJob;
    uint256 private _entered;

    error InvalidConfiguration();
    error InvalidFunding();
    error UnauthorizedPayer();
    error UnqualifiedProvider();
    error FundingReplay();
    error Reentrancy();
    error DirectTransferDisabled();

    event NativeJobFunded(
        bytes32 indexed jobId, address indexed payer, bytes32 indexed obligationId,
        bytes32 fundingRef, bytes32 operationId, bytes32 providerId, address beneficiary, uint256 amount
    );

    constructor(address manager_, address providers_, address escrow_, address payable vault_, bytes32 vaultRef_) {
        if (manager_ == address(0) || providers_ == address(0) || escrow_ == address(0)
            || vault_ == address(0) || vaultRef_ == bytes32(0)) revert InvalidConfiguration();
        manager = AIJobManager(manager_);
        providers = AIProviderRegistry(providers_);
        escrow = AIJobEscrow(payable(escrow_));
        vault = AssetVault420(vault_);
        accounting = vault.accounting();
        vaultRef = vaultRef_;
        if (escrow.AI_JOB_MANAGER() != manager_ || vault.vaultId() != vaultRef_
            || address(accounting) == address(0) || address(vault.registry()) == address(0)
            || address(vault.authorization()) == address(0)) revert InvalidConfiguration();
    }

    /// @notice The payer explicitly approves one transaction with msg.value. All custody,
    /// obligation, and escrow changes happen in this same EVM transaction or none happen.
    /// @param nonce Unique payer-chosen nonce, consumed only on successful completion.
    function fundNative(bytes32 jobId, bytes32 providerId, bytes32 nonce) external payable {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        if (jobId == bytes32(0) || providerId == bytes32(0) || nonce == bytes32(0)
            || msg.value == 0 || consumedJob[jobId] || consumedNonce[msg.sender][nonce]) revert FundingReplay();
        AIJobManager.Job memory job = manager.getJob(jobId);
        if (job.requester != msg.sender) revert UnauthorizedPayer();
        if (job.status != AIJobManager.Status.CREATED || block.timestamp > job.deadline
            || msg.value > job.maxSpend || job.fundedAmount != 0) revert InvalidFunding();
        AIProviderRegistry.Provider memory provider = providers.getProvider(providerId);
        if (!provider.exists || provider.state != AIProviderRegistry.ProviderState.ACTIVE
            || provider.stakeRef == bytes32(0) || provider.settlementAccount == address(0)) revert UnqualifiedProvider();
        if (!escrow.vaultAdapterBound() || escrow.vaultAdapter() != address(this)) revert InvalidConfiguration();

        bytes32 fundingRef = keccak256(abi.encode(block.chainid, address(this), jobId, msg.sender, nonce));
        bytes32 obligationId = keccak256(abi.encode("420AI_NATIVE_OBLIGATION_V1", fundingRef));
        bytes32 operationId = keccak256(abi.encode("420AI_NATIVE_CREATE_V1", fundingRef));
        consumedJob[jobId] = true;
        consumedNonce[msg.sender][nonce] = true;
        obligationForJob[jobId] = obligationId;
        depositOperationForJob[jobId] = operationId;

        // Deposit precedes reservation: one payer-supplied amount is reserved for exactly one job.
        vault.depositNative{value: msg.value}();
        vault.createObligation(operationId, obligationId, address(0), provider.settlementAccount,
            msg.value, keccak256("420AI_NATIVE_JOB_V1"), fundingRef);
        VaultAccounting420.Obligation memory reserved = accounting.getObligation(obligationId);
        if (!reserved.exists || reserved.state != 1 || reserved.vaultId != vaultRef
            || reserved.asset != address(0) || reserved.beneficiary != provider.settlementAccount
            || reserved.amount != msg.value || reserved.sourceRef != fundingRef) revert InvalidFunding();
        escrow.confirmVaultFunding(jobId, msg.sender, providerId, provider.settlementAccount,
            vaultRef, fundingRef, msg.value);
        emit NativeJobFunded(jobId, msg.sender, obligationId, fundingRef, operationId,
            providerId, provider.settlementAccount, msg.value);
        _entered = 0;
    }

    receive() external payable { revert DirectTransferDisabled(); }
    fallback() external payable { revert DirectTransferDisabled(); }
}
