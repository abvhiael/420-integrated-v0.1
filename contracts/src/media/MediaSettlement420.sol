// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

interface IMediaJobSettlement420 {
    function confirmFunding(bytes32 jobId, bytes32 fundingRef, uint256 amount) external;
    function confirmSettlement(bytes32 jobId) external;
    function confirmRefund(bytes32 jobId) external;
}

contract MediaSettlement420 is SystemAccess, I420System {
    enum SettlementState { NONE, FUNDED, CLAIMABLE, REFUNDABLE, CLOSED }

    struct Settlement {
        address payer;
        address beneficiary;
        bytes32 operatorId;
        bytes32 vaultRef;
        bytes32 fundingRef;
        bytes32 resolutionRef;
        uint256 amount;
        SettlementState state;
    }

    mapping(bytes32 => Settlement) public settlements;

    address public jobMarket;
    address public vaultAdapter;
    address public payoutAdapter;
    bool public jobMarketBound;
    bool public vaultAdapterBound;
    bool public payoutAdapterBound;

    error DirectCustodyDisabled();
    error AdapterAlreadyBound();
    error NotJobMarket();
    error NotVaultAdapter();
    error NotPayoutAdapter();
    error InvalidSettlement();
    error InvalidStateTransition();
    error InvalidRecipient();

    event JobMarketBound(address indexed jobMarket);
    event VaultAdapterBound(address indexed adapter);
    event PayoutAdapterBound(address indexed adapter);
    event FundingConfirmed(bytes32 indexed jobId, address indexed payer, bytes32 indexed operatorId, address beneficiary, uint256 amount, bytes32 vaultRef, bytes32 fundingRef);
    event ResolutionBound(bytes32 indexed jobId, bytes32 indexed resolutionRef, bool claimable);
    event Released(bytes32 indexed jobId, address indexed beneficiary, uint256 amount);
    event Refunded(bytes32 indexed jobId, address indexed payer, uint256 amount);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "MediaSettlement420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindJobMarket(address jobMarket_) external onlyGovernance {
        if (jobMarketBound) revert AdapterAlreadyBound();
        if (jobMarket_ == address(0)) revert ZeroAddress();
        jobMarket = jobMarket_;
        jobMarketBound = true;
        emit JobMarketBound(jobMarket_);
    }

    function bindVaultAdapter(address adapter) external onlyGovernance {
        if (vaultAdapterBound) revert AdapterAlreadyBound();
        if (adapter == address(0)) revert ZeroAddress();
        vaultAdapter = adapter;
        vaultAdapterBound = true;
        emit VaultAdapterBound(adapter);
    }

    function bindPayoutAdapter(address adapter) external onlyGovernance {
        if (payoutAdapterBound) revert AdapterAlreadyBound();
        if (adapter == address(0)) revert ZeroAddress();
        payoutAdapter = adapter;
        payoutAdapterBound = true;
        emit PayoutAdapterBound(adapter);
    }

    function fund(bytes32) external payable { revert DirectCustodyDisabled(); }
    receive() external payable { revert DirectCustodyDisabled(); }

    function confirmVaultFunding(
        bytes32 jobId,
        address payer,
        bytes32 operatorId,
        address beneficiary,
        bytes32 vaultRef,
        bytes32 fundingRef,
        uint256 amount
    ) external onlyVaultAdapter {
        if (
            jobId == bytes32(0) || payer == address(0) || operatorId == bytes32(0) || beneficiary == address(0)
                || vaultRef == bytes32(0) || fundingRef == bytes32(0) || amount == 0
                || settlements[jobId].state != SettlementState.NONE
        ) revert InvalidSettlement();

        settlements[jobId] = Settlement({
            payer: payer,
            beneficiary: beneficiary,
            operatorId: operatorId,
            vaultRef: vaultRef,
            fundingRef: fundingRef,
            resolutionRef: bytes32(0),
            amount: amount,
            state: SettlementState.FUNDED
        });
        emit FundingConfirmed(jobId, payer, operatorId, beneficiary, amount, vaultRef, fundingRef);
        IMediaJobSettlement420(jobMarket).confirmFunding(jobId, fundingRef, amount);
    }

    function resolve(bytes32 jobId, bool claimable, bytes32 resolutionRef) external onlyJobMarket {
        Settlement storage s = _get(jobId);
        if (s.state != SettlementState.FUNDED || resolutionRef == bytes32(0)) revert InvalidStateTransition();
        s.resolutionRef = resolutionRef;
        s.state = claimable ? SettlementState.CLAIMABLE : SettlementState.REFUNDABLE;
        emit ResolutionBound(jobId, resolutionRef, claimable);
    }

    function release(bytes32 jobId, address beneficiary) external onlyPayoutAdapter {
        Settlement storage s = _get(jobId);
        if (s.state != SettlementState.CLAIMABLE) revert InvalidStateTransition();
        if (beneficiary != s.beneficiary) revert InvalidRecipient();
        s.state = SettlementState.CLOSED;
        emit Released(jobId, beneficiary, s.amount);
        IMediaJobSettlement420(jobMarket).confirmSettlement(jobId);
    }

    function refund(bytes32 jobId) external onlyPayoutAdapter {
        Settlement storage s = _get(jobId);
        if (s.state != SettlementState.REFUNDABLE) revert InvalidStateTransition();
        s.state = SettlementState.CLOSED;
        emit Refunded(jobId, s.payer, s.amount);
        IMediaJobSettlement420(jobMarket).confirmRefund(jobId);
    }

    function _get(bytes32 jobId) private view returns (Settlement storage s) {
        s = settlements[jobId];
        if (s.state == SettlementState.NONE) revert InvalidSettlement();
    }

    modifier onlyJobMarket() {
        if (!jobMarketBound || msg.sender != jobMarket) revert NotJobMarket();
        _;
    }

    modifier onlyVaultAdapter() {
        if (!vaultAdapterBound || msg.sender != vaultAdapter) revert NotVaultAdapter();
        _;
    }

    modifier onlyPayoutAdapter() {
        if (!payoutAdapterBound || msg.sender != payoutAdapter) revert NotPayoutAdapter();
        _;
    }
}
