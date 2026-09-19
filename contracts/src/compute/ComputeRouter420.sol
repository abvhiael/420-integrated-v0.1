// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeOfferRegistry420.sol";
import "./ComputeRequestRegistry420.sol";
import "./ComputeMatch420.sol";
import "./ComputeJobRegistry420.sol";

contract ComputeRouter420 is I420System {
    ComputeOfferRegistry420 public immutable offers;
    ComputeRequestRegistry420 public immutable requests;
    ComputeMatch420 public immutable matches;
    ComputeJobRegistry420 public immutable jobs;

    error InvalidDependency();

    constructor(address offers_, address requests_, address matches_, address jobs_) {
        if (offers_ == address(0) || requests_ == address(0) || matches_ == address(0) || jobs_ == address(0)) {
            revert InvalidDependency();
        }
        offers = ComputeOfferRegistry420(offers_);
        requests = ComputeRequestRegistry420(requests_);
        matches = ComputeMatch420(matches_);
        jobs = ComputeJobRegistry420(jobs_);
    }

    function systemName() external pure returns (string memory) { return "ComputeRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canMatch(bytes32 requestId, bytes32 offerId, uint128 units)
        external
        view
        returns (bool ok, uint256 quotedAmount420)
    {
        if (!requests.isFunded(requestId) || !offers.isEffective(offerId) || units == 0) return (false, 0);
        ComputeRequestRegistry420.Request memory r = requests.getRequest(requestId);
        ComputeOfferRegistry420.Offer memory o = offers.getOffer(offerId);
        if (units > o.maxUnits) return (false, 0);
        quotedAmount420 = uint256(units) * uint256(o.unitPrice420);
        ok = quotedAmount420 <= r.maxSpend420 && quotedAmount420 <= r.fundedAmount;
    }

    function matchId(bytes32 requestId, bytes32 offerId) external view returns (bytes32) {
        return matches.canonicalMatchId(requestId, offerId);
    }

    function jobId(bytes32 matchId_) external view returns (bytes32) {
        return jobs.canonicalJobId(matchId_);
    }
}
