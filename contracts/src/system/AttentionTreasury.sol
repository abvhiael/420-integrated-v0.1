// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ProtocolTreasury.sol";
import "../interfaces/I420System.sol";

contract AttentionTreasury is ProtocolTreasury, I420System {
    struct CampaignFunds {
        address sponsor;
        uint256 funded;
        uint256 reserved;
        uint256 paid;
        uint256 refunded;
        bool closed;
    }

    address public campaignRegistry;
    address public rewardRegistry;
    uint256 public totalCampaignLiability;
    mapping(bytes32 => CampaignFunds) private _campaignFunds;
    mapping(bytes32 => bool) public rewardReserved;
    mapping(bytes32 => bool) public rewardReleased;

    error UnauthorizedController();
    error AlreadyBound();
    error InvalidInput();
    error InsufficientCampaignFunds();
    error InvalidRewardState();

    event CampaignRegistryBound(address indexed registry);
    event RewardRegistryBound(address indexed registry);
    event CampaignFundingRegistered(bytes32 indexed campaignId, address indexed sponsor);
    event CampaignFunded(bytes32 indexed campaignId, address indexed sponsor, uint256 amount);
    event RewardReserved(bytes32 indexed campaignId, bytes32 indexed rewardId, uint256 amount);
    event RewardReleased(bytes32 indexed campaignId, bytes32 indexed rewardId, address indexed recipient, uint256 amount);
    event CampaignClosed(bytes32 indexed campaignId);
    event CampaignRefunded(bytes32 indexed campaignId, address indexed sponsor, uint256 amount);

    constructor(address timelock_) ProtocolTreasury(timelock_) {}

    function systemName() external pure returns (string memory) { return "AttentionTreasury"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindCampaignRegistry(address registry) external onlyGovernance {
        if (campaignRegistry != address(0)) revert AlreadyBound();
        if (registry == address(0)) revert InvalidInput();
        campaignRegistry = registry;
        emit CampaignRegistryBound(registry);
    }

    function bindRewardRegistry(address registry) external onlyGovernance {
        if (rewardRegistry != address(0)) revert AlreadyBound();
        if (registry == address(0)) revert InvalidInput();
        rewardRegistry = registry;
        emit RewardRegistryBound(registry);
    }

    function registerCampaign(bytes32 campaignId, address sponsor) external {
        if (msg.sender != campaignRegistry) revert UnauthorizedController();
        if (campaignId == bytes32(0) || sponsor == address(0)) revert InvalidInput();
        CampaignFunds storage f = _campaignFunds[campaignId];
        if (f.sponsor != address(0)) revert InvalidInput();
        f.sponsor = sponsor;
        emit CampaignFundingRegistered(campaignId, sponsor);
    }

    function fundCampaign(bytes32 campaignId) external payable {
        CampaignFunds storage f = _campaignFunds[campaignId];
        if (f.sponsor == address(0) || f.sponsor != msg.sender || f.closed || msg.value == 0) revert InvalidInput();
        f.funded += msg.value;
        totalCampaignLiability += msg.value;
        emit CampaignFunded(campaignId, msg.sender, msg.value);
    }

    function reserveReward(bytes32 campaignId, bytes32 rewardId, uint256 amount) external {
        if (msg.sender != rewardRegistry) revert UnauthorizedController();
        if (rewardId == bytes32(0) || amount == 0 || rewardReserved[rewardId]) revert InvalidRewardState();
        CampaignFunds storage f = _campaignFunds[campaignId];
        if (f.closed || f.funded - f.paid - f.refunded - f.reserved < amount) revert InsufficientCampaignFunds();
        rewardReserved[rewardId] = true;
        f.reserved += amount;
        emit RewardReserved(campaignId, rewardId, amount);
    }

    function releaseReward(bytes32 campaignId, bytes32 rewardId, address payable recipient, uint256 amount) external {
        if (msg.sender != rewardRegistry) revert UnauthorizedController();
        if (!rewardReserved[rewardId] || rewardReleased[rewardId] || recipient == address(0) || amount == 0) revert InvalidRewardState();
        CampaignFunds storage f = _campaignFunds[campaignId];
        if (f.reserved < amount) revert InsufficientCampaignFunds();
        rewardReleased[rewardId] = true;
        f.reserved -= amount;
        f.paid += amount;
        totalCampaignLiability -= amount;
        (bool ok,) = recipient.call{value: amount}("");
        require(ok, "reward transfer failed");
        emit RewardReleased(campaignId, rewardId, recipient, amount);
    }

    function closeCampaign(bytes32 campaignId) external {
        if (msg.sender != campaignRegistry) revert UnauthorizedController();
        CampaignFunds storage f = _campaignFunds[campaignId];
        if (f.sponsor == address(0)) revert InvalidInput();
        f.closed = true;
        emit CampaignClosed(campaignId);
    }

    function claimUnused(bytes32 campaignId) external {
        CampaignFunds storage f = _campaignFunds[campaignId];
        if (!f.closed || f.sponsor != msg.sender || f.reserved != 0) revert InvalidInput();
        uint256 amount = f.funded - f.paid - f.refunded;
        if (amount == 0) revert InvalidInput();
        f.refunded += amount;
        totalCampaignLiability -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "refund transfer failed");
        emit CampaignRefunded(campaignId, msg.sender, amount);
    }

    function campaignFunds(bytes32 campaignId) external view returns (CampaignFunds memory) { return _campaignFunds[campaignId]; }

    function treasuryTransfer(address payable to, uint256 amount, bytes32 reason) external override onlyGovernance {
        require(to != address(0), "zero destination");
        require(amount <= address(this).balance - totalCampaignLiability, "campaign liabilities");
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit TreasuryTransfer(to, amount, reason);
    }
}
