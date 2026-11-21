// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/governance/GovernanceTimelock.sol";
import "../src/governance/Governance420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicVoting420.sol";
import "../src/governance/CivicGovernor420.sol";
import "../src/governance/CivicMerkleElectorateSource420.sol";

interface VmGovAudit6 {
    function warp(
        uint256
    ) external;
    function etch(
        address target,
        bytes calldata code
    ) external;
    function store(
        address target,
        bytes32 slot,
        bytes32 value
    ) external;
    function roll(
        uint256
    ) external;
    function prank(
        address
    ) external;
    function mockCall(
        address callee,
        bytes calldata data,
        bytes calldata returnData
    ) external;
    function clearMockedCalls() external;
}

contract GovAudit6PairFactory {
    function predicted(
        uint8 nonce
    ) public view returns (address) {
        require(nonce == 1 || nonce == 2, "nonce");
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), address(this), bytes1(nonce)))))
        );
    }

    function deployPair() external returns (Governance420 compatibility, GovernanceTimelock timelock) {
        address expectedCompatibility = predicted(1);
        address expectedTimelock = predicted(2);
        compatibility = new Governance420(expectedTimelock);
        require(address(compatibility) == expectedCompatibility, "compatibility address");
        timelock = new GovernanceTimelock(expectedCompatibility);
        require(address(timelock) == expectedTimelock, "timelock address");
    }
}

/// @dev Deliberately exposes the canonical getters and version, but its runtime is not approved.
contract GovRec1SpoofConstitution {
    address public immutable governanceTimelock;

    constructor(
        address timelock_
    ) {
        governanceTimelock = timelock_;
    }

    function systemName() external pure returns (string memory) {
        return "CivicConstitution420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function ruleFor(
        CivicIds420.ProposalClass
    ) external pure returns (CivicConstitution420.Rule memory rule) {
        return rule;
    }
}

