// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceAuthorization420.sol";
import "./ResourceIds420.sol";
import "./ResourceNodeRegistry420.sol";
import "./ResourceOfferRegistry420.sol";
import "./ResourceProviderRegistry420.sol";
import "./StorageCapacityRegistry420.sol";
import "./StorageCommitmentRegistry420.sol";
import "./StorageProofIds420.sol";
import "./StorageProofSchemeRegistry420.sol";

/// @notice Canonical 420Store agreement lifecycle binding a consumer request to
///         a STORE offer, locked node capacity and an immutable provider storage commitment.
/// @dev Payload bytes remain off-chain. This registry anchors object identity,
///      durability policy, timing, capacity and the commitment that the proof layer verifies.
contract StorageAgreementRegistry420 is I420System {
    uint32 public constant MAX_TOTAL_SHARDS = 1024;

    enum State { NONE, PROPOSED, ACTIVE, COMPLETED, CANCELLED }

    struct Agreement {
        address consumer;
        bytes32 offerId;
        bytes32 objectId;
        bytes32 contentRoot;
        bytes32 manifestHash;
        bytes32 storageClass;
        bytes32 repairPolicyHash;
        bytes32 proofSchemeId;
        bytes32 commitmentId;
        bytes32 capacityReservationId;
        uint128 sizeBytes;
        uint64 startTime;
        uint64 endTime;
        uint64 proofInterval;
        uint32 dataShards;
        uint32 totalShards;
        State state;
        bool exists;
    }

    ResourceAuthorization420 public immutable authorization;
    ResourceOfferRegistry420 public immutable offers;
    ResourceNodeRegistry420 public immutable nodes;
    ResourceProviderRegistry420 public immutable providers;
    StorageProofSchemeRegistry420 public immutable schemes;
    StorageCommitmentRegistry420 public immutable commitments;
    StorageCapacityRegistry420 public immutable capacity;

    mapping(bytes32 => Agreement) private _agreements;
    mapping(bytes32 => bytes32) public collateralReservation;
    mapping(bytes32 => bytes32) public settlementForAgreement;
    mapping(bytes32 => bool) public settlementFinalized;
    mapping(bytes32 => bool) public collateralReleased;
    mapping(bytes32 => bytes32) public agreementForCommitment;
    address public settlementController;
    bytes32 public settlementControllerCodeHash;
    event AgreementSettlementBound(bytes32 indexed agreementId, bytes32 indexed settlementId);
    event AgreementSettlementFinalized(bytes32 indexed agreementId, bytes32 indexed settlementId);
    event AgreementCollateralReleased(bytes32 indexed agreementId);

    error ZeroAddress();
    error InvalidAgreement();
    error AgreementExists();
    error AgreementNotFound();
    error InvalidState();
    error InvalidStoreOffer();
    error InactiveProofScheme();
    error CommitmentMismatch();
    error CapacityReservationMismatch();
    error Unauthorized();

    event StorageAgreementProposed(
        bytes32 indexed agreementId,
        address indexed consumer,
        bytes32 indexed offerId,
        bytes32 objectId,
        bytes32 contentRoot,
        uint128 sizeBytes,
        uint64 startTime,
        uint64 endTime
    );
    event StorageAgreementActivated(
        bytes32 indexed agreementId,
        bytes32 indexed commitmentId,
        bytes32 indexed nodeId,
        bytes32 capacityReservationId
    );
    event StorageAgreementCompleted(bytes32 indexed agreementId);
    event StorageAgreementCancelled(bytes32 indexed agreementId);

    constructor(
        address authorization_,
        address offers_,
        address nodes_,
        address providers_,
        address schemes_,
        address commitments_,
        address capacity_
    ) {
        if (
            authorization_ == address(0) || offers_ == address(0) || nodes_ == address(0)
                || providers_ == address(0) || schemes_ == address(0) || commitments_ == address(0)
                || capacity_ == address(0)
        ) revert ZeroAddress();
        authorization = ResourceAuthorization420(authorization_);
        offers = ResourceOfferRegistry420(offers_);
        nodes = ResourceNodeRegistry420(nodes_);
        providers = ResourceProviderRegistry420(providers_);
        schemes = StorageProofSchemeRegistry420(schemes_);
        commitments = StorageCommitmentRegistry420(commitments_);
        capacity = StorageCapacityRegistry420(capacity_);
    }

    function systemName() external pure returns (string memory) { return "StorageAgreementRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalAgreementId(address consumer, bytes32 offerId, bytes32 objectId, uint256 nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode("420/STORAGE/AGREEMENT/V1", block.chainid, address(this), consumer, offerId, objectId, nonce));
    }

    function proposeAgreement(
        bytes32 offerId,
        bytes32 objectId,
        bytes32 contentRoot,
        bytes32 manifestHash,
        bytes32 storageClass,
        bytes32 repairPolicyHash,
        bytes32 proofSchemeId,
        uint128 sizeBytes,
        uint64 startTime,
        uint64 endTime,
        uint64 proofInterval,
        uint32 dataShards,
        uint32 totalShards,
        uint256 nonce
    ) external returns (bytes32 agreementId) {
        if (
            offerId == bytes32(0) || objectId == bytes32(0) || contentRoot == bytes32(0) || manifestHash == bytes32(0)
                || storageClass == bytes32(0) || repairPolicyHash == bytes32(0) || proofSchemeId == bytes32(0)
                || sizeBytes == 0 || startTime <= block.timestamp || startTime >= endTime || proofInterval == 0
                || uint256(proofInterval) > uint256(endTime) - uint256(startTime) || dataShards == 0
                || totalShards < dataShards || totalShards > MAX_TOTAL_SHARDS
        ) revert InvalidAgreement();

        ResourceOfferRegistry420.Offer memory offer = offers.getOffer(offerId);
        if (offer.serviceId != ResourceIds420.SERVICE_STORE || !offers.isEffective(offerId)) revert InvalidStoreOffer();
        if (sizeBytes > offer.maxUnits) revert InvalidStoreOffer();
        if (offer.validUntil != 0 && offer.validUntil < startTime) revert InvalidStoreOffer();
        if (!schemes.isActive(proofSchemeId)) revert InactiveProofScheme();

        agreementId = canonicalAgreementId(msg.sender, offerId, objectId, nonce);
        if (_agreements[agreementId].exists) revert AgreementExists();

        _agreements[agreementId] = Agreement({
            consumer: msg.sender,
            offerId: offerId,
            objectId: objectId,
            contentRoot: contentRoot,
            manifestHash: manifestHash,
            storageClass: storageClass,
            repairPolicyHash: repairPolicyHash,
            proofSchemeId: proofSchemeId,
            commitmentId: bytes32(0),
            capacityReservationId: bytes32(0),
            sizeBytes: sizeBytes,
            startTime: startTime,
            endTime: endTime,
            proofInterval: proofInterval,
            dataShards: dataShards,
            totalShards: totalShards,
            state: State.PROPOSED,
            exists: true
        });

        emit StorageAgreementProposed(agreementId, msg.sender, offerId, objectId, contentRoot, sizeBytes, startTime, endTime);
    }

    function activateAgreement(bytes32 agreementId, bytes32 commitmentId, bytes32 capacityReservationId) external {
        Agreement storage agreement = _get(agreementId);
        if (
            agreement.state != State.PROPOSED || commitmentId == bytes32(0) || capacityReservationId == bytes32(0)
                || block.timestamp >= agreement.startTime
        ) revert InvalidState();

        ResourceOfferRegistry420.Offer memory offer = offers.getOffer(agreement.offerId);
        if (offer.serviceId != ResourceIds420.SERVICE_STORE || !offers.isEffective(agreement.offerId)) revert InvalidStoreOffer();

        ResourceNodeRegistry420.Node memory node = nodes.getNode(offer.nodeId);
        ResourceProviderRegistry420.Provider memory provider = providers.getProvider(node.providerId);
        if (
            msg.sender != node.operatorAccount && msg.sender != provider.operatorAccount
                && !authorization.isNodeAuthorized(msg.sender, node.providerId, offer.nodeId, StorageProofIds420.ACTION_ACCEPT_STORAGE_AGREEMENT)
        ) revert Unauthorized();

        StorageCapacityRegistry420.Reservation memory reservation = capacity.getReservation(capacityReservationId);
        if (
            !reservation.active || reservation.nodeId != offer.nodeId || reservation.agreementId != agreementId
                || reservation.sizeBytes != agreement.sizeBytes || reservation.releaseAfter < agreement.endTime
                || !capacity.isReservationActive(capacityReservationId)
        ) revert CapacityReservationMismatch();

        StorageCommitmentRegistry420.Commitment memory commitment = commitments.getCommitment(commitmentId);
        if (
            commitment.nodeId != offer.nodeId || commitment.providerId != node.providerId
                || commitment.proofSchemeId != agreement.proofSchemeId || commitment.contentRoot != agreement.contentRoot
                || commitment.sizeBytes != agreement.sizeBytes || commitment.startTime != agreement.startTime
                || commitment.endTime != agreement.endTime
        ) revert CommitmentMismatch();

        if (agreementForCommitment[commitmentId] != bytes32(0)) revert CommitmentMismatch();
        if (agreement.sizeBytes > offer.maxUnits) revert InvalidStoreOffer();
        collateralReservation[agreementId] = providers.collateral().reserveExposure(
            node.providerId, agreementId, uint256(agreement.sizeBytes) * uint256(offer.unitPrice420)
        );
        agreementForCommitment[commitmentId] = agreementId;
        agreement.commitmentId = commitmentId;
        agreement.capacityReservationId = capacityReservationId;
        agreement.state = State.ACTIVE;
        emit StorageAgreementActivated(agreementId, commitmentId, offer.nodeId, capacityReservationId);
    }

    function cancelAgreement(bytes32 agreementId) external {
        Agreement storage agreement = _get(agreementId);
        if (agreement.state != State.PROPOSED) revert InvalidState();
        if (msg.sender != agreement.consumer) revert Unauthorized();
        agreement.state = State.CANCELLED;
        emit StorageAgreementCancelled(agreementId);
    }

    function completeAgreement(bytes32 agreementId) external {
        Agreement storage agreement = _get(agreementId);
        if (agreement.state != State.ACTIVE || block.timestamp <= agreement.endTime) revert InvalidState();
        agreement.state = State.COMPLETED;
        emit StorageAgreementCompleted(agreementId);
        _releaseIfDischarged(agreementId, agreement);
    }

    function bindSettlementController(address controller) external {
        if (msg.sender != providers.governanceTimelock() || settlementController != address(0)
            || controller.code.length == 0) revert Unauthorized();
        settlementController = controller;
        settlementControllerCodeHash = controller.codehash;
    }

    function registerSettlement(bytes32 agreementId, bytes32 settlementId) external {
        _requireSettlementController();
        Agreement storage a = _get(agreementId);
        if (a.state != State.ACTIVE || block.timestamp >= a.startTime || settlementId == bytes32(0)
            || settlementForAgreement[agreementId] != bytes32(0) || collateralReservation[agreementId] == bytes32(0))
            revert InvalidState();
        settlementForAgreement[agreementId] = settlementId;
        emit AgreementSettlementBound(agreementId, settlementId);
    }

    function finalizeSettlement(bytes32 agreementId, bytes32 settlementId) external {
        _requireSettlementController();
        Agreement storage a = _get(agreementId);
        if (settlementId == bytes32(0) || settlementForAgreement[agreementId] != settlementId
            || settlementFinalized[agreementId]) revert InvalidState();
        settlementFinalized[agreementId] = true;
        emit AgreementSettlementFinalized(agreementId, settlementId);
        _releaseIfDischarged(agreementId, a);
    }

    function _requireSettlementController() private view {
        if (msg.sender != settlementController || msg.sender.codehash != settlementControllerCodeHash) revert Unauthorized();
    }

    function releaseDischargedAgreement(bytes32 agreementId) external {
        Agreement storage a = _get(agreementId);
        _releaseIfDischarged(agreementId, a);
        if (!collateralReleased[agreementId]) revert InvalidState();
    }

    function _releaseIfDischarged(bytes32 agreementId, Agreement storage a) private {
        if (collateralReleased[agreementId] || a.state != State.COMPLETED
            || block.timestamp <= commitments.collateralReleaseAfter(a.commitmentId)
            || (settlementForAgreement[agreementId] != bytes32(0) && !settlementFinalized[agreementId])) return;
        collateralReleased[agreementId] = true;
        providers.collateral().releaseExposure(collateralReservation[agreementId]);
        emit AgreementCollateralReleased(agreementId);
    }

    function getAgreement(bytes32 agreementId) external view returns (Agreement memory) { return _get(agreementId); }

    function isEffective(bytes32 agreementId) external view returns (bool) {
        Agreement memory agreement = _agreements[agreementId];
        return agreement.exists && agreement.state == State.ACTIVE && block.timestamp >= agreement.startTime
            && block.timestamp <= agreement.endTime && commitments.isLive(agreement.commitmentId);
    }

    function _get(bytes32 agreementId) private view returns (Agreement storage agreement) {
        agreement = _agreements[agreementId];
        if (!agreement.exists) revert AgreementNotFound();
    }
}
