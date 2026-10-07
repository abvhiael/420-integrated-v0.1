// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/economics/HzStreamEconomicsPlan420.sol";
import "../src/creative/economics/RoyaltyScheduleRegistry420.sol";
import "../src/creative/economics/RoyaltyRouter420.sol";

interface VmHzStreamEconomics420Test {
    function prank(
        address msgSender
    ) external;

    function deal(
        address who,
        uint256 newBalance
    ) external;
}

contract MockHzStreamRecordings420 is IRouterRecordingRegistry420 {
    struct Context {
        WorkId workId;
        RecordingId parentId;
        RecordingClass class_;
        uint32 scheduleVersion;
        AssetStatus status;
    }

    mapping(uint256 => Context) private _contexts;

    function set(
        uint256 recordingId,
        uint256 workId,
        uint256 parentId,
        RecordingClass class_,
        uint32 scheduleVersion,
        AssetStatus status
    ) external {
        _contexts[recordingId] = Context({
            workId: WorkId.wrap(workId),
            parentId: RecordingId.wrap(parentId),
            class_: class_,
            scheduleVersion: scheduleVersion,
            status: status
        });
    }

    function royaltyContext(
        RecordingId recordingId
    )
        external
        view
        returns (WorkId workId, RecordingId parentRecordingId, RecordingClass recordingClass, uint32 scheduleVersion)
    {
        Context storage c = _contexts[RecordingId.unwrap(recordingId)];
        return (c.workId, c.parentId, c.class_, c.scheduleVersion);
    }

    function statusOf(
        RecordingId recordingId
    ) external view returns (AssetStatus) {
        return _contexts[RecordingId.unwrap(recordingId)].status;
    }
}

contract MockHzStreamVault420 is IRouterRoyaltyVault420 {
    mapping(bytes32 => uint256) public poolReceived;
    uint256 public treasuryReceived;

    function depositPool(
        bytes32 assetKey
    ) external payable {
        poolReceived[assetKey] += msg.value;
    }

    function depositTreasury() external payable {
        treasuryReceived += msg.value;
    }
}

