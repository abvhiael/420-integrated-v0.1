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

interface VmGovernanceAudit2 {
    function prank(
        address
    ) external;
    function expectRevert(
        bytes4
    ) external;
    function roll(
        uint256
    ) external;
    function warp(
        uint256
    ) external;
}

contract MockAudit2Authority420 {
    address public immutable proposalRegistry;
    address public immutable electorateRegistry;
    address public immutable timelock;

    constructor(
        address proposalRegistry_,
        address electorateRegistry_,
        address timelock_
    ) {
        proposalRegistry = proposalRegistry_;
        electorateRegistry = electorateRegistry_;
        timelock = timelock_;
    }

    function register(
        CivicProposalRegistry420 registry,
        bytes32 proposalId
    ) external {
        registry.registerProposal(
            proposalId,
            address(this),
            CivicIds420.ProposalClass.G1,
            keccak256("metadata"),
            keccak256("actions"),
            1,
            2,
            3
        );
    }

    function transition(
        CivicProposalRegistry420 registry,
        bytes32 proposalId,
        CivicIds420.ProposalState next
    ) external {
        registry.transition(proposalId, next);
    }
}

contract MockAudit2Electorate420 is ICivicElectorateSource420 {
    bytes32 public constant ROOT = keccak256("GOV-AUDIT-2-ROOT");
    uint256 public totalWeight;
    mapping(address => uint256) public weights;

    constructor(
        uint256 totalWeight_
    ) {
        totalWeight = totalWeight_;
    }

    function sourceType() external pure returns (bytes32) {
        return keccak256("GOV-AUDIT-2-ELECTORATE");
    }

    function setWeight(
        address voter,
        uint256 weight
    ) external {
        weights[voter] = weight;
    }

    function setTotalWeight(
        uint256 totalWeight_
    ) external {
        totalWeight = totalWeight_;
    }

    function snapshotAt(
        uint64
    ) external view returns (bytes32, uint256) {
        return (ROOT, totalWeight);
    }

    function votingWeight(
        bytes32 root,
        address voter,
        bytes calldata
    ) external view returns (uint256) {
        return root == ROOT ? weights[voter] : 0;
    }
}

contract MockAudit2TimelockBoundGovernor420 {
    address public immutable timelock;

    constructor(
        address timelock_
    ) {
        timelock = timelock_;
    }
}

