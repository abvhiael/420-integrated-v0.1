// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeIds420.sol";
import "./ComputeOfferRegistry420.sol";
import "./ComputeRequestRegistry420.sol";
import "./ComputeResourceRegistry420.sol";

contract ComputeMatch420 is I420System {
    struct MatchRecord {
        bytes32 requestId;
        bytes32 offerId;
        bytes32 providerId;
        bytes32 resourceId;
        bytes32 policyId;
        uint256 quotedAmount420;
        uint64 acceptedAt;
        bool exists;
    }

    ComputeAuthorization420 public immutable authorization;
    ComputeOfferRegistry420 public immutable offers;
    ComputeRequestRegistry420 public immutable requests;
    ComputeResourceRegistry420 public immutable resources;
    mapping(bytes32 => MatchRecord) private _matches;

    error InvalidMatch();
    error MatchExists();
    error MatchNotFound();
    error Unauthorized();

    event MatchAccepted(
        bytes32 indexed matchId,
        bytes32 indexed requestId,
        bytes32 indexed offerId,
        bytes32 providerId,
        bytes32 resourceId,
        uint256 quotedAmount420
    );

    constructor(address authorization_, address offers_, address requests_, address resources_) {
        if (
            authorization_ == address(0) || offers_ == address(0) || requests_ == address(0)
                || resources_ == address(0)
        ) revert InvalidMatch();
        authorization = ComputeAuthorization420(authorization_);
        offers = ComputeOfferRegistry420(offers_);
        requests = ComputeRequestRegistry420(requests_);
        resources = ComputeResourceRegistry420(resources_);
    }

    function systemName() external pure returns (string memory) { return "ComputeMatch420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalMatchId(bytes32 requestId, bytes32 offerId) public view returns (bytes32) {
        return keccak256(abi.encode("420/COMPUTE/MATCH/V1", block.chainid, address(this), requestId, offerId));
    }

    function acceptMatch(bytes32 matchId, bytes32 requestId, bytes32 offerId, uint128 acceptedUnits)
        external
        returns (uint256 quotedAmount420)
    {
        if (matchId != canonicalMatchId(requestId, offerId) || acceptedUnits == 0) revert InvalidMatch();
        if (_matches[matchId].exists) revert MatchExists();
        if (!requests.isFunded(requestId) || !offers.isEffective(offerId)) revert InvalidMatch();

        ComputeRequestRegistry420.Request memory r = requests.getRequest(requestId);
        ComputeOfferRegistry420.Offer memory o = offers.getOffer(offerId);
        if (acceptedUnits > o.maxUnits) revert InvalidMatch();

        quotedAmount420 = uint256(acceptedUnits) * uint256(o.unitPrice420);
        if (quotedAmount420 > r.maxSpend420 || quotedAmount420 > r.fundedAmount) revert InvalidMatch();

        if (
            msg.sender != r.requester
                && !authorization.isRequestAuthorized(
                    msg.sender, requestId, ComputeIds420.ACTION_ACCEPT_MATCH, quotedAmount420
                )
        ) revert Unauthorized();

        ComputeResourceRegistry420.Resource memory resource = resources.getResource(o.resourceId);
        _matches[matchId] = MatchRecord({
            requestId: requestId,
            offerId: offerId,
            providerId: o.providerId,
            resourceId: o.resourceId,
            policyId: o.policyId,
            quotedAmount420: quotedAmount420,
            acceptedAt: uint64(block.timestamp),
            exists: true
        });

        // The request registry accepts the same requester/capability boundary.
        requests.markMatched(requestId);
        emit MatchAccepted(matchId, requestId, offerId, resource.providerId, o.resourceId, quotedAmount420);
    }

    function getMatch(bytes32 matchId) external view returns (MatchRecord memory) {
        MatchRecord memory m = _matches[matchId];
        if (!m.exists) revert MatchNotFound();
        return m;
    }
}
