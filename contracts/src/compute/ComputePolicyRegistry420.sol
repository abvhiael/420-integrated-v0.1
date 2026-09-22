// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

/// @notice Append-only ComputeMarket policy publication and separately gated new admission.
/// @dev The caller of a future matching/verifying contract must snapshot (kind,id,revision,commitment)
///      and the policy parameters at acceptance. `isAcceptable` applies ONLY to new acceptance;
///      historic records remain readable after supersession or suspension. No funds, job or grant authority.
contract ComputePolicyRegistry420 is SystemAccess, I420System {
    bytes32 public constant KIND_PRICING = keccak256("420/COMPUTE/POLICY/PRICING/V1");
    bytes32 public constant KIND_VERIFICATION = keccak256("420/COMPUTE/POLICY/VERIFICATION/V1");
    bytes32 public constant KIND_PRIVACY = keccak256("420/COMPUTE/POLICY/PRIVACY/V1");
    bytes32 public constant KIND_SLA = keccak256("420/COMPUTE/POLICY/SLA/V1");
    bytes32 public constant KIND_DISPUTE = keccak256("420/COMPUTE/POLICY/DISPUTE/V1");
    bytes32 public constant KIND_RUNTIME = keccak256("420/COMPUTE/POLICY/RUNTIME/V1");
    bytes32 private constant _COMMITMENT_DOMAIN = keccak256("420/COMPUTE/POLICY/COMMITMENT/V1");

    struct Policy {
        bytes32 kind;
        bytes32 termsHash;
        bytes32 schemaHash;
        uint64 maxDurationSeconds;
        uint256 maxUnits;
        uint256 maxSpend;
        uint32 revision;
        bool exists;
    }

    mapping(bytes32 => uint32) public latestRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _revisions;
    mapping(bytes32 => bool) public acceptingNew;

    error InvalidPolicy();
    error UnknownPolicy();
    error UnsupportedKind();
    error RevisionOverflow();
    event PolicyPublished(bytes32 indexed policyId, bytes32 indexed kind, uint32 indexed revision, bytes32 commitment);
    event NewAcceptanceSet(bytes32 indexed policyId, bool accepting);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "ComputePolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function supportedKind(bytes32 kind) public pure returns (bool) {
        return kind == KIND_PRICING || kind == KIND_VERIFICATION || kind == KIND_PRIVACY
            || kind == KIND_SLA || kind == KIND_DISPUTE || kind == KIND_RUNTIME;
    }

    /// @dev A new revision never overwrites an accepted one. Nonzero bounds apply across policy kinds
    ///      as conservative V1 ceilings; no arbitrary external parser is enabled by publishing a hash.
    function publish(bytes32 policyId, bytes32 kind, bytes32 termsHash, bytes32 schemaHash,
        uint64 maxDurationSeconds, uint256 maxUnits, uint256 maxSpend) external onlyGovernance returns (uint32 revision) {
        if (policyId == bytes32(0) || termsHash == bytes32(0) || schemaHash == bytes32(0)
            || maxDurationSeconds == 0 || maxUnits == 0 || maxSpend == 0) revert InvalidPolicy();
        if (!supportedKind(kind)) revert UnsupportedKind();
        uint32 previous = latestRevision[policyId];
        if (previous == type(uint32).max) revert RevisionOverflow();
        if (previous != 0 && _revisions[policyId][previous].kind != kind) revert InvalidPolicy();
        revision = previous + 1;
        _revisions[policyId][revision] = Policy(kind, termsHash, schemaHash, maxDurationSeconds, maxUnits, maxSpend, revision, true);
        latestRevision[policyId] = revision;
        acceptingNew[policyId] = true;
        emit PolicyPublished(policyId, kind, revision, commitment(policyId, revision));
        emit NewAcceptanceSet(policyId, true);
    }

    /// @notice Stops/reenables NEW policy acceptance; does not rewrite terms for existing commitments.
    function setNewAcceptance(bytes32 policyId, bool accepting) external onlyGovernance {
        if (latestRevision[policyId] == 0) revert UnknownPolicy();
        acceptingNew[policyId] = accepting;
        emit NewAcceptanceSet(policyId, accepting);
    }

    function policy(bytes32 policyId, uint32 revision) public view returns (Policy memory p) {
        p = _revisions[policyId][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function commitment(bytes32 policyId, uint32 revision) public view returns (bytes32) {
        Policy memory p = policy(policyId, revision);
        return keccak256(abi.encode(_COMMITMENT_DOMAIN, block.chainid, address(this), policyId,
            p.kind, p.revision, p.termsHash, p.schemaHash, p.maxDurationSeconds, p.maxUnits, p.maxSpend));
    }

    /// @notice Validate a new acceptance against the CURRENT revision and its immutable exact digest.
    /// @dev Existing accepted jobs must use `policy` + their stored digest, not call this function to
    ///      reinterpret their historical terms after an upgrade or policy suspension.
    function isAcceptable(bytes32 policyId, uint32 revision, bytes32 kind, bytes32 exactCommitment,
        uint64 durationSeconds, uint256 units, uint256 spend) external view returns (bool) {
        if (!acceptingNew[policyId] || revision == 0 || revision != latestRevision[policyId]
            || exactCommitment == bytes32(0)) return false;
        Policy memory p = _revisions[policyId][revision];
        if (!p.exists || p.kind != kind || durationSeconds == 0 || units == 0 || spend == 0
            || durationSeconds > p.maxDurationSeconds || units > p.maxUnits || spend > p.maxSpend) return false;
        return exactCommitment == commitment(policyId, revision);
    }
}
