// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

contract RewardCampaignRegistry420 is I420System {
    struct Campaign {
        address sponsor;
        bytes32 appId;
        bytes32 contributionType;
        address scorer;
        address policy;
        uint256 maxRewardPerContribution;
        uint256 maxRewardPerAccount;
        uint256 totalBudget;
        uint64 startsAt;
        uint64 endsAt;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Campaign) private _campaigns;
    mapping(address => uint256) public sponsorNonce;

    error InvalidInput();
    error Unauthorized();
    error InvalidState();

    event CampaignCreated(bytes32 indexed campaignId, address indexed sponsor, bytes32 indexed appId, bytes32 contributionType, address scorer, address policy, uint256 totalBudget);
    event CampaignActivationChanged(bytes32 indexed campaignId, bool active);

    function systemName() external pure returns (string memory) { return "RewardCampaignRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function createCampaign(
        bytes32 appId,
        bytes32 contributionType,
        address scorer,
        address policy,
        uint256 maxRewardPerContribution,
        uint256 maxRewardPerAccount,
        uint256 totalBudget,
        uint64 startsAt,
        uint64 endsAt
    ) external returns (bytes32 campaignId) {
        if (appId == bytes32(0) || contributionType == bytes32(0) || scorer == address(0) || maxRewardPerContribution == 0 || maxRewardPerAccount < maxRewardPerContribution || totalBudget == 0 || endsAt <= startsAt) revert InvalidInput();
        uint256 nonce = ++sponsorNonce[msg.sender];
        campaignId = keccak256(abi.encode("420/REWARDS/CAMPAIGN/V1", block.chainid, msg.sender, nonce, appId, contributionType));
        _campaigns[campaignId] = Campaign(msg.sender, appId, contributionType, scorer, policy, maxRewardPerContribution, maxRewardPerAccount, totalBudget, startsAt, endsAt, false, true);
        emit CampaignCreated(campaignId, msg.sender, appId, contributionType, scorer, policy, totalBudget);
    }

    function setActive(bytes32 campaignId, bool active_) external {
        Campaign storage c = _campaigns[campaignId];
        if (!c.exists) revert InvalidState();
        if (msg.sender != c.sponsor) revert Unauthorized();
        c.active = active_;
        emit CampaignActivationChanged(campaignId, active_);
    }

    function campaign(bytes32 campaignId) external view returns (Campaign memory) { return _campaigns[campaignId]; }
}
