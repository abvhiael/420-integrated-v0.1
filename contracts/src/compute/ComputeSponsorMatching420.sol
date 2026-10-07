// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

interface IComputeSponsorMatchFunding420 {
    struct Contribution {
        bytes32 contributionId;
        address contributor;
        uint8 sourceKind;
        uint8 targetKind;
        bytes32 targetRef;
        bytes32 fundingRef;
        uint256 amount;
        uint64 fundedAt;
        bool exists;
    }

    function TARGET_POOL() external view returns (uint8);
    function contribution(bytes32 contributionId)
        external
        view
        returns (Contribution memory c);
}

interface IComputeSponsorMatchPool420 {
    struct Pool {
        bytes32 poolId;
        bytes32 projectId;
        uint64 projectRevision;
        bytes32 projectCommitment;
        bytes32 researchDomain;
        bytes32 policyId;
        uint32 policyRevision;
        bytes32 policyCommitment;
        uint8 metricKind;
        bytes32 metricId;
        address owner;
        uint64 createdAt;
        bool acceptingContributions;
        bool exists;
    }

    function pool(bytes32 poolId) external view returns (Pool memory p);
}

/// @notice CMP-6.5 prefunded sponsor matching for CMP-6.1 research-pool funding.
/// @dev A sponsor's own pool funding supplies finite match capacity. Matching records accounting
///      commitments only: no Vault transfer, obligation, payout, minting, or reward entitlement.
contract ComputeSponsorMatching420 is I420System {
    bytes32 public constant PROGRAM_DOMAIN =
        keccak256("420Integrated.ComputeMarket.SponsorMatching.Program.v1");
    bytes32 public constant MATCH_DOMAIN =
        keccak256("420Integrated.ComputeMarket.SponsorMatching.Match.v1");
    uint256 public constant RATIO_SCALE = 1_000_000;

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

    IComputeSponsorMatchFunding420 public immutable funding;
    IComputeSponsorMatchPool420 public immutable pools;
    uint8 public immutable poolTargetKind;

    mapping(bytes32 => Program) private _programs;
    mapping(bytes32 => MatchRecord) private _matches;
    mapping(bytes32 => mapping(bytes32 => bytes32)) public matchForContribution;

    error InvalidConfiguration();
    error InvalidProgram();
    error InvalidMatch();
    error Unauthorized();
    error Replay();

    event SponsorMatchProgramCreated(
        bytes32 indexed programId,
        bytes32 indexed poolId,
        address indexed sponsor,
        bytes32 sponsorFundingContributionId,
        uint32 numerator,
        uint32 denominator,
        uint256 capacity,
        uint256 perContributionCap
    );
    event SponsorMatchProgramActiveSet(bytes32 indexed programId, bool active);
    event SponsorMatchRecorded(
        bytes32 indexed matchId,
        bytes32 indexed programId,
        bytes32 indexed matchedFundingContributionId,
        address contributor,
        uint256 contributedAmount,
        uint256 matchedAmount
    );

    constructor(address funding_, address pools_) {
        if (funding_.code.length == 0 || pools_.code.length == 0) {
            revert InvalidConfiguration();
        }
        funding = IComputeSponsorMatchFunding420(funding_);
        pools = IComputeSponsorMatchPool420(pools_);
        uint8 targetKind = funding.TARGET_POOL();
        if (targetKind == 0) revert InvalidConfiguration();
        poolTargetKind = targetKind;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeSponsorMatching420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Create a finite sponsor-match program backed by one prior CMP-6.1 pool contribution.
    /// @dev numerator/denominator is the native-$420 funding match ratio, e.g. 1/1 or 2/1.
    function createProgram(
        bytes32 poolId,
        bytes32 sponsorFundingContributionId,
        uint32 numerator,
        uint32 denominator,
        uint256 perContributionCap
    ) external returns (bytes32 programId) {
        if (
            poolId == bytes32(0)
                || sponsorFundingContributionId == bytes32(0)
                || numerator == 0
                || denominator == 0
                || numerator > RATIO_SCALE
                || denominator > RATIO_SCALE
        ) revert InvalidProgram();

        IComputeSponsorMatchPool420.Pool memory p = pools.pool(poolId);
        if (!p.exists || !p.acceptingContributions) revert InvalidProgram();

        IComputeSponsorMatchFunding420.Contribution memory sponsorFunding =
            funding.contribution(sponsorFundingContributionId);
        if (
            !sponsorFunding.exists
                || sponsorFunding.contributor != msg.sender
                || sponsorFunding.targetKind != poolTargetKind
                || sponsorFunding.targetRef != poolId
                || sponsorFunding.amount == 0
        ) revert Unauthorized();

        uint256 cap = perContributionCap == 0
            ? sponsorFunding.amount
            : perContributionCap;
        if (cap > sponsorFunding.amount) revert InvalidProgram();

        programId = keccak256(
            abi.encode(
                PROGRAM_DOMAIN,
                block.chainid,
                address(this),
                poolId,
                sponsorFundingContributionId,
                msg.sender,
                numerator,
                denominator,
                sponsorFunding.amount,
                cap
            )
        );
        if (_programs[programId].exists) revert Replay();

        _programs[programId] = Program({
            programId: programId,
            poolId: poolId,
            sponsorFundingContributionId: sponsorFundingContributionId,
            sponsor: msg.sender,
            numerator: numerator,
            denominator: denominator,
            capacity: sponsorFunding.amount,
            matched: 0,
            perContributionCap: cap,
            createdAt: uint64(block.timestamp),
            active: true,
            exists: true
        });

        emit SponsorMatchProgramCreated(
            programId,
            poolId,
            msg.sender,
            sponsorFundingContributionId,
            numerator,
            denominator,
            sponsorFunding.amount,
            cap
        );
    }

    function setActive(bytes32 programId, bool active) external {
        Program storage p = _programs[programId];
        if (!p.exists) revert InvalidProgram();
        if (msg.sender != p.sponsor) revert Unauthorized();
        if (p.active == active) revert InvalidProgram();
        p.active = active;
        emit SponsorMatchProgramActiveSet(programId, active);
    }

    /// @notice Match one third-party CMP-6.1 contribution into the same research pool.
    /// @dev Permissionless relay; the contributor, amount, and pool are read from canonical funding.
    function recordMatch(bytes32 programId, bytes32 fundingContributionId)
        external
        returns (bytes32 matchId)
    {
        Program storage p = _programs[programId];
        if (!p.exists || !p.active) revert InvalidProgram();
        if (fundingContributionId == bytes32(0)) revert InvalidMatch();
        if (matchForContribution[programId][fundingContributionId] != bytes32(0)) {
            revert Replay();
        }

        IComputeSponsorMatchPool420.Pool memory poolRecord = pools.pool(p.poolId);
        if (!poolRecord.exists || !poolRecord.acceptingContributions) {
            revert InvalidMatch();
        }

        IComputeSponsorMatchFunding420.Contribution memory c =
            funding.contribution(fundingContributionId);
        if (
            !c.exists
                || c.targetKind != poolTargetKind
                || c.targetRef != p.poolId
                || c.amount == 0
                || c.contributor == address(0)
                || c.contributor == p.sponsor
                || fundingContributionId == p.sponsorFundingContributionId
                || c.fundedAt < p.createdAt
        ) revert InvalidMatch();

        uint256 calculated = c.amount * uint256(p.numerator) / uint256(p.denominator);
        if (calculated == 0) revert InvalidMatch();

        uint256 remaining = p.capacity - p.matched;
        uint256 matchedAmount = calculated;
        if (matchedAmount > p.perContributionCap) matchedAmount = p.perContributionCap;
        if (matchedAmount > remaining) matchedAmount = remaining;
        if (matchedAmount == 0) revert InvalidMatch();

        matchId = keccak256(
            abi.encode(
                MATCH_DOMAIN,
                block.chainid,
                address(this),
                programId,
                fundingContributionId,
                c.contributor,
                c.amount,
                matchedAmount,
                p.matched
            )
        );
        if (_matches[matchId].exists) revert Replay();

        p.matched += matchedAmount;
        _matches[matchId] = MatchRecord({
            matchId: matchId,
            programId: programId,
            matchedFundingContributionId: fundingContributionId,
            contributor: c.contributor,
            contributedAmount: c.amount,
            matchedAmount: matchedAmount,
            matchedAt: uint64(block.timestamp),
            exists: true
        });
        matchForContribution[programId][fundingContributionId] = matchId;

        emit SponsorMatchRecorded(
            matchId,
            programId,
            fundingContributionId,
            c.contributor,
            c.amount,
            matchedAmount
        );
    }

    function remainingCapacity(bytes32 programId) external view returns (uint256) {
        Program memory p = _programs[programId];
        if (!p.exists) revert InvalidProgram();
        return p.capacity - p.matched;
    }

    function program(bytes32 programId) external view returns (Program memory p) {
        p = _programs[programId];
        if (!p.exists) revert InvalidProgram();
    }

    function matchRecord(bytes32 matchId) external view returns (MatchRecord memory m) {
        m = _matches[matchId];
        if (!m.exists) revert InvalidMatch();
    }
}
