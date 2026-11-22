// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/governance/FoundingCommitteeMembership420.sol";
import "../src/governance/FoundingRetirementVerifier420.sol";

interface VmRetirement420 {
    function prank(
        address who
    ) external;
    function warp(
        uint256 timestamp
    ) external;
}

contract CivicTimelockStubRetirement420 {
    bool public civicAuthorityActivated;
    address public scheduler;

    function setCivic(
        bool value
    ) external {
        civicAuthorityActivated = value;
    }

    function setScheduler(
        address value
    ) external {
        scheduler = value;
    }
}

contract CivicGovernorStubRetirement420 {
    uint256 public dualHouseExecutedCount;
    address public immutable timelock;
    bool public activeDualHouseExecution;
    bytes32 public activeDualHouseActionHash;

    constructor(
        address timelock_
    ) {
        timelock = timelock_;
    }

    function setExecuted(
        uint256 value
    ) external {
        dualHouseExecutedCount = value;
    }

    function setActiveExecution(bool value, address target) external {
        activeDualHouseExecution = value;
        activeDualHouseActionHash = value
            ? keccak256(abi.encode(target, abi.encodeWithSignature("retire()")))
            : bytes32(0);
    }
}

contract FounderStateStubRetirement420 {
    address public immutable foundingAdministrator;
    bool public retired;

    constructor(
        address admin
    ) {
        foundingAdministrator = admin;
    }

    function setRetired(
        bool value
    ) external {
        retired = value;
    }
}

contract ValidatorEvidenceStubRetirement420 {
    uint256 public eligibleValidatorCount;
    uint64 public retirementEligiblePoolSince;
    mapping(bytes32 => address) public owners;
    mapping(bytes32 => uint64) public since;
    mapping(address => bytes32) public ownerValidatorId;

    function setup(
        bytes32 id,
        address owner,
        uint64 from
    ) external {
        require(owners[id] == address(0) && ownerValidatorId[owner] == bytes32(0), "duplicate");
        owners[id] = owner;
        ownerValidatorId[owner] = id;
        since[id] = from;
        ++eligibleValidatorCount;
    }

    function setPoolSince(
        uint64 from
    ) external {
        retirementEligiblePoolSince = from;
    }

    function pause(
        bytes32 id
    ) external {
        require(since[id] != 0, "not eligible");
        since[id] = 0;
        --eligibleValidatorCount;
        retirementEligiblePoolSince = 0;
    }

    function reinstate(
        bytes32 id
    ) external {
        require(since[id] == 0, "already eligible");
        since[id] = uint64(block.timestamp);
        ++eligibleValidatorCount;
        if (eligibleValidatorCount == 60) retirementEligiblePoolSince = uint64(block.timestamp);
    }

    function retirementOwnerStatus(
        bytes32 id
    ) external view returns (address owner, bool eligible, uint64 continuouslyEligibleSince) {
        return (owners[id], since[id] != 0, since[id]);
    }
}

