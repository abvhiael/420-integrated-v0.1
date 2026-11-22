// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IValidatorRetirementEvidence420 {
    function eligibleValidatorCount() external view returns (uint256);
    function retirementEligiblePoolSince() external view returns (uint64);
    function retirementOwnerStatus(
        bytes32 id
    ) external view returns (address owner, bool eligible, uint64 continuouslyEligibleSince);
    function ownerValidatorId(
        address owner
    ) external view returns (bytes32);
}

interface ICommitteeRetirementEvidence420 {
    function memberCount() external view returns (uint256);
    function committeeQualifiedSince() external view returns (uint64);
    function isMember(
        address member
    ) external view returns (bool);
    function nominationEvidence(
        address member
    ) external view returns (bytes32);
}

interface ICivicRetirementEvidence420 {
    function dualHouseExecutedCount() external view returns (uint256);
    function activeDualHouseExecution() external view returns (bool);
    function timelock() external view returns (address);
}

interface ITimelockRetirementEvidence420 {
    function civicAuthorityActivated() external view returns (bool);
    function scheduler() external view returns (address);
}

/// @notice Fail-closed founding authority retirement verifier.
/// @dev Validator eligibility is consensus-sourced; committee membership is opt-in and
/// on-chain. Independence evidence comes from Civic-approved, public witness records;
/// no EVM proof alone can establish unique human ownership of different wallets.
contract FoundingRetirementVerifier420 {
    uint256 public constant MIN_ELIGIBLE_VALIDATOR_OWNERS = 60;
    uint256 public constant MIN_VERIFIED_COMMITTEE_MEMBERS = 15;
    uint256 public constant CONTINUOUS_DURATION = 30 days;

    IValidatorRetirementEvidence420 public immutable validators;
    ICommitteeRetirementEvidence420 public immutable committee;
    ICivicRetirementEvidence420 public immutable civicGovernor;
    ITimelockRetirementEvidence420 public immutable governanceTimelock;

    bytes32[60] private _witnessValidators;
    address[15] private _witnessCommittee;
    mapping(bytes32 => bytes32) public independentOwnershipEvidence;
    mapping(address => bytes32) public independentCommitteeEvidence;
    mapping(address => bytes32) public witnessedCommitteeNomination;
    uint64 public witnessQualifiedSince;
    uint32 public witnessRevision;
    uint64 public committeeWitnessQualifiedSince;
    uint32 public committeeWitnessRevision;

    error Unauthorized();
    error InvalidWitnessSet();
    event IndependentValidatorWitnessesVerified(
        uint32 indexed revision, uint64 qualifiedSince, bytes32 indexed evidenceCommitment
    );
    event IndependentCommitteeWitnessesVerified(
        uint32 indexed revision, uint64 qualifiedSince, bytes32 indexed evidenceCommitment
    );

    constructor(
        address registry,
        address committee_,
        address governor,
        address timelock
    ) {
        if (
            registry.code.length == 0 || committee_.code.length == 0 || governor.code.length == 0
                || timelock.code.length == 0
        ) revert InvalidWitnessSet();
        validators = IValidatorRetirementEvidence420(registry);
        committee = ICommitteeRetirementEvidence420(committee_);
        civicGovernor = ICivicRetirementEvidence420(governor);
        governanceTimelock = ITimelockRetirementEvidence420(timelock);
    }

    /// @notice Only authentic Civic Timelock decisions can commit the 60 witnessed validator
    /// owner identities. Each witness requires independent off-chain review evidence.
    /// Replacing any witness resets the entire 30-day stability clock.
    function publishIndependentValidatorWitnesses(
        bytes32[60] calldata ids,
        bytes32[60] calldata evidence
    ) external {
        if (msg.sender != address(governanceTimelock) || !governanceTimelock.civicAuthorityActivated()) {
            revert Unauthorized();
        }
        bytes32 prior;
        for (uint256 i; i < MIN_ELIGIBLE_VALIDATOR_OWNERS; ++i) {
            if (ids[i] <= prior || evidence[i] == bytes32(0)) revert InvalidWitnessSet();
            // Distinct reviewed evidence for each independent owner; a repeated generic
            // commitment cannot establish 60 independent witnesses.
            for (uint256 j; j < i; ++j) {
                if (evidence[j] == evidence[i]) revert InvalidWitnessSet();
            }
            prior = ids[i]; // strictly sorted, so no duplicate IDs or replayed zero ID
            (address owner, bool eligible, uint64 since) = validators.retirementOwnerStatus(ids[i]);
            if (owner == address(0) || !eligible || since == 0 || validators.ownerValidatorId(owner) != ids[i]) {
                revert InvalidWitnessSet();
            }
            independentOwnershipEvidence[ids[i]] = evidence[i];
        }
        _witnessValidators = ids;
        witnessQualifiedSince = uint64(block.timestamp);
        ++witnessRevision;
        emit IndependentValidatorWitnessesVerified(
            witnessRevision, witnessQualifiedSince, keccak256(abi.encode(ids, evidence))
        );
    }

    /// @notice Independent Civic-review commitments for at least 15 *actual* members.
    /// @dev Candidates individually signed their own nominations; the Timelock-approved
    /// attestations are separate from the nomination and unique for each member.
    function publishIndependentCommitteeWitnesses(
        address[15] calldata members,
        bytes32[15] calldata evidence
    ) external {
        if (msg.sender != address(governanceTimelock) || !governanceTimelock.civicAuthorityActivated()) {
            revert Unauthorized();
        }
        address prior;
        for (uint256 i; i < MIN_VERIFIED_COMMITTEE_MEMBERS; ++i) {
            address member = members[i];
            if (
                uint160(member) <= uint160(prior) || evidence[i] == bytes32(0) || !committee.isMember(member)
                    || committee.nominationEvidence(member) == bytes32(0)
                    || evidence[i] == committee.nominationEvidence(member)
            ) revert InvalidWitnessSet();
            for (uint256 j; j < i; ++j) {
                if (evidence[i] == evidence[j]) revert InvalidWitnessSet();
            }
            independentCommitteeEvidence[member] = evidence[i];
            witnessedCommitteeNomination[member] = committee.nominationEvidence(member);
            prior = member;
        }
        _witnessCommittee = members;
        committeeWitnessQualifiedSince = uint64(block.timestamp);
        ++committeeWitnessRevision;
        emit IndependentCommitteeWitnessesVerified(
            committeeWitnessRevision, committeeWitnessQualifiedSince, keccak256(abi.encode(members, evidence))
        );
    }

    function witnessedCommitteeMember(
        uint256 i
    ) external view returns (address) {
        return _witnessCommittee[i];
    }

    function witnessedValidator(
        uint256 i
    ) external view returns (bytes32) {
        return _witnessValidators[i];
    }

    /// @notice Preflight: prior executed dual-house governance OR the live, atomic
    /// currently executing dual-house Civic batch; the latter becomes irreversible
    /// only if the full Timelock batch succeeds.
    function retirementReady() external view returns (bool) {
        return _eligibilityReady()
            && (civicGovernor.dualHouseExecutedCount() != 0 || civicGovernor.activeDualHouseExecution());
    }

    /// @notice Called by the founding authority from inside a real Timelock action.
    /// A past unrelated Civic vote is insufficient to authorize retirement.
    function retirementExecutionAuthorized() external view returns (bool) {
        return _eligibilityReady() && civicGovernor.activeDualHouseExecution();
    }

    function _eligibilityReady() private view returns (bool) {
        uint256 nowTime = block.timestamp;
        if (
            !governanceTimelock.civicAuthorityActivated() || governanceTimelock.scheduler() != address(civicGovernor)
                || civicGovernor.timelock() != address(governanceTimelock)
                || validators.eligibleValidatorCount() < MIN_ELIGIBLE_VALIDATOR_OWNERS
                || committee.memberCount() < MIN_VERIFIED_COMMITTEE_MEMBERS || witnessRevision == 0
                || committeeWitnessRevision == 0 || !_stable(validators.retirementEligiblePoolSince(), nowTime)
                || !_stable(committee.committeeQualifiedSince(), nowTime) || !_stable(witnessQualifiedSince, nowTime)
                || !_stable(committeeWitnessQualifiedSince, nowTime)
        ) return false;
        for (uint256 i; i < MIN_ELIGIBLE_VALIDATOR_OWNERS; ++i) {
            bytes32 id = _witnessValidators[i];
            (address owner, bool eligible, uint64 since) = validators.retirementOwnerStatus(id);
            if (
                owner == address(0) || !eligible || independentOwnershipEvidence[id] == bytes32(0)
                    || validators.ownerValidatorId(owner) != id || !_stable(since, nowTime)
            ) return false;
        }
        for (uint256 i; i < MIN_VERIFIED_COMMITTEE_MEMBERS; ++i) {
            address member = _witnessCommittee[i];
            if (
                member == address(0) || !committee.isMember(member)
                    || committee.nominationEvidence(member) == bytes32(0)
                    || independentCommitteeEvidence[member] == bytes32(0)
                    || committee.nominationEvidence(member) != witnessedCommitteeNomination[member]
            ) return false;
        }
        return true;
    }

    function _stable(
        uint64 since,
        uint256 nowTime
    ) private pure returns (bool) {
        return since != 0 && nowTime >= uint256(since) + CONTINUOUS_DURATION;
    }
}
