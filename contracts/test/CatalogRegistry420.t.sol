// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/catalog/CatalogRegistry420.sol";

interface VmCatalog420 {
    function prank(address msgSender) external;
    function expectRevert(bytes4 selector) external;
}

contract MockCatalogProfiles420 {
    mapping(uint256 => address) public ownerOf;

    function setOwner(CreatorId creatorId, address owner) external {
        ownerOf[CreatorId.unwrap(creatorId)] = owner;
    }

    function isAuthorized(CreatorId creatorId, address account) external view returns (bool) {
        return ownerOf[CreatorId.unwrap(creatorId)] == account;
    }
}

contract MockCatalogRecordings420 {
    mapping(uint256 => AssetStatus) public status;

    function setStatus(RecordingId recordingId, AssetStatus status_) external {
        status[RecordingId.unwrap(recordingId)] = status_;
    }

    function statusOf(RecordingId recordingId) external view returns (AssetStatus) {
        return status[RecordingId.unwrap(recordingId)];
    }
}

contract CatalogRegistry420Test {
    VmCatalog420 private constant vm = VmCatalog420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant ARTIST = address(0xA11CE);
    address private constant STRANGER = address(0xBAD);
    CreatorId private constant ARTIST_ID = CreatorId.wrap(1);
    RecordingId private constant TRACK_ONE = RecordingId.wrap(11);
    RecordingId private constant TRACK_TWO = RecordingId.wrap(12);

    MockCatalogProfiles420 private profiles;
    MockCatalogRecordings420 private recordings;
    CatalogRegistry420 private catalog;

    function setUp() public {
        profiles = new MockCatalogProfiles420();
        recordings = new MockCatalogRecordings420();
        catalog = new CatalogRegistry420(address(profiles), address(recordings));
        profiles.setOwner(ARTIST_ID, ARTIST);
        recordings.setStatus(TRACK_ONE, AssetStatus.ACTIVE);
        recordings.setStatus(TRACK_TWO, AssetStatus.ACTIVE);
    }

    function testCreatorBuildsAndPublishesOrderedRelease() public {
        uint256 releaseId = _createAlbum();

        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_ONE);
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_TWO);

        require(catalog.trackCount(releaseId) == 2, "track count");
        require(RecordingId.unwrap(catalog.trackAt(releaseId, 0)) == RecordingId.unwrap(TRACK_ONE), "track one order");
        require(RecordingId.unwrap(catalog.trackAt(releaseId, 1)) == RecordingId.unwrap(TRACK_TWO), "track two order");

        vm.prank(ARTIST);
        catalog.publishRelease(releaseId);
        CatalogRegistry420.Release420 memory release_ = catalog.release(releaseId);
        require(release_.status == CatalogRegistry420.ReleaseStatus.PUBLISHED, "not published");
        require(release_.publishedAt != 0, "missing publication timestamp");
    }

    function testUnauthorizedAccountCannotMutateCatalog() public {
        uint256 releaseId = _createAlbum();
        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(STRANGER);
        catalog.addTrack(releaseId, TRACK_ONE);
    }

    function testOnlyActiveRecordingsCanEnterCatalog() public {
        uint256 releaseId = _createAlbum();
        recordings.setStatus(TRACK_ONE, AssetStatus.PROVISIONAL);
        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_ONE);
    }

    function testDuplicateTrackIsRejected() public {
        uint256 releaseId = _createAlbum();
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_ONE);
        vm.expectRevert(CreativeErrors420.AlreadyExists.selector);
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_ONE);
    }

    function testPublishedReleaseIsCatalogImmutable() public {
        uint256 releaseId = _createAlbum();
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_ONE);
        vm.prank(ARTIST);
        catalog.publishRelease(releaseId);

        vm.expectRevert(CreativeErrors420.InvalidTransition.selector);
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_TWO);

        vm.expectRevert(CreativeErrors420.InvalidTransition.selector);
        vm.prank(ARTIST);
        catalog.updateMetadata(releaseId, keccak256("changed"), keccak256("changed-art"));
    }

    function testPublishRevalidatesRecordingStatus() public {
        uint256 releaseId = _createAlbum();
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_ONE);
        recordings.setStatus(TRACK_ONE, AssetStatus.WITHDRAWN);

        vm.expectRevert(CreativeErrors420.InvalidState.selector);
        vm.prank(ARTIST);
        catalog.publishRelease(releaseId);
    }

    function testPublishedReleaseCanBeWithdrawnButNotRepublished() public {
        uint256 releaseId = _createAlbum();
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_ONE);
        vm.prank(ARTIST);
        catalog.publishRelease(releaseId);
        vm.prank(ARTIST);
        catalog.withdrawRelease(releaseId);

        CatalogRegistry420.Release420 memory release_ = catalog.release(releaseId);
        require(release_.status == CatalogRegistry420.ReleaseStatus.WITHDRAWN, "not withdrawn");

        vm.expectRevert(CreativeErrors420.InvalidTransition.selector);
        vm.prank(ARTIST);
        catalog.publishRelease(releaseId);
    }

    function testDraftTrackCanBeRemovedWithoutReorderingRemainingTracks() public {
        uint256 releaseId = _createAlbum();
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_ONE);
        vm.prank(ARTIST);
        catalog.addTrack(releaseId, TRACK_TWO);
        vm.prank(ARTIST);
        catalog.removeTrack(releaseId, TRACK_ONE);

        require(catalog.trackCount(releaseId) == 1, "bad count");
        require(RecordingId.unwrap(catalog.trackAt(releaseId, 0)) == RecordingId.unwrap(TRACK_TWO), "bad remaining order");
        require(!catalog.containsTrack(releaseId, TRACK_ONE), "removed track retained");
    }

    function _createAlbum() private returns (uint256 releaseId) {
        vm.prank(ARTIST);
        return catalog.createRelease(
            ARTIST_ID,
            CatalogRegistry420.ReleaseType.ALBUM,
            keccak256("album-metadata-v1"),
            keccak256("album-art-v1")
        );
    }
}
