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

interface VmGovernanceAudit3 {
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

contract AdversarialElectorateSource420 is ICivicElectorateSource420 {
    bytes32 private immutable _sourceType;
    bytes32 public immutable root;
    uint256 public totalWeight;
    bool public revertSnapshot;
    bool public revertWeight;
    mapping(address => uint256) public weights;

    constructor(
        bytes32 sourceType_,
        bytes32 root_,
        uint256 totalWeight_
    ) {
        _sourceType = sourceType_;
        root = root_;
        totalWeight = totalWeight_;
    }

    function sourceType() external view returns (bytes32) {
        return _sourceType;
    }

    function setWeight(
        address voter,
        uint256 weight
    ) external {
        weights[voter] = weight;
    }

    function setRevertSnapshot(
        bool value
    ) external {
        revertSnapshot = value;
    }

    function setRevertWeight(
        bool value
    ) external {
        revertWeight = value;
    }

    function snapshotAt(
        uint64
    ) external view returns (bytes32, uint256) {
        require(!revertSnapshot, "hostile snapshot");
        return (root, totalWeight);
    }

    function votingWeight(
        bytes32 electorateRoot,
        address voter,
        bytes calldata
    ) external view returns (uint256) {
        require(!revertWeight, "hostile weight");
        return electorateRoot == root ? weights[voter] : 0;
    }
}

contract MalformedElectorateAdapter420 {
    fallback() external {
        assembly {
            mstore(0, 1)
            return(31, 1)
        }
    }
}

contract Audit3ExecutionTarget420 {
    uint256 public value;

    function setValue(
        uint256 value_
    ) external {
        value = value_;
    }
}

contract Audit3TimelockGovernor420 {
    address public immutable timelock;

    constructor(
        address timelock_
    ) {
        timelock = timelock_;
    }
}

contract GovernanceAudit3Adversarial420Test {
    VmGovernanceAudit3 constant vm = VmGovernanceAudit3(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant CAROL = address(0xCA401);

    bytes32 constant COMMUNITY_ROOT = keccak256("AUDIT3_COMMUNITY");
    bytes32 constant VALIDATOR_ROOT = keccak256("AUDIT3_VALIDATOR");

    struct Stack {
        GovernanceTimelock timelock;
        CivicConstitution420 constitution;
        CivicProposalRegistry420 proposals;
        CivicElectorateRegistry420 electorates;
        CivicVoting420 voting;
        CivicGovernor420 governor;
        AdversarialElectorateSource420 community;
        AdversarialElectorateSource420 validators;
    }

    function _stack(
        bool dualHouse,
        uint256 communityTotal,
        uint256 validatorTotal,
        uint16 communityQuorum,
        uint16 communityApproval
    ) private returns (Stack memory s) {
        s.timelock = new GovernanceTimelock(address(this));
        s.constitution = new CivicConstitution420(address(s.timelock));
        s.proposals = new CivicProposalRegistry420(address(s.timelock));
        s.electorates = new CivicElectorateRegistry420(address(s.timelock));
        s.community =
            new AdversarialElectorateSource420(keccak256("AUDIT3_COMMUNITY_SOURCE"), COMMUNITY_ROOT, communityTotal);
        s.validators =
            new AdversarialElectorateSource420(keccak256("AUDIT3_VALIDATOR_SOURCE"), VALIDATOR_ROOT, validatorTotal);

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
                communityQuorum,
                communityApproval,
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
        Stack memory s,
        bytes32 salt
    ) private returns (bytes32 proposalId) {
        vm.roll(100);
        vm.prank(ALICE);
        proposalId = s.governor
            .createProposal(
                CivicIds420.ProposalClass.G1,
                keccak256(abi.encode("meta", salt)),
                keccak256(abi.encode("actions", salt))
            );
    }

    function _cast(
        Stack memory s,
        bytes32 proposalId,
        CivicIds420.House house,
        address voter,
        CivicVoting420.Support support
    ) private {
        vm.prank(voter);
        s.voting.castVote(proposalId, house, support, "");
    }

    function testQuorumExactBoundaryOneBelowAndFullParticipation() public {
        Stack memory exact = _stack(false, 100, 1, 5000, 6000);
        exact.community.setWeight(ALICE, 50);
        bytes32 exactId = _create(exact, "quorum-exact");
        vm.roll(101);
        _cast(exact, exactId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        CivicGovernor420.HouseResult memory exactResult = exact.governor.resultFor(exactId, CivicIds420.House.COMMUNITY);
        require(exactResult.quorumMet, "exact quorum must pass");

        Stack memory below = _stack(false, 100, 1, 5000, 6000);
        below.community.setWeight(ALICE, 49);
        bytes32 belowId = _create(below, "quorum-below");
        vm.roll(101);
        _cast(below, belowId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        CivicGovernor420.HouseResult memory belowResult = below.governor.resultFor(belowId, CivicIds420.House.COMMUNITY);
        require(!belowResult.quorumMet, "one below quorum must fail");

        Stack memory full = _stack(false, 100, 1, 10000, 6000);
        full.community.setWeight(ALICE, 100);
        bytes32 fullId = _create(full, "quorum-full");
        vm.roll(101);
        _cast(full, fullId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        CivicGovernor420.HouseResult memory fullResult = full.governor.resultFor(fullId, CivicIds420.House.COMMUNITY);
        require(fullResult.quorumMet, "full participation must meet 100 percent quorum");
    }

    function testApprovalExactBoundaryAndOneBelow() public {
        Stack memory exact = _stack(false, 100, 1, 5000, 6000);
        exact.community.setWeight(ALICE, 60);
        exact.community.setWeight(BOB, 40);
        bytes32 exactId = _create(exact, "approval-exact");
        vm.roll(101);
        _cast(exact, exactId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        _cast(exact, exactId, CivicIds420.House.COMMUNITY, BOB, CivicVoting420.Support.AGAINST);
        require(
            exact.governor.resultFor(exactId, CivicIds420.House.COMMUNITY).approvalMet,
            "exact approval boundary must pass"
        );

        Stack memory below = _stack(false, 100, 1, 5000, 6000);
        below.community.setWeight(ALICE, 59);
        below.community.setWeight(BOB, 41);
        bytes32 belowId = _create(below, "approval-below");
        vm.roll(101);
        _cast(below, belowId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        _cast(below, belowId, CivicIds420.House.COMMUNITY, BOB, CivicVoting420.Support.AGAINST);
        require(
            !below.governor.resultFor(belowId, CivicIds420.House.COMMUNITY).approvalMet, "one below approval must fail"
        );
    }

    function testAbstainOnlyMeetsQuorumButCannotApprove() public {
        Stack memory s = _stack(false, 100, 1, 5000, 6000);
        s.community.setWeight(ALICE, 100);
        bytes32 proposalId = _create(s, "abstain-only");
        vm.roll(101);
        _cast(s, proposalId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.ABSTAIN);

        CivicGovernor420.HouseResult memory result = s.governor.resultFor(proposalId, CivicIds420.House.COMMUNITY);
        require(result.quorumMet, "abstain participates in quorum");
        require(!result.approvalMet, "no decisive vote cannot approve");
        require(!result.passed, "abstain-only house cannot pass");
    }

    function _dualOutcome(
        bool communityPass,
        bool validatorPass
    ) private returns (bool) {
        Stack memory s = _stack(true, 100, 10, 5000, 6000);
        s.community.setWeight(ALICE, 60);
        s.validators.setWeight(BOB, 6);
        bytes32 proposalId = _create(s, keccak256(abi.encode(communityPass, validatorPass)));
        vm.roll(101);
        _cast(
            s,
            proposalId,
            CivicIds420.House.COMMUNITY,
            ALICE,
            communityPass ? CivicVoting420.Support.FOR : CivicVoting420.Support.AGAINST
        );
        _cast(
            s,
            proposalId,
            CivicIds420.House.VALIDATOR,
            BOB,
            validatorPass ? CivicVoting420.Support.FOR : CivicVoting420.Support.AGAINST
        );
        vm.roll(106);
        return s.governor.finalize(proposalId);
    }

    function testDualHouseAllIndependentPassFailPermutations() public {
        require(_dualOutcome(true, true), "pass/pass must pass");
        require(!_dualOutcome(true, false), "pass/fail must fail");
        require(!_dualOutcome(false, true), "fail/pass must fail");
        require(!_dualOutcome(false, false), "fail/fail must fail");
    }

    function testMaximumElectorateWeightArithmeticDoesNotOverflow() public {
        Stack memory s = _stack(false, type(uint256).max, 1, 10000, 6000);
        s.community.setWeight(ALICE, type(uint256).max - 1);
        s.community.setWeight(BOB, 1);
        bytes32 proposalId = _create(s, "max-weight");
        vm.roll(101);
        _cast(s, proposalId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        _cast(s, proposalId, CivicIds420.House.COMMUNITY, BOB, CivicVoting420.Support.FOR);

        CivicGovernor420.HouseResult memory result = s.governor.resultFor(proposalId, CivicIds420.House.COMMUNITY);
        require(result.participation == type(uint256).max, "max participation mismatch");
        require(result.quorumMet && result.approvalMet && result.passed, "max-weight result wrong");
    }

    function testDuplicateBallotRejectedButSameVoterCanVoteInBothRequiredHouses() public {
        Stack memory s = _stack(true, 100, 10, 5000, 6000);
        s.community.setWeight(ALICE, 60);
        s.validators.setWeight(ALICE, 6);
        bytes32 proposalId = _create(s, "cross-house");
        vm.roll(101);

        _cast(s, proposalId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        _cast(s, proposalId, CivicIds420.House.VALIDATOR, ALICE, CivicVoting420.Support.FOR);

        vm.prank(ALICE);
        vm.expectRevert(CivicVoting420.AlreadyVoted.selector);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.AGAINST, "");

        require(s.voting.tally(proposalId, CivicIds420.House.COMMUNITY).forVotes == 60, "community vote changed");
        require(s.voting.tally(proposalId, CivicIds420.House.VALIDATOR).forVotes == 6, "validator vote missing");
    }

    function testMaliciousOverweightAndCumulativeAllocationFailClosed() public {
        Stack memory overweight = _stack(false, 100, 1, 5000, 6000);
        overweight.community.setWeight(ALICE, 101);
        bytes32 overweightId = _create(overweight, "overweight");
        vm.roll(101);
        vm.prank(ALICE);
        vm.expectRevert(CivicVoting420.InvalidVotingWeight.selector);
        overweight.voting.castVote(overweightId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        require(
            overweight.voting.participation(overweightId, CivicIds420.House.COMMUNITY) == 0,
            "overweight vote mutated tally"
        );

        Stack memory cumulative = _stack(false, 100, 1, 5000, 6000);
        cumulative.community.setWeight(ALICE, 60);
        cumulative.community.setWeight(BOB, 50);
        bytes32 cumulativeId = _create(cumulative, "cumulative-overweight");
        vm.roll(101);
        _cast(cumulative, cumulativeId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);

        vm.prank(BOB);
        vm.expectRevert(CivicVoting420.InvalidVotingWeight.selector);
        cumulative.voting.castVote(cumulativeId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        require(
            cumulative.voting.participation(cumulativeId, CivicIds420.House.COMMUNITY) == 60,
            "cumulative over-allocation mutated tally"
        );
        require(
            !cumulative.voting.ballot(cumulativeId, CivicIds420.House.COMMUNITY, BOB).cast, "rejected ballot persisted"
        );
    }

    function testHostileSnapshotAdapterRevertsAtomically() public {
        Stack memory s = _stack(false, 100, 1, 5000, 6000);
        s.community.setRevertSnapshot(true);
        vm.roll(100);
        vm.prank(ALICE);
        (bool ok,) = address(s.governor)
            .call(
                abi.encodeCall(
                    s.governor.createProposal,
                    (CivicIds420.ProposalClass.G1, keccak256("hostile snapshot"), keccak256("actions"))
                )
            );
        require(!ok, "hostile snapshot admitted");
        require(s.governor.proposerNonces(ALICE) == 0, "failed create consumed nonce");
    }

    function testHostileVotingWeightAdapterFailsWithoutBallotOrTallyMutation() public {
        Stack memory s = _stack(false, 100, 1, 5000, 6000);
        s.community.setWeight(ALICE, 60);
        bytes32 proposalId = _create(s, "hostile-weight");
        s.community.setRevertWeight(true);
        vm.roll(101);
        vm.prank(ALICE);
        (bool ok,) = address(s.voting)
            .call(
                abi.encodeCall(
                    s.voting.castVote, (proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, bytes(""))
                )
            );
        require(!ok, "hostile weight admitted");
        require(!s.voting.ballot(proposalId, CivicIds420.House.COMMUNITY, ALICE).cast, "ballot persisted");
        require(s.voting.participation(proposalId, CivicIds420.House.COMMUNITY) == 0, "tally mutated");
    }

    function testMalformedElectorateAdapterRejectedDuringConfiguration() public {
        CivicElectorateRegistry420 registry = new CivicElectorateRegistry420(address(this));
        MalformedElectorateAdapter420 malformed = new MalformedElectorateAdapter420();
        (bool ok,) = address(registry)
            .call(abi.encodeCall(registry.setHouseSource, (CivicIds420.House.COMMUNITY, address(malformed))));
        require(!ok, "malformed adapter configured");
        require(!registry.sourceFor(CivicIds420.House.COMMUNITY).exists, "malformed source persisted");
    }

    function testVotingWindowExactStartAndEndAcceptedOutsideRejected() public {
        Stack memory s = _stack(false, 100, 1, 5000, 6000);
        s.community.setWeight(ALICE, 10);
        s.community.setWeight(BOB, 10);
        s.community.setWeight(CAROL, 10);
        bytes32 proposalId = _create(s, "window");

        vm.roll(100);
        vm.prank(ALICE);
        vm.expectRevert(CivicVoting420.VotingNotStarted.selector);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");

        vm.roll(101);
        _cast(s, proposalId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);

        vm.roll(105);
        _cast(s, proposalId, CivicIds420.House.COMMUNITY, BOB, CivicVoting420.Support.FOR);

        vm.roll(106);
        vm.prank(CAROL);
        vm.expectRevert(CivicVoting420.VotingEnded.selector);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
    }

    function _passedActionProposal(
        Stack memory s,
        CivicGovernor420.Action[] memory actions,
        bytes32 salt
    ) private returns (bytes32 proposalId) {
        vm.roll(100);
        vm.prank(ALICE);
        proposalId = s.governor
            .createProposal(
                CivicIds420.ProposalClass.G1, keccak256(abi.encode("action-meta", salt)), keccak256(abi.encode(actions))
            );
        vm.roll(101);
        _cast(s, proposalId, CivicIds420.House.COMMUNITY, ALICE, CivicVoting420.Support.FOR);
        vm.roll(106);
        require(s.governor.finalize(proposalId), "proposal should pass");
    }

    function testRepeatedQueueAttemptRejected() public {
        Stack memory s = _stack(false, 100, 1, 5000, 6000);
        s.community.setWeight(ALICE, 60);
        Audit3ExecutionTarget420 target = new Audit3ExecutionTarget420();
        CivicGovernor420.Action[] memory actions = new CivicGovernor420.Action[](1);
        actions[0] =
            CivicGovernor420.Action({ target: address(target), value: 0, data: abi.encodeCall(target.setValue, (1)) });
        bytes32 proposalId = _passedActionProposal(s, actions, "repeat-queue");
        s.timelock.activateCivicAuthority(address(s.governor));
        s.governor.queue(proposalId, actions);

        vm.expectRevert(CivicGovernor420.ProposalNotPassed.selector);
        s.governor.queue(proposalId, actions);
    }

    function testActionBatchReorderingRejected() public {
        Stack memory s = _stack(false, 100, 1, 5000, 6000);
        s.community.setWeight(ALICE, 60);
        Audit3ExecutionTarget420 target = new Audit3ExecutionTarget420();
        CivicGovernor420.Action[] memory committed = new CivicGovernor420.Action[](2);
        committed[0] =
            CivicGovernor420.Action({ target: address(target), value: 0, data: abi.encodeCall(target.setValue, (1)) });
        committed[1] =
            CivicGovernor420.Action({ target: address(target), value: 0, data: abi.encodeCall(target.setValue, (2)) });
        bytes32 proposalId = _passedActionProposal(s, committed, "reorder");
        s.timelock.activateCivicAuthority(address(s.governor));

        CivicGovernor420.Action[] memory reordered = new CivicGovernor420.Action[](2);
        reordered[0] = committed[1];
        reordered[1] = committed[0];

        vm.expectRevert(CivicGovernor420.ActionHashMismatch.selector);
        s.governor.queue(proposalId, reordered);
    }

    function testUnauthorizedActivationSchedulingAndCancellationFailClosed() public {
        GovernanceTimelock timelock = new GovernanceTimelock(address(this));
        Audit3ExecutionTarget420 target = new Audit3ExecutionTarget420();
        bytes32 operationId = keccak256("audit3-unauthorized");

        vm.prank(ALICE);
        (bool scheduleOk,) = address(timelock)
            .call(
                abi.encodeCall(
                    timelock.schedule, (operationId, address(target), 0, bytes(""), GovernanceTimelock.Class.G1)
                )
            );
        require(!scheduleOk, "unauthorized schedule admitted");

        timelock.schedule(operationId, address(target), 0, bytes(""), GovernanceTimelock.Class.G1);

        vm.prank(ALICE);
        (bool cancelOk,) = address(timelock).call(abi.encodeCall(timelock.cancel, (operationId)));
        require(!cancelOk, "unauthorized cancel admitted");

        Audit3TimelockGovernor420 governor = new Audit3TimelockGovernor420(address(timelock));
        vm.prank(ALICE);
        (bool activateOk,) =
            address(timelock).call(abi.encodeCall(timelock.activateCivicAuthority, (address(governor))));
        require(!activateOk, "unauthorized activation admitted");

        (address scheduledTarget,,,,, bool executed, bool cancelled) = timelock.operations(operationId);
        require(scheduledTarget == address(target) && !executed && !cancelled, "unauthorized call mutated state");
    }

    function testRepeatedBootstrapCancellationRejected() public {
        GovernanceTimelock timelock = new GovernanceTimelock(address(this));
        Audit3ExecutionTarget420 target = new Audit3ExecutionTarget420();
        bytes32 operationId = keccak256("audit3-repeat-cancel");
        timelock.schedule(operationId, address(target), 0, bytes(""), GovernanceTimelock.Class.G1);
        timelock.cancel(operationId);

        (bool secondOk,) = address(timelock).call(abi.encodeCall(timelock.cancel, (operationId)));
        require(!secondOk, "cancel replay admitted");
        (,,,,, bool executed, bool cancelled) = timelock.operations(operationId);
        require(!executed && cancelled, "cancelled operation mutated");
    }
}