contract FoundingRetirementVerifier420Test {
    VmRetirement420 private constant vm = VmRetirement420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ADMIN = address(0xA11CE);
    address private constant ANDREW = address(0xA22);
    address private constant JANET = address(0xA33);
    CivicTimelockStubRetirement420 internal timelock;
    CivicGovernorStubRetirement420 internal civic;
    FounderStateStubRetirement420 internal founder;
    ValidatorEvidenceStubRetirement420 internal validators;
    FoundingCommitteeMembership420 internal committee;
    FoundingRetirementVerifier420 internal verifier;

    function setUp() public {
        vm.warp(100 days);
        timelock = new CivicTimelockStubRetirement420();
        civic = new CivicGovernorStubRetirement420(address(timelock));
        timelock.setScheduler(address(civic));
        founder = new FounderStateStubRetirement420(ADMIN);
        validators = new ValidatorEvidenceStubRetirement420();
        committee = new FoundingCommitteeMembership420(ADMIN, ANDREW, JANET, address(timelock));
        vm.prank(address(timelock));
        committee.bindRetirementAuthority(address(founder));
        verifier = new FoundingRetirementVerifier420(
            address(validators), address(committee), address(civic), address(timelock)
        );
    }

    function _prepare15() internal {
        for (uint256 i; i < 15; ++i) {
            address nominee = address(uint160(0xC000 + i));
            bytes32 evidence = keccak256(abi.encode("committee", nominee));
            vm.prank(nominee);
            committee.nominate(evidence);
            vm.prank(ADMIN);
            committee.appoint(nominee, evidence);
        }
    }

    function _prepare60() internal returns (bytes32[60] memory ids, bytes32[60] memory evidence) {
        for (uint256 i; i < 60; ++i) {
            ids[i] = bytes32(i + 1);
            address owner = address(uint160(0xD000 + i));
            evidence[i] = keccak256(abi.encode("independence-review", owner));
            validators.setup(ids[i], owner, uint64(block.timestamp - 31 days));
        }
        validators.setPoolSince(uint64(block.timestamp - 31 days));
    }

    function _prepare() internal returns (bytes32[60] memory ids) {
        _prepare15();
        bytes32[60] memory evidence;
        (ids, evidence) = _prepare60();
        timelock.setCivic(true);
        civic.setExecuted(1);
        vm.prank(address(timelock));
        verifier.publishIndependentValidatorWitnesses(ids, evidence);
        address[15] memory committeeOwners;
        bytes32[15] memory committeeEvidence;
        for (uint256 i; i < 15; ++i) {
            committeeOwners[i] = address(uint160(0xC000 + i));
            committeeEvidence[i] = keccak256(abi.encode("independent-community-review", committeeOwners[i]));
        }
        vm.prank(address(timelock));
        verifier.publishIndependentCommitteeWitnesses(committeeOwners, committeeEvidence);
    }

    function testEmptyGenesisFailClosedAndNoUntrustedWitnesses() public {
        require(!verifier.retirementReady(), "empty electorate retired");
        bytes32[60] memory ids;
        bytes32[60] memory evidence;
        (bool untrusted,) =
            address(verifier).call(abi.encodeCall(verifier.publishIndependentValidatorWitnesses, (ids, evidence)));
        require(!untrusted, "non-Civic witness published");
        require(committee.memberCount() == 0, "fabricated committee");
    }

    function testSixtyFifteenThirtyAndDualHouseExecutionRequired() public {
        _prepare();
        require(!verifier.retirementReady(), "no stability period");
        vm.warp(block.timestamp + 29 days);
        require(!verifier.retirementReady(), "29 days enough");
        vm.warp(block.timestamp + 1 days);
        require(verifier.retirementReady(), "thirty-day conditions");
        civic.setExecuted(0);
        require(!verifier.retirementReady(), "no executed dual-house vote");
        civic.setExecuted(1);
        timelock.setCivic(false);
        require(!verifier.retirementReady(), "civic handoff not active");
    }

    function testDistinctCommitteeWitnessesRequiredAndCannotBeSelfApproved() public {
        _prepare();
        vm.warp(block.timestamp + 30 days);
        require(verifier.retirementReady(), "complete independent evidence");
        address[15] memory committeeOwners;
        bytes32[15] memory proof;
        for (uint256 i; i < 15; ++i) {
            committeeOwners[i] = address(uint160(0xC000 + i));
            proof[i] = keccak256(abi.encode("new independent review", i));
        }
        proof[1] = proof[0];
        vm.prank(address(timelock));
        (bool repeated,) = address(verifier)
            .call(abi.encodeCall(verifier.publishIndependentCommitteeWitnesses, (committeeOwners, proof)));
        require(!repeated, "duplicate owner evidence accepted");
        proof[1] = keccak256("separate");
        vm.prank(address(0xBAD));
        (bool unauthorized,) = address(verifier)
            .call(abi.encodeCall(verifier.publishIndependentCommitteeWitnesses, (committeeOwners, proof)));
        require(!unauthorized, "unauthorized witness recorder");
    }

    function testExecutingDualHouseBatchSatisfiesActionProofWithoutUnrelatedPriorVote() public {
        _prepare();
        vm.warp(block.timestamp + 30 days);
        civic.setExecuted(0);
        require(!verifier.retirementReady(), "historical execution is absent");
        civic.setActiveExecution(true, address(founder));
        require(
            verifier.retirementReady() && verifier.retirementExecutionAuthorized(address(founder)),
            "current dual-house execution proves proposed retirement itself"
        );
        civic.setActiveExecution(false, address(founder));
        require(!verifier.retirementExecutionAuthorized(), "out-of-context retirement");
        civic.setActiveExecution(true, address(0xBAD));
        require(!verifier.retirementExecutionAuthorized(address(founder)),
            "other verified dual-house action cannot authorize retirement");
        civic.setActiveExecution(false, address(founder));
        civic.setExecuted(1);
        require(
            verifier.retirementReady() && !verifier.retirementExecutionAuthorized(),
            "past vote cannot substitute for active retirement proposal"
        );
    }

    function testReplacedSelfSignedCommitteeNominationInvalidatesIndependentWitness() public {
        _prepare();
        vm.warp(block.timestamp + 30 days);
        require(verifier.retirementReady(), "independent witness baseline");
        address member = address(0xC000);
        vm.prank(member);
        committee.nominate(keccak256("new self-signed commitment"));
        require(!verifier.retirementReady(), "new nomination reused stale 30-day verification");
    }

    function testValidatorExitImmediatelyResetsEligibility() public {
        bytes32[60] memory ids = _prepare();
        vm.warp(block.timestamp + 30 days);
        require(verifier.retirementReady(), "baseline");
        validators.pause(ids[13]);
        require(!verifier.retirementReady(), "eligible validator departed");
        validators.reinstate(ids[13]);
        require(!verifier.retirementReady(), "reactivation skips thirty days");
    }

    function testCommitteeMutationResetsQualificationAndFounderCannotBeUnilaterallyRemoved() public {
        _prepare();
        vm.warp(block.timestamp + 30 days);
        require(verifier.retirementReady(), "baseline");
        vm.prank(ADMIN);
        committee.remove(address(0xC000), keccak256("inactive"));
        require(!verifier.retirementReady(), "committee below 15");
        vm.prank(ADMIN);
        committee.appoint(address(0xC000), keccak256("reappointed"));
        require(!verifier.retirementReady(), "changed roster bypasses waiting");
        vm.prank(ANDREW);
        committee.nominate(keccak256("founding-seat"));
        vm.prank(ADMIN);
        committee.appoint(ANDREW, keccak256("founding-seat"));
        vm.prank(ADMIN);
        (bool removeFounder,) =
            address(committee).call(abi.encodeCall(committee.remove, (ANDREW, keccak256("unilateral"))));
        require(!removeFounder, "founding seat unilaterally removed");
    }

    function testRetirementRevokesFounderCommitteeAppointmentsAndPermitsCivic() public {
        bytes32 evidence = keccak256("candidate");
        address candidate = address(0xDADA);
        vm.prank(candidate);
        committee.nominate(evidence);
        founder.setRetired(true);
        vm.prank(ADMIN);
        (bool result,) = address(committee).call(abi.encodeCall(committee.appoint, (candidate, evidence)));
        require(!result, "retired founder still appoints");
        vm.prank(address(timelock));
        committee.appoint(candidate, evidence);
        require(committee.isMember(candidate), "civic not able to appoint");
    }
}
