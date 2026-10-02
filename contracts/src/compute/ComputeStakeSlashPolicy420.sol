// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

/// @notice Append-only objective slash policy authority for CMP-1.5.
/// @dev Policies are keyed by stakePolicyId + subjectKind. A position is governed by the
///      policy revision that was current when that collateral position opened.
contract ComputeStakeSlashPolicy420 is SystemAccess, I420System {
    bytes32 public constant POLICY_DOMAIN =
        keccak256("420Integrated.ComputeMarket.StakeSlashPolicy.v1");

    uint8 public constant SUBJECT_WORKER = 1;
    uint8 public constant SUBJECT_VERIFIER = 2;

    struct Policy {
        uint8 subjectKind;
        address evidenceAdapter;
        bytes32 evidenceAdapterCodeHash;
        bytes32 violationCode;
        bytes32 requiredVerificationPolicyId;
        uint32 requiredVerificationPolicyRevision;
        bytes32 requiredVerificationPolicyCommitment;
        uint16 slashBps;
        uint256 maxSlashAmount;
        uint64 publishedAt;
        uint32 revision;
        bool exists;
    }

    mapping(bytes32 => mapping(uint8 => uint32)) public latestRevision;
    mapping(bytes32 => mapping(uint8 => mapping(uint32 => Policy))) private _revisions;

    error InvalidPolicy();
    error UnknownPolicy();
    error RevisionOverflow();

    event SlashPolicyPublished(
        bytes32 indexed stakePolicyId,
        uint8 indexed subjectKind,
        uint32 indexed revision,
        bytes32 commitment
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "ComputeStakeSlashPolicy420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function publish(
        bytes32 stakePolicyId,
        uint8 subjectKind,
        address evidenceAdapter,
        bytes32 violationCode,
        bytes32 requiredVerificationPolicyId,
        uint32 requiredVerificationPolicyRevision,
        bytes32 requiredVerificationPolicyCommitment,
        uint16 slashBps,
        uint256 maxSlashAmount
    ) external onlyGovernance returns (uint32 revision) {
        if (
            stakePolicyId == bytes32(0)
                || (subjectKind != SUBJECT_WORKER && subjectKind != SUBJECT_VERIFIER)
                || evidenceAdapter.code.length == 0
                || violationCode == bytes32(0)
                || slashBps == 0
                || slashBps > 10_000
        ) revert InvalidPolicy();

        bool emptyVerification = requiredVerificationPolicyId == bytes32(0)
            && requiredVerificationPolicyRevision == 0
            && requiredVerificationPolicyCommitment == bytes32(0);
        bool completeVerification = requiredVerificationPolicyId != bytes32(0)
            && requiredVerificationPolicyRevision != 0
            && requiredVerificationPolicyCommitment != bytes32(0);
        if (!emptyVerification && !completeVerification) revert InvalidPolicy();

        uint32 previous = latestRevision[stakePolicyId][subjectKind];
        if (previous == type(uint32).max) revert RevisionOverflow();
        revision = previous + 1;

        _revisions[stakePolicyId][subjectKind][revision] = Policy({
            subjectKind: subjectKind,
            evidenceAdapter: evidenceAdapter,
            evidenceAdapterCodeHash: evidenceAdapter.codehash,
            violationCode: violationCode,
            requiredVerificationPolicyId: requiredVerificationPolicyId,
            requiredVerificationPolicyRevision: requiredVerificationPolicyRevision,
            requiredVerificationPolicyCommitment: requiredVerificationPolicyCommitment,
            slashBps: slashBps,
            maxSlashAmount: maxSlashAmount,
            publishedAt: uint64(block.timestamp),
            revision: revision,
            exists: true
        });
        latestRevision[stakePolicyId][subjectKind] = revision;

        emit SlashPolicyPublished(
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
                stakePolicyId,
                p.subjectKind,
                p.evidenceAdapter,
                p.evidenceAdapterCodeHash,
                p.violationCode,
                p.requiredVerificationPolicyId,
                p.requiredVerificationPolicyRevision,
                p.requiredVerificationPolicyCommitment,
                p.slashBps,
                p.maxSlashAmount,
                p.publishedAt,
                p.revision
            )
        );
    }

    function wasCurrentAt(
        bytes32 stakePolicyId,
        uint8 subjectKind,
        uint32 revision,
        uint64 openedAt
    ) external view returns (bool) {
        if (openedAt == 0) return false;
        Policy memory p = policy(stakePolicyId, subjectKind, revision);
        if (p.publishedAt > openedAt) return false;

        uint32 latest = latestRevision[stakePolicyId][subjectKind];
        if (revision == latest) return true;
        if (revision >= latest) return false;

        Policy memory next = _revisions[stakePolicyId][subjectKind][revision + 1];
        return next.exists && next.publishedAt > openedAt;
    }
}
