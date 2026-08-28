// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

interface IAIJobManagerEscrow420 {
    function confirmFunding(bytes32 jobId, bytes32 fundingRef, uint256 amount) external;
    function confirmSettlement(bytes32 jobId) external;
    function confirmRefund(bytes32 jobId) external;
}

contract AIJobEscrow is SystemAccess, I420System {
    address public constant AI_JOB_MANAGER = address(0x0000000000000000000000000000000000000431);

    enum EscrowState { NONE, FUNDED, CLAIMABLE, REFUNDABLE, CLOSED }

    struct Escrow {
        address payer;
        address beneficiary;
        bytes32 providerId;
        bytes32 vaultRef;
        bytes32 fundingRef;
        bytes32 settlementRef;
        uint256 amount;
        EscrowState state;
    }

    mapping(bytes32 => Escrow) public escrows;
    address public vaultAdapter;
    address public settlementAdapter;
    bool public vaultAdapterBound;
    bool public settlementAdapterBound;

    error DirectCustodyDisabled();
    error AdapterAlreadyBound();
    error NotVaultAdapter();
    error NotSettlementAdapter();
    error InvalidEscrow();
    error InvalidStateTransition();
    error InvalidRecipient();

    event VaultAdapterBound(address indexed adapter);
    event SettlementAdapterBound(address indexed adapter);
    event Funded(bytes32 indexed jobId, address indexed payer, bytes32 indexed providerId, uint256 amount);
    event FundingBound(bytes32 indexed jobId, bytes32 vaultRef, bytes32 fundingRef, address beneficiary, uint256 amount);
    event Released(bytes32 indexed jobId, address indexed to, uint256 amount);
    event Refunded(bytes32 indexed jobId, address indexed to, uint256 amount);
    event SettlementReferenceBound(bytes32 indexed jobId, bytes32 settlementRef, EscrowState state);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "AIJobEscrow"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function bindVaultAdapter(address adapter) external onlyGovernance {
        if (vaultAdapterBound) revert AdapterAlreadyBound();
        if (adapter == address(0)) revert ZeroAddress();
        vaultAdapter = adapter;
        vaultAdapterBound = true;
        emit VaultAdapterBound(adapter);
    }

    function bindSettlementAdapter(address adapter) external onlyGovernance {
        if (settlementAdapterBound) revert AdapterAlreadyBound();
        if (adapter == address(0)) revert ZeroAddress();
        settlementAdapter = adapter;
        settlementAdapterBound = true;
        emit SettlementAdapterBound(adapter);
    }

    /// @notice Legacy direct custody is deliberately disabled; V2 funding is bound to 420Vault/approved settlement primitives.
    function fund(bytes32, bytes32) external payable { revert DirectCustodyDisabled(); }

    function confirmVaultFunding(
        bytes32 jobId,
        address payer,
        bytes32 providerId,
        address beneficiary,
        bytes32 vaultRef,
        bytes32 fundingRef,
        uint256 amount
    ) external onlyVaultAdapter {
        if (jobId == bytes32(0) || payer == address(0) || providerId == bytes32(0) || beneficiary == address(0)) revert InvalidEscrow();
        if (vaultRef == bytes32(0) || fundingRef == bytes32(0) || amount == 0 || escrows[jobId].state != EscrowState.NONE) revert InvalidEscrow();
        escrows[jobId] = Escrow({
            payer: payer,
            beneficiary: beneficiary,
            providerId: providerId,
            vaultRef: vaultRef,
            fundingRef: fundingRef,
            settlementRef: bytes32(0),
            amount: amount,
            state: EscrowState.FUNDED
        });
        emit Funded(jobId, payer, providerId, amount);
        emit FundingBound(jobId, vaultRef, fundingRef, beneficiary, amount);
        IAIJobManagerEscrow420(AI_JOB_MANAGER).confirmFunding(jobId, fundingRef, amount);
    }

    function markClaimable(bytes32 jobId, bytes32 settlementRef) external onlySettlementAdapter {
        Escrow storage e = _get(jobId);
        if (e.state != EscrowState.FUNDED || settlementRef == bytes32(0)) revert InvalidStateTransition();
        e.settlementRef = settlementRef;
        e.state = EscrowState.CLAIMABLE;
        emit SettlementReferenceBound(jobId, settlementRef, e.state);
    }

    function markRefundable(bytes32 jobId, bytes32 settlementRef) external onlySettlementAdapter {
        Escrow storage e = _get(jobId);
        if (e.state != EscrowState.FUNDED || settlementRef == bytes32(0)) revert InvalidStateTransition();
        e.settlementRef = settlementRef;
        e.state = EscrowState.REFUNDABLE;
        emit SettlementReferenceBound(jobId, settlementRef, e.state);
    }

    /// @notice Compatibility release confirms the already-bound beneficiary entitlement; it never accepts an arbitrary recipient.
    function release(bytes32 jobId, address payable to) external onlySettlementAdapter {
        Escrow storage e = _get(jobId);
        if (e.state != EscrowState.CLAIMABLE) revert InvalidStateTransition();
        if (to != e.beneficiary) revert InvalidRecipient();
        e.state = EscrowState.CLOSED;
        emit Released(jobId, to, e.amount);
        IAIJobManagerEscrow420(AI_JOB_MANAGER).confirmSettlement(jobId);
    }

    function refund(bytes32 jobId) external onlySettlementAdapter {
        Escrow storage e = _get(jobId);
        if (e.state != EscrowState.REFUNDABLE) revert InvalidStateTransition();
        e.state = EscrowState.CLOSED;
        emit Refunded(jobId, e.payer, e.amount);
        IAIJobManagerEscrow420(AI_JOB_MANAGER).confirmRefund(jobId);
    }

    receive() external payable { revert DirectCustodyDisabled(); }

    function _get(bytes32 jobId) private view returns (Escrow storage e) {
        e = escrows[jobId];
        if (e.state == EscrowState.NONE) revert InvalidEscrow();
    }

    modifier onlyVaultAdapter() {
        if (!vaultAdapterBound || msg.sender != vaultAdapter) revert NotVaultAdapter();
        _;
    }

    modifier onlySettlementAdapter() {
        if (!settlementAdapterBound || msg.sender != settlementAdapter) revert NotSettlementAdapter();
        _;
    }
}
