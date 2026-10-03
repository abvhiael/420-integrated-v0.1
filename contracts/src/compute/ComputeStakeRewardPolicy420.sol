// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

/// @notice Append-only authorization policy for CMP worker/verifier reward evidence sources.
/// @dev This contract authorizes evidence/accounting sources only. It cannot mint, move Vault
///      value, mutate collateral, or touch payer escrow.
contract ComputeStakeRewardPolicy420 is SystemAccess, I420System {
    bytes32 public constant POLICY_DOMAIN =
        keccak256("420Integrated.ComputeMarket.StakeRewardPolicy.v1");

    uint8 public constant SUBJECT_WORKER = 1;
    uint8 public constant SUBJECT_VERIFIER = 2;

    struct Policy {
        bytes32 stakePolicyId;
        uint8 subjectKind;
        address rewardSource;
        bytes32 rewardSourceCodeHash;
        uint256 maxRewardAmount;
        uint64 publishedAt;
        uint32 revision;
        bool exists;
    }

    mapping(bytes32 => mapping(uint8 => uint32)) public latestRevision;
    mapping(bytes32 => mapping(uint8 => mapping(uint32 => Policy))) private _revisions;

    error InvalidPolicy();
    error UnknownPolicy();
    error RevisionOverflow();

    event RewardPolicyPublished(
        bytes32 indexed stakePolicyId,
        uint8 indexed subjectKind,
        uint32 indexed revision,
        bytes32 commitment
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "ComputeStakeRewardPolicy420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function publish(
        bytes32 stakePolicyId,
        uint8 subjectKind,
        address rewardSource,
        uint256 maxRewardAmount
    ) external onlyGovernance returns (uint32 revision) {
        if (
            stakePolicyId == bytes32(0)
                || (subjectKind != SUBJECT_WORKER && subjectKind != SUBJECT_VERIFIER)
                || rewardSource.code.length == 0
                || maxRewardAmount == 0
        ) revert InvalidPolicy();

        uint32 previous = latestRevision[stakePolicyId][subjectKind];
        if (previous == type(uint32).max) revert RevisionOverflow();
        revision = previous + 1;

        _revisions[stakePolicyId][subjectKind][revision] = Policy({
            stakePolicyId: stakePolicyId,
            subjectKind: subjectKind,
            rewardSource: rewardSource,
            rewardSourceCodeHash: rewardSource.codehash,
            maxRewardAmount: maxRewardAmount,
            publishedAt: uint64(block.timestamp),
            revision: revision,
            exists: true
        });
        latestRevision[stakePolicyId][subjectKind] = revision;

        emit RewardPolicyPublished(
            stakePolicyId,
            subjectKind,
            revision,
            commitment(stakePolicyId, subjectKind, revision)
        );
    }

    function policy(bytes32 stakePolicyId, uint8 subjectKind, uint32 revision)
        public
        view
        returns (Policy memory p)
    {
        p = _revisions[stakePolicyId][subjectKind][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function currentPolicy(bytes32 stakePolicyId, uint8 subjectKind)
        external
        view
        returns (Policy memory p, bytes32 exactCommitment)
    {
        uint32 revision = latestRevision[stakePolicyId][subjectKind];
        if (revision == 0) revert UnknownPolicy();
        p = _revisions[stakePolicyId][subjectKind][revision];
        exactCommitment = commitment(stakePolicyId, subjectKind, revision);
    }

    function commitment(bytes32 stakePolicyId, uint8 subjectKind, uint32 revision)
        public
        view
        returns (bytes32)
    {
        Policy memory p = policy(stakePolicyId, subjectKind, revision);
        return keccak256(
            abi.encode(
                POLICY_DOMAIN,
                block.chainid,
                address(this),
                p.stakePolicyId,
                p.subjectKind,
                p.rewardSource,
                p.rewardSourceCodeHash,
                p.maxRewardAmount,
                p.publishedAt,
                p.revision
            )
        );
    }
}