contract HzStreamEconomics420Test {
    VmHzStreamEconomics420Test private constant vm =
        VmHzStreamEconomics420Test(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant UNAUTHORIZED = address(0xBAD);
    uint256 private constant WORK_ID = 11;
    uint256 private constant ORIGINAL_ID = 1;
    uint256 private constant REMIX_ID = 2;

    RoyaltyScheduleRegistry420 private schedules;
    MockHzStreamRecordings420 private recordings;
    MockHzStreamVault420 private vault;
    RoyaltyRouter420 private router;

    function setUp() public {
        vm.deal(address(this), 1_000 ether);

        schedules = new RoyaltyScheduleRegistry420(address(this));
        recordings = new MockHzStreamRecordings420();
        vault = new MockHzStreamVault420();
        router = new RoyaltyRouter420(address(this), address(recordings), address(schedules), address(vault));

        recordings.set(ORIGINAL_ID, WORK_ID, 0, RecordingClass.ORIGINAL, 1, AssetStatus.ACTIVE);
        recordings.set(REMIX_ID, WORK_ID, ORIGINAL_ID, RecordingClass.REMIX, 1, AssetStatus.ACTIVE);

        router.setSettlementSource(address(this), true);
    }

    function testStreamV1SchedulesMatchCanonicalTermsAndCommitments() public {
        _registerCanonicalSchedules();

        RoyaltySchedule420 memory original = schedules.schedule(RecordingClass.ORIGINAL, RevenueType.STREAM, 1);
        RoyaltySchedule420 memory remix = schedules.schedule(RecordingClass.REMIX, RevenueType.STREAM, 1);

        _assertSchedule(
            original,
            RecordingClass.ORIGINAL,
            1_250,
            0,
            8_500,
            250,
            HzStreamEconomicsPlan420.originalSchedule().termsHash
        );
        _assertSchedule(
            remix, RecordingClass.REMIX, 1_000, 1_500, 7_250, 250, HzStreamEconomicsPlan420.remixSchedule().termsHash
        );

        bytes32 originalExpected = keccak256(
            abi.encode(
                "420.hz.stream.schedule.v1",
                RecordingClass.ORIGINAL,
                RevenueType.STREAM,
                uint16(1_250),
                uint16(0),
                uint16(8_500),
                uint16(250),
                uint32(1),
                uint64(0)
            )
        );
        bytes32 remixExpected = keccak256(
            abi.encode(
                "420.hz.stream.schedule.v1",
                RecordingClass.REMIX,
                RevenueType.STREAM,
                uint16(1_000),
                uint16(1_500),
                uint16(7_250),
                uint16(250),
                uint32(1),
                uint64(0)
            )
        );

        require(original.termsHash == originalExpected, "original/terms-hash");
        require(remix.termsHash == remixExpected, "remix/terms-hash");
        require(original.termsHash != remix.termsHash, "terms-hash/collision");
    }

    function testStreamRoutingPreservesCanonicalOriginalAndRemixSplits() public {
        _registerCanonicalSchedules();

        router.route{ value: 100 ether }(
            RecordingId.wrap(ORIGINAL_ID), RevenueType.STREAM, keccak256("hz-audit-4/original")
        );

        bytes32 workKey = CreativeAssetKeys420.key(CreativeAssetType.WORK, WORK_ID);
        bytes32 originalKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, ORIGINAL_ID);
        bytes32 remixKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, REMIX_ID);

        require(vault.poolReceived(workKey) == 12.5 ether, "original/work");
        require(vault.poolReceived(originalKey) == 85 ether, "original/current");
        require(vault.treasuryReceived() == 2.5 ether, "original/protocol");

        router.route{value: 100 ether}(
            RecordingId.wrap(REMIX_ID), RevenueType.STREAM, keccak256("hz-audit-4/remix")
        );

        require(vault.poolReceived(workKey) == 22.5 ether, "combined/work");
        require(vault.poolReceived(originalKey) == 100 ether, "remix/source");
        require(vault.poolReceived(remixKey) == 72.5 ether, "remix/current");
        require(vault.treasuryReceived() == 5 ether, "combined/protocol");

        require(
            vault.poolReceived(workKey) + vault.poolReceived(originalKey) + vault.poolReceived(remixKey)
                    + vault.treasuryReceived() == 200 ether,
            "gross/conservation"
        );
    }

    function testGovernanceOnlyRegistrationAndDuplicateVersionFailClosed() public {
        RoyaltySchedule420 memory original = HzStreamEconomicsPlan420.originalSchedule();

        vm.prank(UNAUTHORIZED);
        (bool unauthorized,) = address(schedules)
            .call(
                abi.encodeCall(
                    RoyaltyScheduleRegistry420.registerSchedule, (RecordingClass.ORIGINAL, RevenueType.STREAM, original)
                )
            );
        require(!unauthorized, "unauthorized/register");

        schedules.registerSchedule(RecordingClass.ORIGINAL, RevenueType.STREAM, original);

        (bool replay,) = address(schedules)
            .call(
                abi.encodeCall(
                    RoyaltyScheduleRegistry420.registerSchedule, (RecordingClass.ORIGINAL, RevenueType.STREAM, original)
                )
            );
        require(!replay, "duplicate/version-replay");
    }

    function testUnsupportedRecordingClassesHaveNoStreamSchedule() public {
        require(HzStreamEconomicsPlan420.isSupported(RecordingClass.ORIGINAL), "original/support");
        require(HzStreamEconomicsPlan420.isSupported(RecordingClass.REMIX), "remix/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.COVER), "cover/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.STEM_REMIX), "stem/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.SAMPLE_DERIVATIVE), "sample/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.AI_DERIVATIVE), "ai/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.LIVE), "live/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.ACOUSTIC), "acoustic/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.REMASTER), "remaster/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.RADIO_EDIT), "radio/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.CLEAN_EDIT), "clean/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.SPATIAL), "spatial/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.RESTORATION), "restoration/support");
        require(!HzStreamEconomicsPlan420.isSupported(RecordingClass.OTHER), "other/support");

        _registerCanonicalSchedules();

        (bool found,) = address(schedules)
            .call(
                abi.encodeCall(
                    RoyaltyScheduleRegistry420.schedule, (RecordingClass.COVER, RevenueType.STREAM, uint32(1))
                )
            );
        require(!found, "unsupported/schedule-exists");
    }

    function testInvalidEconomicSchedulesFailClosed() public {
        RoyaltySchedule420 memory invalidTotal = RoyaltySchedule420({
            workBps: 1_250,
            sourceBps: 0,
            currentRecordingBps: 8_499,
            protocolBps: 250,
            version: 1,
            effectiveAt: 0,
            termsHash: keccak256("invalid-total")
        });

        (bool totalOk,) = address(schedules)
            .call(
                abi.encodeCall(
                    RoyaltyScheduleRegistry420.registerSchedule,
                    (RecordingClass.ORIGINAL, RevenueType.STREAM, invalidTotal)
                )
            );
        require(!totalOk, "invalid-total/accepted");

        RoyaltySchedule420 memory excessiveProtocol = RoyaltySchedule420({
            workBps: 1_000,
            sourceBps: 1_500,
            currentRecordingBps: 6_900,
            protocolBps: 600,
            version: 1,
            effectiveAt: 0,
            termsHash: keccak256("excessive-protocol")
        });

        (bool feeOk,) = address(schedules)
            .call(
                abi.encodeCall(
                    RoyaltyScheduleRegistry420.registerSchedule,
                    (RecordingClass.REMIX, RevenueType.STREAM, excessiveProtocol)
                )
            );
        require(!feeOk, "protocol-cap/accepted");
    }

    function _registerCanonicalSchedules() private {
        schedules.registerSchedule(
            RecordingClass.ORIGINAL, RevenueType.STREAM, HzStreamEconomicsPlan420.originalSchedule()
        );
        schedules.registerSchedule(RecordingClass.REMIX, RevenueType.STREAM, HzStreamEconomicsPlan420.remixSchedule());
    }

    function _assertSchedule(
        RoyaltySchedule420 memory schedule_,
        RecordingClass class_,
        uint16 workBps,
        uint16 sourceBps,
        uint16 currentBps,
        uint16 protocolBps,
        bytes32 termsHash
    ) private pure {
        require(schedule_.workBps == workBps, "schedule/work");
        require(schedule_.sourceBps == sourceBps, "schedule/source");
        require(schedule_.currentRecordingBps == currentBps, "schedule/current");
        require(schedule_.protocolBps == protocolBps, "schedule/protocol");
        require(schedule_.version == 1, "schedule/version");
        require(schedule_.effectiveAt == 0, "schedule/effective-at");
        require(schedule_.termsHash == termsHash, "schedule/terms");
        require(
            uint256(schedule_.workBps) + schedule_.sourceBps + schedule_.currentRecordingBps + schedule_.protocolBps
                == CreativeConstants420.BPS_DENOMINATOR,
            class_ == RecordingClass.ORIGINAL ? "original/total" : "remix/total"
        );
        require(schedule_.protocolBps <= CreativeConstants420.MAX_PROTOCOL_FEE_BPS, "schedule/protocol-cap");
    }

    receive() external payable { }
}
