// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/governance/CivicIds420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/ICivicElectorateSource420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicVoting420.sol";
import "../src/governance/CivicGovernor420.sol";
import "../src/governance/GovernanceTimelock.sol";

interface VmCivicGovernor420 {
    function prank(
        address
    ) external;
    function expectRevert(
        bytes4
    ) external;
    function roll(
        uint256
    ) external;
}

contract MockGovernorElectorate420 is ICivicElectorateSource420 {
    bytes32 private immutable _type;
    bytes32 public root;
    uint256 public totalWeight;
    mapping(bytes32 => mapping(address => uint256)) public weights;

    constructor(
        bytes32 type_,
        bytes32 root_,
        uint256 totalWeight_
    ) {
        _type = type_;
        root = root_;
        totalWeight = totalWeight_;
    }

    function sourceType() external view returns (bytes32) {
        return _type;
    }

    function setWeight(
        address voter,
        uint256 weight
    ) external {
        weights[root][voter] = weight;
    }

    function snapshotAt(
        uint64
    ) external view returns (bytes32 electorateRoot, uint256 totalWeight_) {
        return (root, totalWeight);
    }

    function votingWeight(
        bytes32 electorateRoot,
        address voter,
        bytes calldata
    ) external view returns (uint256) {
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
        GovernanceTimelock timelock;
        CivicConstitution420 constitution;
        CivicProposalRegistry420 proposals;
        CivicElectorateRegistry420 electorates;
        CivicVoting420 voting;
        CivicGovernor420 governor;
        MockGovernorElectorate420 community;
        MockGovernorElectorate420 validators;
    }

    function _stack(
        bool dualHouse
    ) private returns (Stack memory s) {
        s.timelock = new GovernanceTimelock(address(this));
        s.constitution = new CivicConstitution420(address(s.timelock));
        s.proposals = new CivicProposalRegistry420(address(s.timelock));
        s.electorates = new CivicElectorateRegistry420(address(s.timelock));
        s.community = new MockGovernorElectorate420(keccak256("COMMUNITY_V1"), COMMUNITY_ROOT, 100);
        s.validators = new MockGovernorElectorate420(keccak256("VALIDATOR_V1"), VALIDATOR_ROOT, 10);

        vm.prank(address(s.timelock));
        s.electorates.setHouseSource(CivicIds420.House.COMMUNITY, address(s.community));
        if (dualHouse) {
            vm.prank(address(s.timelock));
            s.electorates.setHouseSource(CivicIds420.House.VALIDATOR, address(s.validators));
        }

        vm.prank(address(s.timelock));
        s.constitution
            .setRule(
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
        vm.prank(address(s.timelock));
        s.proposals.bindProposalAuthority(address(s.governor));
        vm.prank(address(s.timelock));
        s.electorates.bindSnapshotAuthority(address(s.governor));
    }

    function _create(
        Stack memory s
    ) private returns (bytes32 proposalId) {
        vm.roll(100);
        vm.prank(ALICE);
        proposalId =
            s.governor.createProposal(CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions"));
    }

    function testCreateFreezesRuleAndProposalWindow() public {
        Stack memory s = _stack(false);
        bytes32 proposalId = _create(s);

        CivicGovernor420.FrozenRule memory frozen = s.governor.frozenRule(proposalId);
        require(frozen.communityQuorumBps == 5000, "quorum frozen");
        require(frozen.communityApprovalBps == 6000, "approval frozen");
        require(frozen.constitutionRevision == 1, "revision frozen");

        (,,,, uint64 snapshotBlock, uint64 voteStart, uint64 voteEnd, CivicIds420.ProposalState state, bool exists) =
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

        vm.prank(address(s.timelock));
        s.constitution.setRule(CivicIds420.ProposalClass.G1, 5, 7 days, 9000, 9000, 0, 0, false);

        vm.roll(101);
        vm.prank(ALICE);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");

        vm.roll(106);
        bool passed = s.governor.finalize(proposalId);
        require(passed, "frozen rev1 rule should pass");

        (,,,,,,, CivicIds420.ProposalState state,) = s.proposals.proposals(proposalId);
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

        CivicGovernor420.HouseResult memory result = s.governor.resultFor(proposalId, CivicIds420.House.COMMUNITY);
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

        (,,,,,,, CivicIds420.ProposalState state,) = s.proposals.proposals(proposalId);
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
        bytes32 first =
            s.governor.createProposal(CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions"));

        vm.roll(110);
        vm.prank(ALICE);
        bytes32 second =
            s.governor.createProposal(CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions"));

        require(first != second, "ids unique");
        require(s.governor.proposerNonces(ALICE) == 2, "nonce advanced");
    }

    function testOneBlockVotingWindowCanRegisterVoteAndFinalize() public {
        Stack memory s = _stack(false);
        s.community.setWeight(ALICE, 100);
        vm.prank(address(s.timelock));
        s.constitution.setRule(CivicIds420.ProposalClass.G1, 1, 7 days, 5000, 6000, 0, 0, false);
        vm.roll(100);
        bytes32 proposalId = s.governor
            .createProposal(
                CivicIds420.ProposalClass.G1, keccak256("one block metadata"), keccak256("one block actions")
            );
        (,,,, uint64 snapshot, uint64 start, uint64 end,,) = s.proposals.proposals(proposalId);
        require(snapshot == 99, "one-block electorate freezes at prior block");
        require(start == 101 && end == 101, "inclusive one-block window");

        vm.prank(ALICE);
        vm.expectRevert(CivicVoting420.VotingNotStarted.selector);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");

        vm.roll(start);
        vm.prank(ALICE);
        require(
            s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "") == 100,
            "first eligible block must accept the full ballot"
        );
        vm.expectRevert(CivicGovernor420.VotingStillActive.selector);
        s.governor.finalize(proposalId);

        vm.roll(uint256(end) + 1);
        vm.prank(BOB);
        vm.expectRevert(CivicVoting420.VotingEnded.selector);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        require(s.governor.finalize(proposalId), "single-block proposal should pass at end + 1");
    }

    function testOneBlockWindowAtLastRepresentableStartCanVoteAndFinalize() public {
        Stack memory s = _stack(false);
        s.community.setWeight(ALICE, 100);
        vm.prank(address(s.timelock));
        s.constitution.setRule(CivicIds420.ProposalClass.G1, 1, 7 days, 5000, 6000, 0, 0, false);

        vm.roll(uint256(type(uint64).max) - 1);
        bytes32 proposalId = s.governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256("last valid start"), keccak256("last valid actions")
        );
        (,,,, uint64 snapshot, uint64 start, uint64 end,,) = s.proposals.proposals(proposalId);
        require(snapshot == type(uint64).max - 2, "last snapshot");
        require(start == type(uint64).max && end == start, "last uint64 voting block");

        vm.roll(uint256(start));
        vm.prank(ALICE);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        vm.expectRevert(CivicGovernor420.VotingStillActive.selector);
        s.governor.finalize(proposalId);
        vm.roll(uint256(end) + 1);
        require(s.governor.finalize(proposalId), "finalization cannot overflow its block comparison");
    }

    function testZeroPeriodAndOverflowingGovernorWindowsFailWithoutConsumingNonce() public {
        Stack memory s = _stack(false);
        vm.prank(address(s.timelock));
        vm.expectRevert(CivicConstitution420.InvalidVotingPeriod.selector);
        s.constitution.setRule(CivicIds420.ProposalClass.G1, 0, 7 days, 5000, 6000, 0, 0, false);

        vm.prank(address(s.timelock));
        s.constitution.setRule(CivicIds420.ProposalClass.G1, type(uint64).max, 7 days, 5000, 6000, 0, 0, false);
        vm.roll(1);
        vm.expectRevert(CivicGovernor420.BlockNumberOverflow.selector);
        s.governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256("overflow metadata"), keccak256("overflow actions")
        );
        require(s.governor.proposerNonces(address(this)) == 0, "overflow must not consume proposal nonce");

        vm.prank(address(s.timelock));
        s.constitution.setRule(CivicIds420.ProposalClass.G1, type(uint64).max - 1, 7 days, 5000, 6000, 0, 0, false);
        bytes32 lastEnd = s.governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256("maximum valid period"), keccak256("maximum valid actions")
        );
        (,,,, uint64 snapshot, uint64 start, uint64 end,,) = s.proposals.proposals(lastEnd);
        require(snapshot == 0 && start == 2 && end == type(uint64).max, "largest representable voting window");

        vm.prank(address(s.timelock));
        s.constitution.setRule(CivicIds420.ProposalClass.G1, 1, 7 days, 5000, 6000, 0, 0, false);
        vm.roll(uint256(type(uint64).max));
        vm.expectRevert(CivicGovernor420.BlockNumberOverflow.selector);
        s.governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256("next-block overflow"), keccak256("next-block actions")
        );

        vm.roll(0);
        vm.expectRevert(CivicGovernor420.BlockNumberOverflow.selector);
        s.governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256("genesis block invalid"), keccak256("genesis actions")
        );
        require(s.governor.proposerNonces(address(this)) == 1, "overflow unexpectedly advanced nonce");
    }

    function testFrozenGenesisG1ThroughG4WindowsAndFinalizationBoundaries() public {
        Stack memory s = _stack(true);
        s.community.setWeight(ALICE, 100);
        s.validators.setWeight(CAROL, 10);
        uint64[4] memory periods = [uint64(17_640), uint64(35_280), uint64(35_280), uint64(105_840)];
        uint64[4] memory delays = [uint64(7 days), uint64(14 days), uint64(14 days), uint64(42 days)];
        uint16[4] memory quorums = [uint16(1000), uint16(2000), uint16(3334), uint16(5000)];
        uint16[4] memory approvals = [uint16(5001), uint16(6000), uint16(6667), uint16(7500)];

        for (uint8 i = 0; i < 4; ++i) {
            CivicIds420.ProposalClass class_ = CivicIds420.ProposalClass(i);
            bool dual = i >= 2;
            vm.prank(address(s.timelock));
            s.constitution.setRule(
                class_, periods[i], delays[i], quorums[i], approvals[i],
                dual ? quorums[i] : 0, dual ? approvals[i] : 0, dual
            );

            vm.roll(100 + uint256(i) * 200_000);
            bytes32 id = s.governor.createProposal(
                class_, keccak256(abi.encode("genesis class metadata", i)),
                keccak256(abi.encode("genesis class actions", i))
            );
            (,,,, uint64 snapshot, uint64 start, uint64 end,,) = s.proposals.proposals(id);
            require(uint256(snapshot) + 1 == block.number, "Genesis class snapshot");
            require(uint256(start) == block.number + 1, "Genesis class vote start");
            require(uint256(end) == uint256(start) + periods[i] - 1, "Genesis class inclusive vote end");

            vm.roll(start);
            vm.prank(ALICE);
            s.voting.castVote(id, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
            if (dual) {
                vm.prank(CAROL);
                s.voting.castVote(id, CivicIds420.House.VALIDATOR, CivicVoting420.Support.FOR, "");
            }

            vm.roll(end);
            vm.expectRevert(CivicGovernor420.VotingStillActive.selector);
            s.governor.finalize(id);
            vm.roll(uint256(end) + 1);
            require(s.governor.finalize(id), "Genesis class must finalize after inclusive vote end");
        }
    }
}
