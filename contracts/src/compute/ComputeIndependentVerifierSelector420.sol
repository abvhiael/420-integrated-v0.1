// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./IComputeAcceptedMatchRuntime420.sol";
import "./ComputeVerifierRegistry420.sol";
import "./ComputeVerifierCapabilityRegistry420.sol";
import "./ComputeVerifierIndependencePolicy420.sol";

interface IComputeSelectionPayerTerms420 {
    function fundingTerms(bytes32 requestId) external view returns (address payer, uint256 maxSpend);
}

/// @notice Canonical CMP independent verifier selector.
/// @dev Selection cannot mint verifier identity/capability, publish profiles/policies, prove correctness,
///      move funds, alter worker lifecycle, or bypass the controller-independence policy.
contract ComputeIndependentVerifierSelector420 {
    bytes32 public constant SELECTION_DOMAIN =
        keccak256("420/COMPUTE/INDEPENDENT_VERIFIER_SELECTION/V1");

    struct Selection {
        bytes32 verifierId;
        uint64 verifierRevision;
        address verifier;
        bytes32 workloadClass;
        bytes32 profileId;
        bytes32 verificationPolicyId;
        uint32 verificationPolicyRevision;
        bytes32 verificationPolicyCommitment;
        bytes32 evidenceHash;
        uint64 validUntil;
        uint64 revision;
        bool active;
    }

    ComputeJobRegistry420 public immutable jobs;
    IComputeAcceptedMatchRuntime420 public immutable matches;
    ComputeVerifierRegistry420 public immutable verifiers;
    ComputeVerifierCapabilityRegistry420 public immutable capabilities;
    ComputeVerifierIndependencePolicy420 public immutable independencePolicy;
    address public immutable selectionAuthority;

    mapping(bytes32 => Selection) private _selection;
    mapping(bytes32 => mapping(uint64 => Selection)) private _history;

    error InvalidSelection();
    error Unauthorized();
    error IneligibleVerifier();
    error SerialExhausted();

    event VerifierSelected(
        bytes32 indexed jobId,
        bytes32 indexed verifierId,
        address indexed verifier,
        uint64 verifierRevision,
        bytes32 workloadClass,
        bytes32 profileId,
        bytes32 verificationPolicyId,
        uint32 verificationPolicyRevision,
        bytes32 selectionRef,
        uint64 selectionRevision
    );
    event SelectionRevoked(
        bytes32 indexed jobId,
        bytes32 indexed verifierId,
        address indexed verifier,
        bytes32 reasonHash,
        uint64 selectionRevision
    );

    constructor(
        address jobs_,
        address matches_,
        address verifierRegistry_,
        address capabilityRegistry_,
        address independencePolicy_,
        address selectionAuthority_
    ) {
        if (
            jobs_.code.length == 0 || matches_.code.length == 0
                || verifierRegistry_.code.length == 0 || capabilityRegistry_.code.length == 0
                || independencePolicy_.code.length == 0 || selectionAuthority_ == address(0)
        ) revert InvalidSelection();

        jobs = ComputeJobRegistry420(jobs_);
        matches = IComputeAcceptedMatchRuntime420(matches_);
        verifiers = ComputeVerifierRegistry420(verifierRegistry_);
        capabilities = ComputeVerifierCapabilityRegistry420(capabilityRegistry_);
        independencePolicy = ComputeVerifierIndependencePolicy420(independencePolicy_);
        selectionAuthority = selectionAuthority_;

        if (matches.jobs() != jobs_) revert InvalidSelection();
        if (address(capabilities.verifiers()) != verifierRegistry_) revert InvalidSelection();
        if (
            selectionAuthority_ == independencePolicy.governance()
                || selectionAuthority_ == independencePolicy.identityAttestor()
        ) revert InvalidSelection();
    }

    function selection(bytes32 jobId) external view returns (Selection memory s) {
        s = _selection[jobId];
        if (s.revision == 0) revert InvalidSelection();
    }

    function selectionRevision(bytes32 jobId, uint64 revision_)
        external view returns (Selection memory s)
    {
        s = _history[jobId][revision_];
        if (s.revision == 0) revert InvalidSelection();
    }

    function selectionRef(bytes32 jobId, Selection memory s) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                SELECTION_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                s.verifierId,
                s.verifierRevision,
                s.verifier,
                s.workloadClass,
                s.profileId,
                s.verificationPolicyId,
                s.verificationPolicyRevision,
                s.verificationPolicyCommitment,
                s.evidenceHash,
                s.validUntil,
                s.revision
            )
        );
    }

    /// @notice Appoint one exact active independent verifier before worker execution begins.
    function select(
        bytes32 jobId,
        bytes32 verifierId,
        uint64 verifierRevision,
        bytes32 profileId,
        bytes32 evidenceHash,
        uint64 validUntil
    ) external returns (bytes32 ref) {
        if (msg.sender != selectionAuthority) revert Unauthorized();
        if (
            jobId == bytes32(0) || verifierId == bytes32(0) || verifierRevision == 0
                || profileId == bytes32(0) || evidenceHash == bytes32(0)
                || validUntil <= block.timestamp
        ) revert InvalidSelection();
        if (independencePolicy.verifierSelector() != address(this)) revert InvalidSelection();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            j.status != ComputeJobRegistry420.Status.ACCEPTED || j.worker != address(0)
                || j.acceptanceRef == bytes32(0) || j.verificationPolicyId == bytes32(0)
                || j.verificationPolicyRevision == 0 || j.verificationPolicyCommitment == bytes32(0)
        ) revert InvalidSelection();

        Selection memory previous = _selection[jobId];
        if (previous.active) revert InvalidSelection();
        if (previous.revision == type(uint64).max) revert SerialExhausted();

        (bytes32 matchJobId, address matchOwner, address operator, bool matchExists) =
            matches.matchParties(j.matchId);
        if (
            !matchExists || matchJobId != jobId || matchOwner != j.owner
                || operator == address(0)
        ) revert InvalidSelection();

        (address payer, uint256 maxSpend) =
            IComputeSelectionPayerTerms420(address(jobs.requestEvidence())).fundingTerms(j.requestId);
        if (payer == address(0) || maxSpend == 0) revert InvalidSelection();

        ComputeVerifierRegistry420.Verifier memory v = verifiers.verifier(verifierId);
        if (
            v.authority == address(0) || v.authority == j.owner || v.authority == payer
                || v.authority == operator || v.authority == selectionAuthority
                || msg.sender == j.owner || msg.sender == payer || msg.sender == operator
        ) revert IneligibleVerifier();
        if (
            v.revision != verifierRevision
                || !capabilities.isCapable(
                    verifierId,
                    v.authority,
                    verifierRevision,
                    capabilities.INDEPENDENT_VERIFIER(),
                    j.workloadType
                )
        ) revert IneligibleVerifier();

        uint64 newRevision = previous.revision + 1;
        Selection memory next = Selection({
            verifierId: verifierId,
            verifierRevision: verifierRevision,
            verifier: v.authority,
            workloadClass: j.workloadType,
            profileId: profileId,
            verificationPolicyId: j.verificationPolicyId,
            verificationPolicyRevision: j.verificationPolicyRevision,
            verificationPolicyCommitment: j.verificationPolicyCommitment,
            evidenceHash: evidenceHash,
            validUntil: validUntil,
            revision: newRevision,
            active: true
        });

        // The policy independently rechecks current controller attestations/conflicts.
        independencePolicy.appoint(
            jobId,
            v.authority,
            profileId,
            j.owner,
            payer,
            operator,
            evidenceHash,
            validUntil
        );

        _selection[jobId] = next;
        _history[jobId][newRevision] = next;
        ref = selectionRef(jobId, next);

        emit VerifierSelected(
            jobId,
            verifierId,
            v.authority,
            verifierRevision,
            j.workloadType,
            profileId,
            j.verificationPolicyId,
            j.verificationPolicyRevision,
            ref,
            newRevision
        );
    }

    /// @notice Revoke the selector's current appointment without changing verifier identity/capability.
    function revoke(bytes32 jobId, bytes32 reasonHash) external {
        if (msg.sender != selectionAuthority || reasonHash == bytes32(0)) revert Unauthorized();
        Selection memory current = _selection[jobId];
        if (!current.active || current.revision == 0) revert InvalidSelection();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        (bytes32 matchJobId,, address operator, bool matchExists) = matches.matchParties(j.matchId);
        (address payer,) =
            IComputeSelectionPayerTerms420(address(jobs.requestEvidence())).fundingTerms(j.requestId);
        if (
            !matchExists || matchJobId != jobId || msg.sender == j.owner
                || msg.sender == payer || msg.sender == operator || msg.sender == current.verifier
        ) revert Unauthorized();

        independencePolicy.revokeAppointment(jobId);

        current.active = false;
        _selection[jobId] = current;
        _history[jobId][current.revision] = current;
        emit SelectionRevoked(jobId, current.verifierId, current.verifier, reasonHash, current.revision);
    }
}
