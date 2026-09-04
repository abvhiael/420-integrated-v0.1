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

interface VmCivicExecution420 {
    function prank(address) external;
    function roll(uint256) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract MockExecutionElectorate420 is ICivicElectorateSource420 {
    bytes32 public constant ROOT = keccak256("CIVIC_EXECUTION_ROOT");
    mapping(address => uint256) public weights;

    function sourceType() external pure returns (bytes32) { return keccak256("CIVIC_EXECUTION_ELECTORATE_V1"); }
    function setWeight(address voter, uint256 weight) external { weights[voter] = weight; }
    function snapshotAt(uint64) external pure returns (bytes32, uint256) { return (ROOT, 100); }
    function votingWeight(bytes32 root, address voter, bytes calldata) external view returns (uint256) {
        if (root != ROOT) return 0;
        return weights[voter];
    }
}

contract MockCivicExecutionTarget420 {
    uint256 public value;
    function setValue(uint256 value_) external { value = value_; }
    function fail() external pure { revert("forced failure"); }
}

contract CivicTimelockExecution420Test {
    VmCivicExecution420 constant vm =
        VmCivicExecution420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);

    struct Stack {
        GovernanceTimelock timelock;
        CivicConstitution420 constitution;
        CivicProposalRegistry420 proposals;
        CivicElectorateRegistry420 electorates;
        CivicVoting420 voting;
        CivicGovernor420 governor;
        MockExecutionElectorate420 source;
        MockCivicExecutionTarget420 target;
    }

    function _stack(uint64 delay_) private returns (Stack memory s) {
        s.timelock = new GovernanceTimelock(address(this));
        s.constitution = new CivicConstitution420(address(s.timelock));
        s.proposals = new CivicProposalRegistry420(address(s.timelock));
        s.electorates = new CivicElectorateRegistry420(address(s.timelock));
        s.source = new MockExecutionElectorate420();
        s.target = new MockCivicExecutionTarget420();

        vm.prank(address(s.timelock));
        s.electorates.setHouseSource(CivicIds420.House.COMMUNITY, address(s.source));
        vm.prank(address(s.timelock));
        s.constitution.setRule(CivicIds420.ProposalClass.G1, 2, delay_, 5000, 6000, 0, 0, false);

        s.voting = new CivicVoting420(address(s.proposals), address(s.electorates));
        s.governor = new CivicGovernor420(
            address(s.constitution), address(s.proposals), address(s.electorates), address(s.voting)
        );
        vm.prank(address(s.timelock));
        s.proposals.bindProposalAuthority(address(s.governor));
        vm.prank(address(s.timelock));
        s.electorates.bindSnapshotAuthority(address(s.governor));
        s.source.setWeight(ALICE, 60);
    }

    function _actions(MockCivicExecutionTarget420 target, uint256 value_)
        private pure returns (CivicGovernor420.Action[] memory actions)
    {
        actions = new CivicGovernor420.Action[](1);
        actions[0] = CivicGovernor420.Action({
            target: address(target), value: 0, data: abi.encodeCall(target.setValue, (value_))
        });
    }