contract GovernanceAudit6Deployment420Test {
    VmGovAudit6 private constant vm = VmGovAudit6(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant REGISTRY = 0x0000000000000000000000000000000000000434;

    GovernanceTimelock private timelock;
    Governance420 private compatibility;
    CivicConstitution420 private constitution;
    CivicProposalRegistry420 private proposals;
    CivicElectorateRegistry420 private electorates;
    CivicVoting420 private voting;
    CivicGovernor420 private governor;
    CivicMerkleElectorateSource420 private community;
    CivicMerkleElectorateSource420 private validator;

    struct BootstrapGraph {
        address constitution;
        address proposals;
        address electorates;
        address voting;
        address governor;
        address community;
        address validator;
    }

    function _deployCanonicalGraph() private {
        GovAudit6PairFactory factory = new GovAudit6PairFactory();
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
    }

    function _seedApprovedGenesisPlan() private {
        bytes32 root = keccak256(abi.encode(address(this)));
        // Slots 4-8 are the five immutable-from-Genesis bootstrap commitment values.
        vm.store(address(compatibility), bytes32(uint256(5)), root);
        vm.store(address(compatibility), bytes32(uint256(6)), bytes32(uint256(1)));
        vm.store(address(compatibility), bytes32(uint256(7)), root);
        vm.store(address(compatibility), bytes32(uint256(8)), bytes32(uint256(1)));
        bytes32 approved = compatibility.canonicalBootstrapPlanHash(
            address(constitution),
            address(proposals),
            address(electorates),
            address(voting),
            address(governor),
            address(community),
            address(validator)
        );
        vm.store(address(compatibility), bytes32(uint256(4)), approved);
    }

    function _approvedGraph() private view returns (BootstrapGraph memory graph) {
        graph = BootstrapGraph({
            constitution: address(constitution),
            proposals: address(proposals),
            electorates: address(electorates),
            voting: address(voting),
            governor: address(governor),
            community: address(community),
            validator: address(validator)
        });
    }

    function _trySchedule(
        BootstrapGraph memory graph
    ) private returns (bool ok) {
        (ok,) = address(compatibility)
            .call(
                abi.encodeCall(
                    Governance420.scheduleCanonicalCivicBootstrap,
                    (
                        graph.constitution,
                        graph.proposals,
                        graph.electorates,
                        graph.voting,
                        graph.governor,
                        graph.community,
                        graph.validator
                    )
                )
            );
    }

    function _requireNoCapture() private view {
        require(!compatibility.bootstrapPlanScheduled(), "failed call captured bootstrap");
        require(compatibility.bootstrapPlanHash() == bytes32(0), "failed call persisted a plan");
        require(compatibility.civicGovernor() == address(0), "failed call bound a governor");
    }

    function _shadowGraph() private returns (BootstrapGraph memory graph) {
        graph.constitution = address(new CivicConstitution420(address(timelock)));
        graph.proposals = address(new CivicProposalRegistry420(address(timelock)));
        graph.electorates = address(new CivicElectorateRegistry420(address(timelock)));
        graph.voting = address(new CivicVoting420(graph.proposals, graph.electorates));
        graph.governor =
            address(new CivicGovernor420(graph.constitution, graph.proposals, graph.electorates, graph.voting));
        graph.community = address(
            new CivicMerkleElectorateSource420(
                address(timelock), keccak256("420CIVIC_COMMUNITY_EQUAL_WEIGHT_MERKLE_V1")
            )
        );
        graph.validator = address(
            new CivicMerkleElectorateSource420(
                address(timelock), keccak256("420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1")
            )
        );
    }

    function testCanonicalBootstrapSchedulesExactPlanAndRetiresToCivicGovernor() public {
        _deployCanonicalGraph();

        require(timelock.bootstrapGovernor() == address(compatibility), "bootstrap identity");
        require(timelock.scheduler() == address(compatibility), "bootstrap scheduler");
        require(!timelock.civicAuthorityActivated(), "premature activation");
        _seedApprovedGenesisPlan();

        compatibility.scheduleCanonicalCivicBootstrap(
            address(constitution),
            address(proposals),
            address(electorates),
            address(voting),
            address(governor),
            address(community),
            address(validator)
        );

        bytes32 plan = compatibility.bootstrapPlanHash();
        require(plan != bytes32(0) && compatibility.bootstrapPlanScheduled(), "plan not scheduled");

        vm.warp(block.timestamp + timelock.G1_DELAY() + 1);
        for (uint8 i = 0; i < 19; ++i) {
            timelock.execute(compatibility.bootstrapOperationId(plan, i));
        }

        vm.roll(block.number + 2);
        compatibility.activateCanonicalCivic(
            address(constitution),
            address(proposals),
            address(electorates),
            address(voting),
            address(governor),
            address(community),
            address(validator)
        );

        require(compatibility.bootstrapRetired(), "bootstrap not retired");
        require(compatibility.civicGovernor() == address(governor), "compatibility pointer");
        require(timelock.civicAuthorityActivated(), "Civic authority inactive");
        require(timelock.scheduler() == address(governor), "scheduler not Civic governor");
        require(proposals.proposalAuthority() == address(governor), "proposal authority");
        require(electorates.snapshotAuthority() == address(governor), "snapshot authority");
        require(community.checkpointCount() == 1 && validator.checkpointCount() == 1, "first electorate checkpoints");
        bytes32 proposalId = governor.createProposal(
            CivicIds420.ProposalClass.G3, keccak256("genesis metadata"), keccak256("genesis actions")
        );
        vm.roll(block.number + 1);
        bytes32[] memory proof = new bytes32[](0);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, abi.encode(proof));
        voting.castVote(proposalId, CivicIds420.House.VALIDATOR, CivicVoting420.Support.FOR, abi.encode(proof));
        require(voting.participation(proposalId, CivicIds420.House.COMMUNITY) == 1, "community ballot");
        require(voting.participation(proposalId, CivicIds420.House.VALIDATOR) == 1, "validator ballot");

        CivicConstitution420.Rule memory g1 = constitution.ruleFor(CivicIds420.ProposalClass.G1);
        CivicConstitution420.Rule memory g4 = constitution.ruleFor(CivicIds420.ProposalClass.G4);
        require(
            g1.votingPeriodBlocks == 17_640 && g1.communityQuorumBps == 1000 && g1.communityApprovalBps == 5001
                && !g1.dualHouseRequired,
            "G1 rule"
        );
        require(
            g4.votingPeriodBlocks == 105_840 && g4.communityQuorumBps == 5000 && g4.communityApprovalBps == 7500
                && g4.validatorQuorumBps == 5000 && g4.validatorApprovalBps == 7500 && g4.dualHouseRequired,
            "G4 rule"
        );

        ProtocolRegistry registry = ProtocolRegistry(REGISTRY);
        require(
            registry.resolve(compatibility.COMMUNITY_COMPONENT_ID()) == address(constitution), "constitution discovery"
        );
        require(registry.resolve(compatibility.PROPOSAL_COMPONENT_ID()) == address(proposals), "proposal discovery");
        require(
            registry.resolve(compatibility.ELECTORATE_COMPONENT_ID()) == address(electorates), "electorate discovery"
        );
        require(registry.resolve(compatibility.VOTING_COMPONENT_ID()) == address(voting), "voting discovery");
        require(registry.resolve(compatibility.GOVERNOR_COMPONENT_ID()) == address(governor), "governor discovery");
        require(
            registry.resolve(compatibility.COMMUNITY_SOURCE_COMPONENT_ID()) == address(community),
            "community source discovery"
        );
        require(
            registry.resolve(compatibility.VALIDATOR_SOURCE_COMPONENT_ID()) == address(validator),
            "validator source discovery"
        );

        (bool reschedule,) = address(compatibility)
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
        require(!reschedule, "bootstrap rescheduled");
    }

    function testBootstrapRejectsWrongElectorateRole() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        (bool ok,) = address(compatibility)
            .call(
                abi.encodeCall(
                    Governance420.scheduleCanonicalCivicBootstrap,
                    (
                        address(constitution),
                        address(proposals),
                        address(electorates),
                        address(voting),
                        address(governor),
                        address(validator),
                        address(community)
                    )
                )
            );
        require(!ok, "swapped electorate roles accepted");
    }

    function testUnapprovedBootstrapFailsClosedAndCannotCaptureTheFirstCaller() public {
        _deployCanonicalGraph();
        (bool unapproved,) = address(compatibility)
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
        require(!unapproved && !compatibility.bootstrapPlanScheduled(), "missing Genesis approval accepted");

        _seedApprovedGenesisPlan();
        CivicConstitution420 competingConstitution = new CivicConstitution420(address(timelock));
        (bool competing,) = address(compatibility)
            .call(
                abi.encodeCall(
                    Governance420.scheduleCanonicalCivicBootstrap,
                    (
                        address(competingConstitution),
                        address(proposals),
                        address(electorates),
                        address(voting),
                        address(governor),
                        address(community),
                        address(validator)
                    )
                )
            );
        require(!competing && !compatibility.bootstrapPlanScheduled(), "unapproved graph captured bootstrap");

        compatibility.scheduleCanonicalCivicBootstrap(
            address(constitution),
            address(proposals),
            address(electorates),
            address(voting),
            address(governor),
            address(community),
            address(validator)
        );
        require(compatibility.bootstrapPlanScheduled(), "approved bootstrap not scheduled");
    }

    function testApprovedPlanRemainsPermissionlessAfterCompetingCallerFails() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        BootstrapGraph memory competing = _approvedGraph();
        competing.constitution = address(new CivicConstitution420(address(timelock)));

        vm.prank(address(0xBAD));
        require(!_trySchedule(competing), "unauthorized graph accepted first");
        _requireNoCapture();

        vm.prank(address(0xBEE));
        require(_trySchedule(_approvedGraph()), "approved caller rejected");
        bytes32 approved = compatibility.approvedBootstrapPlanHash();
        require(compatibility.bootstrapPlanHash() == approved, "incorrect plan recorded");

        vm.prank(address(0xBAD));
        require(!_trySchedule(competing), "competing caller replaced approved plan");
        require(compatibility.bootstrapPlanHash() == approved, "competing caller modified plan");
    }

    function testRejectsIdenticalRuntimeAtUnapprovedGraphAddresses() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        BootstrapGraph memory alternative = _shadowGraph();

        require(alternative.constitution != address(constitution), "graph addresses not distinct");
        require(alternative.constitution.codehash == address(constitution).codehash, "runtime provenance differs");
        require(alternative.governor.codehash == address(governor).codehash, "governor runtime differs");
        require(alternative.community.codehash == address(community).codehash, "source runtime differs");
        require(!_trySchedule(alternative), "unapproved addresses with identical runtime accepted");
        _requireNoCapture();
        require(_trySchedule(_approvedGraph()), "approved graph blocked by alternate addresses");
    }

    function testRejectsCorrectInterfaceWithUnapprovedRuntimeAtApprovedAddress() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        bytes memory approvedRuntime = address(constitution).code;
        GovRec1SpoofConstitution spoof = new GovRec1SpoofConstitution(address(timelock));
        vm.etch(address(constitution), address(spoof).code);

        require(constitution.governanceTimelock() == address(timelock), "spoof lacks expected authority");
        require(constitution.protocolVersion() == 1, "spoof lacks expected interface version");
        require(!_trySchedule(_approvedGraph()), "unapproved runtime accepted");
        _requireNoCapture();

        vm.etch(address(constitution), approvedRuntime);
        require(_trySchedule(_approvedGraph()), "approved runtime blocked after invalid candidate");
    }

    function testRejectsWrongTimelockAtTheApprovedComponentAddress() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        bytes memory approvedRuntime = address(constitution).code;
        GovRec1SpoofConstitution wrong = new GovRec1SpoofConstitution(address(0xDEAD));
        vm.etch(address(constitution), address(wrong).code);

        require(!_trySchedule(_approvedGraph()), "incorrect constructor authority accepted");
        _requireNoCapture();
        vm.etch(address(constitution), approvedRuntime);
        require(_trySchedule(_approvedGraph()), "wrong Timelock attempt consumed approval");
    }

    function testRejectsMixedInternalModuleGraph() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        BootstrapGraph memory mixed = _approvedGraph();
        CivicElectorateRegistry420 foreignElectorates = new CivicElectorateRegistry420(address(timelock));
        mixed.voting = address(new CivicVoting420(address(proposals), address(foreignElectorates)));

        require(!_trySchedule(mixed), "mixed internal dependencies accepted");
        _requireNoCapture();
        require(_trySchedule(_approvedGraph()), "mixed graph captured approved bootstrap");
    }

    function testRejectsIncorrectVersionWithoutChangingApprovedRuntime() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        vm.mockCall(
            address(constitution), abi.encodeCall(CivicConstitution420.protocolVersion, ()), abi.encode(uint32(2))
        );
        require(!_trySchedule(_approvedGraph()), "wrong interface version accepted");
        _requireNoCapture();
        vm.clearMockedCalls();
        require(_trySchedule(_approvedGraph()), "version spoof blocked approved graph");
    }

    function testRejectsMissingOrPartiallyMaterializedGenesisApproval() public {
        _deployCanonicalGraph();
        require(!_trySchedule(_approvedGraph()), "missing Genesis commitment accepted");
        _requireNoCapture();

        _seedApprovedGenesisPlan();
        vm.store(address(compatibility), bytes32(uint256(7)), bytes32(0));
        require(!_trySchedule(_approvedGraph()), "partial electorate commitment accepted");
        _requireNoCapture();

        _seedApprovedGenesisPlan();
        vm.store(address(compatibility), bytes32(uint256(4)), bytes32(0));
        require(!_trySchedule(_approvedGraph()), "missing approval hash accepted");
        _requireNoCapture();

        _seedApprovedGenesisPlan();
        require(_trySchedule(_approvedGraph()), "valid commitment rejected after partial candidates");
    }

    function testRejectsAbsentOrIncorrectProtocolRegistry() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        bytes memory registryRuntime = REGISTRY.code;

        vm.etch(REGISTRY, hex"");
        require(!_trySchedule(_approvedGraph()), "missing frozen Registry accepted");
        _requireNoCapture();

        ProtocolRegistry wrongRegistry = new ProtocolRegistry(address(0xDEAD));
        vm.etch(REGISTRY, address(wrongRegistry).code);
        require(!_trySchedule(_approvedGraph()), "Registry with wrong Timelock accepted");
        _requireNoCapture();

        vm.etch(REGISTRY, registryRuntime);
        require(_trySchedule(_approvedGraph()), "approved Registry blocked after failed candidates");
    }

    function testRejectsPrematureGovernanceServicePublication() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        ProtocolRegistry registry = ProtocolRegistry(REGISTRY);

        vm.prank(address(timelock));
        registry.publishService(
            compatibility.GOVERNANCE_SERVICE_ID(),
            address(governor),
            address(governor).codehash,
            keccak256("metadata"),
            1,
            true
        );

        require(!_trySchedule(_approvedGraph()), "partially initialized Registry service accepted");
        _requireNoCapture();
    }

    function testRejectsPreconfiguredConstitution() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        vm.prank(address(timelock));
        constitution.setRule(CivicIds420.ProposalClass.G1, 17_640, 7 days, 1000, 5001, 0, 0, false);

        require(!_trySchedule(_approvedGraph()), "already initialized rule accepted");
        _requireNoCapture();
    }

    function testRejectsPreconfiguredProposalAuthority() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        vm.prank(address(timelock));
        proposals.bindProposalAuthority(address(governor));

        require(!_trySchedule(_approvedGraph()), "prebound proposal authority accepted");
        _requireNoCapture();
    }

    function testRejectsPrepublishedElectorateCheckpoint() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        vm.prank(address(timelock));
        community.publishInitialCheckpoint(compatibility.initialCommunityRoot(), 1);

        require(!_trySchedule(_approvedGraph()), "already initialized electorate accepted");
        _requireNoCapture();
    }

    function testRejectsCompetingRescheduleBeforeActivation() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        require(_trySchedule(_approvedGraph()), "approved plan rejected");
        bytes32 approved = compatibility.bootstrapPlanHash();

        vm.prank(address(0xBAD));
        require(!_trySchedule(_approvedGraph()), "duplicate bootstrap accepted");
        require(compatibility.bootstrapPlanHash() == approved, "duplicate changed bootstrap");
    }

    function testTimelockScheduleFailureRollsBackEveryEarlierOperation() public {
        _deployCanonicalGraph();
        _seedApprovedGenesisPlan();
        bytes32 plan = compatibility.approvedBootstrapPlanHash();
        bytes32 collision = compatibility.bootstrapOperationId(plan, 2);

        // Arrange an operation collision after operations 0 and 1 would have been scheduled.
        // This artificial scheduler prank is only a fault injection; it is not public authority.
        vm.prank(address(compatibility));
        timelock.schedule(collision, address(compatibility), 0, "", GovernanceTimelock.Class.G1);

        require(!_trySchedule(_approvedGraph()), "schedule collision not rejected");
        _requireNoCapture();
        (address op0,,,,,,) = timelock.operations(compatibility.bootstrapOperationId(plan, 0));
        (address op1,,,,,,) = timelock.operations(compatibility.bootstrapOperationId(plan, 1));
        (address op2,,,,,,) = timelock.operations(collision);
        require(op0 == address(0) && op1 == address(0), "partial timelock operations survived revert");
        require(op2 == address(compatibility), "failed scheduling mutated prior Timelock state");
    }
}
