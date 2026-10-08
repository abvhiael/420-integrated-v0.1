// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeSponsorMatching420.sol";

contract MockSponsorFunding420 is IComputeSponsorMatchFunding420 {
    uint8 public constant TARGET_POOL = 2;
    mapping(bytes32 => Contribution) private _contributions;

    function setContribution(
        bytes32 id,
        address contributor,
        uint8 targetKind,
        bytes32 targetRef,
        uint256 amount,
        uint64 fundedAt
    ) external {
        _contributions[id] = Contribution({
            contributionId: id,
            contributor: contributor,
            sourceKind: 1,
            targetKind: targetKind,
            targetRef: targetRef,
            fundingRef: keccak256(abi.encode("funding", id)),
            amount: amount,
            fundedAt: fundedAt,
            exists: true
        });
    }

    function contribution(bytes32 id) external view returns (Contribution memory c) {
        c = _contributions[id];
        require(c.exists, "unknown contribution");
    }
}

contract MockSponsorPool420 is IComputeSponsorMatchPool420 {
    mapping(bytes32 => Pool) private _pools;

    function setPool(bytes32 poolId, address owner, bool accepting) external {
        _pools[poolId] = Pool({
            poolId: poolId,
            projectId: keccak256(abi.encode("project", poolId)),
            projectRevision: 1,
            projectCommitment: keccak256(abi.encode("project-commitment", poolId)),
            researchDomain: keccak256(abi.encode("domain", poolId)),
            policyId: keccak256(abi.encode("policy", poolId)),
            policyRevision: 1,
            policyCommitment: keccak256(abi.encode("policy-commitment", poolId)),
            metricKind: 4,
            metricId: keccak256(abi.encode("metric", poolId)),
            owner: owner,
            createdAt: uint64(block.timestamp),
            acceptingContributions: accepting,
            exists: true
        });
    }

    function setAcceptance(bytes32 poolId, bool accepting) external {
        _pools[poolId].acceptingContributions = accepting;
    }

    function pool(bytes32 poolId) external view returns (Pool memory p) {
        p = _pools[poolId];
        require(p.exists, "unknown pool");
    }
}

contract SponsorActor420 {
    function create(
        ComputeSponsorMatching420 matching,
        bytes32 poolId,
        bytes32 sponsorFundingContributionId,
        uint32 numerator,
        uint32 denominator,
        uint256 perContributionCap
    ) external returns (bytes32) {
        return matching.createProgram(
            poolId,
            sponsorFundingContributionId,
            numerator,
            denominator,
            perContributionCap
        );
    }

    function setActive(ComputeSponsorMatching420 matching, bytes32 programId, bool active)
        external
    {
        matching.setActive(programId, active);
    }
}

