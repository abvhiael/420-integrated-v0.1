// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeSlashRecipientResolver420.sol";
import "../system/SystemAccess.sol";

/// @notice Append-only policy for routing an already-authorized CMP slash.
/// @dev This policy chooses recipient classes and shares only. It cannot authorize a slash,
///      move collateral, consume an authorization, or mutate payer escrow.
contract ComputeStakeSlashDistributionPolicy420 is SystemAccess, I420System {
    bytes32 public constant POLICY_DOMAIN =
        keccak256("420Integrated.ComputeMarket.StakeSlashDistributionPolicy.v1");

    struct Policy {
        bytes32 slashPolicyCommitment;
        address recipientResolver;
        bytes32 recipientResolverCodeHash;
        address protocolTreasury;
        uint16 harmedPayerBps;
        uint16 replacementWorkerBps;
        uint16 challengerBps;
        uint16 protocolTreasuryBps;
        uint64 publishedAt;
        uint32 revision;
        bool exists;
    }

    mapping(bytes32 => uint32) public latestRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _revisions;

    error InvalidPolicy();
    error UnknownPolicy();
    error RevisionOverflow();

    event DistributionPolicyPublished(
        bytes32 indexed slashPolicyCommitment,
        uint32 indexed revision,
        bytes32 indexed commitment
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "ComputeStakeSlashDistributionPolicy420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function publish(
        bytes32 slashPolicyCommitment,
        address recipientResolver,
        address protocolTreasury,
        uint16 harmedPayerBps,
        uint16 replacementWorkerBps,
        uint16 challengerBps,
        uint16 protocolTreasuryBps
    ) external onlyGovernance returns (uint32 revision) {
        if (slashPolicyCommitment == bytes32(0)) revert InvalidPolicy();

        uint256 total = uint256(harmedPayerBps)
            + uint256(replacementWorkerBps)
            + uint256(challengerBps)
            + uint256(protocolTreasuryBps);
        if (total != 10_000) revert InvalidPolicy();

        bool dynamicRecipientRequired =
            harmedPayerBps != 0 || replacementWorkerBps != 0 || challengerBps != 0;
        if (
            (dynamicRecipientRequired && recipientResolver.code.length == 0)
                || (!dynamicRecipientRequired && recipientResolver != address(0))
                || (protocolTreasuryBps != 0 && protocolTreasury == address(0))
                || (protocolTreasuryBps == 0 && protocolTreasury != address(0))
        ) revert InvalidPolicy();

        uint32 previous = latestRevision[slashPolicyCommitment];
        if (previous == type(uint32).max) revert RevisionOverflow();
        revision = previous + 1;

        _revisions[slashPolicyCommitment][revision] = Policy({
            slashPolicyCommitment: slashPolicyCommitment,
            recipientResolver: recipientResolver,
            recipientResolverCodeHash:
                recipientResolver == address(0) ? bytes32(0) : recipientResolver.codehash,
            protocolTreasury: protocolTreasury,
            harmedPayerBps: harmedPayerBps,
            replacementWorkerBps: replacementWorkerBps,
            challengerBps: challengerBps,
            protocolTreasuryBps: protocolTreasuryBps,
            publishedAt: uint64(block.timestamp),
            revision: revision,
            exists: true
        });
        latestRevision[slashPolicyCommitment] = revision;

        emit DistributionPolicyPublished(
            slashPolicyCommitment,
            revision,
            commitment(slashPolicyCommitment, revision)
        );
    }

    function policy(bytes32 slashPolicyCommitment, uint32 revision)
        public
        view
        returns (Policy memory p)
    {
        p = _revisions[slashPolicyCommitment][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function currentPolicy(bytes32 slashPolicyCommitment)
        external
        view
        returns (Policy memory p, bytes32 exactCommitment)
    {
        uint32 revision = latestRevision[slashPolicyCommitment];
        if (revision == 0) revert UnknownPolicy();
        p = _revisions[slashPolicyCommitment][revision];
        exactCommitment = commitment(slashPolicyCommitment, revision);
    }

    function commitment(bytes32 slashPolicyCommitment, uint32 revision)
        public
        view
        returns (bytes32)
    {
        Policy memory p = policy(slashPolicyCommitment, revision);
        return keccak256(
            abi.encode(
                POLICY_DOMAIN,
                block.chainid,
                address(this),
                p.slashPolicyCommitment,
                p.recipientResolver,
                p.recipientResolverCodeHash,
                p.protocolTreasury,
                p.harmedPayerBps,
                p.replacementWorkerBps,
                p.challengerBps,
                p.protocolTreasuryBps,
                p.publishedAt,
                p.revision
            )
        );
    }
}
