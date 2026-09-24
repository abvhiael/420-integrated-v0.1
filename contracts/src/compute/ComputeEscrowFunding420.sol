// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeJobSignedRequestAuthority420.sol";
import "../vault/AssetVault420.sol";
import "../vault/VaultAccounting420.sol";
import "../vault/VaultRegistry420.sol";

/// @notice CMP-1.2.1 funding admission only. This is NOT a settlement or withdrawal authority.
/// @dev A new ComputeJobRegistry420 must bind this instance as fundingEvidence at construction;
/// legacy ComputeJobPayerCustody420 deposits are never imported or treated as Vault assets.
/// Funding is atomic: real signed-payer native funds enter the registered Vault AND become
/// reserved by a unique, pending, payer-beneficiary safety obligation in the same transaction.
/// Subsequent obligations, payouts, cancellation and refunds require separately qualified CMP-1.2 code.
contract ComputeEscrowFunding420 is IComputeJobFundingEvidence420 {
    struct Credit {
        bytes32 requestId;
        address owner;
        address payer;
        uint256 deposited;
        uint256 maximumSpend;
        uint64 deadline;
        bytes32 obligationId;
        bool exists;
    }

    bytes32 private constant SAFETY_DOMAIN = keccak256("420/CMP/ESCROW/PAYER-SAFETY/V1");
    bytes32 public constant PAYER_SAFETY_TYPE = keccak256("420/CMP/PAYER-SAFETY/V1");
    ComputeJobSignedRequestAuthority420 public immutable requests;
    AssetVault420 public immutable vault;
    VaultRegistry420 public immutable vaultRegistry;
    VaultAccounting420 public immutable accounting;
    bytes32 public immutable vaultId;
    address public immutable deploymentAuthority;
    ComputeJobRegistry420 public jobs;
    uint256 public totalFunded;
    mapping(bytes32 => Credit) private _credits;
    bool private entered;

    error InvalidFunding();
    error UnauthorizedPayer();
    error AlreadyFunded();
    event FundingBound(bytes32 indexed jobId, bytes32 indexed requestId, address indexed payer,
        uint256 amount, uint256 maximumSpend, bytes32 vaultId, bytes32 safetyObligationId);

    constructor(address signedRequests, address registeredVault) {
        if (signedRequests.code.length == 0 || registeredVault.code.length == 0) revert InvalidFunding();
        requests = ComputeJobSignedRequestAuthority420(signedRequests);
        vault = AssetVault420(payable(registeredVault));
        vaultRegistry = vault.registry();
        accounting = vault.accounting();
        vaultId = vault.vaultId();
        if (address(vaultRegistry).code.length == 0 || address(accounting).code.length == 0
            || vaultId == bytes32(0)) revert InvalidFunding();
        deploymentAuthority = msg.sender;
    }

    /// @dev Deployment authority binds only the intended registry, exactly once.
    function bindJobs(address jobRegistry) external {
        if (msg.sender != deploymentAuthority || address(jobs) != address(0)
            || jobRegistry.code.length == 0) revert InvalidFunding();
        ComputeJobRegistry420 candidate = ComputeJobRegistry420(jobRegistry);
        if (address(candidate.fundingEvidence()) != address(this)
            || address(candidate.requestEvidence()) != address(requests)) revert InvalidFunding();
        _requireVaultActive();
        jobs = candidate;
    }

    /// @notice Signed payer deposits native 420 directly through this adapter, never from pooled credits.
    /// @dev Vault must grant this adapter CREATE_OBLIGATION only for the intended CMP Vault and
    /// operationally exclude other writers/withdrawers. The pending obligation is *not* claimable.
    function fund(bytes32 jobId) external payable returns (bytes32 fundingRef) {
        if (entered || address(jobs) == address(0) || msg.value == 0) revert InvalidFunding();
        entered = true;
        if (_credits[jobId].exists) revert AlreadyFunded();
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.CREATED || j.requestId == bytes32(0)
            || j.owner == address(0) || block.timestamp >= j.deadline) revert InvalidFunding();
        ComputeJobSignedRequestAuthority420.Request memory r = requests.getRequest(j.requestId);
        (address payer, uint256 cap) = requests.fundingTerms(j.requestId);
        if (!r.exists || msg.sender != payer || r.payer != payer || payer == address(0)
            || r.owner != j.owner || r.requestCommitment != j.requestCommitment
            || r.manifestHash != j.manifestHash || r.workloadType != j.workloadType
            || r.inputCommitment != j.inputCommitment
            || r.outputSchemaCommitment != j.outputSchemaCommitment || r.deadline != j.deadline
            || cap == 0 || r.maxSpend != cap || msg.value > cap
            || block.timestamp > r.authorizationExpiry) revert UnauthorizedPayer();
        _requireVaultActive();
        bytes32 obligationId = safetyObligationId(jobId);
        uint256 oldBalance = address(vault).balance;
        VaultAccounting420.AssetAccounting memory oldAccounting = accounting.getAccounting(vaultId, address(0));
        // Every already admitted CMP credit must remain encumbered; unrelated free balances
        // are never accepted as funding evidence for another job.
        if (oldAccounting.reserved < totalFunded || oldAccounting.recordedBalance < totalFunded
            || oldBalance < totalFunded) revert InvalidFunding();
        vault.depositNative{value: msg.value}();
        vault.createObligation(
            keccak256(abi.encode(SAFETY_DOMAIN, block.chainid, address(this), vaultId, jobId, uint8(1))),
            obligationId, address(0), payer, msg.value, PAYER_SAFETY_TYPE, jobId
        );
        VaultAccounting420.AssetAccounting memory nowAccounting = accounting.getAccounting(vaultId, address(0));
        VaultAccounting420.Obligation memory o = accounting.getObligation(obligationId);
        if (address(vault).balance != oldBalance + msg.value
            || nowAccounting.recordedBalance != oldAccounting.recordedBalance + msg.value
            || nowAccounting.reserved != oldAccounting.reserved + msg.value
            || nowAccounting.claimable != oldAccounting.claimable
            || !o.exists || o.state != 1 || o.vaultId != vaultId || o.asset != address(0)
            || o.beneficiary != payer || o.amount != msg.value || o.sourceRef != jobId
            || o.obligationType != PAYER_SAFETY_TYPE) revert InvalidFunding();
        _credits[jobId] = Credit(j.requestId, j.owner, payer, msg.value, cap, j.deadline, obligationId, true);
        totalFunded += msg.value;
        emit FundingBound(jobId, j.requestId, payer, msg.value, cap, vaultId, obligationId);
        entered = false;
        return jobId;
    }

    function safetyObligationId(bytes32 jobId) public view returns (bytes32) {
        return keccak256(abi.encode(SAFETY_DOMAIN, block.chainid, address(this), address(vault), vaultId, jobId));
    }

    function credit(bytes32 jobId) external view returns (Credit memory) { return _credits[jobId]; }

    /// @notice True only for the *same* job's actual, still-pending, Vault-backed payer obligation.
    function funded(bytes32 jobId, address owner, bytes32 fundingRef) external view returns (bool) {
        Credit storage c = _credits[jobId];
        if (address(jobs) == address(0) || !c.exists || fundingRef != jobId || jobId == bytes32(0)
            || c.owner != owner || owner == address(0) || c.payer == address(0)
            || c.requestId == bytes32(0) || c.deposited == 0 || c.deposited > c.maximumSpend
            || c.obligationId != safetyObligationId(jobId)) return false;
        VaultRegistry420.Vault memory registration = vaultRegistry.getVault(vaultId);
        if (registration.vaultAddress != address(vault)) return false;
        VaultAccounting420.Obligation memory o = accounting.getObligation(c.obligationId);
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(vaultId, address(0));
        return o.exists && o.state == 1 && o.vaultId == vaultId && o.asset == address(0)
            && o.beneficiary == c.payer && o.amount == c.deposited
            && o.sourceRef == jobId && o.obligationType == PAYER_SAFETY_TYPE
            && a.reserved >= totalFunded && a.recordedBalance >= totalFunded
            && address(vault).balance >= totalFunded;
    }

    function _requireVaultActive() private view {
        VaultRegistry420.Vault memory registration = vaultRegistry.getVault(vaultId);
        if (registration.vaultAddress != address(vault)
            || vaultRegistry.vaultState(vaultId) != VaultRegistry420.VaultState.ACTIVE
            || address(vault.registry()) != address(vaultRegistry)
            || address(vault.accounting()) != address(accounting)) revert InvalidFunding();
    }

    receive() external payable { revert InvalidFunding(); }
    fallback() external payable { revert InvalidFunding(); }
}
