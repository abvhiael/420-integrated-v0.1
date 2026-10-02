// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeResourceRegistry420.sol";

/// @notice Canonical worker-offer registry for ComputeMarket.
/// @dev CMP-2.1 extends the prior fixed-price admission offer with explicit availability,
/// jurisdiction, revision history, resource-profile snapshots and scoped delegated authority.
/// It does not create requests, matches, reservations, settlement or scheduler authority.
contract ComputeOfferRegistry420 is I420System {
    bytes32 private constant OFFER_DOMAIN = keccak256("420/COMPUTE/OFFER/V2");
    bytes32 public constant LEGACY_JURISDICTION = keccak256("420/COMPUTE/JURISDICTION/UNSPECIFIED/V1");

    struct Offer {
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 resourceId;
        uint64 providerRevision;
        uint64 resourceRevision;
        address operator;
        address settlementAccount;

        bytes32 computeClass;
        bytes32 hardwareProfileHash;
        bytes32 runtimeProfileHash;
        bytes32 capabilityHash;
        uint256 capacityUnits;

        bytes32 jurisdictionHash;
        uint64 availableFrom;
        uint64 validUntil;

        bytes32 pricingPolicyId;
        uint32 pricingVersion;
        uint256 fixedPrice;

        uint64 revision;
        bytes32 predecessorCommitment;
        bool exists;
        bool active;
    }

    ComputeResourceRegistry420 public immutable resources;
    ComputeProviderRegistry420 public immutable providers;
    ComputeAuthorization420 public immutable authorization;

    uint64 public nextSerial;
    mapping(bytes32 => Offer) private _offers;
    mapping(bytes32 => mapping(uint64 => Offer)) private _history;

    error InvalidOffer();
    error Unauthorized();
    error SerialExhausted();

    event OfferPublished(
        bytes32 indexed offerId,
        bytes32 indexed providerId,
        bytes32 indexed resourceId,
        address actor,
        uint64 revision,
        uint256 fixedPrice,
        bytes32 jurisdictionHash,
        uint64 availableFrom,
        uint64 validUntil
    );
    event OfferRevised(
        bytes32 indexed offerId,
        uint64 oldRevision,
        uint64 newRevision,
        address indexed actor,
        bytes32 oldCommitment,
        bytes32 newCommitment
    );
    event OfferCancelled(bytes32 indexed offerId, uint64 indexed revision, address indexed actor);

    constructor(address resources_, address authorization_) {
        if (resources_.code.length == 0 || authorization_.code.length == 0) revert InvalidOffer();
        resources = ComputeResourceRegistry420(resources_);
        providers = resources.providers();
        authorization = ComputeAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeOfferRegistry420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 2;
    }

    /// @notice Backward-compatible fixed-price publication used by the prior accepted-price path.
    /// @dev Direct canonical operator only. CMP-2.1 callers should use publishWorkerOffer.
    function publish(
        bytes32 resourceId,
        bytes32 pricingPolicyId,
        uint32 pricingVersion,
        uint256 fixedPrice,
        uint64 validUntil
    ) external returns (bytes32 offerId) {
        offerId = _publish(
            resourceId,
            LEGACY_JURISDICTION,
            uint64(block.timestamp),
            validUntil,
            pricingPolicyId,
            pricingVersion,
            fixedPrice,
            false,
            false
        );
    }

    /// @notice Publish a worker-market offer advertising resource profile, capacity,
    /// availability window, jurisdiction commitment and fixed native-$420 price.
    function publishWorkerOffer(
        bytes32 resourceId,
        bytes32 jurisdictionHash,
        uint64 availableFrom,
        uint64 validUntil,
        bytes32 pricingPolicyId,
        uint32 pricingVersion,
        uint256 fixedPrice
    ) external returns (bytes32 offerId) {
        offerId = _publish(
            resourceId,
            jurisdictionHash,
            availableFrom,
            validUntil,
            pricingPolicyId,
            pricingVersion,
            fixedPrice,
            true,
            false
        );
    }

    /// @notice Revise future-facing terms for the same offer identity.
    /// @dev Refreshes provider/resource revision and advertised resource-profile snapshots.
    function updateOffer(
        bytes32 offerId,
        bytes32 jurisdictionHash,
        uint64 availableFrom,
        uint64 validUntil,
        bytes32 pricingPolicyId,
        uint32 pricingVersion,
        uint256 fixedPrice
    ) external {
        Offer storage current = _offers[offerId];
        if (!current.exists || !current.active) revert InvalidOffer();
        if (
            jurisdictionHash == bytes32(0) || pricingPolicyId == bytes32(0)
                || pricingVersion == 0 || fixedPrice == 0
                || availableFrom > validUntil || validUntil <= block.timestamp
                || !resources.isAvailable(current.resourceId)
        ) revert InvalidOffer();

        ComputeResourceRegistry420.Resource memory r = resources.resource(current.resourceId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(r.nodeId);
        ComputeProviderRegistry420.Provider memory p = providers.provider(r.providerId);
        _requireAuthority(
            msg.sender,
            authorization.ACTION_UPDATE_OFFER(),
            r.providerId,
            r.nodeId,
            current.resourceId,
            fixedPrice,
            true,
            false
        );

        if (
            r.providerId != current.providerId || r.nodeId != current.nodeId
                || p.settlementAccount == address(0)
        ) revert InvalidOffer();

        Offer memory old = current;
        bytes32 oldCommitment = _commitment(old);
        if (old.revision == type(uint64).max) revert SerialExhausted();

        current.providerRevision = p.revision;
        current.resourceRevision = r.revision;
        current.operator = n.operator;
        current.settlementAccount = p.settlementAccount;
        current.computeClass = r.computeClass;
        current.hardwareProfileHash = r.hardwareProfileHash;
        current.runtimeProfileHash = r.runtimeProfileHash;
        current.capabilityHash = r.capabilityHash;
        current.capacityUnits = r.capacityUnits;
        current.jurisdictionHash = jurisdictionHash;
        current.availableFrom = availableFrom;
        current.validUntil = validUntil;
        current.pricingPolicyId = pricingPolicyId;
        current.pricingVersion = pricingVersion;
        current.fixedPrice = fixedPrice;
        current.predecessorCommitment = oldCommitment;
        current.revision = old.revision + 1;

        Offer memory revised = current;
        _history[offerId][revised.revision] = revised;
        emit OfferRevised(
            offerId,
            old.revision,
            revised.revision,
            msg.sender,
            oldCommitment,
            _commitment(revised)
        );
    }

    function cancel(bytes32 offerId) external {
        Offer storage o = _offers[offerId];
        if (!o.exists || !o.active) revert InvalidOffer();
        _requireAuthority(
            msg.sender,
            authorization.ACTION_CANCEL_OFFER(),
            o.providerId,
            o.nodeId,
            o.resourceId,
            0,
            true,
            true
        );
        o.active = false;
        _history[offerId][o.revision] = o;
        emit OfferCancelled(offerId, o.revision, msg.sender);
    }

    function offer(bytes32 offerId) external view returns (Offer memory o) {
        o = _offers[offerId];
        if (!o.exists) revert InvalidOffer();
    }

    function revision(bytes32 offerId, uint64 version) external view returns (Offer memory o) {
        o = _history[offerId][version];
        if (!o.exists) revert InvalidOffer();
    }

    function commitment(bytes32 offerId, uint64 version) external view returns (bytes32) {
        Offer memory o = _history[offerId][version];
        if (!o.exists) revert InvalidOffer();
        return _commitment(o);
    }

    function isEffective(bytes32 offerId) public view returns (bool) {
        Offer storage o = _offers[offerId];
        if (
            !o.exists || !o.active || block.timestamp < o.availableFrom
                || block.timestamp > o.validUntil || !resources.isAvailable(o.resourceId)
        ) return false;

        ComputeResourceRegistry420.Resource memory r = resources.resource(o.resourceId);
        if (
            r.providerId != o.providerId || r.nodeId != o.nodeId
                || r.revision != o.resourceRevision || r.computeClass != o.computeClass
                || r.hardwareProfileHash != o.hardwareProfileHash
                || r.runtimeProfileHash != o.runtimeProfileHash
                || r.capabilityHash != o.capabilityHash
                || r.capacityUnits != o.capacityUnits
        ) return false;

        ComputeProviderRegistry420.Provider memory p = providers.provider(o.providerId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(o.nodeId);
        return p.revision == o.providerRevision && p.settlementAccount == o.settlementAccount
            && n.providerId == o.providerId && n.operator == o.operator
            && providers.isOperator(o.providerId, o.operator);
    }

    function _publish(
        bytes32 resourceId,
        bytes32 jurisdictionHash,
        uint64 availableFrom,
        uint64 validUntil,
        bytes32 pricingPolicyId,
        uint32 pricingVersion,
        uint256 fixedPrice,
        bool allowDelegated,
        bool allowInactiveOperator
    ) private returns (bytes32 offerId) {
        if (
            resourceId == bytes32(0) || jurisdictionHash == bytes32(0)
                || pricingPolicyId == bytes32(0) || pricingVersion == 0
                || fixedPrice == 0 || availableFrom > validUntil
                || validUntil <= block.timestamp || !resources.isAvailable(resourceId)
        ) revert InvalidOffer();

        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(r.nodeId);
        ComputeProviderRegistry420.Provider memory p = providers.provider(r.providerId);

        _requireAuthority(
            msg.sender,
            authorization.ACTION_PUBLISH_OFFER(),
            r.providerId,
            r.nodeId,
            resourceId,
            fixedPrice,
            allowDelegated,
            allowInactiveOperator
        );

        if (n.providerId != r.providerId || p.settlementAccount == address(0)) revert InvalidOffer();
        if (nextSerial == type(uint64).max) revert SerialExhausted();
        uint64 serial = ++nextSerial;

        offerId = keccak256(
            abi.encode(
                OFFER_DOMAIN,
                block.chainid,
                address(this),
                serial,
                r.providerId,
                r.nodeId,
                resourceId,
                r.revision,
                p.revision,
                jurisdictionHash,
                availableFrom,
                validUntil,
                pricingPolicyId,
                pricingVersion,
                fixedPrice
            )
        );
        if (_offers[offerId].exists) revert InvalidOffer();

        Offer memory o = Offer({
            providerId: r.providerId,
            nodeId: r.nodeId,
            resourceId: resourceId,
            providerRevision: p.revision,
            resourceRevision: r.revision,
            operator: n.operator,
            settlementAccount: p.settlementAccount,
            computeClass: r.computeClass,
            hardwareProfileHash: r.hardwareProfileHash,
            runtimeProfileHash: r.runtimeProfileHash,
            capabilityHash: r.capabilityHash,
            capacityUnits: r.capacityUnits,
            jurisdictionHash: jurisdictionHash,
            availableFrom: availableFrom,
            validUntil: validUntil,
            pricingPolicyId: pricingPolicyId,
            pricingVersion: pricingVersion,
            fixedPrice: fixedPrice,
            revision: 1,
            predecessorCommitment: bytes32(0),
            exists: true,
            active: true
        });
        _offers[offerId] = o;
        _history[offerId][1] = o;

        emit OfferPublished(
            offerId,
            r.providerId,
            resourceId,
            msg.sender,
            1,
            fixedPrice,
            jurisdictionHash,
            availableFrom,
            validUntil
        );
    }

    function _requireAuthority(
        address actor,
        bytes32 action,
        bytes32 providerId,
        bytes32 nodeId,
        bytes32 resourceId,
        uint256 amount,
        bool allowDelegated,
        bool allowInactiveOperator
    ) private view {
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(nodeId);
        if (
            actor == n.operator
                && (allowInactiveOperator || providers.isOperator(providerId, actor))
        ) return;

        if (!allowDelegated) revert Unauthorized();
        bytes32 scope = authorization.scopeResource(providerId, nodeId, resourceId);
        if (!authorization.isAuthorized(actor, action, scope, amount)) revert Unauthorized();
    }

    function _commitment(Offer memory o) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                o.providerId,
                o.nodeId,
                o.resourceId,
                o.providerRevision,
                o.resourceRevision,
                o.operator,
                o.settlementAccount,
                o.computeClass,
                o.hardwareProfileHash,
                o.runtimeProfileHash,
                o.capabilityHash,
                o.capacityUnits,
                o.jurisdictionHash,
                o.availableFrom,
                o.validUntil,
                o.pricingPolicyId,
                o.pricingVersion,
                o.fixedPrice,
                o.revision,
                o.predecessorCommitment,
                o.exists,
                o.active
            )
        );
    }
}
