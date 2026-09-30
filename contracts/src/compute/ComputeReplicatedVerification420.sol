// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeIndependentVerifierSelector420.sol";

interface IComputeReplicatedPayerTerms420 {
    function fundingTerms(bytes32 requestId) external view returns (address payer, uint256 maxSpend);
}

/// @notice Pre-execution-frozen N-of-M verifier committee and independent recomputation quorum evidence.
/// @dev Quorum evidence does not itself submit a verdict, transition a job, move funds, or prove
///      correctness beyond the exact accepted replicated-verification predicate.
contract ComputeReplicatedVerification420 {
    bytes32 public constant COMMITTEE_DOMAIN =
        keccak256("420/COMPUTE/REPLICATED_VERIFICATION/COMMITTEE/V1");
    bytes32 public constant VOTE_DOMAIN =
        keccak256("420/COMPUTE/REPLICATED_VERIFICATION/VOTE/V1");
    bytes32 public constant QUORUM_DOMAIN =
        keccak256("420/COMPUTE/REPLICATED_VERIFICATION/QUORUM/V1");
    uint16 public constant MAX_COMMITTEE = 16;

    struct Committee {
        uint64 jobRevision;
        bytes32 workloadClass;
        bytes32 profileId;
        bytes32 verificationPolicyId;
        uint32 verificationPolicyRevision;
        bytes32 verificationPolicyCommitment;
        bytes32 selectionEvidenceHash;
        uint16 threshold;
        uint16 memberCount;
        uint64 validUntil;
        bytes32 committeeRef;
        bytes32 quorumResultCommitment;
        bytes32 quorumRef;
        bool exists;
    }

    struct Member {
        bytes32 verifierId;
        uint64 verifierRevision;
        address verifier;
        bytes32 controllerId;
        bool exists;
        bool voted;
        bytes32 resultCommitment;
        bytes32 recomputationEvidenceHash;
    }

    ComputeIndependentVerifierSelector420 public immutable selector;
    ComputeJobRegistry420 public immutable jobs;
    IComputeAcceptedMatchRuntime420 public immutable matches;
    ComputeVerifierRegistry420 public immutable verifiers;
    ComputeVerifierCapabilityRegistry420 public immutable capabilities;
    ComputeVerifierIndependencePolicy420 public immutable independencePolicy;
    address public immutable selectionAuthority;

    mapping(bytes32 => Committee) private _committee;
    mapping(bytes32 => address[]) private _members;
    mapping(bytes32 => mapping(address => Member)) private _member;
    mapping(bytes32 => mapping(bytes32 => uint16)) public votesForResult;

    error InvalidCommittee();
    error Unauthorized();
    error IneligibleVerifier();
    error DuplicateMember();
    error AlreadyVoted();
    error ExpiredCommittee();
    error QuorumAlreadyFinalized();

    event CommitteeFrozen(
        bytes32 indexed jobId,
        bytes32 indexed committeeRef,
        bytes32 indexed profileId,
        uint16 threshold,
        uint16 memberCount,
        uint64 jobRevision,
        uint64 validUntil
    );
    event RecomputationSubmitted(
        bytes32 indexed jobId,
        address indexed verifier,
        bytes32 indexed resultCommitment,
        bytes32 evidenceHash,
        uint16 resultVotes
    );
    event QuorumReached(
        bytes32 indexed jobId,
        bytes32 indexed resultCommitment,
        bytes32 indexed quorumRef,
        uint16 votes,
        uint16 threshold
    );

    constructor(address selector_) {
        if (selector_.code.length == 0) revert InvalidCommittee();
        selector = ComputeIndependentVerifierSelector420(selector_);
        jobs = selector.jobs();
        matches = selector.matches();
        verifiers = selector.verifiers();
        capabilities = selector.capabilities();
        independencePolicy = selector.independencePolicy();
        selectionAuthority = selector.selectionAuthority();

        if (
            address(jobs) == address(0) || address(matches) == address(0)
                || address(verifiers) == address(0) || address(capabilities) == address(0)
                || address(independencePolicy) == address(0) || selectionAuthority == address(0)
        ) revert InvalidCommittee();
    }

    function committee(bytes32 jobId) external view returns (Committee memory c) {
        c = _committee[jobId];
        if (!c.exists) revert InvalidCommittee();
    }

    function memberAddresses(bytes32 jobId) external view returns (address[] memory) {
        if (!_committee[jobId].exists) revert InvalidCommittee();
        return _members[jobId];
    }

    function member(bytes32 jobId, address verifier) external view returns (Member memory m) {
        m = _member[jobId][verifier];
        if (!m.exists) revert InvalidCommittee();
    }

    /// @notice Freeze the exact independent verifier committee before execution starts.
    function freezeCommittee(
        bytes32 jobId,
        bytes32 profileId,
        bytes32 selectionEvidenceHash,
        uint16 threshold,
        uint64 validUntil,
        bytes32[] calldata verifierIds,
        uint64[] calldata verifierRevisions
    ) external returns (bytes32 committeeRef) {
        if (msg.sender != selectionAuthority) revert Unauthorized();
        uint256 count = verifierIds.length;
        if (
            jobId == bytes32(0) || profileId == bytes32(0) || selectionEvidenceHash == bytes32(0)
                || count < 2 || count > MAX_COMMITTEE || count != verifierRevisions.length
                || threshold < 2 || threshold > count || validUntil <= block.timestamp
        ) revert InvalidCommittee();
        if (_committee[jobId].exists) revert InvalidCommittee();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            j.status != ComputeJobRegistry420.Status.ACCEPTED || j.worker != address(0)
                || j.acceptanceRef == bytes32(0) || j.verificationPolicyId == bytes32(0)
                || j.verificationPolicyRevision == 0 || j.verificationPolicyCommitment == bytes32(0)
                || validUntil > j.deadline
        ) revert InvalidCommittee();

        (bytes32 matchJobId, address matchOwner, address operator, bool matchExists) =
            matches.matchParties(j.matchId);
        if (!matchExists || matchJobId != jobId || matchOwner != j.owner || operator == address(0))
            revert InvalidCommittee();

        (address payer, uint256 maxSpend) =
            IComputeReplicatedPayerTerms420(address(jobs.requestEvidence())).fundingTerms(j.requestId);
        if (payer == address(0) || maxSpend == 0) revert InvalidCommittee();

        bytes32 ownerController = _controller(j.owner);
        bytes32 payerController = _controller(payer);
        bytes32 operatorController = _controller(operator);
        if (
            ownerController == bytes32(0) || payerController == bytes32(0)
                || operatorController == bytes32(0)
        ) revert InvalidCommittee();

        address[] memory authorities = new address[](count);
        bytes32[] memory controllers = new bytes32[](count);

        for (uint256 i = 0; i < count; ++i) {
            bytes32 verifierId = verifierIds[i];
            uint64 verifierRevision = verifierRevisions[i];
            if (verifierId == bytes32(0) || verifierRevision == 0) revert IneligibleVerifier();

            ComputeVerifierRegistry420.Verifier memory v = verifiers.verifier(verifierId);
            address authority = v.authority;
            if (
                authority == address(0) || v.revision != verifierRevision
                    || authority == j.owner || authority == payer || authority == operator
                    || authority == selectionAuthority
            ) revert IneligibleVerifier();

            if (
                !capabilities.isCapable(
                    verifierId,
                    authority,
                    verifierRevision,
                    capabilities.INDEPENDENT_VERIFIER(),
                    j.workloadType
                )
                    || !capabilities.isCapable(
                        verifierId,
                        authority,
                        verifierRevision,
                        capabilities.COMMITTEE_VERIFIER(),
                        j.workloadType
                    )
            ) revert IneligibleVerifier();

            bytes32 controllerId = _controller(authority);
            if (
                controllerId == bytes32(0) || controllerId == ownerController
                    || controllerId == payerController || controllerId == operatorController
            ) revert IneligibleVerifier();

            for (uint256 k = 0; k < i; ++k) {
                if (
                    verifierIds[k] == verifierId || authorities[k] == authority
                        || controllers[k] == controllerId
                ) revert DuplicateMember();
            }

            authorities[i] = authority;
            controllers[i] = controllerId;
        }

        committeeRef = keccak256(
            abi.encode(
                COMMITTEE_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                j.revision,
                j.workloadType,
                profileId,
                j.verificationPolicyId,
                j.verificationPolicyRevision,
                j.verificationPolicyCommitment,
                selectionEvidenceHash,
                threshold,
                verifierIds,
                verifierRevisions,
                authorities,
                controllers,
                validUntil
            )
        );

        _committee[jobId] = Committee({
            jobRevision: j.revision,
            workloadClass: j.workloadType,
            profileId: profileId,
            verificationPolicyId: j.verificationPolicyId,
            verificationPolicyRevision: j.verificationPolicyRevision,
            verificationPolicyCommitment: j.verificationPolicyCommitment,
            selectionEvidenceHash: selectionEvidenceHash,
            threshold: threshold,
            memberCount: uint16(count),
            validUntil: validUntil,
            committeeRef: committeeRef,
            quorumResultCommitment: bytes32(0),
            quorumRef: bytes32(0),
            exists: true
        });

        for (uint256 i = 0; i < count; ++i) {
            address authority = authorities[i];
            _members[jobId].push(authority);
            _member[jobId][authority] = Member({
                verifierId: verifierIds[i],
                verifierRevision: verifierRevisions[i],
                verifier: authority,
                controllerId: controllers[i],
                exists: true,
                voted: false,
                resultCommitment: bytes32(0),
                recomputationEvidenceHash: bytes32(0)
            });
        }

        emit CommitteeFrozen(
            jobId,
            committeeRef,
            profileId,
            threshold,
            uint16(count),
            j.revision,
            validUntil
        );
    }

    /// @notice Record one independent recomputation result from one frozen committee member.
    /// @dev Each member gets one immutable vote. Conflicting results remain auditable and simply
    ///      do not contribute to the same-result threshold.
    function submitRecomputation(
        bytes32 jobId,
        bytes32 resultCommitment,
        bytes32 recomputationEvidenceHash
    ) external returns (bytes32 voteRef, bytes32 quorumRef) {
        Committee storage c = _committee[jobId];
        if (!c.exists) revert InvalidCommittee();
        if (c.quorumRef != bytes32(0)) revert QuorumAlreadyFinalized();
        if (c.validUntil < block.timestamp) revert ExpiredCommittee();
        if (resultCommitment == bytes32(0) || recomputationEvidenceHash == bytes32(0))
            revert InvalidCommittee();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            j.status != ComputeJobRegistry420.Status.RESULT_COMMITTED
                || j.resultCommitment == bytes32(0)
                || j.verificationPolicyId != c.verificationPolicyId
                || j.verificationPolicyRevision != c.verificationPolicyRevision
                || j.verificationPolicyCommitment != c.verificationPolicyCommitment
                || j.workloadType != c.workloadClass
        ) revert InvalidCommittee();

        Member storage m = _member[jobId][msg.sender];
        if (!m.exists) revert Unauthorized();
        if (m.voted) revert AlreadyVoted();

        ComputeVerifierRegistry420.Verifier memory current = verifiers.verifier(m.verifierId);
        if (
            current.authority != msg.sender || current.revision != m.verifierRevision
                || !capabilities.isCapable(
                    m.verifierId,
                    msg.sender,
                    m.verifierRevision,
                    capabilities.INDEPENDENT_VERIFIER(),
                    c.workloadClass
                )
                || !capabilities.isCapable(
                    m.verifierId,
                    msg.sender,
                    m.verifierRevision,
                    capabilities.COMMITTEE_VERIFIER(),
                    c.workloadClass
                )
                || _controller(msg.sender) != m.controllerId
        ) revert IneligibleVerifier();

        m.voted = true;
        m.resultCommitment = resultCommitment;
        m.recomputationEvidenceHash = recomputationEvidenceHash;

        uint16 votes = votesForResult[jobId][resultCommitment] + 1;
        votesForResult[jobId][resultCommitment] = votes;

        voteRef = keccak256(
            abi.encode(
                VOTE_DOMAIN,
                block.chainid,
                address(this),
                jobId,
                c.committeeRef,
                m.verifierId,
                m.verifierRevision,
                msg.sender,
                resultCommitment,
                recomputationEvidenceHash
            )
        );

        emit RecomputationSubmitted(
            jobId,
            msg.sender,
            resultCommitment,
            recomputationEvidenceHash,
            votes
        );

        if (votes >= c.threshold) {
            quorumRef = keccak256(
                abi.encode(
                    QUORUM_DOMAIN,
                    block.chainid,
                    address(this),
                    jobId,
                    c.committeeRef,
                    c.profileId,
                    c.verificationPolicyId,
                    c.verificationPolicyRevision,
                    c.verificationPolicyCommitment,
                    resultCommitment,
                    votes,
                    c.threshold
                )
            );
            c.quorumResultCommitment = resultCommitment;
            c.quorumRef = quorumRef;
            emit QuorumReached(jobId, resultCommitment, quorumRef, votes, c.threshold);
        }
    }

    function quorumReached(bytes32 jobId, bytes32 resultCommitment)
        external view returns (bool, bytes32 quorumRef)
    {
        Committee storage c = _committee[jobId];
        if (
            !c.exists || resultCommitment == bytes32(0)
                || c.quorumResultCommitment != resultCommitment || c.quorumRef == bytes32(0)
        ) return (false, bytes32(0));
        return (true, c.quorumRef);
    }

    function _controller(address account) private view returns (bytes32 controllerId) {
        if (account == address(0) || independencePolicy.suspendedControllerAccount(account))
            return bytes32(0);
        (bytes32 id, bytes32 evidenceHash, uint64 validUntil, bool active) =
            independencePolicy.identities(account);
        if (
            !active || id == bytes32(0) || evidenceHash == bytes32(0)
                || validUntil < block.timestamp
        ) return bytes32(0);
        return id;
    }
}
