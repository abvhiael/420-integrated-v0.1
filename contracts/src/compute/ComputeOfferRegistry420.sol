// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeProviderRegistry420.sol";
import "./ComputeNodeRegistry420.sol";
import "./ComputeResourceRegistry420.sol";
import "./ComputePolicyRegistry420.sol";
import "./ComputeIds420.sol";

contract ComputeOfferRegistry420 is I420System {
    struct Offer {
        bytes32 providerId;
        bytes32 resourceId;
        bytes32 policyId;
        uint128 unitPrice420;
        uint128 maxUnits;
        uint64 validUntil;
        bytes32 regionPolicyHash;
        bool active;
        bool exists;
    }

    ComputeAuthorization420 public immutable authorization;
    ComputeProviderRegistry420 public immutable providers;
    ComputeNodeRegistry420 public immutable nodes;
    ComputeResourceRegistry420 public immutable resources;
    ComputePolicyRegistry420 public immutable policies;
    mapping(bytes32 => Offer) private _offers;

    error InvalidOffer();
    error OfferExists();
    error OfferNotFound();
    error Unauthorized();

    event OfferPublished(
        bytes32 indexed offerId,
        bytes32 indexed providerId,
        bytes32 indexed resourceId,
        bytes32 policyId,
        uint128 unitPrice420,
        uint128 maxUnits
    );
    event OfferCancelled(bytes32 indexed offerId);

    constructor(address authorization_, address providers_, address nodes_, address resources_, address policies_) {
        if (
            authorization_ == address(0) || providers_ == address(0) || nodes_ == address(0)
                || resources_ == address(0) || policies_ == address(0)
        ) revert InvalidOffer();
        authorization = ComputeAuthorization420(authorization_);
        providers = ComputeProviderRegistry420(providers_);
        nodes = ComputeNodeRegistry420(nodes_);
        resources = ComputeResourceRegistry420(resources_);
        policies = ComputePolicyRegistry420(policies_);
    }

    function systemName() external pure returns (string memory) { return "ComputeOfferRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function publishOffer(
        bytes32 offerId,
        bytes32 resourceId,
        bytes32 policyId,
        uint128 unitPrice420,
        uint128 maxUnits,
        uint64 validUntil,
        bytes32 regionPolicyHash
    ) external {
        if (
            offerId == bytes32(0) || resourceId == bytes32(0) || policyId == bytes32(0) || maxUnits == 0
                || (validUntil != 0 && validUntil <= block.timestamp) || !resources.isActive(resourceId)
                || !policies.isActive(policyId)
        ) revert InvalidOffer();
        if (_offers[offerId].exists) revert OfferExists();

        ComputeResourceRegistry420.Resource memory r = resources.getResource(resourceId);
        if (maxUnits > r.capacityUnits) revert InvalidOffer();
        ComputeProviderRegistry420.Provider memory p = providers.getProvider(r.providerId);
        ComputeNodeRegistry420.Node memory n = nodes.getNode(r.nodeId);
        if (
            msg.sender != p.operatorAccount && msg.sender != n.operatorAccount
                && !authorization.isResourceAuthorized(
                    msg.sender, r.providerId, r.nodeId, resourceId, ComputeIds420.ACTION_PUBLISH_OFFER
                )
        ) revert Unauthorized();

        _offers[offerId] = Offer({
            providerId: r.providerId,
            resourceId: resourceId,
            policyId: policyId,
            unitPrice420: unitPrice420,
            maxUnits: maxUnits,
            validUntil: validUntil,
            regionPolicyHash: regionPolicyHash,
            active: true,
            exists: true
        });
        emit OfferPublished(offerId, r.providerId, resourceId, policyId, unitPrice420, maxUnits);
    }

    function cancelOffer(bytes32 offerId) external {
        Offer storage o = _get(offerId);
        ComputeProviderRegistry420.Provider memory p = providers.getProvider(o.providerId);
        ComputeResourceRegistry420.Resource memory r = resources.getResource(o.resourceId);
        ComputeNodeRegistry420.Node memory n = nodes.getNode(r.nodeId);
        if (msg.sender != p.operatorAccount && msg.sender != n.operatorAccount) revert Unauthorized();
        o.active = false;
        emit OfferCancelled(offerId);
    }

    function getOffer(bytes32 offerId) external view returns (Offer memory) { return _get(offerId); }

    function isEffective(bytes32 offerId) external view returns (bool) {
        Offer memory o = _offers[offerId];
        return o.exists && o.active && (o.validUntil == 0 || block.timestamp <= o.validUntil)
            && resources.isActive(o.resourceId) && policies.isActive(o.policyId);
    }

    function _get(bytes32 offerId) private view returns (Offer storage o) {
        o = _offers[offerId];
        if (!o.exists) revert OfferNotFound();
    }
}
