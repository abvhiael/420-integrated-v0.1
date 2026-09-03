// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IReviewContributionVerifier420.sol";
import "./IReviewContributionSource420.sol";
import "./ReviewRewardTypes420.sol";

contract ReviewContributionVerifier420 is IReviewContributionVerifier420 {
    IReviewContributionSource420 public immutable source;

    constructor(address source_) {
        require(source_ != address(0), "source");
        source = IReviewContributionSource420(source_);
    }

    function verifyContribution(
        bytes32 contributionType,
        bytes32 sourceId,
        address beneficiary,
        bytes32 evidenceHash
    ) external view returns (bool) {
        if (sourceId == bytes32(0) || beneficiary == address(0) || evidenceHash == bytes32(0)) return false;

        if (contributionType == ReviewRewardTypes420.REVIEW) {
            (address author, bytes32 subjectId, bytes32 contentHash, bool active, bool finalized) = source.reviewRecord(sourceId);
            return author == beneficiary && subjectId != bytes32(0) && contentHash == evidenceHash && active && finalized;
        }

        if (contributionType == ReviewRewardTypes420.CORRECTION) {
            (address author, bytes32 targetReviewId, bytes32 correctionHash, bool accepted, bool active) = source.correctionRecord(sourceId);
            return author == beneficiary && targetReviewId != bytes32(0) && correctionHash == evidenceHash && accepted && active;
        }

        if (contributionType == ReviewRewardTypes420.VERIFICATION) {
            (address verifier, bytes32 targetReviewId, bytes32 verificationEvidenceHash, bool finalized, bool overturned) = source.verificationRecord(sourceId);
            return verifier == beneficiary && targetReviewId != bytes32(0) && verificationEvidenceHash == evidenceHash && finalized && !overturned;
        }

        if (contributionType == ReviewRewardTypes420.CURATION) {
            (address curator, bytes32 targetReviewId, bytes32 decisionHash, bool active) = source.curationRecord(sourceId);
            return curator == beneficiary && targetReviewId != bytes32(0) && decisionHash == evidenceHash && active;
        }

        return false;
    }
}
