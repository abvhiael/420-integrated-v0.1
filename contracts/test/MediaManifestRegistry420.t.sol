// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/media/MediaManifestRegistry420.sol";

interface VmMedia420 {
    function prank(address msgSender) external;
    function expectRevert(bytes4 selector) external;
}

contract MockMediaProfiles420 {
    mapping(uint256 => address) public ownerOf;
    function setOwner(CreatorId creatorId, address owner) external { ownerOf[CreatorId.unwrap(creatorId)] = owner; }
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool) {
        return ownerOf[CreatorId.unwrap(creatorId)] == account;
    }
}

contract MockMediaRecordings420 {
    mapping(uint256 => AssetStatus) public status;
    mapping(uint256 => CreatorId) public creator;
    function setRecording(RecordingId recordingId, CreatorId creatorId, AssetStatus status_) external {
        status[RecordingId.unwrap(recordingId)] = status_;
        creator[RecordingId.unwrap(recordingId)] = creatorId;
    }
    function statusOf(RecordingId recordingId) external view returns (AssetStatus) {
        return status[RecordingId.unwrap(recordingId)];
    }
    function registrantProfileOf(RecordingId recordingId) external view returns (CreatorId) {
        return creator[RecordingId.unwrap(recordingId)];
    }
}

contract MediaManifestRegistry420Test {
    VmMedia420 private constant vm = VmMedia420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ARTIST = address(0xA11CE);
    address private constant STRANGER = address(0xBAD);
    CreatorId private constant ARTIST_ID = CreatorId.wrap(1);
    RecordingId private constant RECORDING = RecordingId.wrap(101);

    MockMediaProfiles420 private profiles;
    MockMediaRecordings420 private recordings;
    MediaManifestRegistry420 private registry;

    function setUp() public {
        profiles = new MockMediaProfiles420();
        recordings = new MockMediaRecordings420();
        profiles.setOwner(ARTIST_ID, ARTIST);
        recordings.setRecording(RECORDING, ARTIST_ID, AssetStatus.ACTIVE);
        registry = new MediaManifestRegistry420(address(recordings), address(profiles));
    }

    function testAuthorizedCreatorPublishesVersionedManifest() public {
        vm.prank(ARTIST);
        registry.publishMediaManifest(
            RECORDING,
            keccak256("manifest-v1"), keccak256("master-v1"), keccak256("tech-v1"),
            keccak256("storage-v1"), keccak256("provenance-v1"), 240000
        );
        vm.prank(ARTIST);
        registry.publishMediaManifest(
            RECORDING,
            keccak256("manifest-v2"), keccak256("master-v2"), keccak256("tech-v2"),
            keccak256("storage-v2"), keccak256("provenance-v2"), 241000
        );

        MediaManifestRegistry420.MediaManifest420 memory current_ = registry.current(RECORDING);
        MediaManifestRegistry420.MediaManifest420 memory first = registry.revision(RECORDING, 1);
        require(current_.revision == 2, "current revision");
        require(current_.durationMs == 241000, "current duration");
        require(first.revision == 1, "history revision");
        require(first.durationMs == 240000, "history mutated");
    }

    function testUnauthorizedAccountCannotPublish() public {
        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(STRANGER);
        registry.publishMediaManifest(
            RECORDING,
            keccak256("manifest"), keccak256("master"), keccak256("tech"),
            keccak256("storage"), keccak256("provenance"), 240000
        );
    }

    function testInactiveRecordingCannotPublish() public {
        recordings.setRecording(RECORDING, ARTIST_ID, AssetStatus.PROVISIONAL);
        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        vm.prank(ARTIST);
        registry.publishMediaManifest(
            RECORDING,
            keccak256("manifest"), keccak256("master"), keccak256("tech"),
            keccak256("storage"), keccak256("provenance"), 240000
        );
    }

    function testEmptyRequiredFieldsFailClosed() public {
        vm.expectRevert(CreativeErrors420.InvalidId.selector);
        vm.prank(ARTIST);
        registry.publishMediaManifest(
            RECORDING,
            bytes32(0), keccak256("master"), keccak256("tech"),
            keccak256("storage"), keccak256("provenance"), 240000
        );
    }
}
