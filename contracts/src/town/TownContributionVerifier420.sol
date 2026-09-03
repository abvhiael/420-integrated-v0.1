// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ITownContributionVerifier420.sol";
import "./ITownContributionSource420.sol";
import "./TownRewardTypes420.sol";

contract TownContributionVerifier420 is ITownContributionVerifier420 {
    ITownContributionSource420 public immutable source;

    error InvalidSource();

    constructor(address source_) {
        if (source_ == address(0)) revert InvalidSource();
        source = ITownContributionSource420(source_);
    }

    function verifyContribution(
        bytes32 contributionType,
        bytes32 sourceId,
        address beneficiary,
        bytes32 evidenceHash
    ) external view returns (bool) {
        if (sourceId == bytes32(0) || beneficiary == address(0) || evidenceHash == bytes32(0)) return false;

        if (contributionType == TownRewardTypes420.POST) {
            ITownContributionSource420.PostRecord memory r = source.post(sourceId);
            return r.exists && r.active && r.author == beneficiary && r.contentHash == evidenceHash;
        }

        if (contributionType == TownRewardTypes420.COMMENT) {
            ITownContributionSource420.CommentRecord memory r = source.comment(sourceId);
            return r.exists
                && r.active
                && r.author == beneficiary
                && r.parentId != bytes32(0)
                && r.contentHash == evidenceHash;
        }

        if (contributionType == TownRewardTypes420.CURATION) {
            ITownContributionSource420.CurationRecord memory r = source.curation(sourceId);
            return r.exists
                && r.active
                && r.curator == beneficiary
                && r.targetId != bytes32(0)
                && r.decisionHash == evidenceHash;
        }

        if (contributionType == TownRewardTypes420.MODERATION_ACTION) {
            ITownContributionSource420.ModerationRecord memory r = source.moderationAction(sourceId);
            return r.exists
                && r.finalized
                && !r.overturned
                && r.authorizedAtAction
                && r.moderator == beneficiary
                && r.communityId != bytes32(0)
                && r.targetId != bytes32(0)
                && r.actionHash == evidenceHash;
        }

        if (contributionType == TownRewardTypes420.TRANSLATION) {
            ITownContributionSource420.TranslationRecord memory r = source.translation(sourceId);
            return r.exists
                && r.accepted
                && r.translator == beneficiary
                && r.sourceId != bytes32(0)
                && r.sourceLanguage != bytes32(0)
                && r.targetLanguage != bytes32(0)
                && r.sourceLanguage != r.targetLanguage
                && r.translationHash == evidenceHash;
        }

        if (contributionType == TownRewardTypes420.COMMUNITY_RESOURCE) {
            ITownContributionSource420.CommunityResourceRecord memory r = source.communityResource(sourceId);
            return r.exists
                && r.published
                && r.contributor == beneficiary
                && r.communityId != bytes32(0)
                && r.resourceHash == evidenceHash;
        }

        return false;
    }
}
