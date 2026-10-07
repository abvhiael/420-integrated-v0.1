// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeUsefulAntiFarming420.sol";

contract MockAntiFarmMatching420 is IComputeAntiFarmSponsorMatching420 {
    mapping(bytes32 => Program) private _programs;
    mapping(bytes32 => MatchRecord) private _matches;

    function setProgram(bytes32 programId, bytes32 poolId) external {
        _programs[programId] = Program({
            programId: programId,
            poolId: poolId,
            sponsorFundingContributionId: keccak256(abi.encode("sponsor-funding", programId)),
            sponsor: address(0x5150),
            numerator: 1,
            denominator: 1,
            capacity: 1_000 ether,
            matched: 0,
            perContributionCap: 100 ether,
            createdAt: uint64(block.timestamp),
            active: true,
            exists: true
        });
    }

    function setMatch(
        bytes32 matchId,
        bytes32 programId,
        address contributor,
        uint256 contributedAmount,
        uint256 matchedAmount,
        uint64 matchedAt
    ) external {
        _matches[matchId] = MatchRecord({
            matchId: matchId,
            programId: programId,
            matchedFundingContributionId: keccak256(abi.encode("funding", matchId)),
            contributor: contributor,
            contributedAmount: contributedAmount,
            matchedAmount: matchedAmount,
            matchedAt: matchedAt,
            exists: true
        });
    }

    function program(bytes32 programId) external view returns (Program memory p) {
        p = _programs[programId];
        require(p.exists, "unknown program");
    }

    function matchRecord(bytes32 matchId) external view returns (MatchRecord memory m) {
        m = _matches[matchId];
        require(m.exists, "unknown match");
    }
}

contract AntiFarmActor420 {
    function setOverride(ComputeUsefulAntiFarming420 antiFarm, address account, bytes32 key)
        external
    {
        antiFarm.setPrincipalOverride(account, key);
    }
}

