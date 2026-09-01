// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SystemAccess.sol";
import "./AttentionTreasury.sol";
import "../interfaces/I420System.sol";

/// @notice Canonical sponsor campaign registry for the opt-in 420 Cannaseur / Attention economy.
/// @dev Media, behavioral telemetry and private audience data remain off-chain. This registry stores immutable campaign economics and commitments.
contract CannaseurCampaignRegistry is SystemAccess, I420System {
    enum CampaignState { NONE, DRAFT, ACTIVE, PAUSED, CLOSED, CANCELLED }

    struct Campaign {
        address sponsor;
        address verifier;
        bytes32 metadataHash;
        bytes32 audiencePolicyHash;
        uint256 declaredBudget;
        uint256 rewardPerUnit;
        uint256 maxRewardPerAccount;
        uint64 startsAt;
        uint64 endsAt;
        CampaignState state;
    }

    AttentionTreasury public attentionTreasury;
    mapping(bytes32 => Campaign) private _campaigns;
    mapping(address => uint64) public sponsorNonce;

    error InvalidInput();
    error InvalidState();
    error InvalidWindow();
    error TreasuryNotBound();
    error AlreadyBound();
    error InsufficientFunding();

    event AttentionTreasuryBound(address indexed treasury);
    event CampaignCreated(bytes32 indexed campaignId, address indexed sponsor, address indexed verifier, uint256 declaredBudget);
    event CampaignActivated(bytes32 indexed campaignId);
    event CampaignPaused(bytes32 indexed campaignId);
    event CampaignClosed(bytes32 indexed campaignId);
    event CampaignCancelled(bytes32 indexed campaignId);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "CannaseurCampaignRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindAttentionTreasury(address treasury_) external onlyGovernance {
        if (address(attentionTreasury) != address(0)) revert AlreadyBound();
        if (treasury_ == address(0)) revert InvalidInput();
        attentionTreasury = AttentionTreasury(payable(treasury_));
        emit AttentionTreasuryBound(treasury_);
    }

    function createCampaign(
        bytes32 metadataHash,
        bytes32 audiencePolicyHash,
        address verifier,
        uint256 declaredBudget,
        uint256 rewardPerUnit,
        uint256 maxRewardPerAccount,
        uint64 startsAt,
        uint64 endsAt
    ) external returns (bytes32 campaignId) {
        if (address(attentionTreasury) == address(0)) revert TreasuryNotBound();
        if (metadataHash == bytes32(0) || audiencePolicyHash == bytes32(0) || verifier == address(0)) revert InvalidInput();
        if (declaredBudget == 0 || rewardPerUnit == 0 || maxRewardPerAccount == 0) revert InvalidInput();
        if (endsAt <= startsAt) revert InvalidWindow();
        uint64 nonce = ++sponsorNonce[msg.sender];
        campaignId = keccak256(abi.encode("420/CANNASEUR/CAMPAIGN/V1", block.chainid, msg.sender, nonce, metadataHash));
        _campaigns[campaignId] = Campaign({
            sponsor: msg.sender,
            verifier: verifier,
            metadataHash: metadataHash,
            audiencePolicyHash: audiencePolicyHash,
            declaredBudget: declaredBudget,
            rewardPerUnit: rewardPerUnit,
            maxRewardPerAccount: maxRewardPerAccount,
            startsAt: startsAt,
            endsAt: endsAt,
            state: CampaignState.DRAFT
        });
        attentionTreasury.registerCampaign(campaignId, msg.sender);
        emit CampaignCreated(campaignId, msg.sender, verifier, declaredBudget);
    }

    function activate(bytes32 campaignId) external {
        Campaign storage c = _campaigns[campaignId];
        if (c.sponsor != msg.sender) revert Unauthorized();
        if (c.state != CampaignState.DRAFT && c.state != CampaignState.PAUSED) revert InvalidState();
        AttentionTreasury.CampaignFunds memory f = attentionTreasury.campaignFunds(campaignId);
        if (f.funded < c.declaredBudget || f.closed) revert InsufficientFunding();
        c.state = CampaignState.ACTIVE;
        emit CampaignActivated(campaignId);
    }

    function pause(bytes32 campaignId) external {
        Campaign storage c = _campaigns[campaignId];
        if (c.sponsor != msg.sender && msg.sender != governanceTimelock) revert Unauthorized();
        if (c.state != CampaignState.ACTIVE) revert InvalidState();
        c.state = CampaignState.PAUSED;
        emit CampaignPaused(campaignId);
    }

    function close(bytes32 campaignId) external {
        Campaign storage c = _campaigns[campaignId];
        if (c.sponsor != msg.sender && msg.sender != governanceTimelock) revert Unauthorized();
        if (c.state != CampaignState.ACTIVE && c.state != CampaignState.PAUSED) revert InvalidState();
        if (block.timestamp < c.endsAt && msg.sender != governanceTimelock) revert InvalidWindow();
        c.state = CampaignState.CLOSED;
        attentionTreasury.closeCampaign(campaignId);
        emit CampaignClosed(campaignId);
    }

    function cancel(bytes32 campaignId) external {
        Campaign storage c = _campaigns[campaignId];
        if (c.sponsor != msg.sender && msg.sender != governanceTimelock) revert Unauthorized();
        if (c.state != CampaignState.DRAFT && c.state != CampaignState.PAUSED) revert InvalidState();
        c.state = CampaignState.CANCELLED;
        attentionTreasury.closeCampaign(campaignId);
        emit CampaignCancelled(campaignId);
    }

    function campaign(bytes32 campaignId) external view returns (Campaign memory) { return _campaigns[campaignId]; }

    function acceptsProof(bytes32 campaignId, uint64 observedAt) external view returns (bool) {
        Campaign storage c = _campaigns[campaignId];
        return c.state == CampaignState.ACTIVE && observedAt >= c.startsAt && observedAt <= c.endsAt;
    }
}
