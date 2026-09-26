// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeResourceRegistry420.sol";

/// @notice CMP-1.2.2 immutable fixed-price offer publication for paid compute admission.
/// @dev V1 in this increment intentionally supports a deterministic fixed native-$420 quote only.
/// Metered earning remains a later receipt/settlement concern; acceptance may never enlarge this ceiling.
contract ComputeOfferRegistry420 {
    bytes32 private constant OFFER_DOMAIN = keccak256("420/COMPUTE/OFFER/FIXED/V1");

    struct Offer {
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 resourceId;
        uint64 providerRevision;
        uint64 resourceRevision;
        address operator;
        address settlementAccount;
        bytes32 pricingPolicyId;
        uint32 pricingVersion;
        uint256 fixedPrice;
        uint64 validUntil;
        bool exists;
        bool active;
    }

    ComputeResourceRegistry420 public immutable resources;
    ComputeProviderRegistry420 public immutable providers;
    uint64 public nextSerial;
    mapping(bytes32 => Offer) private _offers;

    error InvalidOffer();
    error Unauthorized();
    event OfferPublished(bytes32 indexed offerId, bytes32 indexed providerId, bytes32 indexed resourceId,
        uint256 fixedPrice, bytes32 pricingPolicyId, uint32 pricingVersion, uint64 validUntil);
    event OfferCancelled(bytes32 indexed offerId);

    constructor(address resources_) {
        if (resources_.code.length == 0) revert InvalidOffer();
        resources = ComputeResourceRegistry420(resources_);
        providers = resources.providers();
    }

    function publish(bytes32 resourceId, bytes32 pricingPolicyId, uint32 pricingVersion,
        uint256 fixedPrice, uint64 validUntil) external returns (bytes32 offerId)
    {
        if (resourceId == bytes32(0) || pricingPolicyId == bytes32(0) || pricingVersion == 0
            || fixedPrice == 0 || validUntil <= block.timestamp || !resources.isAvailable(resourceId))
            revert InvalidOffer();

        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(r.nodeId);
        ComputeProviderRegistry420.Provider memory p = providers.provider(r.providerId);
        if (n.providerId != r.providerId || n.operator != msg.sender
            || !providers.isOperator(r.providerId, msg.sender)
            || p.settlementAccount == address(0)) revert Unauthorized();
        if (nextSerial == type(uint64).max) revert InvalidOffer();
        uint64 serial = ++nextSerial;
        offerId = keccak256(abi.encode(OFFER_DOMAIN, block.chainid, address(this), serial,
            r.providerId, resourceId, r.revision, p.revision, pricingPolicyId, pricingVersion, fixedPrice));
        if (_offers[offerId].exists) revert InvalidOffer();
        _offers[offerId] = Offer(r.providerId, r.nodeId, resourceId, p.revision, r.revision,
            msg.sender, p.settlementAccount, pricingPolicyId, pricingVersion,
            fixedPrice, validUntil, true, true);
        emit OfferPublished(offerId, r.providerId, resourceId, fixedPrice, pricingPolicyId, pricingVersion, validUntil);
    }

    function cancel(bytes32 offerId) external {
        Offer storage o = _offers[offerId];
        if (!o.exists || !o.active) revert InvalidOffer();
        if (msg.sender != o.operator) revert Unauthorized();
        o.active = false;
        emit OfferCancelled(offerId);
    }

    function offer(bytes32 offerId) external view returns (Offer memory o) {
        o = _offers[offerId];
        if (!o.exists) revert InvalidOffer();
    }

    function isEffective(bytes32 offerId) public view returns (bool) {
        Offer storage o = _offers[offerId];
        if (!o.exists || !o.active || block.timestamp > o.validUntil
            || !resources.isAvailable(o.resourceId)) return false;
        ComputeResourceRegistry420.Resource memory r = resources.resource(o.resourceId);
        if (r.providerId != o.providerId || r.nodeId != o.nodeId || r.revision != o.resourceRevision) return false;
        ComputeProviderRegistry420.Provider memory p = providers.provider(o.providerId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(o.nodeId);
        return p.revision == o.providerRevision && p.settlementAccount == o.settlementAccount
            && n.providerId == o.providerId && n.operator == o.operator
            && providers.isOperator(o.providerId, o.operator);
    }
}
