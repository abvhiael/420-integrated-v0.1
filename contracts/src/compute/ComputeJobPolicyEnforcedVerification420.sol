// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobIndependentVerification420.sol";
import "./ComputeVerifierIndependencePolicy420.sol";

interface IComputeJobPayerTerms420 {
    function fundingTerms(bytes32 requestId) external view returns (address payer, uint256 maxSpend);
}

/// @notice Attested independent appointment is mandatory for either signed verdict.
/// @dev Production deployments requiring output correctness must use a profile-evaluating
/// subclass; appointment plus a signature alone does not prove the result is correct.
contract ComputeJobPolicyEnforcedVerification420 is ComputeJobIndependentVerification420 {
    ComputeVerifierIndependencePolicy420 public immutable independencePolicy;

    constructor(address matches_, address authorization_, address policy_)
        ComputeJobIndependentVerification420(matches_, authorization_)
    {
        if (policy_.code.length == 0) revert InvalidEvidence();
        independencePolicy = ComputeVerifierIndependencePolicy420(policy_);
    }

    function submitVerdict(Verdict calldata v, bytes calldata signature)
        public virtual override returns (bytes32 decisionRef)
    {
        if (address(jobs) == address(0)) revert InvalidEvidence();
        ComputeJobRegistry420.Job memory j = jobs.job(v.jobId);
        ComputeJobAcceptedMatch420.Match memory m = matches.getMatch(j.matchId);
        if (!m.exists || m.jobId != v.jobId || m.operator == address(0)) revert InvalidEvidence();
        (address payer, uint256 maxSpend) = IComputeJobPayerTerms420(address(jobs.requestEvidence()))
            .fundingTerms(j.requestId);
        if (payer == address(0) || maxSpend == 0 || !independencePolicy.eligible(
                v.jobId, v.verifier, v.profileId, j.owner, payer, m.operator)) revert Unauthorized();
        return super.submitVerdict(v, signature);
    }
}