contract GovernanceAudit2Hardening420Test {
    VmGovernanceAudit2 constant vm = VmGovernanceAudit2(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    VoteStack private fuzzStack;

    struct VoteStack {
        GovernanceTimelock timelock;
        CivicConstitution420 constitution;
        CivicProposalRegistry420 proposals;
        CivicElectorateRegistry420 electorates;
        CivicVoting420 voting;
        CivicGovernor420 governor;
        MockAudit2Electorate420 source;
    }

    function _voteStack(
        uint256 totalWeight,
        uint16 quorumBps,
        uint16 approvalBps
    ) private returns (VoteStack memory s) {
        s.timelock = new GovernanceTimelock(address(this));
        s.constitution = new CivicConstitution420(address(s.timelock));
        s.proposals = new CivicProposalRegistry420(address(s.timelock));
        s.electorates = new CivicElectorateRegistry420(address(s.timelock));
        s.source = new MockAudit2Electorate420(totalWeight);

        vm.prank(address(s.timelock));
        s.electorates.setHouseSource(CivicIds420.House.COMMUNITY, address(s.source));
        vm.prank(address(s.timelock));
        s.constitution.setRule(CivicIds420.ProposalClass.G1, 2, 7 days, quorumBps, approvalBps, 0, 0, false);

        s.voting = new CivicVoting420(address(s.proposals), address(s.electorates));
        s.governor = new CivicGovernor420(
            address(s.constitution), address(s.proposals), address(s.electorates), address(s.voting)
        );
        vm.prank(address(s.timelock));
        s.proposals.bindProposalAuthority(address(s.governor));
        vm.prank(address(s.timelock));
        s.electorates.bindSnapshotAuthority(address(s.governor));
    }

    function setUp() public {
        fuzzStack = _voteStack(100, 5000, 6000);
    }

    function _proposal(
        VoteStack memory s
    ) private returns (bytes32 proposalId) {
        vm.roll(100);
        vm.prank(ALICE);
        proposalId =
            s.governor.createProposal(CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions"));
    }

    function _ceilBps(
        uint256 total,
        uint16 bps
    ) private pure returns (uint256) {
        uint256 whole = (total / 10_000) * uint256(bps);
        uint256 remainderProduct = (total % 10_000) * uint256(bps);
        return whole + (remainderProduct / 10_000) + (remainderProduct % 10_000 == 0 ? 0 : 1);
    }

    function testAuthorityBindingsRejectEOAAndForeignGraphs() public {
        CivicProposalRegistry420 proposals = new CivicProposalRegistry420(address(this));
        CivicElectorateRegistry420 electorates = new CivicElectorateRegistry420(address(this));
        CivicProposalRegistry420 otherProposals = new CivicProposalRegistry420(address(this));
        CivicElectorateRegistry420 otherElectorates = new CivicElectorateRegistry420(address(this));

        vm.expectRevert(CivicProposalRegistry420.UnauthorizedAuthority.selector);
        proposals.bindProposalAuthority(address(0));
        vm.expectRevert(CivicElectorateRegistry420.UnauthorizedAuthority.selector);
        electorates.bindSnapshotAuthority(address(0));

        vm.expectRevert(CivicProposalRegistry420.UnauthorizedAuthority.selector);
        proposals.bindProposalAuthority(ALICE);
        vm.expectRevert(CivicElectorateRegistry420.UnauthorizedAuthority.selector);
        electorates.bindSnapshotAuthority(ALICE);

        MockAudit2Authority420 foreignProposal =
            new MockAudit2Authority420(address(otherProposals), address(electorates), address(this));
        MockAudit2Authority420 foreignElectorate =
            new MockAudit2Authority420(address(proposals), address(otherElectorates), address(this));

        vm.expectRevert(CivicProposalRegistry420.UnauthorizedAuthority.selector);
        proposals.bindProposalAuthority(address(foreignProposal));
        vm.expectRevert(CivicElectorateRegistry420.UnauthorizedAuthority.selector);
        electorates.bindSnapshotAuthority(address(foreignElectorate));

        MockAudit2Authority420 canonical =
            new MockAudit2Authority420(address(proposals), address(electorates), address(this));
        proposals.bindProposalAuthority(address(canonical));
        electorates.bindSnapshotAuthority(address(canonical));

        vm.expectRevert(CivicProposalRegistry420.AuthorityAlreadyBound.selector);
        proposals.bindProposalAuthority(address(foreignProposal));
        vm.expectRevert(CivicElectorateRegistry420.AuthorityAlreadyBound.selector);
        electorates.bindSnapshotAuthority(address(foreignElectorate));
    }

    function testTimelockRejectsForeignGovernorAndActivationIsOneTime() public {
        GovernanceTimelock timelock = new GovernanceTimelock(address(this));
        GovernanceTimelock foreignTimelock = new GovernanceTimelock(address(this));
        MockAudit2TimelockBoundGovernor420 foreignGovernor =
            new MockAudit2TimelockBoundGovernor420(address(foreignTimelock));
        MockAudit2TimelockBoundGovernor420 governor = new MockAudit2TimelockBoundGovernor420(address(timelock));

        (bool zeroOk,) = address(timelock).call(abi.encodeCall(timelock.activateCivicAuthority, (address(0))));
        require(!zeroOk, "zero governor activated");

        (bool foreignOk,) =
            address(timelock).call(abi.encodeCall(timelock.activateCivicAuthority, (address(foreignGovernor))));
        require(!foreignOk, "foreign governor activated");

        timelock.activateCivicAuthority(address(governor));
        require(timelock.scheduler() == address(governor), "scheduler not bound");

        (bool secondOk,) = address(timelock).call(abi.encodeCall(timelock.activateCivicAuthority, (address(governor))));
        require(!secondOk, "authority rebound");
    }

    function testProposalCreationRejectsBlockNumberOverflow() public {
        VoteStack memory s = _voteStack(100, 5000, 6000);
        vm.roll(uint256(type(uint64).max) - 1);

        vm.prank(ALICE);
        vm.expectRevert(CivicGovernor420.BlockNumberOverflow.selector);
        s.governor
            .createProposal(CivicIds420.ProposalClass.G1, keccak256("overflow metadata"), keccak256("overflow actions"));
    }

    function testTimelockSchedulingRejectsTimestampOverflow() public {
        GovernanceTimelock timelock = new GovernanceTimelock(address(this));
        vm.warp(uint256(type(uint64).max) - uint256(timelock.G1_DELAY()) + 1);

        (bool ok,) = address(timelock)
            .call(
                abi.encodeCall(
                    timelock.schedule,
                    (keccak256("timestamp-overflow"), address(0xBEEF), 0, bytes(""), GovernanceTimelock.Class.G1)
                )
            );
        require(!ok, "timestamp overflow schedule succeeded");
    }

    function testLifecycleTransitionMatrixExhaustive() public {
        for (uint8 from = 0; from < 5; ++from) {
            for (uint8 toRaw = 0; toRaw < 7; ++toRaw) {
                CivicProposalRegistry420 proposals = new CivicProposalRegistry420(address(this));
                MockAudit2Authority420 authority =
                    new MockAudit2Authority420(address(proposals), address(0xBEEF), address(this));
                proposals.bindProposalAuthority(address(authority));

                bytes32 proposalId = keccak256(abi.encode("GOV-AUDIT-2-LIFECYCLE", from, toRaw));
                authority.register(proposals, proposalId);

                if (from == 1) {
                    authority.transition(proposals, proposalId, CivicIds420.ProposalState.PASSED);
                } else if (from == 2) {
                    authority.transition(proposals, proposalId, CivicIds420.ProposalState.PASSED);
                    authority.transition(proposals, proposalId, CivicIds420.ProposalState.QUEUED);
                } else if (from == 3) {
                    authority.transition(proposals, proposalId, CivicIds420.ProposalState.PASSED);
                    authority.transition(proposals, proposalId, CivicIds420.ProposalState.QUEUED);
                    authority.transition(proposals, proposalId, CivicIds420.ProposalState.EXECUTED);
                } else if (from == 4) {
                    authority.transition(proposals, proposalId, CivicIds420.ProposalState.FAILED);
                }

                CivicIds420.ProposalState next = CivicIds420.ProposalState(toRaw);
                bool allowed =
                    (from == 0 && (next == CivicIds420.ProposalState.PASSED || next == CivicIds420.ProposalState.FAILED))
                        || (from == 1 && next == CivicIds420.ProposalState.QUEUED)
                        || (from == 2 && next == CivicIds420.ProposalState.EXECUTED);

                (bool ok,) =
                    address(authority).call(abi.encodeCall(authority.transition, (proposals, proposalId, next)));
                require(ok == allowed, "transition matrix mismatch");
            }
        }
    }

    function testFuzzQuorumCeilingArithmetic(
        uint256 totalRaw,
        uint256 weightRaw,
        uint16 quorumRaw,
        uint16 approvalRaw
    ) public {
        uint256 total = 1 + (totalRaw % 1e24);
        uint256 weight = 1 + (weightRaw % total);
        uint16 quorum = uint16(1 + (uint256(quorumRaw) % 10_000));
        uint16 approval = uint16(5_001 + (uint256(approvalRaw) % 5_000));

        fuzzStack.source.setTotalWeight(total);
        fuzzStack.source.setWeight(ALICE, weight);
        vm.prank(address(fuzzStack.timelock));
        fuzzStack.constitution.setRule(CivicIds420.ProposalClass.G1, 2, 7 days, quorum, approval, 0, 0, false);

        vm.roll(100);
        vm.prank(ALICE);
        bytes32 proposalId =
            fuzzStack.governor.createProposal(CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions"));

        vm.roll(101);
        vm.prank(ALICE);
        fuzzStack.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");

        CivicGovernor420.HouseResult memory result =
            fuzzStack.governor.resultFor(proposalId, CivicIds420.House.COMMUNITY);
        require(result.quorumMet == (weight >= _ceilBps(total, quorum)), "quorum ceiling mismatch");
        require(result.approvalMet, "unanimous decisive vote must approve");
    }

    function testFuzzApprovalCeilingArithmetic(
        uint256 forRaw,
        uint256 againstRaw,
        uint16 approvalRaw
    ) public {
        uint256 forWeight = 1 + (forRaw % 1e24);
        uint256 againstWeight = 1 + (againstRaw % 1e24);
        uint256 total = forWeight + againstWeight;
        uint16 approval = uint16(5_001 + (uint256(approvalRaw) % 5_000));

        fuzzStack.source.setTotalWeight(total);
        fuzzStack.source.setWeight(ALICE, forWeight);
        fuzzStack.source.setWeight(BOB, againstWeight);
        vm.prank(address(fuzzStack.timelock));
        fuzzStack.constitution.setRule(CivicIds420.ProposalClass.G1, 2, 7 days, 1, approval, 0, 0, false);

        vm.roll(100);
        vm.prank(ALICE);
        bytes32 proposalId =
            fuzzStack.governor.createProposal(CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions"));

        vm.roll(101);
        vm.prank(ALICE);
        fuzzStack.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        vm.prank(BOB);
        fuzzStack.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.AGAINST, "");

        CivicGovernor420.HouseResult memory result =
            fuzzStack.governor.resultFor(proposalId, CivicIds420.House.COMMUNITY);
        require(result.quorumMet, "full participation must meet quorum");
        require(result.approvalMet == (forWeight >= _ceilBps(total, approval)), "approval ceiling mismatch");
    }
}
