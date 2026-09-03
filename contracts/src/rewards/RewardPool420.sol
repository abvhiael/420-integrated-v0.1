// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./RewardAuthorization420.sol";

contract RewardPool420 is I420System {
    RewardAuthorization420 public immutable authorization;
    address public distributor;

    mapping(bytes32 => uint256) public funded;
    mapping(bytes32 => uint256) public reserved;

    error InvalidInput();
    error Unauthorized();
    error AlreadyBound();
    error InsufficientAvailable();
    error TransferFailed();

    event DistributorBound(address indexed distributor);
    event CampaignFunded(bytes32 indexed campaignId, address indexed funder, uint256 amount);
    event RewardReserved(bytes32 indexed campaignId, bytes32 indexed rewardId, uint256 amount);
    event RewardReleased(bytes32 indexed campaignId, bytes32 indexed rewardId, address indexed beneficiary, uint256 amount);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert InvalidInput();
        authorization = RewardAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "RewardPool420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindDistributor(address distributor_) external {
        if (distributor_ == address(0)) revert InvalidInput();
        if (distributor != address(0)) revert AlreadyBound();
        if (!authorization.canBindDistributor(msg.sender)) revert Unauthorized();
        distributor = distributor_;
        emit DistributorBound(distributor_);
    }

    function fund(bytes32 campaignId) external payable {
        if (campaignId == bytes32(0) || msg.value == 0) revert InvalidInput();
        funded[campaignId] += msg.value;
        emit CampaignFunded(campaignId, msg.sender, msg.value);
    }

    function reserve(bytes32 campaignId, bytes32 rewardId, uint256 amount) external {
        if (msg.sender != distributor) revert Unauthorized();
        if (amount == 0 || funded[campaignId] < reserved[campaignId] + amount) revert InsufficientAvailable();
        reserved[campaignId] += amount;
        emit RewardReserved(campaignId, rewardId, amount);
    }

    function release(bytes32 campaignId, bytes32 rewardId, address payable beneficiary, uint256 amount) external {
        if (msg.sender != distributor) revert Unauthorized();
        if (beneficiary == address(0) || amount == 0 || reserved[campaignId] < amount || funded[campaignId] < amount) revert InvalidInput();
        reserved[campaignId] -= amount;
        funded[campaignId] -= amount;
        (bool ok,) = beneficiary.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit RewardReleased(campaignId, rewardId, beneficiary, amount);
    }

    function available(bytes32 campaignId) external view returns (uint256) {
        return funded[campaignId] - reserved[campaignId];
    }
}
