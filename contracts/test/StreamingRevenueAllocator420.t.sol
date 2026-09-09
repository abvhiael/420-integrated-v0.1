// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/economics/StreamingRevenueAllocator420.sol";

contract MockSettlementEpoch420 is IStreamingSettlementEpoch420 {
    mapping(bytes32 => SettlementEpoch420) private _epochs;

    function setEpoch(bytes32 settlementId, SettlementEpoch420 calldata value) external {
        _epochs[settlementId] = value;
    }

    function epoch(bytes32 settlementId) external view returns (SettlementEpoch420 memory) {
        SettlementEpoch420 memory value = _epochs[settlementId];
        if (value.state == EpochState.NONE) revert CreativeErrors420.NotFound();
        return value;
    }
}

contract MockStreamingPlaybackAccounting420 is IStreamingPlaybackAccounting420 {
    mapping(uint64 => mapping(uint256 => RecordingAggregate420)) private _aggregates;

    function setAggregate(uint64 epoch_, RecordingId recordingId, uint256 plays, uint256 qualifiedMs) external {
        _aggregates[epoch_][RecordingId.unwrap(recordingId)] = RecordingAggregate420(plays, qualifiedMs);
    }

    function epochAggregate(uint64 epoch_, RecordingId recordingId)
        external
        view
        returns (RecordingAggregate420 memory)
    {
        return _aggregates[epoch_][RecordingId.unwrap(recordingId)];
    }
}

contract StreamingRevenueAllocator420Test {
    bytes32 private constant SETTLEMENT = keccak256("hz4.2-settlement");
    RecordingId private constant TRACK_ONE = RecordingId.wrap(11);
    RecordingId private constant TRACK_TWO = RecordingId.wrap(12);
    RecordingId private constant TRACK_THREE = RecordingId.wrap(13);

    MockSettlementEpoch420 private settlements;
    MockStreamingPlaybackAccounting420 private playback;
    StreamingRevenueAllocator420 private allocator;

    function setUp() public {
        settlements = new MockSettlementEpoch420();
        playback = new MockStreamingPlaybackAccounting420();
        allocator = new StreamingRevenueAllocator420(address(settlements), address(playback));

        playback.setAggregate(7, TRACK_ONE, 10, 1000);
        playback.setAggregate(7, TRACK_TWO, 20, 2000);
        playback.setAggregate(7, TRACK_THREE, 30, 3000);
        settlements.setEpoch(
            SETTLEMENT,
            IStreamingSettlementEpoch420.SettlementEpoch420({
                playbackEpoch: 7,
                committedAt: 1,
                finalizedAt: 2,
                totalPlayCount: 60,
                totalQualifiedMs: 6000,
                grossRevenue: 101,
                playbackRoot: keccak256("playback"),
                revenueRoot: keccak256("revenue"),
                state: IStreamingSettlementEpoch420.EpochState.FINALIZED
            })
        );
    }

    function testAllocatesRevenueByQualifiedListeningAndConservesGross() public {
        RecordingId[] memory ids = _threeTracks();
        allocator.allocate(SETTLEMENT, ids);

        StreamingRevenueAllocator420.RecordingAllocation420 memory one = allocator.allocation(SETTLEMENT, TRACK_ONE);
        StreamingRevenueAllocator420.RecordingAllocation420 memory two = allocator.allocation(SETTLEMENT, TRACK_TWO);
        StreamingRevenueAllocator420.RecordingAllocation420 memory three = allocator.allocation(SETTLEMENT, TRACK_THREE);

        require(one.revenue == 16, "track one revenue");
        require(two.revenue == 33, "track two revenue");
        require(three.revenue == 52, "track three receives deterministic dust");
        require(one.revenue + two.revenue + three.revenue == 101, "revenue conservation");
        require(allocator.allocatedRevenueOf(SETTLEMENT) == 101, "allocated total");
        require(allocator.allocationRootOf(SETTLEMENT) != bytes32(0), "allocation root");
    }

    function testSettlementCannotAllocateTwice() public {
        RecordingId[] memory ids = _threeTracks();
        allocator.allocate(SETTLEMENT, ids);
        try allocator.allocate(SETTLEMENT, ids) {
            revert("expected replay failure");
        } catch (bytes memory reason) {
            require(_selector(reason) == CreativeErrors420.AlreadyExists.selector, "wrong replay revert");
        }
    }

    function testRequiresFinalizedSettlement() public {
        bytes32 pending = keccak256("pending");
        settlements.setEpoch(
            pending,
            IStreamingSettlementEpoch420.SettlementEpoch420({
                playbackEpoch: 7,
                committedAt: 1,
                finalizedAt: 0,
                totalPlayCount: 60,
                totalQualifiedMs: 6000,
                grossRevenue: 101,
                playbackRoot: keccak256("playback"),
                revenueRoot: keccak256("revenue"),
                state: IStreamingSettlementEpoch420.EpochState.COMMITTED
            })
        );
        try allocator.allocate(pending, _threeTracks()) {
            revert("expected finalized failure");
        } catch (bytes memory reason) {
            require(_selector(reason) == CreativeErrors420.InvalidState.selector, "wrong state revert");
        }
    }

    function testOmittedPlaybackAggregateFailsConservation() public {
        RecordingId[] memory ids = new RecordingId[](2);
        ids[0] = TRACK_ONE;
        ids[1] = TRACK_TWO;
        try allocator.allocate(SETTLEMENT, ids) {
            revert("expected aggregate mismatch");
        } catch (bytes memory reason) {
            require(_selector(reason) == CreativeErrors420.InvalidState.selector, "wrong aggregate revert");
        }
    }

    function testRecordingIdsMustBeStrictlyAscending() public {
        RecordingId[] memory ids = new RecordingId[](3);
        ids[0] = TRACK_TWO;
        ids[1] = TRACK_ONE;
        ids[2] = TRACK_THREE;
        try allocator.allocate(SETTLEMENT, ids) {
            revert("expected ordering failure");
        } catch (bytes memory reason) {
            require(_selector(reason) == CreativeErrors420.InvalidState.selector, "wrong ordering revert");
        }
    }

    function testCanonicalPlaybackAggregateIsAuthoritative() public {
        playback.setAggregate(7, TRACK_TWO, 20, 0);
        try allocator.allocate(SETTLEMENT, _threeTracks()) {
            revert("expected zero aggregate failure");
        } catch (bytes memory reason) {
            require(_selector(reason) == CreativeErrors420.InvalidState.selector, "wrong zero aggregate revert");
        }
    }

    function _threeTracks() private pure returns (RecordingId[] memory ids) {
        ids = new RecordingId[](3);
        ids[0] = TRACK_ONE;
        ids[1] = TRACK_TWO;
        ids[2] = TRACK_THREE;
    }

    function _selector(bytes memory reason) private pure returns (bytes4 selector) {
        if (reason.length < 4) return bytes4(0);
        assembly { selector := mload(add(reason, 32)) }
    }
}
