// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/governance/CivicIds420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/ICivicElectorateSource420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicVoting420.sol";
import "../src/governance/CivicGovernor420.sol";

interface VmCivicGovernor420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function roll(uint256) external;
}

contract MockGovernorElectorate420 is ICivicElectorateSource420 {
    bytes32 private immutable _type;
    bytes32 public root;
    uint256 public totalWeight;
    mapping(bytes32 => mapping(address => uint256)) public weights;

    constructor(bytes32 type_, bytes32 root_, uint256 totalWeight_) {
        _type = type_;
        root = root_;
        totalWeight = totalWeight_;
    }

    function sourceType() external view returns (bytes32) {
        return _type;
    }

    function setWeight(address voter, uint256 weight) external {
        weights[root][voter] = weight;
    }

    function snapshotAt(uint64) external view returns (bytes32 electorateRoot, uint256 totalWeight_) {
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

contract CivicGovernor420Test {
    VmCivicGovernor420 constant vm = VmCivicGovernor420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant CAROL = address(0xCA701);
    bytes32 constant COMMUNITY_ROOT = keccak256("COMMUNITY_ROOT");
    bytes32 constant VALIDATOR_ROOT = keccak256("VALIDATOR_ROOT");

    struct Stack {
        CivicConstitution420 constitution;
        CivicProposalRegistry420 proposals;
        CivicElectorateRegistry420 electorates;
        CivicVoting420 voting;
        CivicGovernor420 governor;
        MockGovernorElectorate420 community;
        MockGovernorElectorate420 validators;
    }

    function _stack(bool dualHouse) private returns (Stack memory s) {
        s.constitution = new CivicConstitution420(address(this));
        s.proposals = new CivicProposalRegistry420(address(this));
        s.electorates = new CivicElectorateRegistry420(address(this));
        s.community = new MockGovernorElectorate420(keccak256("COMMUNITY_V1"), COMMUNITY_ROOT, 100);
        s.validators = new MockGovernorElectorate420(keccak256("VALIDATOR_V1"), VALIDATOR_ROOT, 10);

        s.electorates.setHouseSource(CivicIds420.House.COMMUNITY, address(s.community));
        if (dualHouse) s.electorates.setHouseSource(CivicIds420.House.VALIDATOR, address(s.validators));

        s.constitution.setRule(
            CivicIds420.ProposalClass.G1,
            5,
            7 days,
            5000,
            6000,
            dualHouse ? 5000 : 0,
            dualHouse ? 6000 : 0,
            dualHouse
        );

        s.voting = new CivicVoting420(address(s.proposals), address(s.electorates));
        s.governor = new CivicGovernor420(
            address(s.constitution), address(s.proposals), address(s.electorates), address(s.voting)
        );
        s.proposals.bindProposalAuthority(address(s.governor));
        s.electorates.bindSnapshotAuthority(address(s.governor));
    }

    function _create(Stack memory s) private returns (bytes32 proposalId) {
        vm.roll(100);
        vm.prank(ALICE);
        proposalId = s.governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions")
        );
    }

    function testCreateFreezesRuleAndProposalWindow() public {
        Stack memory s = _stack(false);
        bytes32 proposalId = _create(s);

        CivicGovernor420.FrozenRule memory frozen = s.governor.frozenRule(proposalId);
        require(frozen.communityQuorumBps == 5000, "quorum frozen");
        require(frozen.communityApprovalBps == 6000, "approval frozen");
        require(frozen.constitutionRevision == 1, "revision frozen");

        (,,,,uint64 snapshotBlock,uint64 voteStart,uint64 voteEnd,CivicIds420.ProposalState state,bool exists) =
            s.proposals.proposals(proposalId);
        require(exists, "proposal exists");
        require(snapshotBlock == 99, "prior block snapshot");
        require(voteStart == 101, "next-block start");
        require(voteEnd == 105, "five-block window");
        require(state == CivicIds420.ProposalState.ACTIVE, "active");
    }

    function testFinalizationUsesFrozenRuleNotLaterConstitutionRevision() public {
        Stack memory s = _stack(false);
        s.community.setWeight(ALICE, 60);
        bytes32 proposalId = _create(s);

        s.constitution.setRule(CivicIds420.ProposalClass.G1, 5, 7 days, 9000, 9000, 0, 0, false);

        vm.roll(101);
        vm.prank(ALICE);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");

        vm.roll(106);
        bool passed = s.governor.finalize(proposalId);
        require(passed, "frozen rev1 rule should pass");

        (,,,,,,,CivicIds420.ProposalState state,) = s.proposals.proposals(proposalId);
        require(state == CivicIds420.ProposalState.PASSED, "passed state");
        CivicGovernor420.FrozenRule memory frozen = s.governor.frozenRule(proposalId);
        require(frozen.constitutionRevision == 1, "still revision one");
    }

    function testAbstainCountsForQuorumButNotApprovalDenominator() public {
        Stack memory s = _stack(false);
        s.community.setWeight(ALICE, 51);
        s.community.setWeight(BOB, 49);
        bytes32 proposalId = _create(s);

        vm.roll(101);
        vm.prank(ALICE);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        vm.prank(BOB);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.ABSTAIN, "");

        CivicGovernor420.HouseResult memory result =
            s.governor.resultFor(proposalId, CivicIds420.House.COMMUNITY);
        require(result.participation == 100, "all participation");
        require(result.quorumMet, "abstain counts quorum");
        require(result.approvalMet, "abstain excluded approval");
        require(result.passed, "house passes");

        vm.roll(106);
        require(s.governor.finalize(proposalId), "proposal passes");
    }

    function testDualHouseProposalFailsWhenValidatorHouseFails() public {
        Stack memory s = _stack(true);
        s.community.setWeight(ALICE, 60);
        s.validators.setWeight(CAROL, 6);
        bytes32 proposalId = _create(s);

        vm.roll(101);
        vm.prank(ALICE);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        vm.prank(CAROL);
        s.voting.castVote(proposalId, CivicIds420.House.VALIDATOR, CivicVoting420.Support.AGAINST, "");

        vm.roll(106);
        bool passed = s.governor.finalize(proposalId);
        require(!passed, "dual house must fail");

        (,,,,,,,CivicIds420.ProposalState state,) = s.proposals.proposals(proposalId);
        require(state == CivicIds420.ProposalState.FAILED, "failed state");
    }

    function testFinalizeFailsClosedBeforeVotingEndsAndCannotRunTwice() public {
        Stack memory s = _stack(false);
        s.community.setWeight(ALICE, 60);
        bytes32 proposalId = _create(s);

        vm.roll(101);
        vm.prank(ALICE);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");

        vm.expectRevert(CivicGovernor420.VotingStillActive.selector);
        s.governor.finalize(proposalId);

        vm.roll(106);
        require(s.governor.finalize(proposalId), "first finalize");
        vm.expectRevert(CivicGovernor420.ProposalNotActive.selector);
        s.governor.finalize(proposalId);
    }

    function testProposalNonceProducesDistinctIdsForSameCommitments() public {
        Stack memory s = _stack(false);
        vm.roll(100);
        vm.prank(ALICE);
        bytes32 first = s.governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions")
        );

        vm.roll(110);
        vm.prank(ALICE);
        bytes32 second = s.governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions")
        );

        require(first != second, "ids unique");
        require(s.governor.proposerNonces(ALICE) == 2, "nonce advanced");
    }
}
