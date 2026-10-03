// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IComputeStakeRewardSource420 {
    struct RewardEvidence {
        bytes32 positionId;
        uint8 subjectKind;
        bytes32 subjectRef;
        address beneficiary;
        bytes32 stakePolicyId;
        uint256 amount;
        uint64 earnedAt;
        bytes32 evidenceCommitment;
        bool finalEarned;
    }

    function rewardEvidence(bytes32 rewardRef)
        external
        view
        returns (RewardEvidence memory evidence);
}
