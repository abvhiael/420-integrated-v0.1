// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/governance/Governance420.sol";

interface VmGovernance420Retirement {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCanonicalCivicGovernor420 {}

contract Governance420RetirementTest {
    VmGovernance420Retirement constant vm =
        VmGovernance420Retirement(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);

    function testLegacyProposalCreationIsPermanentlyRetired() public {
        Governance420 legacy = new Governance420(address(this));

        vm.expectRevert(Governance420.LegacySurfaceRetired.selector);
        legacy.createProposal(keccak256("P1"), Governance420.Class.G1, keccak256("metadata"), 1, 100);

        vm.prank(ALICE);
        vm.expectRevert(Governance420.LegacySurfaceRetired.selector);
        legacy.createProposal(keccak256("P2"), Governance420.Class.G2, keccak256("metadata"), 1, 100);
    }

    function testLegacyVoteAndResultInjectionArePermanentlyRetiredEvenForGovernance() public {
        Governance420 legacy = new Governance420(address(this));
        bytes32 proposalId = keccak256("P1");

        vm.expectRevert(Governance420.LegacySurfaceRetired.selector);
        legacy.applyVote(proposalId, false, true, type(uint256).max);

        vm.expectRevert(Governance420.LegacySurfaceRetired.selector);
        legacy.applyResult(proposalId, true);

        vm.prank(ALICE);
        vm.expectRevert(Governance420.LegacySurfaceRetired.selector);
        legacy.applyVote(proposalId, true, false, 1);

        vm.prank(ALICE);
        vm.expectRevert(Governance420.LegacySurfaceRetired.selector);
        legacy.applyResult(proposalId, false);
    }

    function testOnlyTimelockCanBindCanonicalCivicGovernorOnce() public {
        Governance420 legacy = new Governance420(address(this));
        MockCanonicalCivicGovernor420 governor = new MockCanonicalCivicGovernor420();
        MockCanonicalCivicGovernor420 replacement = new MockCanonicalCivicGovernor420();

        vm.prank(ALICE);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        legacy.bindCivicGovernor(address(governor));

        vm.expectRevert(Governance420.InvalidCivicGovernor.selector);
        legacy.bindCivicGovernor(address(0));

        vm.expectRevert(Governance420.InvalidCivicGovernor.selector);
        legacy.bindCivicGovernor(ALICE);

        legacy.bindCivicGovernor(address(governor));
        require(legacy.civicGovernor() == address(governor), "canonical governor bound");

        vm.expectRevert(Governance420.CivicGovernorAlreadyBound.selector);
        legacy.bindCivicGovernor(address(replacement));
    }

    function testLegacyProposalStorageCannotBePopulated() public {
        Governance420 legacy = new Governance420(address(this));
        bytes32 proposalId = keccak256("UNWRITABLE");

        (
            address proposer,
            Governance420.Class class_,
            bytes32 metadataHash,
            uint64 snapshotBlock,
            uint64 voteEnd,
            uint256 communityYes,
            uint256 communityNo,
            uint256 validatorYes,
            uint256 validatorNo,
            Governance420.State state
        ) = legacy.proposals(proposalId);

        require(proposer == address(0), "no proposer");
        require(uint8(class_) == 0, "default class");
        require(metadataHash == bytes32(0), "no metadata");
        require(snapshotBlock == 0 && voteEnd == 0, "no window");
        require(communityYes == 0 && communityNo == 0, "no community votes");
        require(validatorYes == 0 && validatorNo == 0, "no validator votes");
        require(state == Governance420.State.NONE, "no state");
    }

    function testCompatibilityIdentityRemainsStable() public {
        Governance420 legacy = new Governance420(address(this));
        require(keccak256(bytes(legacy.systemName())) == keccak256(bytes("Governance420")), "name");
        require(legacy.protocolVersion() == 2, "retired version");
        require(legacy.governanceTimelock() == address(this), "timelock identity");
    }
}
