// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IComputeSlashDistributionSource420.sol";
import "../interfaces/IComputeSlashRecipientResolver420.sol";
import "./ComputeStakeSlashAuthorization420.sol";
import "./ComputeStakeSlashDistributionPolicy420.sol";

/// @notice Permissionless, resumable execution of one preauthorized slash distribution.
/// @dev Recipient terms are frozen in the authorization. Each batch moves only canonical
///      collateral Vault obligations; the authorization is consumed only after full distribution.
contract ComputeStakeSlashDistribution420 is I420System {
    struct Execution {
        bytes32 authorizationRef;
        bytes32 positionId;
        uint8 subjectKind;
        uint256 totalAmount;
        uint256 distributedAmount;
        address harmedPayer;
        address replacementWorker;
        address challenger;
        address protocolTreasury;
        uint256 harmedPayerTarget;
        uint256 replacementWorkerTarget;
        uint256 challengerTarget;
        uint256 protocolTreasuryTarget;
        uint256 harmedPayerPaid;
        uint256 replacementWorkerPaid;
        uint256 challengerPaid;
        uint256 protocolTreasuryPaid;
        bool started;
        bool completed;
    }

    ComputeStakeSlashAuthorization420 public immutable authorizer;
    ComputeStakeSlashDistributionPolicy420 public immutable policies;

    mapping(bytes32 => Execution) private _executions;

    error InvalidDistribution();

    event SlashDistributionStarted(
        bytes32 indexed authorizationRef,
        bytes32 indexed positionId,
        uint256 totalAmount
    );
    event SlashDistributionBatch(
        bytes32 indexed authorizationRef,
        bytes32 indexed positionId,
        uint256 amount,
        uint256 distributedAmount,
        uint64 visitedTranches
    );
    event SlashDistributionCompleted(
        bytes32 indexed authorizationRef,
        bytes32 indexed positionId,
        uint256 totalAmount
    );

    constructor(address authorizer_, address policies_) {
        if (authorizer_.code.length == 0 || policies_.code.length == 0) {
            revert InvalidDistribution();
        }
        authorizer = ComputeStakeSlashAuthorization420(authorizer_);
        policies = ComputeStakeSlashDistributionPolicy420(policies_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeStakeSlashDistribution420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function execution(bytes32 authorizationRef)
        external
        view
        returns (Execution memory e)
    {
        e = _executions[authorizationRef];
        if (!e.started) revert InvalidDistribution();
    }

    function executeBatch(bytes32 authorizationRef, uint64 maxTranches)
        external
        returns (uint256 amount, bool completed)
    {
        if (authorizationRef == bytes32(0) || maxTranches == 0) {
            revert InvalidDistribution();
        }

        Execution storage e = _executions[authorizationRef];
        if (!e.started) _start(authorizationRef, e);
        if (e.completed || e.distributedAmount >= e.totalAmount) {
            revert InvalidDistribution();
        }

        ComputeStakeSlashAuthorization420.Authorization memory a =
            authorizer.authorization(authorizationRef);
        if (a.distributed || a.amount != e.totalAmount || a.positionId != e.positionId) {
            revert InvalidDistribution();
        }

        address source = a.subjectKind == 1
            ? authorizer.workerCollateral()
            : a.subjectKind == 2
                ? authorizer.verifierCollateral()
                : address(0);
        if (source == address(0)) revert InvalidDistribution();

        uint256 remaining = e.totalAmount - e.distributedAmount;
        (amount,) = IComputeSlashDistributionSource420(source).previewSlashBatch(
            e.positionId, remaining, maxTranches
        );
        if (amount == 0 || amount > remaining) revert InvalidDistribution();

        uint256[4] memory slotAmounts = _batchSlots(e, amount);
        uint256 recipientCount;
        for (uint256 i; i < 4; ++i) {
            if (slotAmounts[i] != 0) ++recipientCount;
        }
        if (recipientCount == 0) revert InvalidDistribution();

        address[] memory recipients = new address[](recipientCount);
        uint256[] memory recipientAmounts = new uint256[](recipientCount);
        uint256 cursor;
        for (uint256 i; i < 4; ++i) {
            if (slotAmounts[i] == 0) continue;
            recipients[cursor] = _recipient(e, i);
            recipientAmounts[cursor] = slotAmounts[i];
            ++cursor;
        }

        uint64 visited = IComputeSlashDistributionSource420(source).executeSlashBatch(
            e.positionId,
            authorizationRef,
            amount,
            maxTranches,
            recipients,
            recipientAmounts
        );
        if (visited == 0) revert InvalidDistribution();

        e.harmedPayerPaid += slotAmounts[0];
        e.replacementWorkerPaid += slotAmounts[1];
        e.challengerPaid += slotAmounts[2];
        e.protocolTreasuryPaid += slotAmounts[3];
        e.distributedAmount += amount;

        emit SlashDistributionBatch(
            authorizationRef,
            e.positionId,
            amount,
            e.distributedAmount,
            visited
        );

        if (e.distributedAmount == e.totalAmount) {
            if (
                e.harmedPayerPaid != e.harmedPayerTarget
                    || e.replacementWorkerPaid != e.replacementWorkerTarget
                    || e.challengerPaid != e.challengerTarget
                    || e.protocolTreasuryPaid != e.protocolTreasuryTarget
            ) revert InvalidDistribution();

            uint256 consumed = authorizer.consumeDistribution(authorizationRef);
            if (consumed != e.totalAmount) revert InvalidDistribution();
            e.completed = true;
            completed = true;
            emit SlashDistributionCompleted(
                authorizationRef, e.positionId, e.totalAmount
            );
        }
    }

    function _start(bytes32 authorizationRef, Execution storage e) private {
        if (
            address(authorizer.distributionPolicies()) != address(policies)
                || authorizer.distributionExecutor() != address(this)
        ) revert InvalidDistribution();

        ComputeStakeSlashAuthorization420.Authorization memory a =
            authorizer.authorization(authorizationRef);
        if (!a.exists || a.distributed || a.amount == 0) revert InvalidDistribution();

        ComputeStakeSlashDistributionPolicy420.Policy memory p =
            policies.policy(a.slashPolicyCommitment, a.distributionPolicyRevision);
        if (
            p.slashPolicyCommitment != a.slashPolicyCommitment
                || policies.commitment(a.slashPolicyCommitment, a.distributionPolicyRevision)
                    != a.distributionPolicyCommitment
                || (
                    p.recipientResolver != address(0)
                        && (
                            p.recipientResolver.code.length == 0
                                || p.recipientResolver.codehash
                                    != p.recipientResolverCodeHash
                        )
                )
        ) revert InvalidDistribution();

        if (
            (p.harmedPayerBps != 0
                && (a.harmedPayer == address(0)
                    || a.harmedPayer == a.subjectAccount))
                || (p.replacementWorkerBps != 0
                    && (a.replacementWorker == address(0)
                        || a.replacementWorker == a.subjectAccount))
                || (p.challengerBps != 0
                    && (a.challenger == address(0)
                        || a.challenger == a.subjectAccount))
                || (p.protocolTreasuryBps != 0
                    && (a.protocolTreasury == address(0)
                        || a.protocolTreasury == a.subjectAccount
                        || a.protocolTreasury != p.protocolTreasury))
                || (p.protocolTreasuryBps == 0 && a.protocolTreasury != address(0))
        ) revert InvalidDistribution();

        uint256[4] memory targets;
        targets[0] = _bps(a.amount, p.harmedPayerBps);
        targets[1] = _bps(a.amount, p.replacementWorkerBps);
        targets[2] = _bps(a.amount, p.challengerBps);
        targets[3] = _bps(a.amount, p.protocolTreasuryBps);

        uint256 assigned = targets[0] + targets[1] + targets[2] + targets[3];
        if (assigned > a.amount) revert InvalidDistribution();
        uint256 remainder = a.amount - assigned;
        if (remainder != 0) {
            if (p.harmedPayerBps != 0) targets[0] += remainder;
            else if (p.replacementWorkerBps != 0) targets[1] += remainder;
            else if (p.challengerBps != 0) targets[2] += remainder;
            else if (p.protocolTreasuryBps != 0) targets[3] += remainder;
            else revert InvalidDistribution();
        }

        e.authorizationRef = authorizationRef;
        e.positionId = a.positionId;
        e.subjectKind = a.subjectKind;
        e.totalAmount = a.amount;
        e.harmedPayer = a.harmedPayer;
        e.replacementWorker = a.replacementWorker;
        e.challenger = a.challenger;
        e.protocolTreasury = a.protocolTreasury;
        e.harmedPayerTarget = targets[0];
        e.replacementWorkerTarget = targets[1];
        e.challengerTarget = targets[2];
        e.protocolTreasuryTarget = targets[3];
        e.started = true;

        emit SlashDistributionStarted(authorizationRef, a.positionId, a.amount);
    }

    function _batchSlots(Execution storage e, uint256 amount)
        private
        view
        returns (uint256[4] memory slots)
    {
        uint256 remaining = amount;
        uint256[4] memory targets = [
            e.harmedPayerTarget,
            e.replacementWorkerTarget,
            e.challengerTarget,
            e.protocolTreasuryTarget
        ];
        uint256[4] memory paid = [
            e.harmedPayerPaid,
            e.replacementWorkerPaid,
            e.challengerPaid,
            e.protocolTreasuryPaid
        ];

        for (uint256 i; i < 4 && remaining != 0; ++i) {
            uint256 due = targets[i] - paid[i];
            if (due == 0) continue;
            uint256 take = due > remaining ? remaining : due;
            slots[i] = take;
            remaining -= take;
        }
        if (remaining != 0) revert InvalidDistribution();
    }

    function _recipient(Execution storage e, uint256 slot)
        private
        view
        returns (address)
    {
        if (slot == 0) return e.harmedPayer;
        if (slot == 1) return e.replacementWorker;
        if (slot == 2) return e.challenger;
        if (slot == 3) return e.protocolTreasury;
        revert InvalidDistribution();
    }

    function _bps(uint256 amount, uint16 bps) private pure returns (uint256) {
        uint256 whole = amount / 10_000;
        uint256 remainder = amount % 10_000;
        return whole * uint256(bps) + (remainder * uint256(bps)) / 10_000;
    }
}
