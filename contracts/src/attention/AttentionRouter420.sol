// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/CannaseurCampaignRegistry.sol";
import "../system/AttentionTreasury.sol";
import "./AttentionConsentRegistry420.sol";

contract AttentionRouter420 {
    CannaseurCampaignRegistry public immutable campaigns;
    AttentionTreasury public immutable treasury;
    AttentionConsentRegistry420 public immutable consent;

    constructor(address campaigns_, address treasury_, address consent_) {
        require(campaigns_ != address(0) && treasury_ != address(0) && consent_ != address(0), "420ATTN: zero address");
        campaigns = CannaseurCampaignRegistry(campaigns_);
        treasury = AttentionTreasury(payable(treasury_));
        consent = AttentionConsentRegistry420(consent_);
    }

    function campaignReady(bytes32 campaignId) external view returns (bool) {
        CannaseurCampaignRegistry.Campaign memory c = campaigns.campaign(campaignId);
        AttentionTreasury.CampaignFunds memory f = treasury.campaignFunds(campaignId);
        return c.state == CannaseurCampaignRegistry.CampaignState.ACTIVE && !f.closed && f.funded >= c.declaredBudget;
    }

    function eligibleForProof(bytes32 campaignId, address account, uint64 observedAt) external view returns (bool) {
        return consent.isOptedIn(account, campaignId) && campaigns.acceptsProof(campaignId, observedAt);
    }
}
