// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./ApplicationRevenueIds420.sol";

contract ApplicationRevenueRegistry420 is I420System {
    struct RevenueProfile {
        address creatorTreasury;
        address creatorAccount;
        bytes32 revenuePolicyId;
        bytes32 treasuryKind;
        bytes32 metadataHash;
        uint16 creatorShareBps;
        uint32 revision;
        uint64 updatedAt;
        bool active;
        bool exists;
    }

    ICapabilityRegistry420 public immutable capabilityRegistry;
    mapping(bytes32 => RevenueProfile) private _profiles;

    error ZeroAddress();
    error InvalidApplicationId();
    error InvalidPolicy();
    error InvalidTreasuryKind();
    error InvalidShare();
    error Unauthorized();
    error ProfileNotFound();
    error NoChange();

    event ApplicationRevenueProfileSet(
        bytes32 indexed applicationId,
        address indexed creatorTreasury,
        address indexed creatorAccount,
        bytes32 revenuePolicyId,
        bytes32 treasuryKind,
        uint16 creatorShareBps,
        bytes32 metadataHash,
        uint32 revision
    );
    event ApplicationRevenueProfileDeactivated(bytes32 indexed applicationId, uint32 revision);

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "ApplicationRevenueRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setRevenueProfile(
        bytes32 applicationId,
        address creatorTreasury,
        address creatorAccount,
        bytes32 revenuePolicyId,
        bytes32 treasuryKind,
        uint16 creatorShareBps,
        bytes32 metadataHash
    ) external {
        if (applicationId == bytes32(0)) revert InvalidApplicationId();
        if (creatorTreasury == address(0) || creatorAccount == address(0)) revert ZeroAddress();
        if (revenuePolicyId == bytes32(0)) revert InvalidPolicy();
        if (!ApplicationRevenueIds420.validTreasuryKind(treasuryKind)) revert InvalidTreasuryKind();
        if (creatorShareBps > 10_000) revert InvalidShare();
        if (!_isAuthorized(msg.sender, applicationId, ApplicationRevenueIds420.ACTION_SET_PROFILE)) revert Unauthorized();

        RevenueProfile storage current = _profiles[applicationId];
        uint32 nextRevision = current.revision + 1;
        _profiles[applicationId] = RevenueProfile({
            creatorTreasury: creatorTreasury,
            creatorAccount: creatorAccount,
            revenuePolicyId: revenuePolicyId,
            treasuryKind: treasuryKind,
            metadataHash: metadataHash,
            creatorShareBps: creatorShareBps,
            revision: nextRevision,
            updatedAt: uint64(block.timestamp),
            active: true,
            exists: true
        });

        emit ApplicationRevenueProfileSet(
            applicationId,
            creatorTreasury,
            creatorAccount,
            revenuePolicyId,
            treasuryKind,
            creatorShareBps,
            metadataHash,
            nextRevision
        );
    }

    function deactivateRevenueProfile(bytes32 applicationId) external {
        RevenueProfile storage profile = _profiles[applicationId];
        if (!profile.exists) revert ProfileNotFound();
        if (!profile.active) revert NoChange();
        if (!_isAuthorized(msg.sender, applicationId, ApplicationRevenueIds420.ACTION_DEACTIVATE_PROFILE)) revert Unauthorized();
        profile.active = false;
        profile.revision += 1;
        profile.updatedAt = uint64(block.timestamp);
        emit ApplicationRevenueProfileDeactivated(applicationId, profile.revision);
    }

    function getRevenueProfile(bytes32 applicationId) external view returns (RevenueProfile memory profile) {
        profile = _profiles[applicationId];
        if (!profile.exists) revert ProfileNotFound();
    }

    function resolveCreatorTreasury(bytes32 applicationId)
        external
        view
        returns (address creatorTreasury, uint16 creatorShareBps, bytes32 revenuePolicyId)
    {
        RevenueProfile memory profile = _profiles[applicationId];
        if (!profile.exists || !profile.active) revert ProfileNotFound();
        return (profile.creatorTreasury, profile.creatorShareBps, profile.revenuePolicyId);
    }

    function _isAuthorized(address principal, bytes32 applicationId, bytes32 actionId) private view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            ApplicationRevenueIds420.COMPONENT_APPLICATION_REVENUE,
            actionId,
            ApplicationRevenueIds420.scopeApplication(applicationId),
            0
        );
    }
}
