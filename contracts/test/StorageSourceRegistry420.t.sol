// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/media/StorageSourceRegistry420.sol";

interface VmStorage420 {
    function prank(address msgSender) external;
    function expectRevert(bytes4 selector) external;
}

contract MockStorageProfiles420 {
    mapping(uint256 => address) public ownerOf;
    function setOwner(CreatorId creatorId, address owner) external { ownerOf[CreatorId.unwrap(creatorId)] = owner; }
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool) {
        return ownerOf[CreatorId.unwrap(creatorId)] == account;
    }
}

contract MockStorageRecordings420 {
    mapping(uint256 => AssetStatus) public status;
    mapping(uint256 => CreatorId) public creator;
    function configure(RecordingId recordingId, CreatorId creatorId, AssetStatus status_) external {
        status[RecordingId.unwrap(recordingId)] = status_;
        creator[RecordingId.unwrap(recordingId)] = creatorId;
    }
    function statusOf(RecordingId recordingId) external view returns (AssetStatus) { return status[RecordingId.unwrap(recordingId)]; }
    function registrantProfileOf(RecordingId recordingId) external view returns (CreatorId) { return creator[RecordingId.unwrap(recordingId)]; }
}

contract StorageSourceRegistry420Test {
    VmStorage420 private constant vm = VmStorage420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ARTIST = address(0xA11CE);
    address private constant STRANGER = address(0xBAD);
    CreatorId private constant ARTIST_ID = CreatorId.wrap(1);
    RecordingId private constant RECORDING = RecordingId.wrap(7);

    MockStorageProfiles420 private profiles;
    MockStorageRecordings420 private recordings;
    StorageSourceRegistry420 private registry;

    function setUp() public {
        profiles = new MockStorageProfiles420();
        recordings = new MockStorageRecordings420();
        registry = new StorageSourceRegistry420(address(recordings), address(profiles));
        profiles.setOwner(ARTIST_ID, ARTIST);
        recordings.configure(RECORDING, ARTIST_ID, AssetStatus.ACTIVE);
    }

    function testCreatorAddsReplicaAndResolverPrefersLowestPriority() public {
        vm.prank(ARTIST);
        uint64 first = registry.addSource(RECORDING, keccak256("IPFS"), keccak256("cid-a"), keccak256("audio"), keccak256("proof-a"), 20);
        vm.prank(ARTIST);
        uint64 second = registry.addSource(RECORDING, keccak256("420STORAGE"), keccak256("locator-b"), keccak256("audio"), keccak256("proof-b"), 5);

        (uint64 sourceId, StorageSourceRegistry420.StorageSource420 memory best) = registry.bestAvailableSource(RECORDING);
        require(sourceId == second, "wrong fallback priority");
        require(best.priority == 5, "wrong priority");
        require(first != second, "source ids must differ");
    }

    function testUnavailablePrimaryFallsBackToReplica() public {
        vm.prank(ARTIST);
        uint64 primary = registry.addSource(RECORDING, keccak256("A"), keccak256("a"), keccak256("audio"), keccak256("proof-a"), 1);
        vm.prank(ARTIST);
        uint64 fallbackId = registry.addSource(RECORDING, keccak256("B"), keccak256("b"), keccak256("audio"), keccak256("proof-b"), 10);

        vm.prank(ARTIST);
        registry.updateSourceState(RECORDING, primary, StorageSourceRegistry420.SourceState.UNAVAILABLE, keccak256("failed-check"));

        (uint64 selected,) = registry.bestAvailableSource(RECORDING);
        require(selected == fallbackId, "did not fail over");
    }

    function testMigrationRetiresOldSourceWithoutChangingRecordingIdentity() public {
        vm.prank(ARTIST);
        uint64 oldId = registry.addSource(RECORDING, keccak256("OLD"), keccak256("old"), keccak256("audio"), keccak256("proof-old"), 1);
        vm.prank(ARTIST);
        uint64 newId = registry.migrateSource(
            RECORDING,
            oldId,
            keccak256("NEW"),
            keccak256("new"),
            keccak256("audio"),
            keccak256("proof-new"),
            1
        );

        StorageSourceRegistry420.StorageSource420 memory oldSource = registry.source(RECORDING, oldId);
        StorageSourceRegistry420.StorageSource420 memory newSource = registry.source(RECORDING, newId);
        require(oldSource.state == StorageSourceRegistry420.SourceState.RETIRED, "old source not retired");
        require(newSource.state == StorageSourceRegistry420.SourceState.ACTIVE, "replacement not active");
        require(newSource.contentHash == keccak256("audio"), "content identity changed");
    }

    function testUnauthorizedAccountCannotManageSources() public {
        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(STRANGER);
        registry.addSource(RECORDING, keccak256("A"), keccak256("a"), keccak256("audio"), keccak256("proof"), 1);
    }

    function testInactiveRecordingFailsClosed() public {
        recordings.configure(RECORDING, ARTIST_ID, AssetStatus.PROVISIONAL);
        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        vm.prank(ARTIST);
        registry.addSource(RECORDING, keccak256("A"), keccak256("a"), keccak256("audio"), keccak256("proof"), 1);
    }

    function testRetiredSourceCannotBeReactivated() public {
        vm.prank(ARTIST);
        uint64 oldId = registry.addSource(RECORDING, keccak256("OLD"), keccak256("old"), keccak256("audio"), keccak256("proof-old"), 1);
        vm.prank(ARTIST);
        registry.migrateSource(RECORDING, oldId, keccak256("NEW"), keccak256("new"), keccak256("audio"), keccak256("proof-new"), 1);

        vm.expectRevert(CreativeErrors420.InvalidTransition.selector);
        vm.prank(ARTIST);
        registry.updateSourceState(RECORDING, oldId, StorageSourceRegistry420.SourceState.ACTIVE, keccak256("proof"));
    }
}
