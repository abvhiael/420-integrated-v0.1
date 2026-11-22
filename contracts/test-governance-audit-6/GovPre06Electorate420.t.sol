// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/apps/Identity420.sol";
import "../src/governance/GovernanceTimelock.sol";
import "../src/governance/Governance420.sol";
import "../src/governance/CivicInitialElectorateEnrollment420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicVoting420.sol";
import "../src/governance/CivicGovernor420.sol";
import "../src/governance/CivicMerkleElectorateSource420.sol";

interface VmPre06 {
    function etch(
        address who,
        bytes calldata code
    ) external;
    function store(
        address who,
        bytes32 slot,
        bytes32 value
    ) external;
    function prank(
        address who
    ) external;
    function warp(
        uint256 when_
    ) external;
    function roll(
        uint256 height
    ) external;
    function chainId(
        uint256 value
    ) external;
}

contract Pre06ValidatorWitness {
    address public immutable governanceTimelock;

    constructor(
        address timelock_
    ) {
        governanceTimelock = timelock_;
    }

    function protocolVersion() external pure returns (uint32) {
        return 3;
    }
    mapping(address => bytes32) public ownerValidatorId;
    mapping(bytes32 => address) public owner;
    mapping(bytes32 => bool) public eligible;

    function configure(
        address voter,
        bytes32 validatorId,
        bool eligible_
    ) external {
        ownerValidatorId[voter] = validatorId;
        owner[validatorId] = voter;
        eligible[validatorId] = eligible_;
    }

    function retirementOwnerStatus(
        bytes32 validatorId
    ) external view returns (address, bool, uint64) {
        return (owner[validatorId], eligible[validatorId], 1);
    }

    function setEligible(
        bytes32 validatorId,
        bool value
    ) external {
        eligible[validatorId] = value;
    }
}

contract Pre06PairFactory {
    function predicted(
        uint8 nonce
    ) public view returns (address) {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), address(this), bytes1(nonce)))))
        );
    }

    function deployPair() external returns (Governance420 compatibility, GovernanceTimelock timelock) {
        address first = predicted(1);
        address second = predicted(2);
        compatibility = new Governance420(second);
        require(address(compatibility) == first, "governance CREATE identity");
        timelock = new GovernanceTimelock(first);
        require(address(timelock) == second, "timelock CREATE identity");
    }
}

contract Pre06ActionTarget {
    uint256 public executions;

    function confirm() external {
        executions++;
    }
}

