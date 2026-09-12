// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/economics/StreamingRoyaltySettlement420.sol";

interface VmStreamingRoyaltySettlement420 {
    function expectRevert(bytes4 selector) external;
    function deal(address who, uint256 newBalance) external;
}

contract MockStreamingAllocatorRoyalty420 is IStreamingRevenueAllocatorRoyalty420 {
    mapping(bytes32 => bool) public override allocatedSettlement;
    mapping(bytes32 => mapping(uint256 => RecordingAllocation420)) internal allocations;

    function seed(
        bytes32 settlementId,
        RecordingId recordingId,
        uint256 playCount,
        uint256 qualifiedMs,
        uint256 revenue
    ) external {
        allocatedSettlement[settlementId] = true;
        allocations[settlementId][RecordingId.unwrap(recordingId)] = RecordingAllocation420({
            playCount: playCount,
            qualifiedMs: qualifiedMs,
            revenue: revenue
        });
    }

    function allocation(bytes32 settlementId, RecordingId recordingId)
        external
        view
        override
        returns (RecordingAllocation420 memory)
    {
        RecordingAllocation420 memory result = allocations[settlementId][RecordingId.unwrap(recordingId)];
        if (result.qualifiedMs == 0) revert CreativeErrors420.NotFound();
        return result;
    }
}

contract MockStreamingRoyaltyRouter420 is IStreamingRoyaltyRouter420 {
    RecordingId public lastRecordingId;
    RevenueType public lastRevenueType;
    bytes32 public lastSettlementId;
    uint256 public lastValue;
    bool public shouldRevert;

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function route(RecordingId recordingId, RevenueType revenueType, bytes32 settlementId) external payable override {
        if (shouldRevert) revert CreativeErrors420.InvalidState();
        lastRecordingId = recordingId;
        lastRevenueType = revenueType;
        lastSettlementId = settlementId;
        lastValue = msg.value;
    }
}

contract StreamingRoyaltySettlement420Test {
    VmStreamingRoyaltySettlement420 private constant vm =
        VmStreamingRoyaltySettlement420(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockStreamingAllocatorRoyalty420 private allocator;
    MockStreamingRoyaltyRouter420 private router;
    StreamingRoyaltySettlement420 private settlement;

    function setUp() public {
        allocator = new MockStreamingAllocatorRoyalty420();
        router = new MockStreamingRoyaltyRouter420();
        settlement = new StreamingRoyaltySettlement420(address(allocator), address(router));
        vm.deal(address(this), 100 ether);
    }

    function testRoutesExactAllocationAsStreamRevenue() public {
        bytes32 settlementId = keccak256("hz4-stream-settlement");
        RecordingId recordingId = RecordingId.wrap(42);
        allocator.seed(settlementId, recordingId, 420, 8_400_000, 4.2 ether);

        bytes32 expectedRouteId = settlement.routeId(settlementId, recordingId);
        settlement.routeRecording{value: 4.2 ether}(settlementId, recordingId);

        require(RecordingId.unwrap(router.lastRecordingId()) == 42, "recording");
        require(router.lastRevenueType() == RevenueType.STREAM, "revenue type");
        require(router.lastSettlementId() == expectedRouteId, "route id");
        require(router.lastValue() == 4.2 ether, "value");
        require(settlement.routed(settlementId, 42), "not marked routed");
        require(settlement.routedRevenueOf(settlementId) == 4.2 ether, "routed revenue");
    }

    function testRouteIdIsDeterministicAndRecordingScoped() public view {
        bytes32 settlementId = keccak256("scope");
        bytes32 first = settlement.routeId(settlementId, RecordingId.wrap(1));
        bytes32 again = settlement.routeId(settlementId, RecordingId.wrap(1));
        bytes32 second = settlement.routeId(settlementId, RecordingId.wrap(2));
        require(first == again, "not deterministic");
        require(first != second, "not recording scoped");
    }

    function testCannotRouteBeforeSettlementWasAllocated() public {
        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        settlement.routeRecording{value: 1 ether}(keccak256("missing"), RecordingId.wrap(1));
    }

    function testRequiresExactAllocatedRevenue() public {
        bytes32 settlementId = keccak256("exact-value");
        RecordingId recordingId = RecordingId.wrap(7);
        allocator.seed(settlementId, recordingId, 10, 1000, 2 ether);

        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        settlement.routeRecording{value: 1 ether}(settlementId, recordingId);

        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        settlement.routeRecording{value: 3 ether}(settlementId, recordingId);
    }

    function testCannotRouteSameRecordingAllocationTwice() public {
        bytes32 settlementId = keccak256("replay");
        RecordingId recordingId = RecordingId.wrap(9);
        allocator.seed(settlementId, recordingId, 10, 1000, 1 ether);

        settlement.routeRecording{value: 1 ether}(settlementId, recordingId);

        vm.expectRevert(CreativeErrors420.AlreadyExists.selector);
        settlement.routeRecording{value: 1 ether}(settlementId, recordingId);
    }

    function testDownstreamRouterFailureRollsBackRouteState() public {
        bytes32 settlementId = keccak256("router-revert");
        RecordingId recordingId = RecordingId.wrap(11);
        allocator.seed(settlementId, recordingId, 10, 1000, 1 ether);
        router.setShouldRevert(true);

        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        settlement.routeRecording{value: 1 ether}(settlementId, recordingId);

        require(!settlement.routed(settlementId, 11), "route state persisted");
        require(settlement.routedRevenueOf(settlementId) == 0, "revenue state persisted");
    }

    function testZeroIdsFailClosed() public {
        vm.expectRevert(CreativeErrors420.InvalidId.selector);
        settlement.routeRecording(bytes32(0), RecordingId.wrap(1));

        vm.expectRevert(CreativeErrors420.InvalidId.selector);
        settlement.routeId(keccak256("valid"), RecordingId.wrap(0));
    }
}
