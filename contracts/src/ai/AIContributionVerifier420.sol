// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IAIContributionVerifier420.sol";
import "./IAIContributionSource420.sol";
import "./AIRewardTypes420.sol";

contract AIContributionVerifier420 is IAIContributionVerifier420 {
    IAIContributionSource420 public immutable source;

    error InvalidSource();

    constructor(address source_) {
        if (source_ == address(0)) revert InvalidSource();
        source = IAIContributionSource420(source_);
    }

    function verifyContribution(
        bytes32 contributionType,
        bytes32 sourceId,
        address beneficiary,
        bytes32 evidenceHash
    ) external view returns (bool) {
        if (sourceId == bytes32(0) || beneficiary == address(0) || evidenceHash == bytes32(0)) return false;

        if (contributionType == AIRewardTypes420.DATASET_CONTRIBUTION) {
            (address contributor, bytes32 datasetId, bytes32 contentHash, bool accepted, bool active) =
                source.datasetContributionRecord(sourceId);
            return contributor == beneficiary
                && datasetId != bytes32(0)
                && contentHash == evidenceHash
                && accepted
                && active;
        }

        if (contributionType == AIRewardTypes420.EVALUATION) {
            (address evaluator, bytes32 modelId, bytes32 evaluationHash, bool finalized, bool active) =
                source.evaluationRecord(sourceId);
            return evaluator == beneficiary
                && modelId != bytes32(0)
                && evaluationHash == evidenceHash
                && finalized
                && active;
        }

        if (contributionType == AIRewardTypes420.MODEL_CORRECTION) {
            (address contributor, bytes32 modelId, bytes32 correctionHash, bool accepted, bool active) =
                source.modelCorrectionRecord(sourceId);
            return contributor == beneficiary
                && modelId != bytes32(0)
                && correctionHash == evidenceHash
                && accepted
                && active;
        }

        if (contributionType == AIRewardTypes420.PROVIDER_VALIDATION) {
            (address validator, bytes32 providerId, bytes32 validationHash, bool finalized, bool overturned) =
                source.providerValidationRecord(sourceId);
            return validator == beneficiary
                && providerId != bytes32(0)
                && validationHash == evidenceHash
                && finalized
                && !overturned;
        }

        return false;
    }
}
