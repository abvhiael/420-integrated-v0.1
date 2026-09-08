// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceOfferRegistry420.sol";
import "./ResourceNodeRegistry420.sol";
import "./ResourceProviderRegistry420.sol";
import "./StorageAgreementRegistry420.sol";
import "./StorageProofRegistry420.sol";
import "./StorageProofSchemeRegistry420.sol";

interface IStorageSettlementVault420 {
    function vaultId() external view returns (bytes32);
    function createObligation(bytes32 operationId, bytes32 obligationId, address asset, address beneficiary, uint256 amount, bytes32 obligationType, bytes32 sourceRef) external;
    function releaseObligation(bytes32 operationId, bytes32 obligationId) external;
    function cancelObligation(bytes32 operationId, bytes32 obligationId) external;
}

/// @notice SR-3.4 proof-driven settlement controller for 420Store agreements.
/// @dev Custody remains in canonical 420Vault. This contract only reserves, releases,
///      or cancels vault obligations according to immutable agreement/proof state.
contract StorageSettlementRegistry420 is I420System {
    bytes32 public constant OBLIGATION_STORAGE_PROOF_WINDOW = keccak256("420/STORAGE/OBLIGATION/PROOF_WINDOW/V1");
    uint32 public constant MAX_SETTLEMENT_WINDOWS = 4096;

    enum State { NONE, OPEN, FUNDED, COMPLETE, ABORTING, CANCELLED }
    enum WindowState { NONE, RESERVED, PAID, REFUNDED }

    struct Settlement {
        bytes32 agreementId;
        address consumer;
        address beneficiary;
        address vault;
        address asset;
        uint256 totalAmount420;
        uint256 paid420;
        uint256 refunded420;
        uint32 windowCount;
        uint32 reservedWindows;
        uint32 finalizedWindows;
        State state;
        bool exists;
    }

    StorageAgreementRegistry420 public immutable agreements;
    StorageProofRegistry420 public immutable proofs;

    mapping(bytes32 => Settlement) private _settlements;
    mapping(bytes32 => mapping(uint32 => WindowState)) public windowState;

    error ZeroAddress();
    error InvalidSettlement();
    error SettlementExists();
    error SettlementNotFound();
    error InvalidState();
    error Unauthorized();
    error InvalidWindow();
    error InvalidProof();
    error ProofDeadlineOpen();

    event StorageSettlementOpened(bytes32 indexed settlementId, bytes32 indexed agreementId, address indexed consumer, address vault, address asset, address beneficiary, uint256 totalAmount420, uint32 windowCount);
    event StorageWindowReserved(bytes32 indexed settlementId, uint32 indexed windowIndex, bytes32 indexed obligationId, uint256 amount420);
    event StorageSettlementFunded(bytes32 indexed settlementId);
    event StorageWindowPaid(bytes32 indexed settlementId, uint32 indexed windowIndex, bytes32 indexed proofId, uint256 amount420);
    event StorageWindowRefunded(bytes32 indexed settlementId, uint32 indexed windowIndex, uint256 amount420);
    event StorageSettlementCompleted(bytes32 indexed settlementId, uint256 paid420, uint256 refunded420);
    event StorageSettlementAborting(bytes32 indexed settlementId);
    event StorageSettlementCancelled(bytes32 indexed settlementId, uint256 refunded420);

    constructor(address agreements_, address proofs_) {
        if (agreements_ == address(0) || proofs_ == address(0)) revert ZeroAddress();
        agreements = StorageAgreementRegistry420(agreements_);
        proofs = StorageProofRegistry420(proofs_);
    }

    function systemName() external pure returns (string memory) { return "StorageSettlementRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalSettlementId(bytes32 agreementId, address vault) public view returns (bytes32) {
        return keccak256(abi.encode("420/STORAGE/SETTLEMENT/V1", block.chainid, address(this), agreementId, vault));
    }

    function canonicalChallengeId(bytes32 agreementId, uint32 windowIndex, uint64 challengeEpoch) public pure returns (bytes32) {
        return keccak256(abi.encode("420/STORAGE/SETTLEMENT_CHALLENGE/V1", agreementId, windowIndex, challengeEpoch));
    }

    function canonicalObligationId(bytes32 settlementId, uint32 windowIndex) public pure returns (bytes32) {
        return keccak256(abi.encode("420/STORAGE/SETTLEMENT_OBLIGATION/V1", settlementId, windowIndex));
    }

    function canonicalOperationId(bytes32 settlementId, uint32 windowIndex, bytes32 action) public pure returns (bytes32) {
        return keccak256(abi.encode("420/STORAGE/SETTLEMENT_OPERATION/V1", settlementId, windowIndex, action));
    }

    function openSettlement(bytes32 agreementId, address vault, address asset) external returns (bytes32 settlementId) {
        if (agreementId == bytes32(0) || vault == address(0)) revert InvalidSettlement();
        StorageAgreementRegistry420.Agreement memory agreement = agreements.getAgreement(agreementId);
        if (agreement.consumer != msg.sender || agreement.state != StorageAgreementRegistry420.State.ACTIVE || block.timestamp >= agreement.startTime) revert Unauthorized();

        ResourceOfferRegistry420.Offer memory offer = agreements.offers().getOffer(agreement.offerId);
        ResourceNodeRegistry420.Node memory node = agreements.nodes().getNode(offer.nodeId);
        ResourceProviderRegistry420.Provider memory provider = agreements.providers().getProvider(node.providerId);
        if (provider.operatorAccount == address(0) || offer.unitPrice420 == 0) revert InvalidSettlement();

        uint256 duration = uint256(agreement.endTime) - uint256(agreement.startTime);
        uint32 windowCount = uint32((duration + agreement.proofInterval - 1) / agreement.proofInterval);
        if (windowCount == 0 || windowCount > MAX_SETTLEMENT_WINDOWS || agreement.sizeBytes > offer.maxUnits) revert InvalidSettlement();

        uint256 totalAmount420 = uint256(agreement.sizeBytes) * uint256(offer.unitPrice420);
        if (totalAmount420 == 0) revert InvalidSettlement();

        settlementId = canonicalSettlementId(agreementId, vault);
        if (_settlements[settlementId].exists) revert SettlementExists();
        _settlements[settlementId] = Settlement({
            agreementId: agreementId,
            consumer: msg.sender,
            beneficiary: provider.operatorAccount,
            vault: vault,
            asset: asset,
            totalAmount420: totalAmount420,
            paid420: 0,
            refunded420: 0,
            windowCount: windowCount,
            reservedWindows: 0,
            finalizedWindows: 0,
            state: State.OPEN,
            exists: true
        });
        emit StorageSettlementOpened(settlementId, agreementId, msg.sender, vault, asset, provider.operatorAccount, totalAmount420, windowCount);
    }

    function reserveWindows(bytes32 settlementId, uint32 fromWindow, uint32 count) external {
        Settlement storage settlement = _get(settlementId);
        if (settlement.state != State.OPEN || block.timestamp >= agreements.getAgreement(settlement.agreementId).startTime) revert InvalidState();
        if (count == 0 || fromWindow != settlement.reservedWindows || uint256(fromWindow) + count > settlement.windowCount) revert InvalidWindow();

        IStorageSettlementVault420 vault = IStorageSettlementVault420(settlement.vault);
        for (uint32 i = fromWindow; i < fromWindow + count; ++i) {
            uint256 amount420 = windowAmount(settlementId, i);
            bytes32 obligationId = canonicalObligationId(settlementId, i);
            vault.createObligation(
                canonicalOperationId(settlementId, i, keccak256("RESERVE")),
                obligationId,
                settlement.asset,
                settlement.beneficiary,
                amount420,
                OBLIGATION_STORAGE_PROOF_WINDOW,
                settlement.agreementId
            );
            windowState[settlementId][i] = WindowState.RESERVED;
            settlement.reservedWindows += 1;
            emit StorageWindowReserved(settlementId, i, obligationId, amount420);
        }
        if (settlement.reservedWindows == settlement.windowCount) {
            settlement.state = State.FUNDED;
            emit StorageSettlementFunded(settlementId);
        }
    }

    function settleWindow(bytes32 settlementId, uint32 windowIndex, bytes32 proofId) external {
        Settlement storage settlement = _get(settlementId);
        if (settlement.state != State.FUNDED || windowState[settlementId][windowIndex] != WindowState.RESERVED) revert InvalidState();
        (uint64 epoch,) = windowTiming(settlementId, windowIndex);
        StorageProofRegistry420.ProofReceipt memory receipt = proofs.getProof(proofId);
        StorageAgreementRegistry420.Agreement memory agreement = agreements.getAgreement(settlement.agreementId);
        if (
            receipt.commitmentId != agreement.commitmentId || receipt.challengeEpoch != epoch
                || receipt.challengeId != canonicalChallengeId(settlement.agreementId, windowIndex, epoch)
        ) revert InvalidProof();

        uint256 amount420 = windowAmount(settlementId, windowIndex);
        IStorageSettlementVault420(settlement.vault).releaseObligation(
            canonicalOperationId(settlementId, windowIndex, keccak256("RELEASE")),
            canonicalObligationId(settlementId, windowIndex)
        );
        windowState[settlementId][windowIndex] = WindowState.PAID;
        settlement.paid420 += amount420;
        settlement.finalizedWindows += 1;
        emit StorageWindowPaid(settlementId, windowIndex, proofId, amount420);
        _finishIfComplete(settlementId, settlement);
    }

    function refundMissedWindow(bytes32 settlementId, uint32 windowIndex) external {
        Settlement storage settlement = _get(settlementId);
        if (settlement.state != State.FUNDED || windowState[settlementId][windowIndex] != WindowState.RESERVED) revert InvalidState();
        (, uint64 deadline) = windowTiming(settlementId, windowIndex);
        if (block.timestamp <= deadline) revert ProofDeadlineOpen();
        uint256 amount420 = windowAmount(settlementId, windowIndex);
        IStorageSettlementVault420(settlement.vault).cancelObligation(
            canonicalOperationId(settlementId, windowIndex, keccak256("REFUND")),
            canonicalObligationId(settlementId, windowIndex)
        );
        windowState[settlementId][windowIndex] = WindowState.REFUNDED;
        settlement.refunded420 += amount420;
        settlement.finalizedWindows += 1;
        emit StorageWindowRefunded(settlementId, windowIndex, amount420);
        _finishIfComplete(settlementId, settlement);
    }

    function abortUnfundedSettlement(bytes32 settlementId) external {
        Settlement storage settlement = _get(settlementId);
        if (settlement.state != State.OPEN || block.timestamp < agreements.getAgreement(settlement.agreementId).startTime) revert InvalidState();
        settlement.state = State.ABORTING;
        emit StorageSettlementAborting(settlementId);
        if (settlement.reservedWindows == 0) {
            settlement.state = State.CANCELLED;
            emit StorageSettlementCancelled(settlementId, 0);
        }
    }

    function refundAbortedWindows(bytes32 settlementId, uint32 fromWindow, uint32 count) external {
        Settlement storage settlement = _get(settlementId);
        if (settlement.state != State.ABORTING || count == 0 || uint256(fromWindow) + count > settlement.reservedWindows) revert InvalidState();
        for (uint32 i = fromWindow; i < fromWindow + count; ++i) {
            if (windowState[settlementId][i] != WindowState.RESERVED) continue;
            uint256 amount420 = windowAmount(settlementId, i);
            IStorageSettlementVault420(settlement.vault).cancelObligation(
                canonicalOperationId(settlementId, i, keccak256("ABORT_REFUND")),
                canonicalObligationId(settlementId, i)
            );
            windowState[settlementId][i] = WindowState.REFUNDED;
            settlement.refunded420 += amount420;
            settlement.finalizedWindows += 1;
            emit StorageWindowRefunded(settlementId, i, amount420);
        }
        if (settlement.finalizedWindows == settlement.reservedWindows) {
            settlement.state = State.CANCELLED;
            emit StorageSettlementCancelled(settlementId, settlement.refunded420);
        }
    }

    function windowAmount(bytes32 settlementId, uint32 windowIndex) public view returns (uint256) {
        Settlement memory settlement = _settlements[settlementId];
        if (!settlement.exists || windowIndex >= settlement.windowCount) revert InvalidWindow();
        uint256 base = settlement.totalAmount420 / settlement.windowCount;
        if (windowIndex + 1 == settlement.windowCount) return base + (settlement.totalAmount420 % settlement.windowCount);
        return base;
    }

    function windowTiming(bytes32 settlementId, uint32 windowIndex) public view returns (uint64 challengeEpoch, uint64 deadline) {
        Settlement memory settlement = _settlements[settlementId];
        if (!settlement.exists || windowIndex >= settlement.windowCount) revert InvalidWindow();
        StorageAgreementRegistry420.Agreement memory agreement = agreements.getAgreement(settlement.agreementId);
        uint256 candidate = uint256(agreement.startTime) + uint256(windowIndex + 1) * uint256(agreement.proofInterval);
        challengeEpoch = uint64(candidate > agreement.endTime ? agreement.endTime : candidate);
        StorageProofSchemeRegistry420.Scheme memory scheme = agreements.schemes().getScheme(agreement.proofSchemeId);
        deadline = uint64(uint256(challengeEpoch) + uint256(scheme.maxProofDelay));
    }

    function getSettlement(bytes32 settlementId) external view returns (Settlement memory) { return _get(settlementId); }

    function _finishIfComplete(bytes32 settlementId, Settlement storage settlement) private {
        if (settlement.finalizedWindows == settlement.windowCount) {
            settlement.state = State.COMPLETE;
            emit StorageSettlementCompleted(settlementId, settlement.paid420, settlement.refunded420);
        }
    }

    function _get(bytes32 settlementId) private view returns (Settlement storage settlement) {
        settlement = _settlements[settlementId];
        if (!settlement.exists) revert SettlementNotFound();
    }
}
