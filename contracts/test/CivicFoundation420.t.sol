// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/governance/CivicIds420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";

interface VmCivic420 {
    function prank(
        address
    ) external;
    function expectRevert(
        bytes4
    ) external;
}

contract MockFoundationProposalAuthority420 {
    address public immutable proposalRegistry;
    address public immutable timelock;

    constructor(
        address proposalRegistry_,
        address timelock_
    ) {
        proposalRegistry = proposalRegistry_;
        timelock = timelock_;
    }

    function register(
        CivicProposalRegistry420 registry,
        bytes32 proposalId,
        address proposer
    ) external {
        registry.registerProposal(
            proposalId, proposer, CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions"), 10, 11, 20
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

contract CivicFoundation420Test {
    VmCivic420 constant vm = VmCivic420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);

    function testConstitutionPreservesDelayFloorsAndGovernanceAuthority() public {
        CivicConstitution420 constitution = new CivicConstitution420(address(this));

        vm.prank(ALICE);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        constitution.setRule(CivicIds420.ProposalClass.G1, 100, 7 days, 1000, 5001, 0, 0, false);

        vm.expectRevert(CivicConstitution420.DelayBelowFloor.selector);
        constitution.setRule(CivicIds420.ProposalClass.G4, 100, 41 days, 1000, 6000, 1000, 6000, true);

        constitution.setRule(CivicIds420.ProposalClass.G4, 100, 42 days, 1000, 6000, 1000, 6000, true);
        CivicConstitution420.Rule memory rule = constitution.ruleFor(CivicIds420.ProposalClass.G4);
        require(rule.exists, "rule exists");
        require(rule.timelockDelay == 42 days, "g4 delay floor");
        require(rule.dualHouseRequired, "dual house retained");
        require(rule.revision == 1, "revision one");
    }

    function testConstitutionRejectsZeroQuorumAndNonMajorityApproval() public {
        CivicConstitution420 constitution = new CivicConstitution420(address(this));

        vm.expectRevert(CivicConstitution420.InvalidThreshold.selector);
        constitution.setRule(CivicIds420.ProposalClass.G1, 100, 7 days, 0, 6000, 0, 0, false);

        vm.expectRevert(CivicConstitution420.InvalidThreshold.selector);
        constitution.setRule(CivicIds420.ProposalClass.G1, 100, 7 days, 1000, 5000, 0, 0, false);
    }

    function testProposalAuthorityIsOneTimeBoundAndUnauthorizedWritersFailClosed() public {
        CivicProposalRegistry420 registry = new CivicProposalRegistry420(address(this));
        MockFoundationProposalAuthority420 authority =
            new MockFoundationProposalAuthority420(address(registry), address(this));
        registry.bindProposalAuthority(address(authority));

        vm.expectRevert(CivicProposalRegistry420.AuthorityAlreadyBound.selector);
        registry.bindProposalAuthority(ALICE);

        bytes32 proposalId = keccak256("proposal/1");
        vm.prank(ALICE);
        vm.expectRevert(CivicProposalRegistry420.UnauthorizedAuthority.selector);
        registry.registerProposal(
            proposalId, ALICE, CivicIds420.ProposalClass.G1, keccak256("metadata"), keccak256("actions"), 10, 11, 20
        );

        authority.register(registry, proposalId, ALICE);

        vm.expectRevert(CivicProposalRegistry420.AlreadyExists.selector);
        authority.register(registry, proposalId, ALICE);
    }

    function testProposalLifecycleCannotSkipQueueOrReopenTerminalState() public {
        CivicProposalRegistry420 registry = new CivicProposalRegistry420(address(this));
        MockFoundationProposalAuthority420 authority =
            new MockFoundationProposalAuthority420(address(registry), address(this));
        registry.bindProposalAuthority(address(authority));
        bytes32 proposalId = keccak256("proposal/2");

        authority.register(registry, proposalId, ALICE);

        vm.expectRevert(CivicProposalRegistry420.InvalidStateTransition.selector);
        authority.transition(registry, proposalId, CivicIds420.ProposalState.EXECUTED);

        authority.transition(registry, proposalId, CivicIds420.ProposalState.PASSED);
        authority.transition(registry, proposalId, CivicIds420.ProposalState.QUEUED);
        authority.transition(registry, proposalId, CivicIds420.ProposalState.EXECUTED);

        vm.expectRevert(CivicProposalRegistry420.InvalidStateTransition.selector);
        authority.transition(registry, proposalId, CivicIds420.ProposalState.ACTIVE);
    }
}