    function _pass(Stack memory s, CivicGovernor420.Action[] memory actions) private returns (bytes32 proposalId) {
        vm.roll(100);
        vm.prank(ALICE);
        proposalId = s.governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256("execution metadata"), keccak256(abi.encode(actions))
        );
        vm.roll(101);
        vm.prank(ALICE);
        s.voting.castVote(proposalId, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, "");
        vm.roll(103);
        require(s.governor.finalize(proposalId), "proposal should pass");
    }

    function testQueueRequiresIrreversibleCivicAuthorityActivation() public {
        Stack memory s = _stack(7 days);
        CivicGovernor420.Action[] memory actions = _actions(s.target, 42);
        bytes32 proposalId = _pass(s, actions);

        vm.expectRevert(CivicGovernor420.TimelockAuthorityInactive.selector);
        s.governor.queue(proposalId, actions);

        s.timelock.activateCivicAuthority(address(s.governor));
        require(s.timelock.civicAuthorityActivated(), "activated");
        require(s.timelock.scheduler() == address(s.governor), "governor scheduler");

        (bool ok,) = address(s.timelock).call(
            abi.encodeCall(
                s.timelock.schedule,
                (keccak256("bootstrap-after-retirement"), address(s.target), 0, bytes(""), GovernanceTimelock.Class.G1)
            )
        );
        require(!ok, "bootstrap scheduler must be retired");
    }

    function testQueueBindsExactBatchAndFrozenDelayThenExecutesOnce() public {
        Stack memory s = _stack(8 days);
        CivicGovernor420.Action[] memory actions = _actions(s.target, 420);
        bytes32 proposalId = _pass(s, actions);
        s.timelock.activateCivicAuthority(address(s.governor));

        uint256 queuedAt = block.timestamp;
        s.governor.queue(proposalId, actions);

        (address target, uint256 value,, uint64 executeAfter, GovernanceTimelock.Class class_, bool executed, bool cancelled) =
            s.timelock.operations(proposalId);
        require(target == address(s.governor), "governor batch target");
        require(value == 0, "zero batch value");
        require(executeAfter == queuedAt + 8 days, "frozen constitutional delay");
        require(class_ == GovernanceTimelock.Class.G1, "class preserved");
        require(!executed && !cancelled, "open operation");

        (bool early,) = address(s.timelock).call(abi.encodeCall(s.timelock.execute, (proposalId)));
        require(!early, "cannot execute early");

        vm.warp(executeAfter);
        s.timelock.execute(proposalId);
        require(s.target.value() == 420, "action executed");
        (,,,,,,, CivicIds420.ProposalState state,) = s.proposals.proposals(proposalId);
        require(state == CivicIds420.ProposalState.EXECUTED, "executed state");

        (bool replay,) = address(s.timelock).call(abi.encodeCall(s.timelock.execute, (proposalId)));
        require(!replay, "single execution");
    }

    function testQueueRejectsActionBatchDifferentFromProposalCommitment() public {
        Stack memory s = _stack(7 days);
        CivicGovernor420.Action[] memory committed = _actions(s.target, 1);
        bytes32 proposalId = _pass(s, committed);
        s.timelock.activateCivicAuthority(address(s.governor));

        CivicGovernor420.Action[] memory substituted = _actions(s.target, 2);
        vm.expectRevert(CivicGovernor420.ActionHashMismatch.selector);
        s.governor.queue(proposalId, substituted);
    }

    function testAtomicBatchFailureRollsBackPriorActionsAndKeepsProposalQueued() public {
        Stack memory s = _stack(7 days);
        CivicGovernor420.Action[] memory actions = new CivicGovernor420.Action[](2);
        actions[0] = CivicGovernor420.Action({
            target: address(s.target), value: 0, data: abi.encodeCall(s.target.setValue, (99))
        });
        actions[1] = CivicGovernor420.Action({
            target: address(s.target), value: 0, data: abi.encodeCall(s.target.fail, ())
        });

        bytes32 proposalId = _pass(s, actions);
        s.timelock.activateCivicAuthority(address(s.governor));
        s.governor.queue(proposalId, actions);
        (,,, uint64 executeAfter,,,) = s.timelock.operations(proposalId);
        vm.warp(executeAfter);

        (bool ok,) = address(s.timelock).call(abi.encodeCall(s.timelock.execute, (proposalId)));
        require(!ok, "batch must revert atomically");
        require(s.target.value() == 0, "prior action rolled back");
        (,,,,,,, CivicIds420.ProposalState state,) = s.proposals.proposals(proposalId);
        require(state == CivicIds420.ProposalState.QUEUED, "proposal remains queued");
        (,,,,, bool executed,) = s.timelock.operations(proposalId);
        require(!executed, "timelock execution flag rolled back");
    }
}
