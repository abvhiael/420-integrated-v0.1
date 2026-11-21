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

    function registerWindow(
        CivicProposalRegistry420 registry,
        bytes32 proposalId,
        uint64 snapshotBlock,
        uint64 voteStart,
        uint64 voteEnd
    ) external {
        registry.registerProposal(
            proposalId,
            address(0xA11CE),
            CivicIds420.ProposalClass.G1,
            keccak256("metadata"),
            keccak256("actions"),
            snapshotBlock,
            voteStart,
            voteEnd
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

    function testConstitutionAcceptsOneBlockForAllProposalClassesAndRejectsZero() public {
        CivicConstitution420 constitution = new CivicConstitution420(address(this));
        for (uint8 i = 0; i < 4; ++i) {
            CivicIds420.ProposalClass class_ = CivicIds420.ProposalClass(i);
            bool dual = i >= 2;
            uint64 delay = constitution.delayFloor(class_);
            constitution.setRule(class_, 1, delay, 1000, 5001, dual ? 1000 : 0, dual ? 5001 : 0, dual);

            CivicConstitution420.Rule memory r = constitution.ruleFor(class_);
            require(r.exists && r.revision == 1 && r.votingPeriodBlocks == 1, "valid one-block constitutional period");

            vm.expectRevert(CivicConstitution420.InvalidVotingPeriod.selector);
            constitution.setRule(class_, 0, delay, 1000, 5001, dual ? 1000 : 0, dual ? 5001 : 0, dual);
            require(constitution.ruleFor(class_).revision == 1, "rejected period changed rule");
        }
    }

    function testProposalRegistryAcceptsInclusiveOneBlockAndRejectsInvertedWindows() public {
        CivicProposalRegistry420 registry = new CivicProposalRegistry420(address(this));
        MockFoundationProposalAuthority420 authority =
            new MockFoundationProposalAuthority420(address(registry), address(this));
        registry.bindProposalAuthority(address(authority));

        bytes32 first = keccak256("GOV-REC-3-one-block");
        authority.registerWindow(registry, first, 10, 11, 11);
        (,,,, uint64 snapshot, uint64 start, uint64 end, CivicIds420.ProposalState state, bool exists) =
            registry.proposals(first);
        require(exists && snapshot == 10 && start == 11 && end == 11, "inclusive one-block registration");
        require(state == CivicIds420.ProposalState.ACTIVE, "one-block proposal active");

        bytes32 last = keccak256("GOV-REC-3-last-window");
        authority.registerWindow(registry, last, type(uint64).max - 1, type(uint64).max, type(uint64).max);
        (,,,, uint64 lastSnapshot, uint64 lastStart, uint64 lastEnd,, bool lastExists) = registry.proposals(last);
        require(
            lastExists && lastSnapshot == type(uint64).max - 1 && lastStart == type(uint64).max && lastEnd == lastStart,
            "last representable one-block registration"
        );

        vm.expectRevert(CivicProposalRegistry420.InvalidWindow.selector);
        authority.registerWindow(registry, keccak256("reversed"), 10, 11, 10);

        vm.expectRevert(CivicProposalRegistry420.InvalidWindow.selector);
        authority.registerWindow(registry, keccak256("start at snapshot"), 10, 10, 10);

        vm.expectRevert(CivicProposalRegistry420.InvalidWindow.selector);
        authority.registerWindow(registry, keccak256("start before snapshot"), 11, 10, 11);
    }
}
