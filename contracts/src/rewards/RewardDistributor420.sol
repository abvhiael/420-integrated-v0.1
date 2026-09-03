// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ContributionRegistry420.sol";
import "./RewardCampaignRegistry420.sol";
import "./RewardPool420.sol";
import "./RewardAuthorization420.sol";
import "./IRewardScorer420.sol";
import "./IRewardPolicy420.sol";

contract RewardDistributor420 is I420System {
    enum RewardState { NONE, RESERVED, PAID }

    struct Reward {
        bytes32 campaignId;
        bytes32 contributionId;
        address beneficiary;
        uint256 amount;
        RewardState state;
    }

    ContributionRegistry420 public immutable contributions;
    RewardCampaignRegistry420 public immutable campaigns;
    RewardPool420 public immutable pool;
    RewardAuthorization420 public immutable authorization;

    mapping(bytes32 => Reward) private _rewards;
    mapping(bytes32 => mapping(bytes32 => bool)) public contributionConsumed;
    mapping(bytes32 => mapping(address => uint256)) public earnedByCampaign;
    mapping(bytes32 => uint256) public accruedByCampaign;

    error InvalidInput();
    error InvalidState();
    error Unauthorized();
    error Ineligible();
    error CapExceeded();
    error BudgetExceeded();

    event RewardAccrued(bytes32 indexed rewardId, bytes32 indexed campaignId, bytes32 indexed contributionId, address beneficiary, uint256 amount);
    event RewardClaimed(bytes32 indexed rewardId, address indexed beneficiary, uint256 amount);

    constructor(address contributions_, address campaigns_, address pool_, address authorization_) {
        if (contributions_ == address(0) || campaigns_ == address(0) || pool_ == address(0) || authorization_ == address(0)) revert InvalidInput();
        contributions = ContributionRegistry420(contributions_);
        campaigns = RewardCampaignRegistry420(campaigns_);
        pool = RewardPool420(pool_);
        authorization = RewardAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "RewardDistributor420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function accrue(bytes32 campaignId, bytes32 contributionId) external returns (bytes32 rewardId) {
        if (contributionConsumed[campaignId][contributionId]) revert InvalidState();
        RewardCampaignRegistry420.Campaign memory c = campaigns.campaign(campaignId);
        ContributionRegistry420.Contribution memory contribution_ = contributions.contribution(contributionId);
        if (!c.exists || !c.active || !contribution_.exists) revert InvalidState();
        if (block.timestamp < c.startsAt || block.timestamp > c.endsAt) revert InvalidState();
        if (c.appId != contribution_.appId || c.contributionType != contribution_.contributionType) revert Ineligible();

        uint256 amount = IRewardScorer420(c.scorer).score(campaignId, contributionId, contribution_.beneficiary, contribution_.contentHash);
        if (amount == 0) revert Ineligible();
        if (amount > c.maxRewardPerContribution) revert CapExceeded();

        uint256 previous = earnedByCampaign[campaignId][contribution_.beneficiary];
        if (previous + amount > c.maxRewardPerAccount) revert CapExceeded();
        if (accruedByCampaign[campaignId] + amount > c.totalBudget) revert BudgetExceeded();
        if (c.policy != address(0) && !IRewardPolicy420(c.policy).isEligible(campaignId, contributionId, contribution_.beneficiary, amount)) revert Ineligible();

        rewardId = keccak256(abi.encode("420/REWARDS/REWARD/V1", block.chainid, campaignId, contributionId, contribution_.beneficiary, amount));
        contributionConsumed[campaignId][contributionId] = true;
        earnedByCampaign[campaignId][contribution_.beneficiary] = previous + amount;
        accruedByCampaign[campaignId] += amount;
        _rewards[rewardId] = Reward(campaignId, contributionId, contribution_.beneficiary, amount, RewardState.RESERVED);
        pool.reserve(campaignId, rewardId, amount);
        emit RewardAccrued(rewardId, campaignId, contributionId, contribution_.beneficiary, amount);
    }

    function claim(bytes32 rewardId, address account) external {
        Reward storage r = _rewards[rewardId];
        if (r.state != RewardState.RESERVED || r.beneficiary != account) revert InvalidState();
        if (msg.sender != account && !authorization.canClaim(msg.sender, account)) revert Unauthorized();
        r.state = RewardState.PAID;
        pool.release(r.campaignId, rewardId, payable(account), r.amount);
        emit RewardClaimed(rewardId, account, r.amount);
    }

    function reward(bytes32 rewardId) external view returns (Reward memory) { return _rewards[rewardId]; }
}
