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
        (bool unapproved,) = address(compatibility).call(
            abi.encodeCall(
                Governance420.scheduleCanonicalCivicBootstrap,
                (
                    address(constitution), address(proposals), address(electorates), address(voting),
                    address(governor), address(community), address(validator)
                )
            )
        );
        require(!unapproved && !compatibility.bootstrapPlanScheduled(), "missing Genesis approval accepted");

        _seedApprovedGenesisPlan();
        CivicConstitution420 competingConstitution = new CivicConstitution420(address(timelock));
        (bool competing,) = address(compatibility).call(
            abi.encodeCall(
                Governance420.scheduleCanonicalCivicBootstrap,
                (
                    address(competingConstitution), address(proposals), address(electorates), address(voting),
                    address(governor), address(community), address(validator)
                )
            )
        );
        require(!competing && !compatibility.bootstrapPlanScheduled(), "unapproved graph captured bootstrap");

        compatibility.scheduleCanonicalCivicBootstrap(
            address(constitution), address(proposals), address(electorates), address(voting),
            address(governor), address(community), address(validator)
        );
        require(compatibility.bootstrapPlanScheduled(), "approved bootstrap not scheduled");
    }
}
