// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeOfferRegistry420.sol";
import "./ComputeRequestRegistry420.sol";
import "./ComputeAuthorization420.sol";

/// @notice CMP-2.3 replaceable scheduler proposal registry with authoritative on-chain acceptance.
/// @dev Schedulers are untrusted/replaceable proposal sources. They receive no acceptance, funding,
/// capacity, settlement or execution authority. Acceptance revalidates exact request/offer revisions
/// and freezes an immutable compatibility snapshot. Capacity consumption is deferred to CMP-2.5.
contract ComputeMatch420 {
    bytes32 public constant PROPOSAL_DOMAIN = keccak256("420/COMPUTE/MATCH_PROPOSAL/V1");
    bytes32 public constant MATCH_DOMAIN = keccak256("420/COMPUTE/ACCEPTED_MATCH/V1");

    struct Proposal {
        bytes32 requestId;
        bytes32 offerId;
        uint64 requestRevision;
        uint64 offerRevision;
        bytes32 requestCommitment;
        bytes32 offerCommitment;
        address scheduler;
        uint64 proposedAt;
        bool exists;
    }

    struct AcceptedMatch {
        bytes32 proposalId;
        bytes32 requestId;
        bytes32 offerId;
        uint64 requestRevision;
        uint64 offerRevision;
        bytes32 requestCommitment;
        bytes32 offerCommitment;
        bytes32 providerId;
        bytes32 nodeId;
        bytes32 resourceId;
        address owner;
        address payer;
        address operator;
        address settlementAccount;
        bytes32 computeClass;
        bytes32 runtimeProfileHash;
        bytes32 capabilityHash;
        bytes32 jurisdictionHash;
        bytes32 verificationPolicyCommitment;
        bytes32 privacyPolicyCommitment;
        bytes32 pricingPolicyCommitment;
        bytes32 slaPolicyCommitment;
        bytes32 partitionPlanHash;
        uint32 partitionCount;
        uint32 replicationFactor;
        uint256 capacityUnits;
        uint256 fixedPrice;
        uint64 executionDeadline;
        uint64 acceptedAt;
        bool exists;
    }

    ComputeRequestRegistry420 public immutable requests;
    ComputeOfferRegistry420 public immutable offers;
    ComputeAuthorization420 public immutable authorization;

    uint64 public nextProposalSerial;
    mapping(bytes32 => Proposal) private _proposals;
    mapping(bytes32 => AcceptedMatch) private _matches;
    mapping(bytes32 => bytes32) public acceptedForRequest;

    error InvalidMatch();
    error Unauthorized();
    error StaleRevision();
    error SerialExhausted();

    event MatchProposed(
        bytes32 indexed proposalId,
        bytes32 indexed requestId,
        bytes32 indexed offerId,
        address scheduler,
        uint64 requestRevision,
        uint64 offerRevision
    );
    event MatchAccepted(
        bytes32 indexed matchId,
        bytes32 indexed requestId,
        bytes32 indexed offerId,
        bytes32 proposalId,
        address accepter,
        uint256 fixedPrice
    );

    constructor(address requests_, address offers_, address authorization_) {
        if (requests_.code.length == 0 || offers_.code.length == 0 || authorization_.code.length == 0)
            revert InvalidMatch();
        requests = ComputeRequestRegistry420(requests_);
        offers = ComputeOfferRegistry420(offers_);
        authorization = ComputeAuthorization420(authorization_);
        if (address(requests.authorization()) != authorization_ || address(offers.authorization()) != authorization_)
            revert InvalidMatch();
    }

    /// @notice Any scheduler may propose an eligible pair. Proposal power grants no acceptance authority.
    function propose(bytes32 requestId, bytes32 offerId) external returns (bytes32 proposalId) {
        if (!requests.isEffective(requestId) || !offers.isEffective(offerId)) revert InvalidMatch();

        ComputeRequestRegistry420.Request memory r = requests.request(requestId);
        ComputeOfferRegistry420.Offer memory o = offers.offer(offerId);
        if (!_compatible(r, o)) revert InvalidMatch();
        if (nextProposalSerial == type(uint64).max) revert SerialExhausted();

        uint64 serial = ++nextProposalSerial;
        bytes32 requestCommitment = requests.commitment(requestId, r.revision);
        bytes32 offerCommitment = offers.commitment(offerId, o.revision);
        proposalId = keccak256(
            abi.encode(
                PROPOSAL_DOMAIN,
                block.chainid,
                address(this),
                serial,
                requestId,
                r.revision,
                requestCommitment,
                offerId,
                o.revision,
                offerCommitment,
                msg.sender
            )
        );
        Proposal memory p = Proposal({
            requestId: requestId,
            offerId: offerId,
            requestRevision: r.revision,
            offerRevision: o.revision,
            requestCommitment: requestCommitment,
            offerCommitment: offerCommitment,
            scheduler: msg.sender,
            proposedAt: uint64(block.timestamp),
            exists: true
        });
        _proposals[proposalId] = p;
        emit MatchProposed(proposalId, requestId, offerId, msg.sender, r.revision, o.revision);
    }

    /// @notice Request owner accepts one proposal after exact-revision and compatibility revalidation.
    /// @dev Scheduler identity is deliberately irrelevant to acceptance.
    function accept(bytes32 proposalId, uint64 expectedRequestRevision, uint64 expectedOfferRevision)
        external returns (bytes32 matchId)
    {
        Proposal storage p = _proposals[proposalId];
        if (!p.exists || acceptedForRequest[p.requestId] != bytes32(0)) revert InvalidMatch();
        if (p.requestRevision != expectedRequestRevision || p.offerRevision != expectedOfferRevision)
            revert StaleRevision();
        if (!proposalEligible(proposalId)) revert InvalidMatch();

        ComputeRequestRegistry420.Request memory r = requests.request(p.requestId);
        if (msg.sender != r.owner) revert Unauthorized();
        ComputeOfferRegistry420.Offer memory o = offers.offer(p.offerId);

        matchId = keccak256(
            abi.encode(
                MATCH_DOMAIN,
                block.chainid,
                address(this),
                proposalId,
                p.requestId,
                p.requestRevision,
                p.requestCommitment,
                p.offerId,
                p.offerRevision,
                p.offerCommitment,
                r.owner,
                r.payer,
                o.providerId,
                o.nodeId,
                o.resourceId,
                o.fixedPrice
            )
        );
        if (_matches[matchId].exists) revert InvalidMatch();

        uint64 executionDeadline = r.terms.deadline < o.validUntil ? r.terms.deadline : o.validUntil;
        AcceptedMatch memory m = AcceptedMatch({
            proposalId: proposalId,
            requestId: p.requestId,
            offerId: p.offerId,
            requestRevision: p.requestRevision,
            offerRevision: p.offerRevision,
            requestCommitment: p.requestCommitment,
            offerCommitment: p.offerCommitment,
            providerId: o.providerId,
            nodeId: o.nodeId,
            resourceId: o.resourceId,
            owner: r.owner,
            payer: r.payer,
            operator: o.operator,
            settlementAccount: o.settlementAccount,
            computeClass: o.computeClass,
            runtimeProfileHash: o.runtimeProfileHash,
            capabilityHash: o.capabilityHash,
            jurisdictionHash: o.jurisdictionHash,
            verificationPolicyCommitment: r.terms.verification.commitment,
            privacyPolicyCommitment: r.terms.privacy.commitment,
            pricingPolicyCommitment: r.terms.pricing.commitment,
            slaPolicyCommitment: r.terms.sla.commitment,
            partitionPlanHash: r.terms.partitionPlanHash,
            partitionCount: r.terms.partitionCount,
            replicationFactor: r.terms.replicationFactor,
            capacityUnits: r.terms.capacityUnits,
            fixedPrice: o.fixedPrice,
            executionDeadline: executionDeadline,
            acceptedAt: uint64(block.timestamp),
            exists: true
        });
        _matches[matchId] = m;
        acceptedForRequest[p.requestId] = matchId;
        emit MatchAccepted(matchId, p.requestId, p.offerId, proposalId, msg.sender, o.fixedPrice);
    }

    function proposal(bytes32 proposalId) external view returns (Proposal memory p) {
        p = _proposals[proposalId];
        if (!p.exists) revert InvalidMatch();
    }

    function acceptedMatch(bytes32 matchId) external view returns (AcceptedMatch memory m) {
        m = _matches[matchId];
        if (!m.exists) revert InvalidMatch();
    }

    function commitment(bytes32 matchId) external view returns (bytes32) {
        AcceptedMatch memory m = _matches[matchId];
        if (!m.exists) revert InvalidMatch();
        return keccak256(abi.encode(MATCH_DOMAIN, block.chainid, address(this), matchId, m));
    }

    function proposalEligible(bytes32 proposalId) public view returns (bool) {
        Proposal storage p = _proposals[proposalId];
        if (!p.exists || acceptedForRequest[p.requestId] != bytes32(0)) return false;
        if (!requests.isEffective(p.requestId) || !offers.isEffective(p.offerId)) return false;

        ComputeRequestRegistry420.Request memory r = requests.request(p.requestId);
        ComputeOfferRegistry420.Offer memory o = offers.offer(p.offerId);
        if (r.revision != p.requestRevision || o.revision != p.offerRevision) return false;
        if (requests.commitment(p.requestId, r.revision) != p.requestCommitment) return false;
        if (offers.commitment(p.offerId, o.revision) != p.offerCommitment) return false;
        return _compatible(r, o);
    }

    function _compatible(
        ComputeRequestRegistry420.Request memory r,
        ComputeOfferRegistry420.Offer memory o
    ) private pure returns (bool) {
        if (
            r.terms.resourceClass != o.computeClass
                || r.terms.runtimeHash != o.runtimeProfileHash
                || r.terms.capabilityHash != o.capabilityHash
                || r.terms.jurisdictionHash != o.jurisdictionHash
                || r.terms.pricing.id != o.pricingPolicyId
                || r.terms.pricing.version != o.pricingVersion
                || o.fixedPrice == 0
                || o.fixedPrice > r.terms.maximumPrice
        ) return false;

        uint256 requiredUnits =
            uint256(r.terms.partitionCount) * uint256(r.terms.replicationFactor) * r.terms.capacityUnits;
        return requiredUnits != 0 && requiredUnits <= o.capacityUnits;
    }
}
