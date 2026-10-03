// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeResourceRegistry420.sol";
import "./ComputePricing420.sol";

contract ComputeOfferRegistry420 is I420System {
    bytes32 private constant OFFER_DOMAIN = keccak256("420/COMPUTE/OFFER/V2");
    bytes32 public constant LEGACY_JURISDICTION = keccak256("420/COMPUTE/JURISDICTION/UNSPECIFIED/V1");

    struct Offer {
        bytes32 providerId; bytes32 nodeId; bytes32 resourceId;
        uint64 providerRevision; uint64 resourceRevision;
        address operator; address settlementAccount;
        bytes32 computeClass; bytes32 hardwareProfileHash; bytes32 runtimeProfileHash; bytes32 capabilityHash;
        uint256 capacityUnits;
        bytes32 jurisdictionHash; uint64 availableFrom; uint64 validUntil;
        bytes32 pricingPolicyId; uint32 pricingVersion;
        uint256 fixedPrice; ComputePricing420.Model pricingModel;
        uint256 unitRate; uint256 unitScale; uint256 minimumCharge; uint256 maximumCharge;
        uint256 maximumBillableUnits; bytes32 pricingTermsCommitment;
        uint64 revision; bytes32 predecessorCommitment; bool exists; bool active;
    }

    ComputeResourceRegistry420 public immutable resources;
    ComputeProviderRegistry420 public immutable providers;
    ComputeAuthorization420 public immutable authorization;
    uint64 public nextSerial;
    mapping(bytes32 => Offer) private _offers;
    mapping(bytes32 => mapping(uint64 => Offer)) private _history;

    error InvalidOffer(); error Unauthorized(); error SerialExhausted();

    event OfferPublished(
        bytes32 indexed offerId, bytes32 indexed providerId, bytes32 indexed resourceId,
        address actor, uint64 revision, uint256 fixedPrice, bytes32 jurisdictionHash,
        uint64 availableFrom, uint64 validUntil
    );
    event OfferPricingPublished(
        bytes32 indexed offerId, ComputePricing420.Model indexed pricingModel,
        uint256 unitRate, uint256 unitScale, uint256 minimumCharge, uint256 maximumCharge,
        uint256 maximumBillableUnits, bytes32 pricingTermsCommitment
    );
    event OfferRevised(
        bytes32 indexed offerId, uint64 oldRevision, uint64 newRevision, address indexed actor,
        bytes32 oldCommitment, bytes32 newCommitment
    );
    event OfferCancelled(bytes32 indexed offerId, uint64 indexed revision, address indexed actor);

    constructor(address resources_, address authorization_) {
        if (resources_.code.length == 0 || authorization_.code.length == 0) revert InvalidOffer();
        resources = ComputeResourceRegistry420(resources_);
        providers = resources.providers();
        authorization = ComputeAuthorization420(authorization_);
    }
    function systemName() external pure returns (string memory) { return "ComputeOfferRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 3; }

    function publish(bytes32 resourceId, bytes32 pricingPolicyId, uint32 pricingVersion, uint256 fixedPrice, uint64 validUntil)
        external returns (bytes32)
    {
        return _publish(resourceId, LEGACY_JURISDICTION, uint64(block.timestamp), validUntil,
            pricingPolicyId, pricingVersion, ComputePricing420.fixedTerms(fixedPrice), false, false);
    }

    function publishWorkerOffer(
        bytes32 resourceId, bytes32 jurisdictionHash, uint64 availableFrom, uint64 validUntil,
        bytes32 pricingPolicyId, uint32 pricingVersion, uint256 fixedPrice
    ) external returns (bytes32) {
        return _publish(resourceId, jurisdictionHash, availableFrom, validUntil,
            pricingPolicyId, pricingVersion, ComputePricing420.fixedTerms(fixedPrice), true, false);
    }

    function publishPricedWorkerOffer(
        bytes32 resourceId, bytes32 jurisdictionHash, uint64 availableFrom, uint64 validUntil,
        bytes32 pricingPolicyId, uint32 pricingVersion, ComputePricing420.Terms calldata pricing
    ) external returns (bytes32) {
        return _publish(resourceId, jurisdictionHash, availableFrom, validUntil,
            pricingPolicyId, pricingVersion, pricing, true, false);
    }

    function updateOffer(
        bytes32 offerId, bytes32 jurisdictionHash, uint64 availableFrom, uint64 validUntil,
        bytes32 pricingPolicyId, uint32 pricingVersion, uint256 fixedPrice
    ) external {
        _updateOffer(offerId, jurisdictionHash, availableFrom, validUntil,
            pricingPolicyId, pricingVersion, ComputePricing420.fixedTerms(fixedPrice));
    }

    function updatePricedOffer(
        bytes32 offerId, bytes32 jurisdictionHash, uint64 availableFrom, uint64 validUntil,
        bytes32 pricingPolicyId, uint32 pricingVersion, ComputePricing420.Terms calldata pricing
    ) external {
        _updateOffer(offerId, jurisdictionHash, availableFrom, validUntil,
            pricingPolicyId, pricingVersion, pricing);
    }

    function _updateOffer(
        bytes32 offerId, bytes32 jurisdictionHash, uint64 availableFrom, uint64 validUntil,
        bytes32 pricingPolicyId, uint32 pricingVersion, ComputePricing420.Terms memory pricing
    ) private {
        Offer storage current = _offers[offerId];
        if (!current.exists || !current.active) revert InvalidOffer();
        if (jurisdictionHash == bytes32(0) || pricingPolicyId == bytes32(0) || pricingVersion == 0
            || !ComputePricing420.isValid(pricing) || availableFrom > validUntil
            || validUntil <= block.timestamp || !resources.isAvailable(current.resourceId)) revert InvalidOffer();

        ComputeResourceRegistry420.Resource memory r = resources.resource(current.resourceId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(r.nodeId);
        ComputeProviderRegistry420.Provider memory p = providers.provider(r.providerId);
        _requireAuthority(msg.sender, authorization.ACTION_UPDATE_OFFER(), r.providerId, r.nodeId,
            current.resourceId, ComputePricing420.authorityAmount(pricing), true, false);
        if (r.providerId != current.providerId || r.nodeId != current.nodeId || p.settlementAccount == address(0))
            revert InvalidOffer();

        Offer memory old = current;
        bytes32 oldCommitment = _commitment(old);
        if (old.revision == type(uint64).max) revert SerialExhausted();
        current.providerRevision = p.revision; current.resourceRevision = r.revision;
        current.operator = n.operator; current.settlementAccount = p.settlementAccount;
        current.computeClass = r.computeClass; current.hardwareProfileHash = r.hardwareProfileHash;
        current.runtimeProfileHash = r.runtimeProfileHash; current.capabilityHash = r.capabilityHash;
        current.capacityUnits = r.capacityUnits; current.jurisdictionHash = jurisdictionHash;
        current.availableFrom = availableFrom; current.validUntil = validUntil;
        current.pricingPolicyId = pricingPolicyId; current.pricingVersion = pricingVersion;
        _setPricing(current, pricing);
        current.predecessorCommitment = oldCommitment; current.revision = old.revision + 1;
        Offer memory revised = current; _history[offerId][revised.revision] = revised;
        emit OfferRevised(offerId, old.revision, revised.revision, msg.sender, oldCommitment, _commitment(revised));
        _emitPricing(offerId, revised);
    }

    function cancel(bytes32 offerId) external {
        Offer storage current = _offers[offerId];
        if (!current.exists || !current.active) revert InvalidOffer();
        _requireAuthority(msg.sender, authorization.ACTION_CANCEL_OFFER(), current.providerId, current.nodeId,
            current.resourceId, 0, true, true);
        Offer memory old = current;
        if (old.revision == type(uint64).max) revert SerialExhausted();
        current.predecessorCommitment = _commitment(old); current.revision = old.revision + 1; current.active = false;
        Offer memory cancelled = current; _history[offerId][cancelled.revision] = cancelled;
        emit OfferCancelled(offerId, cancelled.revision, msg.sender);
    }

    function offer(bytes32 offerId) external view returns (Offer memory o) {
        o = _offers[offerId]; if (!o.exists) revert InvalidOffer();
    }
    function revision(bytes32 offerId, uint64 version) external view returns (Offer memory o) {
        o = _history[offerId][version]; if (!o.exists) revert InvalidOffer();
    }
    function commitment(bytes32 offerId, uint64 version) external view returns (bytes32) {
        Offer memory o = _history[offerId][version]; if (!o.exists) revert InvalidOffer(); return _commitment(o);
    }
    function quoteMaximum(bytes32 offerId, uint256 billableUnits) external view returns (uint256) {
        Offer memory o = _offers[offerId]; if (!o.exists || !o.active) revert InvalidOffer();
        (bool ok, uint256 quoted) = ComputePricing420.quoteMaximum(_pricing(o), billableUnits);
        if (!ok) revert InvalidOffer(); return quoted;
    }

    function isEffective(bytes32 offerId) public view returns (bool) {
        Offer storage o = _offers[offerId];
        if (!o.exists || !o.active || block.timestamp < o.availableFrom || block.timestamp > o.validUntil
            || !resources.isAvailable(o.resourceId) || !ComputePricing420.isValid(_pricing(o))
            || ComputePricing420.commitment(_pricing(o)) != o.pricingTermsCommitment) return false;
        ComputeResourceRegistry420.Resource memory r = resources.resource(o.resourceId);
        if (r.providerId != o.providerId || r.nodeId != o.nodeId || r.revision != o.resourceRevision
            || r.computeClass != o.computeClass || r.hardwareProfileHash != o.hardwareProfileHash
            || r.runtimeProfileHash != o.runtimeProfileHash || r.capabilityHash != o.capabilityHash
            || r.capacityUnits != o.capacityUnits) return false;
        ComputeProviderRegistry420.Provider memory p = providers.provider(o.providerId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(o.nodeId);
        return p.revision == o.providerRevision && p.settlementAccount == o.settlementAccount
            && n.providerId == o.providerId && n.operator == o.operator && providers.isOperator(o.providerId, o.operator);
    }

    function _publish(
        bytes32 resourceId, bytes32 jurisdictionHash, uint64 availableFrom, uint64 validUntil,
        bytes32 pricingPolicyId, uint32 pricingVersion, ComputePricing420.Terms memory pricing,
        bool allowDelegated, bool allowInactiveOperator
    ) private returns (bytes32 offerId) {
        if (resourceId == bytes32(0) || jurisdictionHash == bytes32(0) || pricingPolicyId == bytes32(0)
            || pricingVersion == 0 || !ComputePricing420.isValid(pricing) || availableFrom > validUntil
            || validUntil <= block.timestamp || !resources.isAvailable(resourceId)) revert InvalidOffer();
        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(r.nodeId);
        ComputeProviderRegistry420.Provider memory p = providers.provider(r.providerId);
        _requireAuthority(msg.sender, authorization.ACTION_PUBLISH_OFFER(), r.providerId, r.nodeId,
            resourceId, ComputePricing420.authorityAmount(pricing), allowDelegated, allowInactiveOperator);
        if (n.providerId != r.providerId || p.settlementAccount == address(0)) revert InvalidOffer();
        if (nextSerial == type(uint64).max) revert SerialExhausted();
        uint64 serial = ++nextSerial;
        bytes32 pricingCommitment = ComputePricing420.commitment(pricing);
        offerId = keccak256(abi.encode(OFFER_DOMAIN, block.chainid, address(this), serial, r.providerId,
            r.nodeId, resourceId, r.revision, p.revision, jurisdictionHash, availableFrom, validUntil,
            pricingPolicyId, pricingVersion, pricingCommitment));
        if (_offers[offerId].exists) revert InvalidOffer();

        Offer memory o;
        o.providerId=r.providerId; o.nodeId=r.nodeId; o.resourceId=resourceId;
        o.providerRevision=p.revision; o.resourceRevision=r.revision;
        o.operator=n.operator; o.settlementAccount=p.settlementAccount;
        o.computeClass=r.computeClass; o.hardwareProfileHash=r.hardwareProfileHash;
        o.runtimeProfileHash=r.runtimeProfileHash; o.capabilityHash=r.capabilityHash; o.capacityUnits=r.capacityUnits;
        o.jurisdictionHash=jurisdictionHash; o.availableFrom=availableFrom; o.validUntil=validUntil;
        o.pricingPolicyId=pricingPolicyId; o.pricingVersion=pricingVersion; _setPricingMemory(o, pricing);
        o.revision=1; o.exists=true; o.active=true;
        _offers[offerId]=o; _history[offerId][1]=o;
        emit OfferPublished(offerId,r.providerId,resourceId,msg.sender,1,o.fixedPrice,jurisdictionHash,availableFrom,validUntil);
        _emitPricing(offerId,o);
    }

    function _setPricing(Offer storage o, ComputePricing420.Terms memory p) private {
        o.fixedPrice=p.fixedPrice; o.pricingModel=p.model; o.unitRate=p.unitRate; o.unitScale=p.unitScale;
        o.minimumCharge=p.minimumCharge; o.maximumCharge=p.maximumCharge; o.maximumBillableUnits=p.maximumBillableUnits;
        o.pricingTermsCommitment=ComputePricing420.commitment(p);
    }
    function _setPricingMemory(Offer memory o, ComputePricing420.Terms memory p) private pure {
        o.fixedPrice=p.fixedPrice; o.pricingModel=p.model; o.unitRate=p.unitRate; o.unitScale=p.unitScale;
        o.minimumCharge=p.minimumCharge; o.maximumCharge=p.maximumCharge; o.maximumBillableUnits=p.maximumBillableUnits;
        o.pricingTermsCommitment=ComputePricing420.commitment(p);
    }
    function _pricing(Offer memory o) private pure returns (ComputePricing420.Terms memory) {
        return ComputePricing420.Terms(o.pricingModel,o.fixedPrice,o.unitRate,o.unitScale,o.minimumCharge,o.maximumCharge,o.maximumBillableUnits);
    }
    function _emitPricing(bytes32 offerId, Offer memory o) private {
        emit OfferPricingPublished(offerId,o.pricingModel,o.unitRate,o.unitScale,o.minimumCharge,o.maximumCharge,o.maximumBillableUnits,o.pricingTermsCommitment);
    }
    function _requireAuthority(address actor, bytes32 action, bytes32 providerId, bytes32 nodeId, bytes32 resourceId,
        uint256 amount, bool allowDelegated, bool allowInactiveOperator) private view
    {
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(nodeId);
        if (actor == n.operator && (allowInactiveOperator || providers.isOperator(providerId, actor))) return;
        if (!allowDelegated) revert Unauthorized();
        bytes32 scope = authorization.scopeResource(providerId, nodeId, resourceId);
        if (!authorization.isAuthorized(actor, action, scope, amount)) revert Unauthorized();
    }
    function _commitment(Offer memory o) private pure returns (bytes32) {
        return keccak256(abi.encode(o.providerId,o.nodeId,o.resourceId,o.providerRevision,o.resourceRevision,o.operator,
            o.settlementAccount,o.computeClass,o.hardwareProfileHash,o.runtimeProfileHash,o.capabilityHash,o.capacityUnits,
            o.jurisdictionHash,o.availableFrom,o.validUntil,o.pricingPolicyId,o.pricingVersion,o.pricingTermsCommitment,
            o.revision,o.predecessorCommitment,o.exists,o.active));
    }
}
