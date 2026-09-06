// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesContributionVerifier420.sol";

interface IContributionRegistryForBongGoggles420 {
    function publish(
        bytes32 appId,
        bytes32 contributionType,
        address beneficiary,
        bytes32 contentHash,
        bytes32 nonce
    ) external returns (bytes32 contributionId);
}

contract BongGogglesRewardsAdapter420 {
    BongGogglesContributionVerifier420 public immutable verifier;
    IContributionRegistryForBongGoggles420 public immutable contributions;

    mapping(bytes32 => bool) public sourceSubmitted;

    error ZeroAddress();
    error Replay();

    event RewardContributionSubmitted(
        bytes32 indexed contributionId,
        bytes32 indexed sourceKey,
        bytes32 indexed contributionType,
        address beneficiary,
        bytes32 evidenceHash,
        address relay
    );

    constructor(address verifier_, address contributions_) {
        if (verifier_ == address(0) || contributions_ == address(0)) revert ZeroAddress();
        verifier = BongGogglesContributionVerifier420(verifier_);
        contributions = IContributionRegistryForBongGoggles420(contributions_);
    }

    function submitSocialObject(bytes32 objectId) external returns (bytes32 contributionId) {
        return _submit(verifier.verifySocialObject(objectId));
    }

    function submitDiscovery(bytes32 subjectId) external returns (bytes32 contributionId) {
        return _submit(verifier.verifyDiscovery(subjectId));
    }

    function submitReview(bytes32 reviewId) external returns (bytes32 contributionId) {
        return _submit(verifier.verifyReview(reviewId));
    }

    function submitCorrection(bytes32 correctionId) external returns (bytes32 contributionId) {
        return _submit(verifier.verifyCorrection(correctionId));
    }

    function submitVerification(bytes32 verificationId) external returns (bytes32 contributionId) {
        return _submit(verifier.verifyVerification(verificationId));
    }

    function _submit(BongGogglesContributionVerifier420.VerifiedContribution memory verified)
        internal
        returns (bytes32 contributionId)
    {
        if (sourceSubmitted[verified.sourceKey]) revert Replay();
        sourceSubmitted[verified.sourceKey] = true;

        bytes32 nonce = keccak256(abi.encode(
            "420/BONG_GOGGLES/REWARDS_ADAPTER/NONCE/V1",
            block.chainid,
            verified.sourceKey
        ));

        contributionId = contributions.publish(
            verifier.APP_ID_BONG_GOGGLES(),
            verified.contributionType,
            verified.beneficiary,
            verified.evidenceHash,
            nonce
        );

        emit RewardContributionSubmitted(
            contributionId,
            verified.sourceKey,
            verified.contributionType,
            verified.beneficiary,
            verified.evidenceHash,
            msg.sender
        );
    }
}
