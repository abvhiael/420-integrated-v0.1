// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/economics/StreamingSettlementEpoch420.sol";

interface VmStreamingSettlement420 {
    function prank(address msgSender) external;
    function expectRevert(bytes4 selector) external;
}

contract StreamingSettlementEpoch420Test {
    VmStreamingSettlement420 private constant vm =
        VmStreamingSettlement420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOVERNANCE = address(0x420);
    address private constant SUBMITTER = address(0xBEEF);
    address private constant STRANGER = address(0xBAD);
    address private constant PLAYBACK_ACCOUNTING = address(0xA11CE);

    StreamingSettlementEpoch420 private settlement;

    function setUp() public {
        settlement = new StreamingSettlementEpoch420(GOVERNANCE, PLAYBACK_ACCOUNTING);
        vm.prank(GOVERNANCE);
        settlement.setSubmitter(SUBMITTER, true);
    }

    function testAuthorizedSubmitterCommitsAndGovernanceFinalizesEpoch() public {
        bytes32 settlementId = keccak256("hz4-epoch-1");
        vm.prank(SUBMITTER);
        settlement.commitSettlementEpoch(
            settlementId,
            1,
            keccak256("playback-root"),
            keccak256("revenue-root"),
            4200,
            84_000_000,
            42 ether
        );

        StreamingSettlementEpoch420.SettlementEpoch420 memory committed = settlement.epoch(settlementId);
        require(committed.playbackEpoch == 1, "playback epoch");
        require(committed.totalPlayCount == 4200, "play count");
        require(committed.totalQualifiedMs == 84_000_000, "qualified ms");
        require(committed.grossRevenue == 42 ether, "gross revenue");
        require(
            committed.state == StreamingSettlementEpoch420.EpochState.COMMITTED,
            "commit state"
        );
        require(settlement.settlementIdByPlaybackEpoch(1) == settlementId, "playback binding");

        vm.prank(GOVERNANCE);
        settlement.finalizeSettlementEpoch(settlementId);
        require(settlement.isFinalized(settlementId), "not finalized");
    }

    function testUnauthorizedAccountCannotCommit() public {
        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(STRANGER);
        settlement.commitSettlementEpoch(
            keccak256("unauthorized"),
            1,
            keccak256("playback"),
            keccak256("revenue"),
            1,
            1,
            1
        );
    }

    function testPlaybackEpochCannotBeCommittedTwice() public {
        vm.prank(SUBMITTER);
        settlement.commitSettlementEpoch(
            keccak256("first"),
            7,
            keccak256("playback-1"),
            keccak256("revenue-1"),
            10,
            1000,
            100
        );

        vm.expectRevert(CreativeErrors420.AlreadyExists.selector);
        vm.prank(SUBMITTER);
        settlement.commitSettlementEpoch(
            keccak256("second"),
            7,
            keccak256("playback-2"),
            keccak256("revenue-2"),
            20,
            2000,
            200
        );
    }

    function testSettlementIdCannotReplay() public {
        bytes32 settlementId = keccak256("same-settlement");
        vm.prank(SUBMITTER);
        settlement.commitSettlementEpoch(
            settlementId,
            9,
            keccak256("playback-1"),
            keccak256("revenue-1"),
            10,
            1000,
            100
        );

        vm.expectRevert(CreativeErrors420.AlreadyExists.selector);
        vm.prank(SUBMITTER);
        settlement.commitSettlementEpoch(
            settlementId,
            10,
            keccak256("playback-2"),
            keccak256("revenue-2"),
            20,
            2000,
            200
        );
    }

    function testOnlyGovernanceCanFinalize() public {
        bytes32 settlementId = keccak256("governance-finalization");
        vm.prank(SUBMITTER);
        settlement.commitSettlementEpoch(
            settlementId,
            11,
            keccak256("playback"),
            keccak256("revenue"),
            1,
            1,
            1
        );

        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(SUBMITTER);
        settlement.finalizeSettlementEpoch(settlementId);
    }

    function testZeroOrEmptyAccountingInputsFailClosed() public {
        vm.expectRevert(CreativeErrors420.InvalidId.selector);
        vm.prank(SUBMITTER);
        settlement.commitSettlementEpoch(
            bytes32(0),
            1,
            keccak256("playback"),
            keccak256("revenue"),
            1,
            1,
            1
        );

        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        vm.prank(SUBMITTER);
        settlement.commitSettlementEpoch(
            keccak256("zero-metrics"),
            2,
            keccak256("playback"),
            keccak256("revenue"),
            0,
            1,
            1
        );
    }
}
