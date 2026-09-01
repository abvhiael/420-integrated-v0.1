// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/CannaseurCampaignRegistry.sol";
import "../system/AttentionTreasury.sol";
import "./AttentionProofRegistry420.sol";
import "./AttentionAuthorization420.sol";
import "./AttentionIds420.sol";

contract AttentionRewardRegistry420 is I420System {
    enum RewardState { NONE, RESERVED, PAID }

    struct Reward {
        bytes32 campaignId;
        bytes32 proofId;
        address account;
        uint256 amount;
        RewardState state;
    }

    CannaseurCampaignRegistry public immutable campaigns;
    AttentionProofRegistry420 public immutable proofs;
    AttentionTreasury public immutable treasury;
    AttentionAuthorization420 public immutable authorization;

    mapping(bytes32 => Reward) private _rewards;
    mapping(bytes32 => bool) public proofConsumed;
    mapping(bytes32 => mapping(address => uint256)) public earnedByCampaign;

    error InvalidInput();
    error AlreadyConsumed();
    error CapExceeded();
    error Unauthorized();
    error InvalidState();

    event RewardAccrued(bytes32 indexed rewardId, bytes32 indexed campaignId, address indexed account, uint256 amount, bytes32 proofId);
    event RewardClaimed(bytes32 indexed rewardId, address indexed account, uint256 amount);

    constructor(address campaigns_, address proofs_, address treasury_, address authorization_) {
        if (campaigns_ == address(0) || proofs_ == address(0) || treasury_ == address(0) || authorization_ == address(0)) revert InvalidInput();
        campaigns = CannaseurCampaignRegistry(campaigns_);
        proofs = AttentionProofRegistry420(proofs_);
        treasury = AttentionTreasury(payable(treasury_));
        authorization = AttentionAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "AttentionRewardRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function accrue(bytes32 proofId) external returns (bytes32 rewardId) {
        if (proofConsumed[proofId]) revert AlreadyConsumed();
        AttentionProofRegistry420.ProofRecord memory p = proofs.proof(proofId);
        if (!p.exists) revert InvalidInput();
        CannaseurCampaignRegistry.Campaign memory c = campaigns.campaign(p.campaignId);
        uint256 amount = uint256(p.attentionUnits) * c.rewardPerUnit;
        uint256 previous = earnedByCampaign[p.campaignId][p.account];
        if (previous + amount > c.maxRewardPerAccount) revert CapExceeded();
        rewardId = keccak256(abi.encode("420/ATTENTION/REWARD/V1", block.chainid, proofId, p.account, amount));
        proofConsumed[proofId] = true;
        earnedByCampaign[p.campaignId][p.account] = previous + amount;
        _rewards[rewardId] = Reward(p.campaignId, proofId, p.account, amount, RewardState.RESERVED);
        treasury.reserveReward(p.campaignId, rewardId, amount);
        emit RewardAccrued(rewardId, p.campaignId, p.account, amount, proofId);
    }

    function claim(bytes32 rewardId, address account) external {
        Reward storage r = _rewards[rewardId];
        if (r.state != RewardState.RESERVED || r.account != account) revert InvalidState();
        if (msg.sender != account && !authorization.isAuthorized(msg.sender, account, AttentionIds420.ACTION_CLAIM_REWARD)) revert Unauthorized();
        r.state = RewardState.PAID;
        treasury.releaseReward(r.campaignId, rewardId, payable(account), r.amount);
        emit RewardClaimed(rewardId, account, r.amount);
    }

    function reward(bytes32 rewardId) external view returns (Reward memory) { return _rewards[rewardId]; }
}
