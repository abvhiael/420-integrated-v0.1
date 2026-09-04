// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IReviewContributionSource420 {
    function reviewRecord(bytes32 sourceId) external view returns (
        address author,
        bytes32 subjectId,
        bytes32 contentHash,
        bool active,
        bool finalized
    );

    function correctionRecord(bytes32 sourceId) external view returns (
        address author,
        bytes32 targetReviewId,
        bytes32 correctionHash,
        bool accepted,
        bool active
    );

    function verificationRecord(bytes32 sourceId) external view returns (
        address verifier,
        bytes32 targetReviewId,
        bytes32 evidenceHash,
        bool finalized,
        bool overturned
    );

    function curationRecord(bytes32 sourceId) external view returns (
        address curator,
        bytes32 targetReviewId,
        bytes32 decisionHash,
        bool active
    );
}
