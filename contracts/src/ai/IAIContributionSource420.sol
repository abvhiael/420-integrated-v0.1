// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IAIContributionSource420 {
    function datasetContributionRecord(bytes32 id)
        external view returns (address contributor, bytes32 datasetId, bytes32 contentHash, bool accepted, bool active);

    function evaluationRecord(bytes32 id)
        external view returns (address evaluator, bytes32 modelId, bytes32 evaluationHash, bool finalized, bool active);

    function modelCorrectionRecord(bytes32 id)
        external view returns (address contributor, bytes32 modelId, bytes32 correctionHash, bool accepted, bool active);

    function providerValidationRecord(bytes32 id)
        external view returns (address validator, bytes32 providerId, bytes32 validationHash, bool finalized, bool overturned);
}
