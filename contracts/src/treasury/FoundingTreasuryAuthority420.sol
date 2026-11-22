// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./TreasuryBudgetRegistry420.sol";
import "./TreasuryDisbursementRegistry420.sol";
import "./TreasuryPolicyRegistry420.sol";
import "./TreasuryReleaseExecutor420.sol";
import "../vault/VaultRegistry420.sol";
import "../vault/VaultIds420.sol";
import "../governance/IFoundingWalletClaims420.sol";

interface IFoundingRetirementReadiness420 {
    function retirementReady() external view returns (bool);
}
interface IFoundingCivicStatus420 {
    function civicAuthorityActivated() external view returns (bool);
}

/// @notice Purpose-limited, auditable founding spending authority. This contract does not custody assets,
/// grant Vault capabilities, or bypass canonical Treasury disbursement and Vault withdrawal checks.
/// @dev Wallet identities, vault IDs and the independently verified retirement verifier are Genesis
/// deployment inputs. The deployment must bind this same instance in both Treasury registries.
contract FoundingTreasuryAuthority420 {
    uint128 public constant OPERATIONS_ALLOCATION = 4_200_000 ether;
    uint128 public constant CONTINGENCY_ALLOCATION = 840_000 ether;
    uint128 public constant ROUTINE_MAX = 105_000 ether;
    uint128 public constant EXCEPTIONAL_MAX = 420_000 ether;
    uint128 public constant CONTINGENCY_INCIDENT_MAX = 210_000 ether;
    uint128 public constant OPERATIONS_30_DAY_MAX = 840_000 ether;
    uint128 public constant CONTINGENCY_30_DAY_MAX = 420_000 ether;
    uint256 public constant ROLLING_DAYS = 30;
    uint64 public constant EXCEPTIONAL_NOTICE = 48 hours;

    // Source expenditure classifications; contingency only allows infrastructure, app rescue, or security.
    enum Purpose { INFRASTRUCTURE, APPLICATION_RECOVERY, BOUNTY, PARTNERSHIP, VALIDATOR_ONBOARDING, SECURITY, COMMUNITY }

    struct Payment {
        address recipient;
        uint128 amount;
        uint64 proposedAt;
        uint64 notBefore;
        uint64 expiresAt;
        bytes32 evidenceHash;
        bytes32 disbursementId;
        Purpose purpose;
        uint8 approvals;
        bool contingency;
        bool twoFounderRequired;
        bool scheduled;
        bool released;
    }

    IFoundingWalletClaims420 public immutable founderWalletClaims;
    address public immutable foundingAdministrator;
    address public immutable founderAndrew;
    address public immutable founderJanet;
    address public immutable governanceTimelock;
    IFoundingRetirementReadiness420 public immutable retirementVerifier;
    TreasuryBudgetRegistry420 public immutable budgetRegistry;
    TreasuryDisbursementRegistry420 public immutable disbursementRegistry;
    TreasuryPolicyRegistry420 public immutable policyRegistry;
    VaultRegistry420 public immutable vaultRegistry;
    bytes32 public immutable operationsVaultId;
    bytes32 public immutable contingencyVaultId;
    bytes32 public immutable operationsBudgetId;
    bytes32 public immutable contingencyBudgetId;
    bytes32 public immutable operationsActionHash;
    bytes32 public immutable contingencyActionHash;

    bool public budgetsInitialized;
    bool public retired;
    uint256 public nextPaymentNonce;
    uint256 public operationsCommitted;
    uint256 public contingencyCommitted;
    uint256 public operationsReleased;
    uint256 public contingencyReleased;
    mapping(bytes32 => Payment) public payments;
    mapping(bytes32 => mapping(address => bool)) public paymentApproval;
    mapping(uint256 => uint256) public operationsCommittedByDay;
    mapping(uint256 => uint256) public contingencyCommittedByDay;
    mapping(address => mapping(uint256 => uint256)) public recipientCommittedByDay;
    mapping(uint256 => uint256) public operationsReleasedByDay;
    mapping(uint256 => uint256) public contingencyReleasedByDay;
    mapping(address => mapping(uint256 => uint256)) public recipientReleasedByDay;

    error InvalidConfiguration();
    error UnauthorizedFounder();
    error Retired();
    error AlreadyInitialized();
    error NotInitialized();
    error InvalidPurpose();
    error InvalidPayment();
    error ApprovalRequired();
    error NoticeRequired();
    error SpendingLimit();
    error AlreadyApproved();
    error AlreadyScheduled();
    error InvalidVault();
    error RetirementNotReady();

    event FoundingBudgetInitialized(bytes32 indexed operationsBudgetId, bytes32 indexed contingencyBudgetId);
    event FoundingPaymentProposed(bytes32 indexed paymentId, address indexed proposer, address indexed recipient, uint256 amount, bool contingency, Purpose purpose);
    event FoundingPaymentApproved(bytes32 indexed paymentId, address indexed founder, uint8 approvals);
    event FoundingPaymentScheduled(bytes32 indexed paymentId, bytes32 indexed disbursementId, uint256 amount, bool contingency);
    event FoundingReleaseExecuted(bytes32 indexed paymentId, bytes32 indexed disbursementId, bytes32 commitment);
    event FoundingAuthorityRetired(address indexed initiator);

    constructor(
        address administrator_, address andrew_, address janet_,
        address founderWalletClaims_, address governanceTimelock_, address retirementVerifier_,
        address budgetRegistry_, address disbursementRegistry_,
        address policyRegistry_, address vaultRegistry_,
        bytes32 operationsVaultId_, bytes32 contingencyVaultId_
    ) {
        if (administrator_ == address(0) || andrew_ == address(0) || janet_ == address(0)
            || administrator_ == andrew_ || administrator_ == janet_ || andrew_ == janet_
            || founderWalletClaims_.code.length == 0
            || governanceTimelock_.code.length == 0 || retirementVerifier_.code.length == 0
            || budgetRegistry_.code.length == 0 || disbursementRegistry_.code.length == 0
            || policyRegistry_.code.length == 0 || vaultRegistry_.code.length == 0
            || operationsVaultId_ == bytes32(0) || contingencyVaultId_ == bytes32(0)
            || operationsVaultId_ == contingencyVaultId_) revert InvalidConfiguration();
        if (address(TreasuryDisbursementRegistry420(disbursementRegistry_).budgets()) != budgetRegistry_
            || address(TreasuryDisbursementRegistry420(disbursementRegistry_).policy()) != policyRegistry_
            || address(TreasuryBudgetRegistry420(budgetRegistry_).policy()) != policyRegistry_) revert InvalidConfiguration();
        IFoundingWalletClaims420 verifiedClaims = IFoundingWalletClaims420(founderWalletClaims_);
        if (verifiedClaims.administrator() != administrator_ || verifiedClaims.andrew() != andrew_
            || verifiedClaims.janet() != janet_ || verifiedClaims.genesisPlanCommitment() == bytes32(0))
            revert InvalidConfiguration();
        founderWalletClaims = verifiedClaims;
        foundingAdministrator = administrator_;
        founderAndrew = andrew_;
        founderJanet = janet_;
        governanceTimelock = governanceTimelock_;
        retirementVerifier = IFoundingRetirementReadiness420(retirementVerifier_);
        budgetRegistry = TreasuryBudgetRegistry420(budgetRegistry_);
        disbursementRegistry = TreasuryDisbursementRegistry420(disbursementRegistry_);
        policyRegistry = TreasuryPolicyRegistry420(policyRegistry_);
        vaultRegistry = VaultRegistry420(vaultRegistry_);
        operationsVaultId = operationsVaultId_;
        contingencyVaultId = contingencyVaultId_;
        operationsBudgetId = keccak256(abi.encode("420/FOUNDING/OPERATIONS/V1", block.chainid, address(this)));
        contingencyBudgetId = keccak256(abi.encode("420/FOUNDING/CONTINGENCY/V1", block.chainid, address(this)));
        operationsActionHash = keccak256(abi.encode("420/FOUNDING/OPERATIONS/AUTHORITY/V1", block.chainid, address(this)));
        contingencyActionHash = keccak256(abi.encode("420/FOUNDING/CONTINGENCY/AUTHORITY/V1", block.chainid, address(this)));
    }

    modifier onlyFounder() {
        if (!_isFounder(msg.sender) || !founderWalletClaims.claimed(msg.sender)) revert UnauthorizedFounder();
        if (retired) revert Retired();
        _;
    }

    function _isFounder(address a) private view returns (bool) {
        return a == foundingAdministrator || a == founderAndrew || a == founderJanet;
    }

    /// @notice Install the fixed, default-deny native asset budget limits once.
    /// The deployment registrar must first bind this controller in the policy registry.
    function initializeNativePolicy() external onlyFounder {
        if (msg.sender != foundingAdministrator) revert UnauthorizedFounder();
        if (policyRegistry.foundingAuthority() != address(this)) revert InvalidConfiguration();
        policyRegistry.initializeFoundingNativePolicy();
    }

    /// @notice One-time native-420 budget setup. Requires the independently installed native asset
    /// policy, two registered Treasury Vaults and both Treasury registries bound to this authority.
    function initializeBudgets() external onlyFounder {
        if (msg.sender != foundingAdministrator) revert UnauthorizedFounder();
        if (budgetsInitialized) revert AlreadyInitialized();
        if (budgetRegistry.foundingAuthority() != address(this)
            || disbursementRegistry.foundingAuthority() != address(this)) revert InvalidConfiguration();
        VaultRegistry420.Vault memory ops = vaultRegistry.getVault(operationsVaultId);
        VaultRegistry420.Vault memory cont = vaultRegistry.getVault(contingencyVaultId);
        if (ops.vaultType != VaultIds420.VAULT_TREASURY || cont.vaultType != VaultIds420.VAULT_TREASURY
            || ops.vaultAddress == cont.vaultAddress || ops.state != VaultRegistry420.VaultState.ACTIVE
            || cont.state != VaultRegistry420.VaultState.ACTIVE) revert InvalidVault();
        if (!policyRegistry.isAllowed(address(0), EXCEPTIONAL_MAX)) revert InvalidConfiguration();
        budgetsInitialized = true;
        uint64 start = uint64(block.timestamp);
        uint64 end = type(uint64).max;
        budgetRegistry.createBudget(
            operationsBudgetId, operationsVaultId, TreasuryIds420.BUDGET_ECOSYSTEM, address(0),
            OPERATIONS_ALLOCATION, start, end, operationsActionHash, keccak256("420/FOUNDING/OPERATIONS/METADATA/V1")
        );
        budgetRegistry.createBudget(
            contingencyBudgetId, contingencyVaultId, TreasuryIds420.BUDGET_EMERGENCY, address(0),
            CONTINGENCY_ALLOCATION, start, end, contingencyActionHash, keccak256("420/FOUNDING/CONTINGENCY/METADATA/V1")
        );
        emit FoundingBudgetInitialized(operationsBudgetId, contingencyBudgetId);
    }

    function proposePayment(
        bool contingency, address recipient, uint128 amount, Purpose purpose, bytes32 evidenceHash,
        uint64 notBefore, uint64 expiresAt
    ) external onlyFounder returns (bytes32 paymentId) {
        if (!budgetsInitialized) revert NotInitialized();
        if (recipient == address(0) || recipient == address(this) || amount == 0
            || evidenceHash == bytes32(0) || expiresAt <= notBefore
            || expiresAt <= block.timestamp || notBefore < block.timestamp) revert InvalidPayment();
        if (contingency) {
            if (amount > CONTINGENCY_INCIDENT_MAX || !_emergencyPurpose(purpose)) revert InvalidPurpose();
        } else if (amount > EXCEPTIONAL_MAX) revert SpendingLimit();

        bool requiresTwo = contingency || amount > ROUTINE_MAX || _isFounder(recipient)
            || _rollingRecipient(recipient) + amount > ROUTINE_MAX;
        if (!requiresTwo && msg.sender != foundingAdministrator) revert UnauthorizedFounder();
        paymentId = keccak256(abi.encode("420/FOUNDING/PAYMENT/V1", block.chainid, address(this),
            ++nextPaymentNonce, contingency, recipient, amount, purpose, evidenceHash, notBefore, expiresAt));
        Payment storage p = payments[paymentId];
        p.recipient = recipient;
        p.amount = amount;
        p.proposedAt = uint64(block.timestamp);
        p.notBefore = notBefore;
        p.expiresAt = expiresAt;
        p.evidenceHash = evidenceHash;
        p.purpose = purpose;
        p.contingency = contingency;
        p.twoFounderRequired = requiresTwo;
        p.approvals = 1;
        paymentApproval[paymentId][msg.sender] = true;
        emit FoundingPaymentProposed(paymentId, msg.sender, recipient, amount, contingency, purpose);
        emit FoundingPaymentApproved(paymentId, msg.sender, 1);
    }

    function approvePayment(bytes32 paymentId) external onlyFounder {
        Payment storage p = payments[paymentId];
        if (p.recipient == address(0) || p.scheduled) revert InvalidPayment();
        if (paymentApproval[paymentId][msg.sender]) revert AlreadyApproved();
        paymentApproval[paymentId][msg.sender] = true;
        ++p.approvals;
        emit FoundingPaymentApproved(paymentId, msg.sender, p.approvals);
    }

    function schedulePayment(bytes32 paymentId) external onlyFounder returns (bytes32 disbursementId) {
        Payment storage p = payments[paymentId];
        if (p.recipient == address(0)) revert InvalidPayment();
        if (p.scheduled) revert AlreadyScheduled();
        // Re-evaluate when scheduled: multiple routine payments can be proposed concurrently.
        // Once the recipient aggregate crosses the routine ceiling, upgrade permanently to
        // exceptional authorization and retain the public-notice requirement.
        bool elevated = p.twoFounderRequired ||
            (!p.contingency && _rollingRecipient(p.recipient) + p.amount > ROUTINE_MAX);
        if (elevated) {
            p.twoFounderRequired = true;
            if (p.approvals < 2) revert ApprovalRequired();
        } else if (!paymentApproval[paymentId][foundingAdministrator]) revert ApprovalRequired();
        // Exceptional payments require public notice. All three founders can fast-track ONLY
        // genuine contingency incidents, not an exceptional Operations or related-party transfer.
        if (p.twoFounderRequired && block.timestamp < uint256(p.proposedAt) + EXCEPTIONAL_NOTICE
            && !(p.contingency && p.approvals == 3)) revert NoticeRequired();
        if (block.timestamp > p.expiresAt || p.notBefore > p.expiresAt) revert InvalidPayment();
        if (p.contingency) {
            if (contingencyCommitted + p.amount > CONTINGENCY_ALLOCATION
                || _rollingTotal(true) + p.amount > CONTINGENCY_30_DAY_MAX) revert SpendingLimit();
        } else {
            if (operationsCommitted + p.amount > OPERATIONS_ALLOCATION
                || _rollingTotal(false) + p.amount > OPERATIONS_30_DAY_MAX) revert SpendingLimit();

        }
        bytes32 budgetId = p.contingency ? contingencyBudgetId : operationsBudgetId;
        bytes32 actionHash = p.contingency ? contingencyActionHash : operationsActionHash;
        uint64 notBefore = p.notBefore > block.timestamp ? p.notBefore : uint64(block.timestamp);
        disbursementId = disbursementRegistry.canonicalId(
            budgetId, p.recipient, p.amount, notBefore, p.expiresAt, actionHash, p.evidenceHash
        );
        p.scheduled = true;
        p.disbursementId = disbursementId;
        uint256 day = block.timestamp / 1 days;
        if (p.contingency) {
            contingencyCommitted += p.amount;
            contingencyCommittedByDay[day] += p.amount;
        } else {
            operationsCommitted += p.amount;
            operationsCommittedByDay[day] += p.amount;
            recipientCommittedByDay[p.recipient][day] += p.amount;
        }
        disbursementRegistry.schedule(
            disbursementId, budgetId, p.recipient, p.amount, notBefore, p.expiresAt,
            actionHash, p.evidenceHash
        );
        emit FoundingPaymentScheduled(paymentId, disbursementId, p.amount, p.contingency);
    }

    /// @notice A scoped Vault release remains conditional on two independent, live Capability
    /// Registry grants to the designated executor. This function cannot issue those grants.
    function executeApprovedRelease(
        bytes32 paymentId, address executor, bytes32 expectedCommitment
    ) external onlyFounder returns (bytes32 commitment) {
        Payment storage p = payments[paymentId];
        if (!p.scheduled || p.released || p.disbursementId == bytes32(0) || executor.code.length == 0)
            revert InvalidPayment();
        if (TreasuryReleaseExecutor420(executor).operator() != address(this)) revert InvalidConfiguration();
        if (p.contingency) {
            if (_rollingReleased(true) + p.amount > CONTINGENCY_30_DAY_MAX) revert SpendingLimit();
        } else {
            if (_rollingReleased(false) + p.amount > OPERATIONS_30_DAY_MAX) revert SpendingLimit();
            if (!p.twoFounderRequired && _rollingRecipientReleased(p.recipient) + p.amount > ROUTINE_MAX)
                revert ApprovalRequired();
        }
        // Consume the exact release quota before the external call. A failed transfer or accounting
        // proof rolls back these writes with the whole transaction; releases cannot double-spend.
        p.released = true;
        uint256 day = block.timestamp / 1 days;
        if (p.contingency) {
            contingencyReleased += p.amount;
            contingencyReleasedByDay[day] += p.amount;
        } else {
            operationsReleased += p.amount;
            operationsReleasedByDay[day] += p.amount;
            recipientReleasedByDay[p.recipient][day] += p.amount;
        }
        commitment = TreasuryReleaseExecutor420(executor).execute(p.disbursementId, expectedCommitment);
        TreasuryDisbursementRegistry420.Disbursement memory d = disbursementRegistry.disbursement(p.disbursementId);
        if (d.state != TreasuryDisbursementRegistry420.State.EXECUTED || d.vaultReleaseHash != commitment)
            revert InvalidConfiguration();
        emit FoundingReleaseExecuted(paymentId, p.disbursementId, commitment);
    }

    /// @notice Retirement evidence must come from an independently qualified, Genesis-pinned
    /// on-chain verifier: 60 eligible independent validator owners, 15 verified Committee members,
    /// 30 continuous days, plus completed Civic handoff. Any caller may finalize it once true.
    function retire() external {
        if (retired) revert Retired();
        if (!IFoundingCivicStatus420(governanceTimelock).civicAuthorityActivated()
            || !retirementVerifier.retirementReady()) revert RetirementNotReady();
        retired = true;
        emit FoundingAuthorityRetired(msg.sender);
    }

    function rollingCommitted(bool contingency) external view returns (uint256) {
        return _rollingTotal(contingency);
    }

    function rollingRecipientCommitted(address recipient) external view returns (uint256) {
        return _rollingRecipient(recipient);
    }

    function _rollingTotal(bool contingency) private view returns (uint256 total) {
        uint256 day = block.timestamp / 1 days;
        // Include day - 30 conservatively, so no boundary manipulation can spend >30-day cap.
        for (uint256 i; i <= ROLLING_DAYS && i <= day; ++i) {
            total += contingency ? contingencyCommittedByDay[day - i] : operationsCommittedByDay[day - i];
        }
    }

    function rollingReleased(bool contingency) external view returns (uint256) {
        return _rollingReleased(contingency);
    }

    function _rollingReleased(bool contingency) private view returns (uint256 total) {
        uint256 day = block.timestamp / 1 days;
        for (uint256 i; i <= ROLLING_DAYS && i <= day; ++i) {
            total += contingency ? contingencyReleasedByDay[day - i] : operationsReleasedByDay[day - i];
        }
    }

    function _rollingRecipientReleased(address recipient) private view returns (uint256 total) {
        uint256 day = block.timestamp / 1 days;
        for (uint256 i; i <= ROLLING_DAYS && i <= day; ++i) {
            total += recipientReleasedByDay[recipient][day - i];
        }
    }

    function _rollingRecipient(address recipient) private view returns (uint256 total) {
        uint256 day = block.timestamp / 1 days;
        for (uint256 i; i <= ROLLING_DAYS && i <= day; ++i) {
            total += recipientCommittedByDay[recipient][day - i];
        }
    }

    function _emergencyPurpose(Purpose purpose) private pure returns (bool) {
        return purpose == Purpose.INFRASTRUCTURE || purpose == Purpose.APPLICATION_RECOVERY
            || purpose == Purpose.SECURITY;
    }
}
