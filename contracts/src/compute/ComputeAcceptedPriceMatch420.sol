// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeResourceRegistry420.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeOfferRegistry420.sol";
import "./ComputeEscrowFunding420.sol";
import "./IComputeAcceptedMatchRuntime420.sol";

/// @notice CMP-1.2.2 canonical accepted match with atomic fixed-price reservation.
/// @dev Acceptance freezes a provider-derived beneficiary and a deterministic native-$420
/// ceiling that is bounded by BOTH the signed payer maximum and that job's actual Vault-backed credit.
/// This contract does not release funds or create provider earnings.
contract ComputeAcceptedPriceMatch420 is IComputeJobMatchEvidence420 {
    bytes32 private constant MATCH_DOMAIN = keccak256("420/COMPUTE/PRICED_MATCH/V1");
    bytes32 private constant PRICE_DOMAIN = keccak256("420/COMPUTE/ACCEPTED_PRICE/V1");
    bytes32 private constant ACCEPT_DOMAIN = keccak256("420/COMPUTE/PRICED_ACCEPTANCE/V1");

    struct Match {
        bytes32 jobId;
        bytes32 requestId;
        bytes32 manifestHash;
        bytes32 offerId;
        bytes32 resourceId;
        bytes32 providerId;
        bytes32 nodeId;
        uint64 resourceRevision;
        address owner;
        address operator;
        bytes32 priceReservationRef;
        bytes32 acceptanceRef;
        bool exists;
    }

    struct PriceReservation {
        bytes32 jobId;
        bytes32 matchId;
        bytes32 offerId;
        bytes32 requestId;
        address owner;
        address payer;
        bytes32 providerId;
        bytes32 resourceId;
        uint64 resourceRevision;
        address beneficiary;
        bytes32 pricingPolicyId;
        uint32 pricingVersion;
        uint256 acceptedAmount;
        uint256 fundedAmount;
        uint256 payerMaximum;
        uint64 acceptedAt;
        bool exists;
    }

    ComputeJobRegistry420 public jobs;
    ComputeResourceRegistry420 public immutable resources;
    ComputeAuthorization420 public immutable authorization;
    ComputeOfferRegistry420 public immutable offers;
    ComputeEscrowFunding420 public immutable funding;
    address public immutable bindingAdmin;

    mapping(bytes32 => Match) private _matches;
    mapping(bytes32 => PriceReservation) private _prices;
    mapping(bytes32 => bytes32) public matchForJob;
    mapping(bytes32 => bytes32) public priceReservationForJob;

    error InvalidMatch();
    error Unauthorized();
    error InvalidPrice();
    event MatchProposed(bytes32 indexed jobId, bytes32 indexed matchId, bytes32 indexed offerId,
        bytes32 resourceId, address operator);
    event PriceReserved(bytes32 indexed jobId, bytes32 indexed matchId, bytes32 indexed priceReservationRef,
        uint256 acceptedAmount, address payer, address beneficiary);
    event MatchAccepted(bytes32 indexed jobId, bytes32 indexed matchId, bytes32 acceptanceRef,
        bytes32 priceReservationRef);

    constructor(address resources_, address authorization_, address funding_, address offers_) {
        if (resources_.code.length == 0 || authorization_.code.length == 0
            || funding_.code.length == 0 || offers_.code.length == 0) revert InvalidMatch();
        resources = ComputeResourceRegistry420(resources_);
        authorization = ComputeAuthorization420(authorization_);
        funding = ComputeEscrowFunding420(payable(funding_));
        offers = ComputeOfferRegistry420(offers_);
        if (address(offers.resources()) != resources_) revert InvalidMatch();
        bindingAdmin = msg.sender;
    }

    function bindJobs(address jobs_) external {
        if (msg.sender != bindingAdmin || address(jobs) != address(0) || jobs_.code.length == 0)
            revert Unauthorized();
        ComputeJobRegistry420 candidate = ComputeJobRegistry420(jobs_);
        if (address(candidate.matchEvidence()) != address(this)
            || address(candidate.fundingEvidence()) != address(funding)
            || address(funding.jobs()) != jobs_) revert InvalidMatch();
        jobs = candidate;
    }

    function propose(bytes32 jobId, bytes32 resourceId, bytes32 offerId) external returns (bytes32 matchId) {
        if (address(jobs) == address(0) || matchForJob[jobId] != bytes32(0)
            || !resources.isAvailable(resourceId) || !offers.isEffective(offerId)) revert InvalidMatch();
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.FUNDED || j.owner != msg.sender
            || j.deadline <= block.timestamp) revert Unauthorized();

        ComputeResourceRegistry420.Resource memory r = resources.resource(resourceId);
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(r.nodeId);
        ComputeOfferRegistry420.Offer memory o = offers.offer(offerId);
        if (o.resourceId != resourceId || o.providerId != r.providerId || o.nodeId != r.nodeId
            || o.resourceRevision != r.revision || o.operator != n.operator
            || n.providerId != r.providerId || n.operator == address(0)
            || !resources.providers().isOperator(r.providerId, n.operator)) revert InvalidMatch();

        matchId = keccak256(abi.encode(MATCH_DOMAIN, block.chainid, address(this), jobId,
            j.requestId, j.manifestHash, offerId, resourceId, r.providerId, r.nodeId,
            r.revision, j.owner, n.operator));
        if (_matches[matchId].exists) revert InvalidMatch();
        _matches[matchId] = Match(jobId, j.requestId, j.manifestHash, offerId, resourceId,
            r.providerId, r.nodeId, r.revision, j.owner, n.operator, bytes32(0), bytes32(0), true);
        matchForJob[jobId] = matchId;
        emit MatchProposed(jobId, matchId, offerId, resourceId, n.operator);
    }

    function matched(bytes32 jobId, bytes32 requestId, bytes32 matchId, bytes32 manifestHash)
        external view returns (bool)
    {
        Match storage m = _matches[matchId];
        return m.exists && m.jobId == jobId && m.requestId == requestId
            && m.manifestHash == manifestHash && matchForJob[jobId] == matchId && _proposalEligible(m);
    }

    function acceptMatch(bytes32 jobId, uint64 expectedRevision) external returns (bytes32 acceptanceRef) {
        bytes32 matchId = matchForJob[jobId];
        Match storage m = _matches[matchId];
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (!m.exists || m.acceptanceRef != bytes32(0)
            || j.status != ComputeJobRegistry420.Status.MATCHED || j.matchId != matchId
            || j.revision != expectedRevision || j.deadline <= block.timestamp || !_proposalEligible(m))
            revert InvalidMatch();

        ComputeOfferRegistry420.Offer memory o = offers.offer(m.offerId);
        if (msg.sender != m.operator || !authorization.isAuthorized(msg.sender,
            authorization.ACTION_ACCEPT_MATCH(), authorization.scopeJob(jobId), o.fixedPrice))
            revert Unauthorized();

        ComputeEscrowFunding420.Credit memory c = funding.credit(jobId);
        if (!c.exists || c.refunded || c.requestId != m.requestId || c.owner != m.owner
            || c.payer == address(0) || c.deposited == 0 || c.maximumSpend == 0
            || o.fixedPrice > c.deposited || o.fixedPrice > c.maximumSpend
            || !funding.funded(jobId, m.owner, jobId)) revert InvalidPrice();

        bytes32 priceRef = keccak256(abi.encode(PRICE_DOMAIN, block.chainid, address(this),
            jobId, matchId, m.offerId, c.payer, o.providerId, o.resourceId, o.resourceRevision,
            o.settlementAccount, o.pricingPolicyId, o.pricingVersion, o.fixedPrice,
            c.deposited, c.maximumSpend));
        if (_prices[priceRef].exists || priceReservationForJob[jobId] != bytes32(0)) revert InvalidPrice();

        _prices[priceRef] = PriceReservation(jobId, matchId, m.offerId, m.requestId, m.owner,
            c.payer, o.providerId, o.resourceId, o.resourceRevision, o.settlementAccount,
            o.pricingPolicyId, o.pricingVersion, o.fixedPrice, c.deposited, c.maximumSpend,
            uint64(block.timestamp), true);
        priceReservationForJob[jobId] = priceRef;
        m.priceReservationRef = priceRef;

        acceptanceRef = keccak256(abi.encode(ACCEPT_DOMAIN, block.chainid, address(this),
            jobId, matchId, m.offerId, priceRef, o.fixedPrice, o.settlementAccount,
            m.resourceId, m.resourceRevision, m.operator, expectedRevision));
        m.acceptanceRef = acceptanceRef;

        jobs.recordAcceptance(jobId, expectedRevision, acceptanceRef);
        emit PriceReserved(jobId, matchId, priceRef, o.fixedPrice, c.payer, o.settlementAccount);
        emit MatchAccepted(jobId, matchId, acceptanceRef, priceRef);
    }

    function accepted(bytes32 jobId, bytes32 matchId, bytes32 acceptanceRef) external view returns (bool) {
        Match storage m = _matches[matchId];
        PriceReservation storage p = _prices[m.priceReservationRef];
        return m.exists && m.jobId == jobId && matchForJob[jobId] == matchId
            && acceptanceRef != bytes32(0) && m.acceptanceRef == acceptanceRef
            && p.exists && p.jobId == jobId && p.matchId == matchId
            && priceReservationForJob[jobId] == m.priceReservationRef;
    }

    function authorizedResource(bytes32 jobId, bytes32 matchId, bytes32 acceptanceRef,
        bytes32 resourceId, address operator) external view returns (bool)
    {
        Match storage m = _matches[matchId];
        return m.exists && m.jobId == jobId && matchForJob[jobId] == matchId
            && m.acceptanceRef != bytes32(0) && m.acceptanceRef == acceptanceRef
            && m.resourceId == resourceId && m.operator == operator
            && m.priceReservationRef != bytes32(0) && _resourceStillEligible(m);
    }

    function matchParties(bytes32 matchId)
        external view returns (bytes32 jobId, address owner, address operator, bool exists)
    {
        Match storage m = _matches[matchId];
        return (m.jobId, m.owner, m.operator, m.exists);
    }

    function getMatch(bytes32 matchId) external view returns (Match memory m) {
        m = _matches[matchId];
        if (!m.exists) revert InvalidMatch();
    }

    function priceReservation(bytes32 priceReservationRef) external view returns (PriceReservation memory p) {
        p = _prices[priceReservationRef];
        if (!p.exists) revert InvalidPrice();
    }

    function _proposalEligible(Match storage m) private view returns (bool) {
        if (!offers.isEffective(m.offerId) || !_resourceStillEligible(m)) return false;
        ComputeOfferRegistry420.Offer memory o = offers.offer(m.offerId);
        return o.resourceId == m.resourceId && o.providerId == m.providerId
            && o.nodeId == m.nodeId && o.resourceRevision == m.resourceRevision
            && o.operator == m.operator && o.fixedPrice != 0;
    }

    function _resourceStillEligible(Match storage m) private view returns (bool) {
        if (!resources.isAvailable(m.resourceId)) return false;
        ComputeResourceRegistry420.Resource memory r = resources.resource(m.resourceId);
        if (r.revision != m.resourceRevision || r.providerId != m.providerId || r.nodeId != m.nodeId) return false;
        ComputeNodeRegistry420.Node memory n = resources.nodes().node(m.nodeId);
        return n.providerId == m.providerId && n.operator == m.operator
            && resources.providers().isOperator(m.providerId, m.operator);
    }
}
