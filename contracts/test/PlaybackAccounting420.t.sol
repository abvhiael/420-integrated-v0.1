// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/media/PlaybackAccounting420.sol";

interface VmPlaybackAccounting420 {
    function prank(address msgSender) external;
    function expectRevert(bytes4 selector) external;
}

contract MockPlaybackAccountingRecordings420 {
    mapping(uint256 => AssetStatus) public status;

    function setStatus(RecordingId recordingId, AssetStatus status_) external {
        status[RecordingId.unwrap(recordingId)] = status_;
    }

    function statusOf(RecordingId recordingId) external view returns (AssetStatus) {
        return status[RecordingId.unwrap(recordingId)];
    }
}

contract PlaybackAccounting420Test {
    VmPlaybackAccounting420 private constant vm = VmPlaybackAccounting420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOVERNANCE = address(0x420);
    address private constant SUBMITTER = address(0xBEEF);
    address private constant STRANGER = address(0xBAD);

    RecordingId private constant TRACK_ONE = RecordingId.wrap(11);
    RecordingId private constant TRACK_TWO = RecordingId.wrap(12);

    MockPlaybackAccountingRecordings420 private recordings;
    PlaybackAccounting420 private accounting;

    function setUp() public {
        recordings = new MockPlaybackAccountingRecordings420();
        recordings.setStatus(TRACK_ONE, AssetStatus.ACTIVE);
        recordings.setStatus(TRACK_TWO, AssetStatus.ACTIVE);
        accounting = new PlaybackAccounting420(GOVERNANCE, address(recordings));

        vm.prank(GOVERNANCE);
        accounting.setSubmitter(SUBMITTER, true);
    }

    function testAuthorizedSubmitterBatchesAndAggregatesPlayback() public {
        RecordingId[] memory ids = new RecordingId[](2);
        ids[0] = TRACK_ONE;
        ids[1] = TRACK_TWO;
        uint64[] memory plays = new uint64[](2);
        plays[0] = 10;
        plays[1] = 5;
        uint64[] memory msPlayed = new uint64[](2);
        msPlayed[0] = 600_000;
        msPlayed[1] = 300_000;

        vm.prank(SUBMITTER);
        accounting.submitPlaybackBatch(keccak256("batch-1"), 1, keccak256("events-1"), ids, plays, msPlayed);

        PlaybackAccounting420.RecordingAggregate420 memory epochOne = accounting.epochAggregate(1, TRACK_ONE);
        require(epochOne.playCount == 10, "epoch plays");
        require(epochOne.qualifiedMs == 600_000, "epoch ms");

        PlaybackAccounting420.RecordingAggregate420 memory lifetime = accounting.lifetimeAggregate(TRACK_TWO);
        require(lifetime.playCount == 5, "lifetime plays");
        require(lifetime.qualifiedMs == 300_000, "lifetime ms");
    }

    function testBatchReplayIsRejected() public {
        (RecordingId[] memory ids, uint64[] memory plays, uint64[] memory msPlayed) = _singleTrackBatch();
        bytes32 batchId = keccak256("same-batch");

        vm.prank(SUBMITTER);
        accounting.submitPlaybackBatch(batchId, 1, keccak256("events"), ids, plays, msPlayed);

        vm.expectRevert(CreativeErrors420.AlreadyExists.selector);
        vm.prank(SUBMITTER);
        accounting.submitPlaybackBatch(batchId, 1, keccak256("events"), ids, plays, msPlayed);
    }

    function testUnauthorizedSubmitterRejected() public {
        (RecordingId[] memory ids, uint64[] memory plays, uint64[] memory msPlayed) = _singleTrackBatch();
        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(STRANGER);
        accounting.submitPlaybackBatch(keccak256("batch"), 1, keccak256("events"), ids, plays, msPlayed);
    }

    function testInactiveRecordingRejected() public {
        recordings.setStatus(TRACK_ONE, AssetStatus.WITHDRAWN);
        (RecordingId[] memory ids, uint64[] memory plays, uint64[] memory msPlayed) = _singleTrackBatch();
        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        vm.prank(SUBMITTER);
        accounting.submitPlaybackBatch(keccak256("batch"), 1, keccak256("events"), ids, plays, msPlayed);
    }

    function testDuplicateRecordingWithinBatchRejected() public {
        RecordingId[] memory ids = new RecordingId[](2);
        ids[0] = TRACK_ONE;
        ids[1] = TRACK_ONE;
        uint64[] memory plays = new uint64[](2);
        plays[0] = 1;
        plays[1] = 2;
        uint64[] memory msPlayed = new uint64[](2);
        msPlayed[0] = 1_000;
        msPlayed[1] = 2_000;

        vm.expectRevert(CreativeErrors420.AlreadyExists.selector);
        vm.prank(SUBMITTER);
        accounting.submitPlaybackBatch(keccak256("dup"), 1, keccak256("events"), ids, plays, msPlayed);
    }

    function testGovernanceControlsSubmitters() public {
        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(STRANGER);
        accounting.setSubmitter(STRANGER, true);

        vm.prank(GOVERNANCE);
        accounting.setSubmitter(SUBMITTER, false);

        (RecordingId[] memory ids, uint64[] memory plays, uint64[] memory msPlayed) = _singleTrackBatch();
        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(SUBMITTER);
        accounting.submitPlaybackBatch(keccak256("revoked"), 1, keccak256("events"), ids, plays, msPlayed);
    }

    function _singleTrackBatch()
        private
        pure
        returns (RecordingId[] memory ids, uint64[] memory plays, uint64[] memory msPlayed)
    {
        ids = new RecordingId[](1);
        ids[0] = TRACK_ONE;
        plays = new uint64[](1);
        plays[0] = 3;
        msPlayed = new uint64[](1);
        msPlayed[0] = 180_000;
    }
}