contract ComputeSponsorMatching420Test {
    bytes32 private constant POOL_ID = keccak256("cmp6/pool");
    bytes32 private constant SPONSOR_FUNDING = keccak256("cmp6/funding/sponsor");
    bytes32 private constant PUBLIC_FUNDING = keccak256("cmp6/funding/public");
    bytes32 private constant SECOND_FUNDING = keccak256("cmp6/funding/second");

    MockSponsorFunding420 private funding;
    MockSponsorPool420 private pools;
    ComputeSponsorMatching420 private matching;
    SponsorActor420 private sponsor;
    SponsorActor420 private contributor;

    function setUp() public {
        funding = new MockSponsorFunding420();
        pools = new MockSponsorPool420();
        matching = new ComputeSponsorMatching420(address(funding), address(pools));
        sponsor = new SponsorActor420();
        contributor = new SponsorActor420();

        pools.setPool(POOL_ID, address(this), true);
        funding.setContribution(
            SPONSOR_FUNDING,
            address(sponsor),
            2,
            POOL_ID,
            100 ether,
            uint64(block.timestamp)
        );
    }

    function _program(uint32 numerator, uint32 denominator, uint256 cap)
        private
        returns (bytes32)
    {
        return sponsor.create(
            matching,
            POOL_ID,
            SPONSOR_FUNDING,
            numerator,
            denominator,
            cap
        );
    }

    function testSponsorFundingBacksFiniteOneToOneProgram() public {
        bytes32 programId = _program(1, 1, 0);
        ComputeSponsorMatching420.Program memory p = matching.program(programId);

        require(p.poolId == POOL_ID, "pool drift");
        require(p.sponsorFundingContributionId == SPONSOR_FUNDING, "funding drift");
        require(p.sponsor == address(sponsor), "sponsor drift");
        require(p.capacity == 100 ether, "capacity drift");
        require(p.perContributionCap == 100 ether, "default cap drift");
        require(p.matched == 0, "unexpected match");
        require(p.active, "program inactive");
    }

    function testThirdPartyPoolFundingConsumesMatchCapacityAtFrozenRatio() public {
        bytes32 programId = _program(1, 1, 0);
        funding.setContribution(
            PUBLIC_FUNDING,
            address(contributor),
            2,
            POOL_ID,
            40 ether,
            uint64(block.timestamp + 1)
        );

        bytes32 matchId = matching.recordMatch(programId, PUBLIC_FUNDING);
        ComputeSponsorMatching420.MatchRecord memory m = matching.matchRecord(matchId);
        ComputeSponsorMatching420.Program memory p = matching.program(programId);

        require(m.contributor == address(contributor), "contributor drift");
        require(m.contributedAmount == 40 ether, "contribution drift");
        require(m.matchedAmount == 40 ether, "match drift");
        require(p.matched == 40 ether, "program accounting drift");
        require(matching.remainingCapacity(programId) == 60 ether, "remaining drift");
    }

    function testRatioAndPerContributionCapAreAppliedDeterministically() public {
        bytes32 programId = _program(2, 1, 30 ether);
        funding.setContribution(
            PUBLIC_FUNDING,
            address(contributor),
            2,
            POOL_ID,
            20 ether,
            uint64(block.timestamp + 1)
        );

        bytes32 matchId = matching.recordMatch(programId, PUBLIC_FUNDING);
        ComputeSponsorMatching420.MatchRecord memory m = matching.matchRecord(matchId);
        require(m.matchedAmount == 30 ether, "cap not applied");
    }

    function testRemainingCapacityCapsFinalMatch() public {
        bytes32 programId = _program(1, 1, 0);
        funding.setContribution(
            PUBLIC_FUNDING,
            address(contributor),
            2,
            POOL_ID,
            80 ether,
            uint64(block.timestamp + 1)
        );
        funding.setContribution(
            SECOND_FUNDING,
            address(0xBEEF),
            2,
            POOL_ID,
            50 ether,
            uint64(block.timestamp + 1)
        );

        matching.recordMatch(programId, PUBLIC_FUNDING);
        bytes32 matchId = matching.recordMatch(programId, SECOND_FUNDING);
        ComputeSponsorMatching420.MatchRecord memory m = matching.matchRecord(matchId);

        require(m.matchedAmount == 20 ether, "remaining capacity not enforced");
        require(matching.remainingCapacity(programId) == 0, "capacity not exhausted");
    }

    function testSponsorCannotSelfMatchOrReplaySameFundingContribution() public {
        bytes32 programId = _program(1, 1, 0);

        (bool ok,) = address(matching).call(
            abi.encodeCall(matching.recordMatch, (programId, SPONSOR_FUNDING))
        );
        require(!ok, "sponsor self-match accepted");

        funding.setContribution(
            PUBLIC_FUNDING,
            address(contributor),
            2,
            POOL_ID,
            10 ether,
            uint64(block.timestamp + 1)
        );
        matching.recordMatch(programId, PUBLIC_FUNDING);
        (ok,) = address(matching).call(
            abi.encodeCall(matching.recordMatch, (programId, PUBLIC_FUNDING))
        );
        require(!ok, "funding replay accepted");
    }

    function testWrongPoolPreProgramFundingAndClosedPoolFailClosed() public {
        bytes32 programId = _program(1, 1, 0);
        bytes32 wrongPool = keccak256("cmp6/pool/wrong");

        funding.setContribution(
            PUBLIC_FUNDING,
            address(contributor),
            2,
            wrongPool,
            10 ether,
            uint64(block.timestamp + 1)
        );
        (bool ok,) = address(matching).call(
            abi.encodeCall(matching.recordMatch, (programId, PUBLIC_FUNDING))
        );
        require(!ok, "wrong-pool funding accepted");

        funding.setContribution(
            PUBLIC_FUNDING,
            address(contributor),
            2,
            POOL_ID,
            10 ether,
            uint64(block.timestamp - 1)
        );
        (ok,) = address(matching).call(
            abi.encodeCall(matching.recordMatch, (programId, PUBLIC_FUNDING))
        );
        require(!ok, "pre-program funding accepted");

        funding.setContribution(
            PUBLIC_FUNDING,
            address(contributor),
            2,
            POOL_ID,
            10 ether,
            uint64(block.timestamp + 1)
        );
        pools.setAcceptance(POOL_ID, false);
        (ok,) = address(matching).call(
            abi.encodeCall(matching.recordMatch, (programId, PUBLIC_FUNDING))
        );
        require(!ok, "closed pool accepted match");
    }

    function testOnlySponsorControlsProgramActivation() public {
        bytes32 programId = _program(1, 1, 0);
        sponsor.setActive(matching, programId, false);

        ComputeSponsorMatching420.Program memory p = matching.program(programId);
        require(!p.active, "program still active");

        (bool ok,) = address(matching).call(
            abi.encodeCall(matching.setActive, (programId, true))
        );
        require(!ok, "non-sponsor changed program");
    }

    function testInvalidRatioAndUnbackedSponsorFailClosed() public {
        (bool ok,) = address(sponsor).call(
            abi.encodeCall(
                sponsor.create,
                (matching, POOL_ID, SPONSOR_FUNDING, uint32(0), uint32(1), uint256(0))
            )
        );
        require(!ok, "zero numerator accepted");

        bytes32 strangerFunding = keccak256("cmp6/funding/stranger");
        funding.setContribution(
            strangerFunding,
            address(contributor),
            2,
            POOL_ID,
            25 ether,
            uint64(block.timestamp)
        );
        (ok,) = address(sponsor).call(
            abi.encodeCall(
                sponsor.create,
                (matching, POOL_ID, strangerFunding, uint32(1), uint32(1), uint256(0))
            )
        );
        require(!ok, "foreign funding backed sponsor program");
    }
}
