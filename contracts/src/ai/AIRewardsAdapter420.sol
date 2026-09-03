// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../rewards/ContributionRegistry420.sol";
import "./IAIContributionVerifier420.sol";
import "./AIRewardTypes420.sol";

contract AIRewardsAdapter420 is I420System {
    ContributionRegistry420 public immutable contributionRegistry;
    IAIContributionVerifier420 public immutable verifier;

    error InvalidInput();
    error UnsupportedContributionType();
    error UnverifiedContribution();

    event AIContributionForwarded(
        bytes32 indexed contributionId,
        bytes32 indexed contributionType,
        bytes32 indexed sourceId,
        address beneficiary,
        bytes32 evidenceHash
    );

    constructor(address contributionRegistry_, address verifier_) {
        if (contributionRegistry_ == address(0) || verifier_ == address(0)) revert InvalidInput();
        contributionRegistry = ContributionRegistry420(contributionRegistry_);
        verifier = IAIContributionVerifier420(verifier_);
    }

    function systemName() external pure returns (string memory) { return "AIRewardsAdapter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function appId() external pure returns (bytes32) { return AIRewardTypes420.APP_ID; }

    function publishContribution(
        bytes32 contributionType,
        bytes32 sourceId,
        address beneficiary,
        bytes32 evidenceHash
    ) external returns (bytes32 contributionId) {
        if (sourceId == bytes32(0) || beneficiary == address(0) || evidenceHash == bytes32(0)) revert InvalidInput();
        if (!AIRewardTypes420.supported(contributionType)) revert UnsupportedContributionType();
        if (!verifier.verifyContribution(contributionType, sourceId, beneficiary, evidenceHash)) revert UnverifiedContribution();

        bytes32 contentHash = keccak256(abi.encode(
            "420/AI/REWARD_EVIDENCE/V1",
            block.chainid,
            contributionType,
            sourceId,
            beneficiary,
            evidenceHash
        ));
        bytes32 nonce = keccak256(abi.encode("420/AI/REWARD_SOURCE/V1", contributionType, sourceId));

        contributionId = contributionRegistry.publish(
            AIRewardTypes420.APP_ID,
            contributionType,
            beneficiary,
            contentHash,
            nonce
        );

        emit AIContributionForwarded(contributionId, contributionType, sourceId, beneficiary, evidenceHash);
    }
}