contract ComputeUsefulAntiFarming420Test {
    bytes32 private constant POLICY_ID = keccak256("cmp6/anti-farm/default");
    bytes32 private constant PROGRAM_A = keccak256("cmp6/program/a");
    bytes32 private constant PROGRAM_B = keccak256("cmp6/program/b");
    bytes32 private constant POOL_A = keccak256("cmp6/pool/a");
    bytes32 private constant POOL_B = keccak256("cmp6/pool/b");

    MockAntiFarmMatching420 private matching;
    ComputeUsefulAntiFarming420 private antiFarm;
    AntiFarmActor420 private stranger;

    address private constant ALICE = address(0xA11CE);
    address private constant ALICE_ALT = address(0xA11CF);
    address private constant BOB = address(0xB0B);

    function setUp() public {
        matching = new MockAntiFarmMatching420();
        antiFarm = new ComputeUsefulAntiFarming420(address(this), address(matching));
        stranger = new AntiFarmActor420();

        matching.setProgram(PROGRAM_A, POOL_A);
        matching.setProgram(PROGRAM_B, POOL_B);
        antiFarm.publishPolicy(
            POLICY_ID,
            1 days,
            1 hours,
            2,
            10 ether,
            50 ether
        );
    }

    function _setMatch(
        bytes32 id,
        bytes32 programId,
        address contributor,
        uint256 contribution,
        uint256 matchedAmount,
        uint64 when_
    ) private {
        matching.setMatch(id, programId, contributor, contribution, matchedAmount, when_);
    }

    function testAdmitsMatchUnderFrozenEconomicLimits() public {
        bytes32 matchId = keccak256("match/1");
        uint64 when_ = uint64(block.timestamp + 2 hours);
        _setMatch(matchId, PROGRAM_A, ALICE, 25 ether, 20 ether, when_);

        bytes32 admissionId = antiFarm.admit(POLICY_ID, 1, matchId);
        ComputeUsefulAntiFarming420.Admission memory a = antiFarm.admission(admissionId);
        bytes32 principal = antiFarm.principalKey(ALICE);
        uint64 epoch = uint64(when_ / 1 days);

        require(a.matchId == matchId, "match drift");
        require(a.poolId == POOL_A, "pool drift");
        require(a.principalKey == principal, "principal drift");
        require(a.matchedAmount == 20 ether, "amount drift");
        require(antiFarm.matchCountByPoolPrincipalEpoch(POOL_A, principal, epoch) == 1, "count drift");
        require(antiFarm.matchedByPoolPrincipalEpoch(POOL_A, principal, epoch) == 20 ether, "matched drift");
    }

    function testMinimumContributionFailsClosed() public {
        bytes32 matchId = keccak256("match/min");
        _setMatch(matchId, PROGRAM_A, ALICE, 9 ether, 9 ether, uint64(block.timestamp + 2 hours));
        (bool ok,) = address(antiFarm).call(
            abi.encodeCall(antiFarm.admit, (POLICY_ID, uint32(1), matchId))
        );
        require(!ok, "dust contribution admitted");
    }

    function testPerPrincipalCountCapRejectsFarmingBurst() public {
        bytes32 m1 = keccak256("match/count/1");
        bytes32 m2 = keccak256("match/count/2");
        bytes32 m3 = keccak256("match/count/3");
        uint64 t = uint64(block.timestamp + 2 hours);

        _setMatch(m1, PROGRAM_A, ALICE, 20 ether, 10 ether, t);
        _setMatch(m2, PROGRAM_A, ALICE, 20 ether, 10 ether, t + 1 hours);
        _setMatch(m3, PROGRAM_A, ALICE, 20 ether, 10 ether, t + 2 hours);

        antiFarm.admit(POLICY_ID, 1, m1);
        antiFarm.admit(POLICY_ID, 1, m2);
        (bool ok,) = address(antiFarm).call(
            abi.encodeCall(antiFarm.admit, (POLICY_ID, uint32(1), m3))
        );
        require(!ok, "count farming admitted");
    }

    function testPerPrincipalMatchedAmountCapRejectsSplitFunding() public {
        bytes32 m1 = keccak256("match/amount/1");
        bytes32 m2 = keccak256("match/amount/2");
        uint64 t = uint64(block.timestamp + 2 hours);

        _setMatch(m1, PROGRAM_A, ALICE, 40 ether, 35 ether, t);
        _setMatch(m2, PROGRAM_A, ALICE, 30 ether, 20 ether, t + 1 hours);

        antiFarm.admit(POLICY_ID, 1, m1);
        (bool ok,) = address(antiFarm).call(
            abi.encodeCall(antiFarm.admit, (POLICY_ID, uint32(1), m2))
        );
        require(!ok, "amount-cap farming admitted");
    }

    function testCooldownRejectsRapidRepeat() public {
        bytes32 m1 = keccak256("match/cooldown/1");
        bytes32 m2 = keccak256("match/cooldown/2");
        uint64 t = uint64(block.timestamp + 2 hours);

        _setMatch(m1, PROGRAM_A, ALICE, 20 ether, 10 ether, t);
        _setMatch(m2, PROGRAM_A, ALICE, 20 ether, 10 ether, t + 30 minutes);

        antiFarm.admit(POLICY_ID, 1, m1);
        (bool ok,) = address(antiFarm).call(
            abi.encodeCall(antiFarm.admit, (POLICY_ID, uint32(1), m2))
        );
        require(!ok, "cooldown bypass admitted");
    }

    function testGovernanceClusterKeyMakesTwoAddressesShareLimits() public {
        bytes32 cluster = keccak256("principal/alice-cluster");
        antiFarm.setPrincipalOverride(ALICE, cluster);
        antiFarm.setPrincipalOverride(ALICE_ALT, cluster);

        bytes32 m1 = keccak256("match/cluster/1");
        bytes32 m2 = keccak256("match/cluster/2");
        bytes32 m3 = keccak256("match/cluster/3");
        uint64 t = uint64(block.timestamp + 2 hours);

        _setMatch(m1, PROGRAM_A, ALICE, 20 ether, 10 ether, t);
        _setMatch(m2, PROGRAM_A, ALICE_ALT, 20 ether, 10 ether, t + 1 hours);
        _setMatch(m3, PROGRAM_A, ALICE, 20 ether, 10 ether, t + 2 hours);

        antiFarm.admit(POLICY_ID, 1, m1);
        antiFarm.admit(POLICY_ID, 1, m2);
        (bool ok,) = address(antiFarm).call(
            abi.encodeCall(antiFarm.admit, (POLICY_ID, uint32(1), m3))
        );
        require(!ok, "cluster address splitting bypassed cap");
    }

    function testPoolScopedLimitsDoNotCrossContaminateIndependentResearchPools() public {
        bytes32 cluster = keccak256("principal/alice");
        antiFarm.setPrincipalOverride(ALICE, cluster);

        bytes32 m1 = keccak256("match/pool/a");
        bytes32 m2 = keccak256("match/pool/b");
        uint64 t = uint64(block.timestamp + 2 hours);

        _setMatch(m1, PROGRAM_A, ALICE, 40 ether, 40 ether, t);
        _setMatch(m2, PROGRAM_B, ALICE, 40 ether, 40 ether, t);

        antiFarm.admit(POLICY_ID, 1, m1);
        antiFarm.admit(POLICY_ID, 1, m2);

        uint64 epoch = uint64(t / 1 days);
        require(antiFarm.matchedByPoolPrincipalEpoch(POOL_A, cluster, epoch) == 40 ether, "pool A drift");
        require(antiFarm.matchedByPoolPrincipalEpoch(POOL_B, cluster, epoch) == 40 ether, "pool B drift");
    }

    function testNewEpochRestoresCapsButReplayNeverResets() public {
        bytes32 m1 = keccak256("match/epoch/1");
        bytes32 m2 = keccak256("match/epoch/2");
        uint64 t = uint64((block.timestamp / 1 days + 1) * 1 days + 2 hours);

        _setMatch(m1, PROGRAM_A, BOB, 50 ether, 50 ether, t);
        _setMatch(m2, PROGRAM_A, BOB, 50 ether, 50 ether, t + 1 days);

        antiFarm.admit(POLICY_ID, 1, m1);
        antiFarm.admit(POLICY_ID, 1, m2);

        (bool ok,) = address(antiFarm).call(
            abi.encodeCall(antiFarm.admit, (POLICY_ID, uint32(1), m1))
        );
        require(!ok, "match replay admitted");
    }

    function testPolicyRevisionsAreAppendOnlyAndExact() public {
        bytes32 c1 = antiFarm.commitment(POLICY_ID, 1);
        uint32 revision = antiFarm.publishPolicy(
            POLICY_ID,
            7 days,
            0,
            5,
            5 ether,
            100 ether
        );
        require(revision == 2, "revision drift");
        require(antiFarm.commitment(POLICY_ID, 1) == c1, "old policy mutated");
        require(antiFarm.commitment(POLICY_ID, 2) != c1, "new policy not distinct");
    }

    function testOnlyGovernanceCanClusterPrincipalKeys() public {
        (bool ok,) = address(stranger).call(
            abi.encodeCall(stranger.setOverride, (antiFarm, ALICE, keccak256("evil-cluster")))
        );
        require(!ok, "non-governance override accepted");
    }
}
