// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

interface IComputeAntiFarmSponsorMatching420 {
    struct Program {
        bytes32 programId;
        bytes32 poolId;
        bytes32 sponsorFundingContributionId;
        address sponsor;
        uint32 numerator;
        uint32 denominator;
        uint256 capacity;
        uint256 matched;
        uint256 perContributionCap;
        uint64 createdAt;
        bool active;
        bool exists;
    }

    struct MatchRecord {
        bytes32 matchId;
        bytes32 programId;
        bytes32 matchedFundingContributionId;
        address contributor;
        uint256 contributedAmount;
        uint256 matchedAmount;
        uint64 matchedAt;
        bool exists;
    }

    function program(bytes32 programId) external view returns (Program memory p);
    function matchRecord(bytes32 matchId) external view returns (MatchRecord memory m);
}

contract ComputeUsefulAntiFarming420 is SystemAccess, I420System {
    bytes32 public constant POLICY_DOMAIN =
        keccak256("420Integrated.ComputeMarket.UsefulAntiFarming.Policy.v1");
    bytes32 public constant PRINCIPAL_DOMAIN =
        keccak256("420Integrated.ComputeMarket.UsefulAntiFarming.Principal.v1");
    bytes32 public constant ADMISSION_DOMAIN =
        keccak256("420Integrated.ComputeMarket.UsefulAntiFarming.Admission.v1");

    struct Policy {
        bytes32 policyId;
        uint64 epochSeconds;
        uint64 cooldownSeconds;
        uint32 maxMatchesPerPrincipalPerEpoch;
        uint256 minContributionAmount;
        uint256 maxMatchedPerPrincipalPerEpoch;
        uint64 publishedAt;
        uint32 revision;
        bool exists;
    }

    struct Admission {
        bytes32 admissionId;
        bytes32 matchId;
        bytes32 programId;
        bytes32 poolId;
        bytes32 principalKey;
        address contributor;
        uint64 epoch;
        uint256 contributedAmount;
        uint256 matchedAmount;
        uint64 admittedAt;
        bool exists;
    }

    IComputeAntiFarmSponsorMatching420 public immutable matching;

    mapping(bytes32 => uint32) public latestRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _policies;
    mapping(address => bytes32) public principalOverride;
    mapping(bytes32 => Admission) private _admissions;
    mapping(bytes32 => bool) public matchConsumed;
    mapping(bytes32 => mapping(bytes32 => mapping(uint64 => uint32))) public matchCountByPoolPrincipalEpoch;
    mapping(bytes32 => mapping(bytes32 => mapping(uint64 => uint256))) public matchedByPoolPrincipalEpoch;
    mapping(bytes32 => mapping(bytes32 => uint64)) public lastAdmissionAt;

    error InvalidConfiguration();
    error InvalidPolicy();
    error UnknownPolicy();
    error InvalidPrincipal();
    error InvalidAdmission();
    error Replay();

    event AntiFarmingPolicyPublished(
        bytes32 indexed policyId,
        uint32 indexed revision,
        uint64 epochSeconds,
        uint64 cooldownSeconds,
        uint32 maxMatchesPerPrincipalPerEpoch,
        uint256 minContributionAmount,
        uint256 maxMatchedPerPrincipalPerEpoch,
        bytes32 commitment
    );
    event PrincipalOverrideSet(address indexed account, bytes32 indexed principalKey);
    event AntiFarmingAdmissionRecorded(
        bytes32 indexed admissionId,
        bytes32 indexed matchId,
        bytes32 indexed principalKey,
        bytes32 poolId,
        uint64 epoch,
        uint256 matchedAmount
    );

    constructor(address timelock_, address matching_) SystemAccess(timelock_) {
        if (matching_.code.length == 0) revert InvalidConfiguration();
        matching = IComputeAntiFarmSponsorMatching420(matching_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeUsefulAntiFarming420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function publishPolicy(
        bytes32 policyId,
        uint64 epochSeconds,
        uint64 cooldownSeconds,
        uint32 maxMatchesPerPrincipalPerEpoch,
        uint256 minContributionAmount,
        uint256 maxMatchedPerPrincipalPerEpoch
    ) external onlyGovernance returns (uint32 revision) {
        if (
            policyId == bytes32(0)
                || epochSeconds == 0
                || maxMatchesPerPrincipalPerEpoch == 0
                || minContributionAmount == 0
                || maxMatchedPerPrincipalPerEpoch == 0
        ) revert InvalidPolicy();

        uint32 previous = latestRevision[policyId];
        if (previous == type(uint32).max) revert InvalidPolicy();
        revision = previous + 1;

        _policies[policyId][revision] = Policy({
            policyId: policyId,
            epochSeconds: epochSeconds,
            cooldownSeconds: cooldownSeconds,
            maxMatchesPerPrincipalPerEpoch: maxMatchesPerPrincipalPerEpoch,
            minContributionAmount: minContributionAmount,
            maxMatchedPerPrincipalPerEpoch: maxMatchedPerPrincipalPerEpoch,
            publishedAt: uint64(block.timestamp),
            revision: revision,
            exists: true
        });
        latestRevision[policyId] = revision;

        emit AntiFarmingPolicyPublished(
            policyId,
            revision,
            epochSeconds,
            cooldownSeconds,
            maxMatchesPerPrincipalPerEpoch,
            minContributionAmount,
            maxMatchedPerPrincipalPerEpoch,
            commitment(policyId, revision)
        );
    }

    /// @notice Governance may bind several controlled accounts to one anti-farming principal.
    /// @dev bytes32(0) clears the override and returns the account to its deterministic address key.
    function setPrincipalOverride(address account, bytes32 principalKey) external onlyGovernance {
        if (account == address(0)) revert InvalidPrincipal();
        principalOverride[account] = principalKey;
        emit PrincipalOverrideSet(account, principalKey);
    }

    function principalKey(address account) public view returns (bytes32) {
        if (account == address(0)) revert InvalidPrincipal();
        bytes32 overrideKey = principalOverride[account];
        if (overrideKey != bytes32(0)) return overrideKey;
        return keccak256(abi.encode(PRINCIPAL_DOMAIN, block.chainid, address(this), account));
    }

    /// @notice Admit one already-recorded CMP-6.5 match through a frozen anti-farming policy revision.
    /// @dev Permissionless relay; policy limits apply to the contributor's anti-farming principal key.
    function admit(
        bytes32 policyId,
        uint32 policyRevision,
        bytes32 matchId
    ) external returns (bytes32 admissionId) {
        Policy memory p = policy(policyId, policyRevision);
        if (matchId == bytes32(0) || matchConsumed[matchId]) revert Replay();

        IComputeAntiFarmSponsorMatching420.MatchRecord memory m = matching.matchRecord(matchId);
        if (!m.exists || m.matchedAmount == 0 || m.contributedAmount < p.minContributionAmount) {
            revert InvalidAdmission();
        }

        IComputeAntiFarmSponsorMatching420.Program memory program =
            matching.program(m.programId);
        if (!program.exists || program.poolId == bytes32(0) || m.programId != program.programId) {
            revert InvalidAdmission();
        }

        bytes32 principal = principalKey(m.contributor);
        uint64 epoch = uint64(m.matchedAt / p.epochSeconds);
        uint32 count = matchCountByPoolPrincipalEpoch[program.poolId][principal][epoch];
        uint256 matched = matchedByPoolPrincipalEpoch[program.poolId][principal][epoch];

        if (count >= p.maxMatchesPerPrincipalPerEpoch) revert InvalidAdmission();
        if (m.matchedAmount > p.maxMatchedPerPrincipalPerEpoch - matched) {
            revert InvalidAdmission();
        }

        uint64 last = lastAdmissionAt[program.poolId][principal];
        if (
            p.cooldownSeconds != 0
                && last != 0
                && m.matchedAt < last + p.cooldownSeconds
        ) revert InvalidAdmission();

        admissionId = keccak256(
            abi.encode(
                ADMISSION_DOMAIN,
                block.chainid,
                address(this),
                policyId,
                policyRevision,
                commitment(policyId, policyRevision),
                matchId,
                m.programId,
                program.poolId,
                principal,
                m.contributor,
                epoch,
                m.contributedAmount,
                m.matchedAmount
            )
        );
        if (_admissions[admissionId].exists) revert Replay();

        matchConsumed[matchId] = true;
        matchCountByPoolPrincipalEpoch[program.poolId][principal][epoch] = count + 1;
        matchedByPoolPrincipalEpoch[program.poolId][principal][epoch] = matched + m.matchedAmount;
        lastAdmissionAt[program.poolId][principal] = m.matchedAt;

        _admissions[admissionId] = Admission({
            admissionId: admissionId,
            matchId: matchId,
            programId: m.programId,
            poolId: program.poolId,
            principalKey: principal,
            contributor: m.contributor,
            epoch: epoch,
            contributedAmount: m.contributedAmount,
            matchedAmount: m.matchedAmount,
            admittedAt: uint64(block.timestamp),
            exists: true
        });

        emit AntiFarmingAdmissionRecorded(
            admissionId,
            matchId,
            principal,
            program.poolId,
            epoch,
            m.matchedAmount
        );
    }

    function policy(bytes32 policyId, uint32 revision)
        public
        view
        returns (Policy memory p)
    {
        p = _policies[policyId][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function commitment(bytes32 policyId, uint32 revision)
        public
        view
        returns (bytes32)
    {
        Policy memory p = policy(policyId, revision);
        return keccak256(
            abi.encode(
                POLICY_DOMAIN,
                block.chainid,
                address(this),
                p.policyId,
                p.epochSeconds,
                p.cooldownSeconds,
                p.maxMatchesPerPrincipalPerEpoch,
                p.minContributionAmount,
                p.maxMatchedPerPrincipalPerEpoch,
                p.publishedAt,
                p.revision
            )
        );
    }

    function admission(bytes32 admissionId) external view returns (Admission memory a) {
        a = _admissions[admissionId];
        if (!a.exists) revert InvalidAdmission();
    }
}
