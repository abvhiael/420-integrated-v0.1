// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./ComputeVerifierRegistry420.sol";

/// @notice Canonical ComputeMarket verifier class and workload-capability registry.
/// @dev Capability qualification is exact and independent from identity lifecycle, job appointment,
///      verification policy, correctness, settlement, custody, stake/slash, governance, worker,
///      validator, bridge, or arbitrary-wallet authority.
contract ComputeVerifierCapabilityRegistry420 is I420System, SystemAccess {
    bytes32 public constant PROTOCOL_VERIFIER = keccak256("PROTOCOL_VERIFIER");
    bytes32 public constant INDEPENDENT_VERIFIER = keccak256("INDEPENDENT_VERIFIER");
    bytes32 public constant JOB_OWNER_VERIFIER = keccak256("JOB_OWNER_VERIFIER");
    bytes32 public constant ORACLE_VERIFIER = keccak256("ORACLE_VERIFIER");
    bytes32 public constant TEE_VERIFIER = keccak256("TEE_VERIFIER");
    bytes32 public constant COMMITTEE_VERIFIER = keccak256("COMMITTEE_VERIFIER");

    struct Capability {
        bool enabled;
        bytes32 evidenceHash;
        uint64 revision;
    }

    ComputeVerifierRegistry420 public immutable verifiers;

    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => Capability))) private _current;
    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => mapping(uint64 => Capability)))) private _history;

    error InvalidRegistry();
    error InvalidVerifierClass();
    error InvalidWorkloadClass();
    error InvalidEvidence();
    error InvalidVerifier();
    error SerialExhausted();

    event CapabilityRevised(
        bytes32 indexed verifierId,
        bytes32 indexed verifierClass,
        bytes32 indexed workloadClass,
        bool enabled,
        bytes32 evidenceHash,
        uint64 oldRevision,
        uint64 newRevision
    );

    constructor(address verifierRegistry_, address timelock_) SystemAccess(timelock_) {
        if (verifierRegistry_ == address(0) || verifierRegistry_.code.length == 0) revert InvalidRegistry();
        verifiers = ComputeVerifierRegistry420(verifierRegistry_);
    }

    function systemName() external pure returns (string memory) { return "ComputeVerifierCapabilityRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function isKnownVerifierClass(bytes32 verifierClass) public pure returns (bool) {
        return verifierClass == PROTOCOL_VERIFIER
            || verifierClass == INDEPENDENT_VERIFIER
            || verifierClass == JOB_OWNER_VERIFIER
            || verifierClass == ORACLE_VERIFIER
            || verifierClass == TEE_VERIFIER
            || verifierClass == COMMITTEE_VERIFIER;
    }

    function capability(bytes32 verifierId, bytes32 verifierClass, bytes32 workloadClass)
        external view returns (Capability memory)
    {
        _validate(verifierId, verifierClass, workloadClass);
        return _current[verifierId][verifierClass][workloadClass];
    }

    function capabilityRevision(
        bytes32 verifierId,
        bytes32 verifierClass,
        bytes32 workloadClass,
        uint64 revision_
    ) external view returns (Capability memory c) {
        _validate(verifierId, verifierClass, workloadClass);
        c = _history[verifierId][verifierClass][workloadClass][revision_];
        if (c.revision == 0) revert InvalidEvidence();
    }

    /// @notice Governance qualifies or revokes one exact verifier-class/workload tuple.
    /// @dev Workload classes are canonical external bytes32 identities; no wildcard or implicit inheritance exists.
    function setCapability(
        bytes32 verifierId,
        bytes32 verifierClass,
        bytes32 workloadClass,
        bool enabled,
        bytes32 evidenceHash
    ) external onlyGovernance {
        _validate(verifierId, verifierClass, workloadClass);
        if (evidenceHash == bytes32(0)) revert InvalidEvidence();

        ComputeVerifierRegistry420.Verifier memory v = verifiers.verifier(verifierId);
        if (v.status == ComputeVerifierRegistry420.Status.RETIRED) revert InvalidVerifier();

        Capability memory old = _current[verifierId][verifierClass][workloadClass];
        if (old.revision == type(uint64).max) revert SerialExhausted();

        uint64 newRevision = old.revision + 1;
        Capability memory next = Capability({
            enabled: enabled,
            evidenceHash: evidenceHash,
            revision: newRevision
        });
        _current[verifierId][verifierClass][workloadClass] = next;
        _history[verifierId][verifierClass][workloadClass][newRevision] = next;

        emit CapabilityRevised(
            verifierId,
            verifierClass,
            workloadClass,
            enabled,
            evidenceHash,
            old.revision,
            newRevision
        );
    }

    /// @notice Exact-current capability eligibility for later selection/policy components.
    /// @dev This is not job appointment, independence, correctness, or settlement authority.
    function isCapable(
        bytes32 verifierId,
        address authority,
        uint64 verifierRevision,
        bytes32 verifierClass,
        bytes32 workloadClass
    ) external view returns (bool) {
        if (!isKnownVerifierClass(verifierClass) || workloadClass == bytes32(0)) return false;
        Capability storage c = _current[verifierId][verifierClass][workloadClass];
        if (!c.enabled || c.revision == 0) return false;
        return verifiers.isActive(verifierId, authority, verifierRevision);
    }

    function _validate(bytes32 verifierId, bytes32 verifierClass, bytes32 workloadClass) private view {
        if (verifierId == bytes32(0)) revert InvalidVerifier();
        if (!isKnownVerifierClass(verifierClass)) revert InvalidVerifierClass();
        if (workloadClass == bytes32(0)) revert InvalidWorkloadClass();
        verifiers.verifier(verifierId);
    }
}
