// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeOfferRegistry420.sol";
import "./ComputeRequestRegistry420.sol";
import "./ComputeAuthorization420.sol";
import "./ComputePricing420.sol";

contract ComputeMatch420 {
    bytes32 public constant PROPOSAL_DOMAIN = keccak256("420/COMPUTE/MATCH_PROPOSAL/V2");
    bytes32 public constant MATCH_DOMAIN = keccak256("420/COMPUTE/ACCEPTED_MATCH/V2");
    struct Proposal {
        bytes32 requestId; bytes32 offerId; uint64 requestRevision; uint64 offerRevision;
        bytes32 requestCommitment; bytes32 offerCommitment; bytes32 pricingTermsCommitment;
        uint256 billableUnits; uint256 quotedMaximum; address scheduler; uint64 proposedAt; bool exists;
    }
    struct AcceptedMatch {
        bytes32 proposalId; bytes32 requestId; bytes32 offerId; uint64 requestRevision; uint64 offerRevision;
        bytes32 requestCommitment; bytes32 offerCommitment; bytes32 providerId; bytes32 nodeId; bytes32 resourceId;
        address owner; address payer; address operator; address settlementAccount;
        bytes32 computeClass; bytes32 runtimeProfileHash; bytes32 capabilityHash; bytes32 jurisdictionHash;
        bytes32 verificationPolicyCommitment; bytes32 privacyPolicyCommitment; bytes32 pricingPolicyCommitment;
        bytes32 pricingTermsCommitment; bytes32 slaPolicyCommitment; bytes32 partitionPlanHash;
        uint32 partitionCount; uint32 replicationFactor; uint256 capacityUnits;
        ComputePricing420.Model pricingModel; uint256 fixedPrice; uint256 unitRate; uint256 unitScale;
        uint256 minimumCharge; uint256 maximumCharge; uint256 maximumBillableUnits;
        uint256 billableUnits; uint256 acceptedMaximum; uint64 executionDeadline; uint64 acceptedAt; bool exists;
    }
    ComputeRequestRegistry420 public immutable requests;
    ComputeOfferRegistry420 public immutable offers;
    ComputeAuthorization420 public immutable authorization;
    uint64 public nextProposalSerial;
    mapping(bytes32=>Proposal) private _proposals;
    mapping(bytes32=>AcceptedMatch) private _matches;
    mapping(bytes32=>bytes32) public acceptedForRequest;
    error InvalidMatch(); error Unauthorized(); error StaleRevision(); error SerialExhausted();
    event MatchProposed(bytes32 indexed proposalId,bytes32 indexed requestId,bytes32 indexed offerId,address scheduler,uint64 requestRevision,uint64 offerRevision);
    event MatchAccepted(bytes32 indexed matchId,bytes32 indexed requestId,bytes32 indexed offerId,bytes32 proposalId,address accepter,uint256 acceptedMaximum);
    event MatchPricingAccepted(bytes32 indexed matchId,ComputePricing420.Model indexed pricingModel,uint256 billableUnits,uint256 unitRate,uint256 unitScale,uint256 acceptedMaximum,bytes32 pricingTermsCommitment);

    constructor(address requests_,address offers_,address authorization_) {
        if(requests_.code.length==0||offers_.code.length==0||authorization_.code.length==0) revert InvalidMatch();
        requests=ComputeRequestRegistry420(requests_); offers=ComputeOfferRegistry420(offers_); authorization=ComputeAuthorization420(authorization_);
        if(address(requests.authorization())!=authorization_||address(offers.authorization())!=authorization_) revert InvalidMatch();
    }
    function propose(bytes32 requestId,bytes32 offerId) external returns(bytes32){ return _propose(requestId,offerId,0); }
    function proposePriced(bytes32 requestId,bytes32 offerId,uint256 billableUnits) external returns(bytes32){ return _propose(requestId,offerId,billableUnits); }
    function _propose(bytes32 requestId,bytes32 offerId,uint256 billableUnits) private returns(bytes32 proposalId){
        if(!requests.isEffective(requestId)||!offers.isEffective(offerId)) revert InvalidMatch();
        ComputeRequestRegistry420.Request memory r=requests.request(requestId);
        ComputeOfferRegistry420.Offer memory o=offers.offer(offerId);
        (bool compatible,uint256 quotedMaximum)=_compatible(r,o,billableUnits);
        if(!compatible) revert InvalidMatch();
        if(nextProposalSerial==type(uint64).max) revert SerialExhausted();
        uint64 serial=++nextProposalSerial;
        bytes32 rc=requests.commitment(requestId,r.revision); bytes32 oc=offers.commitment(offerId,o.revision);
        proposalId=keccak256(abi.encode(PROPOSAL_DOMAIN,block.chainid,address(this),serial,requestId,r.revision,rc,offerId,o.revision,oc,o.pricingTermsCommitment,billableUnits,quotedMaximum,msg.sender));
        _proposals[proposalId]=Proposal(requestId,offerId,r.revision,o.revision,rc,oc,o.pricingTermsCommitment,billableUnits,quotedMaximum,msg.sender,uint64(block.timestamp),true);
        emit MatchProposed(proposalId,requestId,offerId,msg.sender,r.revision,o.revision);
    }
    function accept(bytes32 proposalId,uint64 expectedRequestRevision,uint64 expectedOfferRevision) external returns(bytes32 matchId){
        Proposal storage p=_proposals[proposalId];
        if(!p.exists||acceptedForRequest[p.requestId]!=bytes32(0)) revert InvalidMatch();
        if(p.requestRevision!=expectedRequestRevision||p.offerRevision!=expectedOfferRevision) revert StaleRevision();
        if(!proposalEligible(proposalId)) revert InvalidMatch();
        ComputeRequestRegistry420.Request memory r=requests.request(p.requestId); if(msg.sender!=r.owner) revert Unauthorized();
        ComputeOfferRegistry420.Offer memory o=offers.offer(p.offerId);
        matchId=keccak256(abi.encode(MATCH_DOMAIN,block.chainid,address(this),proposalId,p.requestId,p.requestRevision,p.requestCommitment,p.offerId,p.offerRevision,p.offerCommitment,p.pricingTermsCommitment,p.billableUnits,p.quotedMaximum,r.owner,r.payer,o.providerId,o.nodeId,o.resourceId));
        if(_matches[matchId].exists) revert InvalidMatch();
        AcceptedMatch memory m;
        m.proposalId=proposalId; m.requestId=p.requestId; m.offerId=p.offerId; m.requestRevision=p.requestRevision; m.offerRevision=p.offerRevision;
        m.requestCommitment=p.requestCommitment; m.offerCommitment=p.offerCommitment; m.providerId=o.providerId; m.nodeId=o.nodeId; m.resourceId=o.resourceId;
        m.owner=r.owner; m.payer=r.payer; m.operator=o.operator; m.settlementAccount=o.settlementAccount;
        m.computeClass=o.computeClass; m.runtimeProfileHash=o.runtimeProfileHash; m.capabilityHash=o.capabilityHash; m.jurisdictionHash=o.jurisdictionHash;
        m.verificationPolicyCommitment=r.terms.verification.commitment; m.privacyPolicyCommitment=r.terms.privacy.commitment;
        m.pricingPolicyCommitment=r.terms.pricing.commitment; m.pricingTermsCommitment=o.pricingTermsCommitment; m.slaPolicyCommitment=r.terms.sla.commitment;
        m.partitionPlanHash=r.terms.partitionPlanHash; m.partitionCount=r.terms.partitionCount; m.replicationFactor=r.terms.replicationFactor; m.capacityUnits=r.terms.capacityUnits;
        m.pricingModel=o.pricingModel; m.fixedPrice=o.fixedPrice; m.unitRate=o.unitRate; m.unitScale=o.unitScale; m.minimumCharge=o.minimumCharge; m.maximumCharge=o.maximumCharge; m.maximumBillableUnits=o.maximumBillableUnits;
        m.billableUnits=p.billableUnits; m.acceptedMaximum=p.quotedMaximum; m.executionDeadline=r.terms.deadline<o.validUntil?r.terms.deadline:o.validUntil; m.acceptedAt=uint64(block.timestamp); m.exists=true;
        _matches[matchId]=m; acceptedForRequest[p.requestId]=matchId;
        emit MatchAccepted(matchId,p.requestId,p.offerId,proposalId,msg.sender,p.quotedMaximum);
        emit MatchPricingAccepted(matchId,o.pricingModel,p.billableUnits,o.unitRate,o.unitScale,p.quotedMaximum,o.pricingTermsCommitment);
    }
    function proposal(bytes32 id) external view returns(Proposal memory p){p=_proposals[id];if(!p.exists)revert InvalidMatch();}
    function acceptedMatch(bytes32 id) external view returns(AcceptedMatch memory m){m=_matches[id];if(!m.exists)revert InvalidMatch();}
    function commitment(bytes32 id) external view returns(bytes32){AcceptedMatch memory m=_matches[id];if(!m.exists)revert InvalidMatch();return keccak256(abi.encode(MATCH_DOMAIN,block.chainid,address(this),id,m));}
    function proposalEligible(bytes32 id) public view returns(bool){
        Proposal storage p=_proposals[id]; if(!p.exists||acceptedForRequest[p.requestId]!=bytes32(0))return false;
        if(!requests.isEffective(p.requestId)||!offers.isEffective(p.offerId))return false;
        ComputeRequestRegistry420.Request memory r=requests.request(p.requestId); ComputeOfferRegistry420.Offer memory o=offers.offer(p.offerId);
        if(r.revision!=p.requestRevision||o.revision!=p.offerRevision)return false;
        if(requests.commitment(p.requestId,r.revision)!=p.requestCommitment||offers.commitment(p.offerId,o.revision)!=p.offerCommitment||o.pricingTermsCommitment!=p.pricingTermsCommitment)return false;
        (bool compatible,uint256 quote)=_compatible(r,o,p.billableUnits); return compatible&&quote==p.quotedMaximum;
    }
    function _compatible(ComputeRequestRegistry420.Request memory r,ComputeOfferRegistry420.Offer memory o,uint256 billableUnits) private pure returns(bool,uint256){
        if(r.terms.resourceClass!=o.computeClass||r.terms.runtimeHash!=o.runtimeProfileHash||r.terms.capabilityHash!=o.capabilityHash||r.terms.jurisdictionHash!=o.jurisdictionHash||r.terms.pricing.id!=o.pricingPolicyId||r.terms.pricing.version!=o.pricingVersion)return(false,0);
        ComputePricing420.Terms memory pricing=ComputePricing420.Terms(o.pricingModel,o.fixedPrice,o.unitRate,o.unitScale,o.minimumCharge,o.maximumCharge,o.maximumBillableUnits);
        if(ComputePricing420.commitment(pricing)!=o.pricingTermsCommitment)return(false,0);
        (bool priceOk,uint256 quotedMaximum)=ComputePricing420.quoteMaximum(pricing,billableUnits);
        if(!priceOk||quotedMaximum>r.terms.maximumPrice)return(false,0);
        uint256 requiredUnits=uint256(r.terms.partitionCount)*uint256(r.terms.replicationFactor)*r.terms.capacityUnits;
        if(requiredUnits==0||requiredUnits>o.capacityUnits)return(false,0);
        return(true,quotedMaximum);
    }
}