contract GovPre06Electorate420Test {
    VmPre06 private constant vm = VmPre06(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant REGISTRY = 0x0000000000000000000000000000000000000434;
    address private constant IDENTITY = 0x0000000000000000000000000000000000000436;
    address private constant VALIDATORS = 0x0000000000000000000000000000000000000423;
    address private constant AUTHORITY = address(0x4242);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCAFE);
    address private constant DAVE = address(0xD00D);
    Governance420 private compatibility;
    GovernanceTimelock private timelock;
    CivicConstitution420 private constitution;
    CivicProposalRegistry420 private proposals;
    CivicElectorateRegistry420 private electorates;
    CivicVoting420 private voting;
    CivicGovernor420 private governor;
    CivicMerkleElectorateSource420 private community;
    CivicMerkleElectorateSource420 private validator;
    CivicInitialElectorateEnrollment420 private enrollment;

    function _profile(
        address voter
    ) private pure returns (bytes32) {
        return keccak256(abi.encode("profile", voter));
    }

    function _credential(
        address voter
    ) private pure returns (bytes32) {
        return keccak256(abi.encode("credential", voter));
    }

    function _validatorId(
        address voter
    ) private pure returns (bytes32) {
        return keccak256(abi.encode("validator", voter));
    }

    function _pair(
        bytes32 a,
        bytes32 b
    ) private pure returns (bytes32) {
        return a <= b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function _root(
        address a,
        address b
    ) private pure returns (bytes32) {
        return _pair(keccak256(abi.encode(a)), keccak256(abi.encode(b)));
    }

    function _proof(
        address other
    ) private pure returns (bytes memory) {
        bytes32[] memory p = new bytes32[](1);
        p[0] = keccak256(abi.encode(other));
        return abi.encode(p);
    }

    function _deploy() private {
        Pre06PairFactory factory = new Pre06PairFactory();
        (compatibility, timelock) = factory.deployPair();
        ProtocolRegistry registryTemplate = new ProtocolRegistry(address(timelock));
        vm.etch(REGISTRY, address(registryTemplate).code);
        constitution = new CivicConstitution420(address(timelock));
        proposals = new CivicProposalRegistry420(address(timelock));
        electorates = new CivicElectorateRegistry420(address(timelock));
        voting = new CivicVoting420(address(proposals), address(electorates));
        governor =
            new CivicGovernor420(address(constitution), address(proposals), address(electorates), address(voting));
        community = new CivicMerkleElectorateSource420(
            address(timelock), keccak256("420CIVIC_COMMUNITY_EQUAL_WEIGHT_MERKLE_V1")
        );
        validator = new CivicMerkleElectorateSource420(
            address(timelock), keccak256("420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1")
        );
        enrollment = new CivicInitialElectorateEnrollment420(address(compatibility));
        vm.etch(IDENTITY, address(new Identity420(address(timelock))).code);
        vm.etch(VALIDATORS, address(new Pre06ValidatorWitness(address(timelock))).code);
        for (uint256 i; i < 4; ++i) {
            address voter = i == 0 ? ALICE : i == 1 ? BOB : i == 2 ? CAROL : DAVE;
            vm.prank(voter);
            Identity420(IDENTITY).createProfile(_profile(voter), keccak256("post-genesis-profile"));
        }
        Pre06ValidatorWitness(VALIDATORS).configure(CAROL, _validatorId(CAROL), true);
        Pre06ValidatorWitness(VALIDATORS).configure(DAVE, _validatorId(DAVE), true);

        // New slots are immutable Genesis materialization, never contract setters.
        vm.store(address(compatibility), bytes32(uint256(9)), bytes32(uint256(uint160(address(enrollment)))));
        vm.store(address(compatibility), bytes32(uint256(10)), bytes32(uint256(uint160(AUTHORITY))));
        bytes32 approved = compatibility.canonicalBootstrapPlanHash(
            address(constitution),
            address(proposals),
            address(electorates),
            address(voting),
            address(governor),
            address(community),
            address(validator)
        );
        require(approved != bytes32(0), "unsigned plan");
        vm.store(address(compatibility), bytes32(uint256(4)), approved);
    }

    function _scheduleBase() private returns (bytes32 plan) {
        compatibility.scheduleCanonicalCivicBootstrap(
            address(constitution),
            address(proposals),
            address(electorates),
            address(voting),
            address(governor),
            address(community),
            address(validator)
        );
        plan = compatibility.bootstrapPlanHash();
        require(plan == compatibility.approvedBootstrapPlanHash(), "wrong approved plan");
        (address preScheduled,,,,,,) = timelock.operations(compatibility.bootstrapOperationId(plan, 17));
        require(preScheduled == address(0), "invented Genesis electorate operation");
    }

    function _enroll(
        address voter,
        CivicIds420.House house
    ) private {
        vm.prank(voter);
        enrollment.enroll(house, _profile(voter), _credential(voter));
    }

    function _enrollAll() private {
        // Unsorted arrival order must still produce deterministic numerically sorted Merkle leaves.
        _enroll(BOB, CivicIds420.House.COMMUNITY);
        _enroll(ALICE, CivicIds420.House.COMMUNITY);
        _enroll(DAVE, CivicIds420.House.VALIDATOR);
        _enroll(CAROL, CivicIds420.House.VALIDATOR);
    }

    function _executeBase(
        bytes32 plan
    ) private {
        vm.warp(block.timestamp + timelock.G1_DELAY() + 1);
        for (uint8 i; i < 17; ++i) timelock.execute(compatibility.bootstrapOperationId(plan, i));
        // The fixed one-shot Timelock permission sets up a trusted issuer without any electorate.
        timelock.execute(compatibility.bootstrapOperationId(plan, 19));
        for (uint256 i; i < 4; ++i) {
            address voter = i == 0 ? ALICE : i == 1 ? BOB : i == 2 ? CAROL : DAVE;
            bytes32 houseType =
                i < 2 ? keccak256("420/CIVIC/COMMUNITY_ELECTORATE/V1") : keccak256("420/CIVIC/VALIDATOR_ELECTORATE/V1");
            vm.prank(AUTHORITY);
            Identity420(IDENTITY)
                .issueCredential(
                    _credential(voter),
                    compatibility.INITIAL_ELECTORATE_ISSUER(),
                    _profile(voter),
                    houseType,
                    keccak256("independent-membership-attestation"),
                    0
                );
        }
    }

    function _activate() private {
        compatibility.activateCanonicalCivic(
            address(constitution),
            address(proposals),
            address(electorates),
            address(voting),
            address(governor),
            address(community),
            address(validator)
        );
    }

    function _canActivate() private returns (bool ok) {
        (ok,) = address(compatibility)
            .call(
                abi.encodeCall(
                    Governance420.activateCanonicalCivic,
                    (
                        address(constitution),
                        address(proposals),
                        address(electorates),
                        address(voting),
                        address(governor),
                        address(community),
                        address(validator)
                    )
                )
            );
    }

    function _live() private {
        _deploy();
        bytes32 plan = _scheduleBase();
        _executeBase(plan);
        _enrollAll();
        require(!_canActivate(), "activated before first real electors");
        vm.prank(AUTHORITY);
        compatibility.schedulePostGenesisInitialElectorates();
        require(
            enrollment.enrollmentClosed() && compatibility.initialEnrollmentScheduled(), "unsealed initial electorate"
        );
        require(!_canActivate(), "activated without real Timelock publication");
        vm.warp(block.timestamp + timelock.G1_DELAY() + 1);
        timelock.execute(compatibility.bootstrapOperationId(plan, 17));
        timelock.execute(compatibility.bootstrapOperationId(plan, 18));
        require(!_canActivate(), "activated before checkpoint effective snapshot");
        vm.roll(block.number + 2);
        _activate();
    }

    function testRealPostGenesisEnrollmentDualHouseVotingAndTimelockHandoff() public {
        _live();
        require(compatibility.initialCommunityRoot() == bytes32(0), "fabricated community Genesis root");
        require(compatibility.initialValidatorRoot() == bytes32(0), "fabricated validator Genesis root");
        require(compatibility.bootstrapRetired() && timelock.civicAuthorityActivated(), "handoff");
        require(timelock.scheduler() == address(governor), "scheduler not Governor");
        require(community.checkpoint(0).electorateRoot == _root(ALICE, BOB), "community Merkle root");
        require(validator.checkpoint(0).electorateRoot == _root(CAROL, DAVE), "validator Merkle root");
        require(
            community.checkpoint(0).totalWeight == 2 && validator.checkpoint(0).totalWeight == 2,
            "weighted ballot drift"
        );

        Pre06ActionTarget target = new Pre06ActionTarget();
        CivicGovernor420.Action[] memory actions = new CivicGovernor420.Action[](1);
        actions[0] = CivicGovernor420.Action({
            target: address(target), value: 0, data: abi.encodeCall(Pre06ActionTarget.confirm, ())
        });
        bytes32 proposalId = governor.createProposal(
            CivicIds420.ProposalClass.G3, keccak256("post Genesis G3"), governor.hashActions(actions)
        );
        CivicElectorateRegistry420.ProposalSnapshot memory snap = electorates.proposalSnapshot(proposalId);
        require(
            snap.community.totalWeight == 2 && snap.validator.totalWeight == 2 && snap.dualHouseRequired,
            "frozen houses"
        );
        vm.roll(block.number + 1);
        vm.prank(ALICE);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, _proof(BOB));
        vm.prank(BOB);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, _proof(ALICE));
        vm.prank(CAROL);
        voting.castVote(proposalId, CivicIds420.House.VALIDATOR, CivicVoting420.Support.FOR, _proof(DAVE));
        vm.prank(DAVE);
        voting.castVote(proposalId, CivicIds420.House.VALIDATOR, CivicVoting420.Support.FOR, _proof(CAROL));

        vm.prank(ALICE);
        (bool doubleVote,) = address(voting)
            .call(
                abi.encodeCall(
                    CivicVoting420.castVote,
                    (proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.AGAINST, _proof(BOB))
                )
            );
        require(!doubleVote, "duplicate vote accepted");
        vm.prank(CAROL);
        (bool crossHouse,) = address(voting)
            .call(
                abi.encodeCall(
                    CivicVoting420.castVote,
                    (proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, _proof(DAVE))
                )
            );
        require(!crossHouse, "wrong house accepted");

        vm.roll(block.number + compatibility.ROTATION_BLOCKS() * 2 + 1);
        require(governor.finalize(proposalId), "dual-house constitutional approval");
        governor.queue(proposalId, actions);
        require(target.executions() == 0, "untimelocked action");
        vm.warp(block.timestamp + timelock.G3_DELAY() + 1);
        timelock.execute(proposalId);
        require(target.executions() == 1, "real timelock batch not executed");
        require(!_canActivate(), "bootstrap reopened after handoff");
    }

    function testUnverifiedDuplicateAndNoneligibleValidatorEnrollmentRejected() public {
        _deploy();
        bytes32 plan = _scheduleBase();
        _executeBase(plan);
        vm.prank(address(0xBAD));
        (bool fake,) = address(enrollment)
            .call(
                abi.encodeCall(
                    CivicInitialElectorateEnrollment420.enroll,
                    (CivicIds420.House.COMMUNITY, _profile(ALICE), _credential(ALICE))
                )
            );
        require(!fake, "non-controller registered as eligible community member");
        _enroll(ALICE, CivicIds420.House.COMMUNITY);
        vm.prank(ALICE);
        (bool duplicate,) = address(enrollment)
            .call(
                abi.encodeCall(
                    CivicInitialElectorateEnrollment420.enroll,
                    (CivicIds420.House.COMMUNITY, _profile(ALICE), _credential(ALICE))
                )
            );
        require(!duplicate, "duplicate enrolled");
        vm.prank(AUTHORITY);
        Identity420(IDENTITY).revokeCredential(_credential(BOB));
        vm.prank(BOB);
        (bool untrusted,) = address(enrollment)
            .call(
                abi.encodeCall(
                    CivicInitialElectorateEnrollment420.enroll,
                    (CivicIds420.House.COMMUNITY, _profile(BOB), _credential(BOB))
                )
            );
        require(!untrusted, "untrusted issuer enrolled");
        Pre06ValidatorWitness(VALIDATORS).setEligible(_validatorId(CAROL), false);
        vm.prank(CAROL);
        (bool inactive,) = address(enrollment)
            .call(
                abi.encodeCall(
                    CivicInitialElectorateEnrollment420.enroll,
                    (CivicIds420.House.VALIDATOR, _profile(CAROL), _credential(CAROL))
                )
            );
        require(!inactive, "non-eligible validator enrolled");
    }

    function testCannotCaptureInitialElectorateOrReopenAfterSealing() public {
        _deploy();
        bytes32 plan = _scheduleBase();
        _executeBase(plan);
        _enroll(ALICE, CivicIds420.House.COMMUNITY);
        vm.prank(address(0xBAD));
        (bool unauthorized,) =
            address(compatibility).call(abi.encodeCall(Governance420.schedulePostGenesisInitialElectorates, ()));
        require(!unauthorized, "unauthorized freeze");
        vm.prank(AUTHORITY);
        (bool incomplete,) =
            address(compatibility).call(abi.encodeCall(Governance420.schedulePostGenesisInitialElectorates, ()));
        require(!incomplete && !enrollment.enrollmentClosed(), "empty validator electorate accepted");
        _enroll(CAROL, CivicIds420.House.VALIDATOR);
        vm.prank(AUTHORITY);
        compatibility.schedulePostGenesisInitialElectorates();
        vm.prank(AUTHORITY);
        (bool repeat,) =
            address(compatibility).call(abi.encodeCall(Governance420.schedulePostGenesisInitialElectorates, ()));
        require(!repeat, "second bootstrap scheduling accepted");
        vm.prank(BOB);
        (bool late,) = address(enrollment)
            .call(
                abi.encodeCall(
                    CivicInitialElectorateEnrollment420.enroll,
                    (CivicIds420.House.COMMUNITY, _profile(BOB), _credential(BOB))
                )
            );
        require(!late, "enrollment reopened");
        (bool directSeal,) = address(enrollment).call(abi.encodeCall(CivicInitialElectorateEnrollment420.seal, ()));
        require(!directSeal, "anyone could seal");
    }

    function testInvalidEnrollmentsCanBeReplacedWithoutRestartOrUnauthorizedCensorship() public {
        _deploy();
        bytes32 plan = _scheduleBase();
        _executeBase(plan);
        _enrollAll();

        vm.prank(address(0xBAD));
        (bool censorship,) = address(enrollment)
            .call(
                abi.encodeCall(
                    CivicInitialElectorateEnrollment420.pruneIneligible, (CivicIds420.House.COMMUNITY, ALICE)
                )
            );
        require(!censorship, "untrusted caller purged an eligible voter");

        vm.prank(AUTHORITY);
        Identity420(IDENTITY).revokeCredential(_credential(BOB));
        vm.prank(address(0xBAD));
        enrollment.pruneIneligible(CivicIds420.House.COMMUNITY, BOB);
        require(enrollment.count(CivicIds420.House.COMMUNITY) == 1, "revoked member not removed");

        bytes32 renewed = keccak256("real-Bob-renewed");
        vm.prank(AUTHORITY);
        Identity420(IDENTITY)
            .issueCredential(
                renewed,
                compatibility.INITIAL_ELECTORATE_ISSUER(),
                _profile(BOB),
                keccak256("420/CIVIC/COMMUNITY_ELECTORATE/V1"),
                keccak256("renewal"),
                0
            );
        vm.prank(BOB);
        enrollment.enroll(CivicIds420.House.COMMUNITY, _profile(BOB), renewed);
        Pre06ValidatorWitness(VALIDATORS).setEligible(_validatorId(CAROL), false);
        enrollment.pruneIneligible(CivicIds420.House.VALIDATOR, CAROL);
        require(enrollment.count(CivicIds420.House.VALIDATOR) == 1, "ineligible validator not pruned");
        Pre06ValidatorWitness(VALIDATORS).setEligible(_validatorId(CAROL), true);
        _enroll(CAROL, CivicIds420.House.VALIDATOR);

        vm.prank(AUTHORITY);
        compatibility.schedulePostGenesisInitialElectorates();
        require(compatibility.enrolledCommunityTotalWeight() == 2, "restored community weight");
        require(compatibility.enrolledValidatorTotalWeight() == 2, "restored validator weight");

        vm.prank(BOB);
        (bool reopened,) = address(enrollment)
            .call(abi.encodeCall(CivicInitialElectorateEnrollment420.withdraw, (CivicIds420.House.COMMUNITY)));
        require(!reopened, "enrollment reopened after irreversible freeze");

        vm.warp(block.timestamp + timelock.G1_DELAY() + 1);
        timelock.execute(compatibility.bootstrapOperationId(plan, 17));
        timelock.execute(compatibility.bootstrapOperationId(plan, 18));
        vm.roll(block.number + 2);
        _activate();
        require(timelock.scheduler() == address(governor), "recovered electorate did not hand off");
    }

    function testRevocationBlocksActivationAndWrongChainCannotStart() public {
        _deploy();
        uint256 realChain = block.chainid;
        vm.chainId(realChain + 1);
        (bool wrongChain,) = address(compatibility)
            .call(
                abi.encodeCall(
                    Governance420.scheduleCanonicalCivicBootstrap,
                    (
                        address(constitution),
                        address(proposals),
                        address(electorates),
                        address(voting),
                        address(governor),
                        address(community),
                        address(validator)
                    )
                )
            );
        require(!wrongChain, "replayed Genesis approval onto other chain");
        vm.chainId(enrollment.deploymentChainId());
        bytes32 plan = _scheduleBase();
        _executeBase(plan);
        _enrollAll();
        vm.prank(AUTHORITY);
        compatibility.schedulePostGenesisInitialElectorates();
        vm.warp(block.timestamp + timelock.G1_DELAY() + 1);
        timelock.execute(compatibility.bootstrapOperationId(plan, 17));
        timelock.execute(compatibility.bootstrapOperationId(plan, 18));
        vm.roll(block.number + 2);
        Pre06ValidatorWitness(VALIDATORS).setEligible(_validatorId(CAROL), false);
        require(!_canActivate(), "withdrawn validator retained voting authority");
        Pre06ValidatorWitness(VALIDATORS).setEligible(_validatorId(CAROL), true);
        vm.prank(AUTHORITY);
        Identity420(IDENTITY).revokeCredential(_credential(ALICE));
        require(!_canActivate(), "revoked identity authorized first electorate");
    }
}
