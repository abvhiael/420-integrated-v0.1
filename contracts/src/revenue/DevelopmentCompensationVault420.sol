// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./DevelopmentCompensationIds420.sol";

interface IERC20DevelopmentCompensation420 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Segregated, non-custodial router for the developer-compensation share of eligible application revenue.
/// @dev The vault never accepts arbitrary deposits and exposes no owner withdrawal path. Authorized source
///      applications submit an exact policy-calculated share, which is forwarded atomically to the immutable
///      420 Integrated Labs beneficiary configured at deployment.
contract DevelopmentCompensationVault420 is I420System {
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_COMPENSATION_BPS = 1_000; // 10% V1 policy ceiling

    ICapabilityRegistry420 public immutable capabilityRegistry;
    address public immutable beneficiary;
    bytes32 public constant beneficiaryId = DevelopmentCompensationIds420.BENEFICIARY_420_INTEGRATED_LABS;
    bytes32 public constant policyId = DevelopmentCompensationIds420.POLICY_APPLICATION_REVENUE_V1;

    mapping(bytes32 => bool) public consumedRevenueContribution;
    uint256 private _entered;

    error ZeroAddress();
    error InvalidIdentifier();
    error InvalidRevenueAmount();
    error InvalidCompensationBps();
    error IncorrectContributionAmount();
    error UnauthorizedSource();
    error Replay();
    error TransferFailed();
    error UnexpectedTokenDelta();
    error DirectDepositDisabled();
    error Reentrancy();

    event DevelopmentCompensationForwarded(
        bytes32 indexed contributionId,
        bytes32 indexed sourceApplicationId,
        bytes32 indexed revenueRef,
        address source,
        address asset,
        address beneficiary,
        uint256 grossProtocolRevenue,
        uint16 compensationBps,
        uint256 compensationAmount,
        bytes32 policyRef
    );

    constructor(address capabilityRegistry_, address beneficiary_) {
        if (capabilityRegistry_ == address(0) || beneficiary_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
        beneficiary = beneficiary_;
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function systemName() external pure returns (string memory) { return "DevelopmentCompensationVault420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    receive() external payable { revert DirectDepositDisabled(); }
    fallback() external payable { revert DirectDepositDisabled(); }

    function expectedCompensation(uint256 grossProtocolRevenue, uint16 compensationBps) public pure returns (uint256) {
        if (grossProtocolRevenue == 0) revert InvalidRevenueAmount();
        if (compensationBps == 0 || compensationBps > MAX_COMPENSATION_BPS) revert InvalidCompensationBps();
        return (grossProtocolRevenue * compensationBps) / BPS_DENOMINATOR;
    }

    function contributionId(address source, bytes32 sourceApplicationId, bytes32 revenueRef) public pure returns (bytes32) {
        return keccak256(abi.encode("420/REVENUE/DEVELOPMENT_COMPENSATION/CONTRIBUTION/V1", source, sourceApplicationId, revenueRef));
    }

    function contributeNative(
        bytes32 sourceApplicationId,
        bytes32 revenueRef,
        bytes32 policyRef,
        uint256 grossProtocolRevenue,
        uint16 compensationBps
    ) external payable nonReentrant {
        _validateIdentifiers(sourceApplicationId, revenueRef, policyRef);
        uint256 amount = expectedCompensation(grossProtocolRevenue, compensationBps);
        if (msg.value != amount || amount == 0) revert IncorrectContributionAmount();
        _requireAuthorized(msg.sender, sourceApplicationId, amount);

        bytes32 id = _consume(msg.sender, sourceApplicationId, revenueRef);
        // The destination is the immutable deployment-configured 420 Integrated Labs beneficiary,
        // never caller-selected. Source authorization, exact fee math, replay protection and the
        // shared nonReentrant lock execute before this fixed-destination atomic forward.
        // slither-disable-next-line arbitrary-send-eth
        (bool ok,) = payable(beneficiary).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit DevelopmentCompensationForwarded(
            id,
            sourceApplicationId,
            revenueRef,
            msg.sender,
            address(0),
            beneficiary,
            grossProtocolRevenue,
            compensationBps,
            amount,
            policyRef
        );
    }

    function contributeToken(
        address token,
        bytes32 sourceApplicationId,
        bytes32 revenueRef,
        bytes32 policyRef,
        uint256 grossProtocolRevenue,
        uint16 compensationBps
    ) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        _validateIdentifiers(sourceApplicationId, revenueRef, policyRef);
        uint256 amount = expectedCompensation(grossProtocolRevenue, compensationBps);
        if (amount == 0) revert IncorrectContributionAmount();
        _requireAuthorized(msg.sender, sourceApplicationId, amount);

        bytes32 id = _consume(msg.sender, sourceApplicationId, revenueRef);
        IERC20DevelopmentCompensation420 asset = IERC20DevelopmentCompensation420(token);
        uint256 beforeSource = asset.balanceOf(msg.sender);
        uint256 beforeBeneficiary = asset.balanceOf(beneficiary);
        if (!asset.transferFrom(msg.sender, beneficiary, amount)) revert TransferFailed();
        uint256 afterSource = asset.balanceOf(msg.sender);
        uint256 afterBeneficiary = asset.balanceOf(beneficiary);
        if (
            beforeSource < afterSource || beforeSource - afterSource != amount
                || afterBeneficiary < beforeBeneficiary || afterBeneficiary - beforeBeneficiary != amount
        ) revert UnexpectedTokenDelta();

        emit DevelopmentCompensationForwarded(
            id,
            sourceApplicationId,
            revenueRef,
            msg.sender,
            token,
            beneficiary,
            grossProtocolRevenue,
            compensationBps,
            amount,
            policyRef
        );
    }

    function _validateIdentifiers(bytes32 sourceApplicationId, bytes32 revenueRef, bytes32 policyRef) private pure {
        if (sourceApplicationId == bytes32(0) || revenueRef == bytes32(0) || policyRef == bytes32(0)) {
            revert InvalidIdentifier();
        }
    }

    function _requireAuthorized(address source, bytes32 sourceApplicationId, uint256 amount) private view {
        bool allowed = capabilityRegistry.isAuthorized(
            source,
            DevelopmentCompensationIds420.COMPONENT_DEVELOPMENT_COMPENSATION,
            DevelopmentCompensationIds420.ACTION_CONTRIBUTE_REVENUE,
            DevelopmentCompensationIds420.scopeSource(sourceApplicationId),
            amount
        );
        if (!allowed) revert UnauthorizedSource();
    }

    function _consume(address source, bytes32 sourceApplicationId, bytes32 revenueRef) private returns (bytes32 id) {
        id = contributionId(source, sourceApplicationId, revenueRef);
        if (consumedRevenueContribution[id]) revert Replay();
        consumedRevenueContribution[id] = true;
    }
}
