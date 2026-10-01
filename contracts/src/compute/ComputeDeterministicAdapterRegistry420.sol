// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./IComputeDeterministicVerificationAdapter420.sol";

/// @notice Governance-versioned deterministic verification adapter registry.
/// @dev Registration is semantic routing metadata only. It grants no verification/verdict/settlement authority.
contract ComputeDeterministicAdapterRegistry420 is I420System, SystemAccess {
    bytes32 public constant ADAPTER_KIND =
        keccak256("420/CMP/VERIFICATION_ADAPTER/DETERMINISTIC/V1");
    struct Route {
        address adapter;
        bytes32 codeHash;
        bytes32 outputSchemaCommitment;
        uint64 revision;
        bool active;
    }

    mapping(bytes32 => mapping(bytes32 => uint64)) public latestRevision;
    mapping(bytes32 => mapping(bytes32 => mapping(uint64 => Route))) private _history;

    error InvalidRoute();
    error RevisionOverflow();

    event DeterministicAdapterPublished(
        bytes32 indexed workloadType,
        bytes32 indexed profileId,
        uint64 indexed revision,
        address adapter,
        bytes32 codeHash,
        bytes32 outputSchemaCommitment
    );
    event DeterministicAdapterActivationSet(
        bytes32 indexed workloadType,
        bytes32 indexed profileId,
        uint64 indexed revision,
        bool active
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "ComputeDeterministicAdapterRegistry420";
    }

    function protocolVersion() external pure returns (uint32) { return 1; }

    function publish(bytes32 workloadType_, bytes32 profileId_, address adapter_)
        external onlyGovernance returns (uint64 revision)
    {
        if (
            workloadType_ == bytes32(0) || profileId_ == bytes32(0)
                || adapter_ == address(0) || adapter_.code.length == 0
        ) revert InvalidRoute();

        IComputeDeterministicVerificationAdapter420 a =
            IComputeDeterministicVerificationAdapter420(adapter_);
        bytes32 outputSchema = a.outputSchemaCommitment();
        if (
            a.adapterKind() != ADAPTER_KIND
                || a.workloadType() != workloadType_ || a.profileId() != profileId_
                || outputSchema == bytes32(0)
        ) revert InvalidRoute();

        uint64 previous = latestRevision[workloadType_][profileId_];
        if (previous == type(uint64).max) revert RevisionOverflow();
        revision = previous + 1;

        bytes32 codeHash = adapter_.codehash;
        if (codeHash == bytes32(0)) revert InvalidRoute();

        _history[workloadType_][profileId_][revision] = Route({
            adapter: adapter_,
            codeHash: codeHash,
            outputSchemaCommitment: outputSchema,
            revision: revision,
            active: true
        });
        latestRevision[workloadType_][profileId_] = revision;

        emit DeterministicAdapterPublished(
            workloadType_, profileId_, revision, adapter_, codeHash, outputSchema
        );
        emit DeterministicAdapterActivationSet(workloadType_, profileId_, revision, true);
    }

    function setActive(bytes32 workloadType_, bytes32 profileId_, uint64 revision, bool active)
        external onlyGovernance
    {
        Route storage r = _history[workloadType_][profileId_][revision];
        if (r.adapter == address(0)) revert InvalidRoute();
        r.active = active;
        emit DeterministicAdapterActivationSet(workloadType_, profileId_, revision, active);
    }

    function route(bytes32 workloadType_, bytes32 profileId_, uint64 revision)
        public view returns (Route memory r)
    {
        r = _history[workloadType_][profileId_][revision];
        if (r.adapter == address(0)) revert InvalidRoute();
    }

    function isCurrentActive(bytes32 workloadType_, bytes32 profileId_, uint64 revision)
        external view returns (bool)
    {
        if (revision == 0 || latestRevision[workloadType_][profileId_] != revision) return false;
        Route storage r = _history[workloadType_][profileId_][revision];
        return r.active && r.adapter != address(0) && r.adapter.codehash == r.codeHash;
    }
}
