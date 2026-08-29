// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/governance/CivicIds420.sol";
import "../src/governance/ICivicElectorateSource420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/CivicVoting420.sol";

interface VmCivicVoting420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function roll(uint256) external;
}

contract MockVotingElectorateSource420 is ICivicElectorateSource420 {
    bytes32 private immutable _type;
    bytes32 public root;
    uint256 public totalWeight;
    mapping(bytes32 => mapping(address => uint256)) public weights;

    constructor(bytes32 type_) {
        _type = type_;
    }

    function sourceType() external view returns (bytes32) {
        return _type;
    }

    function setSnapshot(bytes32 root_, uint256 totalWeight_) external {
        root = root_;
        totalWeight = totalWeight_;
    }

    function setWeight(bytes32 root_, address voter, uint256 weight) external {
        weights[root_][voter] = weight;
    }

    function snapshotAt(uint64) external view returns (bytes32, uint256) {
        return (root, totalWeight);
    }

    function votingWeight(bytes32 electorateRoot, address voter, bytes calldata)
        external
        view
        returns (uint256)
    {
        return weights[electorateRoot][voter];
    }
}

contract CivicVoting420Test {
    VmCivicVoting420 constant vm = VmCivicVoting420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    bytes32 constant COMMUNITY_TYPE = keccak256("COMMUNITY_CHECKPOINT_V1");
    bytes32 constant VALIDATOR_TYPE = keccak256("VALIDATOR_SET_V1");
    bytes32 constant ROOT_A = keccak256("ROOT_A");
    bytes32 constant ROOT_B = keccak256("ROOT_B");

    CivicProposalRegistry420 proposals;
    CivicElectorateRegistry420 electorates;
    CivicVoting420 voting;
    MockVotingElectorateSource420 community;
    MockVotingElectorateSource420 validators;

    function setUp() public {
        proposals = new CivicProposalRegistry420(address(this));
        electorates = new CivicElectorateRegistry420(address(this));
        community = new MockVotingElectorateSource420(COMMUNITY_TYPE);
        validators = new MockVotingElectorateSource420(VALIDATOR_TYPE);

        proposals.bindProposalAuthority(address(this));
        electorates.bindSnapshotAuthority(address(this));
        electorates.setHouseSource(CivicIds420.House.COMMUNITY, address(community));
        electorates.setHouseSource(CivicIds420.House.VALIDATOR, address(validators));

        voting = new CivicVoting420(address(proposals), address(electorates));
    }

    function _register(bytes32 proposalId, bool dualHouse) private {
        vm.roll(100);
        community.setSnapshot(ROOT_A, 100);
        validators.setSnapshot(ROOT_B, 10);
        electorates.snapshotProposal(proposalId, 99, dualHouse);
        proposals.registerProposal(
            proposalId,
            ALICE,
            CivicIds420.ProposalClass.G1,
            keccak256("metadata"),
            keccak256("actions"),
            99,
            101,
            110
        );
    }

    function testVoteUsesFrozenSnapshotWeightAndUpdatesTally() public {
        bytes32 proposalId = keccak256("P1");
        community.setWeight(ROOT_A, ALICE, 7);
        _register(proposalId, false);
        vm.roll(101);

        vm.prank(ALICE);
        uint256 weight = voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        require(weight == 7, "weight");

        CivicVoting420.Tally memory t = voting.tally(proposalId, CivicIds420.House.COMMUNITY);
        require(t.forVotes == 7, "for tally");
        require(t.againstVotes == 0, "against zero");
        require(t.abstainVotes == 0, "abstain zero");
        require(voting.participation(proposalId, CivicIds420.House.COMMUNITY) == 7, "participation");
    }

    function testDoubleVoteRejected() public {
        bytes32 proposalId = keccak256("P2");
        community.setWeight(ROOT_A, ALICE, 5);
        _register(proposalId, false);
        vm.roll(101);

        vm.prank(ALICE);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.AGAINST, "");

        vm.prank(ALICE);
        vm.expectRevert(CivicVoting420.AlreadyVoted.selector);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
    }

    function testZeroWeightRejected() public {
        bytes32 proposalId = keccak256("P3");
        _register(proposalId, false);
        vm.roll(101);

        vm.prank(BOB);
        vm.expectRevert(CivicVoting420.NoVotingWeight.selector);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.ABSTAIN, "");
    }

    function testVotingWindowEnforced() public {
        bytes32 proposalId = keccak256("P4");
        community.setWeight(ROOT_A, ALICE, 3);
        _register(proposalId, false);

        vm.roll(100);
        vm.prank(ALICE);
        vm.expectRevert(CivicVoting420.VotingNotStarted.selector);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");

        vm.roll(111);
        vm.prank(ALICE);
        vm.expectRevert(CivicVoting420.VotingEnded.selector);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
    }

    function testValidatorHouseRequiresDualHouseProposal() public {
        bytes32 proposalId = keccak256("P5");
        validators.setWeight(ROOT_B, ALICE, 1);
        _register(proposalId, false);
        vm.roll(101);

        vm.prank(ALICE);
        vm.expectRevert(CivicVoting420.HouseNotEligible.selector);
        voting.castVote(proposalId, CivicIds420.House.VALIDATOR, CivicVoting420.Support.FOR, "");
    }

    function testDualHouseTalliesRemainIndependent() public {
        bytes32 proposalId = keccak256("P6");
        community.setWeight(ROOT_A, ALICE, 8);
        validators.setWeight(ROOT_B, ALICE, 1);
        _register(proposalId, true);
        vm.roll(101);

        vm.prank(ALICE);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        vm.prank(ALICE);
        voting.castVote(proposalId, CivicIds420.House.VALIDATOR, CivicVoting420.Support.AGAINST, "");

        CivicVoting420.Tally memory communityTally = voting.tally(proposalId, CivicIds420.House.COMMUNITY);
        CivicVoting420.Tally memory validatorTally = voting.tally(proposalId, CivicIds420.House.VALIDATOR);
        require(communityTally.forVotes == 8, "community for");
        require(validatorTally.againstVotes == 1, "validator against");
    }

    function testFrozenSourceWeightSurvivesProspectiveSourceUpgrade() public {
        bytes32 proposalId = keccak256("P7");
        community.setWeight(ROOT_A, ALICE, 4);
        _register(proposalId, false);

        MockVotingElectorateSource420 replacement = new MockVotingElectorateSource420(COMMUNITY_TYPE);
        replacement.setSnapshot(keccak256("ROOT_NEW"), 1000);
        replacement.setWeight(keccak256("ROOT_NEW"), ALICE, 99);
        electorates.setHouseSource(CivicIds420.House.COMMUNITY, address(replacement));

        vm.roll(101);
        vm.prank(ALICE);
        uint256 weight = voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        require(weight == 4, "frozen old weight");
    }

    function testInactiveProposalCannotReceiveVotes() public {
        bytes32 proposalId = keccak256("P8");
        community.setWeight(ROOT_A, ALICE, 2);
        _register(proposalId, false);
        proposals.transition(proposalId, CivicIds420.ProposalState.CANCELLED);
        vm.roll(101);

        vm.prank(ALICE);
        vm.expectRevert(CivicVoting420.ProposalNotActive.selector);
        voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
    }
}
