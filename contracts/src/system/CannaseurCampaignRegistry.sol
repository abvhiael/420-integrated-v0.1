
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SystemAccess.sol";

/// @notice Wallet-native opt-in campaign registry.
/// Media remains off-chain. Campaign records store budget and immutable critical metadata hashes.
/// This contract does not grant advertisers access to wallet keys or arbitrary transaction authority.
contract CannaseurCampaignRegistry is SystemAccess {
    struct Campaign {
        address sponsor;
        bytes32 metadataHash;
        uint256 budget;
        uint64 startsAt;
        uint64 endsAt;
        bool active;
    }

    mapping(bytes32 => Campaign) public campaigns;
    event CampaignCreated(bytes32 indexed campaignId, address indexed sponsor, uint256 budget);
    event CampaignPaused(bytes32 indexed campaignId);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function create(
        bytes32 campaignId,
        bytes32 metadataHash,
        uint64 startsAt,
        uint64 endsAt
    ) external payable {
        require(msg.value > 0, "budget");
        require(endsAt > startsAt, "window");
        require(campaigns[campaignId].sponsor == address(0), "exists");
        campaigns[campaignId]=Campaign(msg.sender,metadataHash,msg.value,startsAt,endsAt,true);
        emit CampaignCreated(campaignId,msg.sender,msg.value);
    }

    function pause(bytes32 campaignId) external onlyGovernance {
        require(campaigns[campaignId].sponsor != address(0), "unknown");
        campaigns[campaignId].active=false;
        emit CampaignPaused(campaignId);
    }
}
