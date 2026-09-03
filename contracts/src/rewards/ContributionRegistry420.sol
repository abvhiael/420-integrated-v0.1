// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./RewardAuthorization420.sol";

contract ContributionRegistry420 is I420System {
    struct Contribution {
        bytes32 appId;
        bytes32 contributionType;
        address publisher;
        address beneficiary;
        bytes32 contentHash;
        bytes32 nullifier;
        uint64 createdAt;
        bool exists;
    }

    RewardAuthorization420 public immutable authorization;
    mapping(bytes32 => Contribution) private _contributions;
    mapping(bytes32 => bool) public nullifierUsed;

    error InvalidInput();
    error Unauthorized();
    error Replay();

    event ContributionPublished(
        bytes32 indexed contributionId,
        bytes32 indexed appId,
        bytes32 indexed contributionType,
        address publisher,
        address beneficiary,
        bytes32 contentHash,
        bytes32 nullifier
    );

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert InvalidInput();
        authorization = RewardAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "ContributionRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function publish(
        bytes32 appId,
        bytes32 contributionType,
        address beneficiary,
        bytes32 contentHash,
        bytes32 nonce
    ) external returns (bytes32 contributionId) {
        if (appId == bytes32(0) || contributionType == bytes32(0) || beneficiary == address(0) || contentHash == bytes32(0) || nonce == bytes32(0)) {
            revert InvalidInput();
        }
        if (!authorization.canPublish(msg.sender, appId)) revert Unauthorized();

        bytes32 nullifier = keccak256(abi.encode("420/REWARDS/CONTRIBUTION/NULLIFIER/V1", block.chainid, appId, msg.sender, nonce));
        if (nullifierUsed[nullifier]) revert Replay();

        contributionId = keccak256(abi.encode(
            "420/REWARDS/CONTRIBUTION/V1",
            block.chainid,
            appId,
            contributionType,
            msg.sender,
            beneficiary,
            contentHash,
            nonce
        ));
        if (_contributions[contributionId].exists) revert Replay();

        nullifierUsed[nullifier] = true;
        _contributions[contributionId] = Contribution({
            appId: appId,
            contributionType: contributionType,
            publisher: msg.sender,
            beneficiary: beneficiary,
            contentHash: contentHash,
            nullifier: nullifier,
            createdAt: uint64(block.timestamp),
            exists: true
        });

        emit ContributionPublished(contributionId, appId, contributionType, msg.sender, beneficiary, contentHash, nullifier);
    }

    function contribution(bytes32 contributionId) external view returns (Contribution memory) {
        return _contributions[contributionId];
    }
}
