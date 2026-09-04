// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/governance/CivicIds420.sol";
import "../src/governance/CivicConstitution420.sol";
import "../src/governance/CivicProposalRegistry420.sol";

interface VmCivic420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract CivicFoundation420Test {
    VmCivic420 constant vm = VmCivic420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant GOVERNOR = address(0x0437);

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
        registry.bindProposalAuthority(GOVERNOR);

        vm.expectRevert(CivicProposalRegistry420.AuthorityAlreadyBound.selector);
        registry.bindProposalAuthority(ALICE);

        bytes32 proposalId = keccak256("proposal/1");
        vm.prank(ALICE);
        vm.expectRevert(CivicProposalRegistry420.UnauthorizedAuthority.selector);
        registry.registerProposal(
            proposalId,
            ALICE,
            CivicIds420.ProposalClass.G1,
            keccak256("metadata"),
            keccak256("actions"),
            10,
            11,
            20
        );

        vm.prank(GOVERNOR);
        registry.registerProposal(
            proposalId,
            ALICE,
            CivicIds420.ProposalClass.G1,
            keccak256("metadata"),
            keccak256("actions"),
            10,
            11,
            20
        );

        vm.prank(GOVERNOR);
        vm.expectRevert(CivicProposalRegistry420.AlreadyExists.selector);
        registry.registerProposal(
            proposalId,
            ALICE,
            CivicIds420.ProposalClass.G1,
            keccak256("other-metadata"),
            keccak256("other-actions"),
            10,
            11,
            20
        );
    }

    function testProposalLifecycleCannotSkipQueueOrReopenTerminalState() public {
        CivicProposalRegistry420 registry = new CivicProposalRegistry420(address(this));
        registry.bindProposalAuthority(GOVERNOR);
        bytes32 proposalId = keccak256("proposal/2");

        vm.prank(GOVERNOR);
        registry.registerProposal(
            proposalId,
            ALICE,
            CivicIds420.ProposalClass.G4,
            keccak256("metadata"),
            keccak256("actions"),
            10,
            11,
            20
        );

        vm.prank(GOVERNOR);
        vm.expectRevert(CivicProposalRegistry420.InvalidStateTransition.selector);
        registry.transition(proposalId, CivicIds420.ProposalState.EXECUTED);

        vm.prank(GOVERNOR);
        registry.transition(proposalId, CivicIds420.ProposalState.PASSED);
        vm.prank(GOVERNOR);
        registry.transition(proposalId, CivicIds420.ProposalState.QUEUED);
        vm.prank(GOVERNOR);
        registry.transition(proposalId, CivicIds420.ProposalState.EXECUTED);

        vm.prank(GOVERNOR);
        vm.expectRevert(CivicProposalRegistry420.InvalidStateTransition.selector);
        registry.transition(proposalId, CivicIds420.ProposalState.ACTIVE);
    }
}
