// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/governance/GovernanceTimelock.sol";
import "../src/governance/CivicIds420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";
import "../src/governance/CivicElectorateRegistry420.sol";
import "../src/governance/CivicVoting420.sol";
import "../src/governance/CivicGovernor420.sol";

interface VmGovernanceAudit420 {
    function expectRevert(
        bytes4
    ) external;
}

contract MockGovernanceAuditAuthority420 {
    address public immutable proposalRegistry;
    address public immutable electorateRegistry;
    address public immutable timelock;

    constructor(address proposalRegistry_, address electorateRegistry_, address timelock_) {
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

contract MockTimelockBoundGovernor420 {
    address public immutable timelock;

    constructor(address timelock_) {
        timelock = timelock_;
    }
}

contract GovernanceAudit420Test {
    VmGovernanceAudit420 constant vm = VmGovernanceAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));

    function _base()
        private
        returns (
            GovernanceTimelock timelock,
            CivicConstitution420 constitution,
            CivicProposalRegistry420 proposals,
            CivicElectorateRegistry420 electorates,
            CivicVoting420 voting
        )
    {
        timelock = new GovernanceTimelock(address(this));
        constitution = new CivicConstitution420(address(timelock));
        proposals = new CivicProposalRegistry420(address(timelock));
        electorates = new CivicElectorateRegistry420(address(timelock));
        voting = new CivicVoting420(address(proposals), address(electorates));
    }

    function testGovernorAcceptsOneConsistentAuthorityGraph() public {
        (
            GovernanceTimelock timelock,
            CivicConstitution420 constitution,
            CivicProposalRegistry420 proposals,
            CivicElectorateRegistry420 electorates,
            CivicVoting420 voting
        ) = _base();

        CivicGovernor420 governor =
            new CivicGovernor420(address(constitution), address(proposals), address(electorates), address(voting));

        require(address(governor.timelock()) == address(timelock), "timelock");
        require(address(governor.constitution()) == address(constitution), "constitution");
        require(address(governor.proposalRegistry()) == address(proposals), "proposals");
        require(address(governor.electorateRegistry()) == address(electorates), "electorates");
        require(address(governor.voting()) == address(voting), "voting");
    }

    function testGovernorRejectsConstitutionWithDifferentGovernanceTimelock() public {
        (,, CivicProposalRegistry420 proposals, CivicElectorateRegistry420 electorates, CivicVoting420 voting) = _base();
        GovernanceTimelock otherTimelock = new GovernanceTimelock(address(this));
        CivicConstitution420 wrongConstitution = new CivicConstitution420(address(otherTimelock));

        vm.expectRevert(CivicGovernor420.InvalidModule.selector);
        new CivicGovernor420(address(wrongConstitution), address(proposals), address(electorates), address(voting));
    }

    function testVotingRejectsRegistriesWithDifferentGovernanceTimelocks() public {
        (
            GovernanceTimelock timelock,
            CivicConstitution420 constitution,
            CivicProposalRegistry420 proposals,
            CivicElectorateRegistry420 originalElectorates,
            CivicVoting420 originalVoting
        ) = _base();
        constitution;
        originalElectorates;
        originalVoting;

        GovernanceTimelock otherTimelock = new GovernanceTimelock(address(this));
        CivicElectorateRegistry420 wrongElectorates = new CivicElectorateRegistry420(address(otherTimelock));

        require(address(timelock) != address(otherTimelock), "distinct timelocks");
        vm.expectRevert(CivicVoting420.InvalidRegistry.selector);
        new CivicVoting420(address(proposals), address(wrongElectorates));
    }

    function testGovernorRejectsNonContractTimelockAuthorityGraph() public {
        CivicConstitution420 constitution = new CivicConstitution420(address(this));
        CivicProposalRegistry420 proposals = new CivicProposalRegistry420(address(this));
        CivicElectorateRegistry420 electorates = new CivicElectorateRegistry420(address(this));
        CivicVoting420 voting = new CivicVoting420(address(proposals), address(electorates));

        vm.expectRevert(CivicGovernor420.InvalidModule.selector);
        new CivicGovernor420(address(constitution), address(proposals), address(electorates), address(voting));
    }

    function testGovernorRejectsVotingBoundToDifferentProposalRegistry() public {
        (
            GovernanceTimelock timelock,
            CivicConstitution420 constitution,
            CivicProposalRegistry420 proposals,
            CivicElectorateRegistry420 electorates,
            CivicVoting420 originalVoting
        ) = _base();
        originalVoting;
        CivicProposalRegistry420 otherProposals = new CivicProposalRegistry420(address(timelock));
        CivicVoting420 wrongVoting = new CivicVoting420(address(otherProposals), address(electorates));

        vm.expectRevert(CivicGovernor420.InvalidModule.selector);
        new CivicGovernor420(address(constitution), address(proposals), address(electorates), address(wrongVoting));
    }

    function testGovernorRejectsVotingBoundToDifferentElectorateRegistry() public {
        (
            GovernanceTimelock timelock,
            CivicConstitution420 constitution,
            CivicProposalRegistry420 proposals,
            CivicElectorateRegistry420 electorates,
            CivicVoting420 originalVoting
        ) = _base();
        originalVoting;
        CivicElectorateRegistry420 otherElectorates = new CivicElectorateRegistry420(address(timelock));
        CivicVoting420 wrongVoting = new CivicVoting420(address(proposals), address(otherElectorates));

        vm.expectRevert(CivicGovernor420.InvalidModule.selector);
        new CivicGovernor420(address(constitution), address(proposals), address(electorates), address(wrongVoting));
    }

    function testCivicProposalCancellationIsRejectedFromEveryLiveState() public {
        CivicProposalRegistry420 proposals = new CivicProposalRegistry420(address(this));
        MockGovernanceAuditAuthority420 authority =
            new MockGovernanceAuditAuthority420(address(proposals), address(0xBEEF), address(this));
        proposals.bindProposalAuthority(address(authority));

        bytes32 proposalId = keccak256("GOV-AUDIT-1-CANCEL");
        authority.register(proposals, proposalId);

        vm.expectRevert(CivicProposalRegistry420.InvalidStateTransition.selector);
        authority.transition(proposals, proposalId, CivicIds420.ProposalState.CANCELLED);

        authority.transition(proposals, proposalId, CivicIds420.ProposalState.PASSED);
        vm.expectRevert(CivicProposalRegistry420.InvalidStateTransition.selector);
        authority.transition(proposals, proposalId, CivicIds420.ProposalState.CANCELLED);

        authority.transition(proposals, proposalId, CivicIds420.ProposalState.QUEUED);
        vm.expectRevert(CivicProposalRegistry420.InvalidStateTransition.selector);
        authority.transition(proposals, proposalId, CivicIds420.ProposalState.CANCELLED);
    }

    function testTimelockCancellationRetiresWhenCivicAuthorityActivates() public {
        GovernanceTimelock timelock = new GovernanceTimelock(address(this));
        bytes32 operationId = keccak256("GOV-AUDIT-1-BOOTSTRAP-OP");
        timelock.schedule(operationId, address(0xBEEF), 0, "", GovernanceTimelock.Class.G1);

        MockTimelockBoundGovernor420 governor = new MockTimelockBoundGovernor420(address(timelock));
        timelock.activateCivicAuthority(address(governor));
        require(timelock.civicAuthorityActivated(), "civic active");

        (bool ok,) = address(timelock).call(abi.encodeCall(timelock.cancel, (operationId)));
        require(!ok, "post-activation cancel must fail");

        (,,,,, bool executed, bool cancelled) = timelock.operations(operationId);
        require(!executed && !cancelled, "operation state mutated");
    }
}
