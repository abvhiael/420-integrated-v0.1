// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/catalog/CatalogMetadataRegistry420.sol";

interface VmCatalogMetadata420 {
    function prank(address msgSender) external;
    function expectRevert(bytes4 selector) external;
}

contract MockCatalogMetadataProfiles420 {
    mapping(uint256 => address) public ownerOf;

    function setOwner(CreatorId creatorId, address owner) external {
        ownerOf[CreatorId.unwrap(creatorId)] = owner;
    }

    function isAuthorized(CreatorId creatorId, address account) external view returns (bool) {
        return ownerOf[CreatorId.unwrap(creatorId)] == account;
    }
}

contract MockCatalogMetadataCatalog420 {
    mapping(uint256 => CreatorId) private _creatorOf;

    function setCreator(uint256 releaseId, CreatorId creatorId) external {
        _creatorOf[releaseId] = creatorId;
    }

    function creatorOf(uint256 releaseId) external view returns (CreatorId) {
        CreatorId creatorId = _creatorOf[releaseId];
        if (CreatorId.unwrap(creatorId) == 0) revert CreativeErrors420.NotFound();
        return creatorId;
    }
}

contract CatalogMetadataRegistry420Test {
    VmCatalogMetadata420 private constant vm = VmCatalogMetadata420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant ARTIST = address(0xA11CE);
    address private constant STRANGER = address(0xBAD);
    CreatorId private constant ARTIST_ID = CreatorId.wrap(1);
    uint256 private constant RELEASE_ID = 7;

    MockCatalogMetadataProfiles420 private profiles;
    MockCatalogMetadataCatalog420 private catalog;
    CatalogMetadataRegistry420 private metadata;

    function setUp() public {
        profiles = new MockCatalogMetadataProfiles420();
        catalog = new MockCatalogMetadataCatalog420();
        metadata = new CatalogMetadataRegistry420(address(profiles), address(catalog));
        profiles.setOwner(ARTIST_ID, ARTIST);
        catalog.setCreator(RELEASE_ID, ARTIST_ID);
    }

    function testCreatorCanPublishVersionedPresentationMetadata() public {
        bytes32 profileV1 = keccak256("artist-profile-v1");
        bytes32 socialV1 = keccak256("artist-socials-v1");
        vm.prank(ARTIST);
        metadata.updateCreatorPresentation(ARTIST_ID, profileV1, socialV1);

        CatalogMetadataRegistry420.CreatorPresentation420 memory first = metadata.creatorPresentation(ARTIST_ID);
        require(first.profileManifestHash == profileV1, "profile v1");
        require(first.socialLinksHash == socialV1, "social v1");
        require(first.revision == 1, "creator revision 1");

        bytes32 profileV2 = keccak256("artist-profile-v2");
        vm.prank(ARTIST);
        metadata.updateCreatorPresentation(ARTIST_ID, profileV2, bytes32(0));
        CatalogMetadataRegistry420.CreatorPresentation420 memory second = metadata.creatorPresentation(ARTIST_ID);
        require(second.profileManifestHash == profileV2, "profile v2");
        require(second.socialLinksHash == bytes32(0), "social clear");
        require(second.revision == 2, "creator revision 2");
    }

    function testCreatorCanPublishVersionedReleasePresentation() public {
        bytes32 presentationV1 = keccak256("release-presentation-v1");
        bytes32 discoverabilityV1 = keccak256("release-tags-v1");
        bytes32 idsV1 = keccak256("release-external-ids-v1");
        vm.prank(ARTIST);
        metadata.updateReleasePresentation(RELEASE_ID, presentationV1, discoverabilityV1, idsV1);

        CatalogMetadataRegistry420.ReleasePresentation420 memory first = metadata.releasePresentation(RELEASE_ID);
        require(first.presentationHash == presentationV1, "presentation v1");
        require(first.discoverabilityHash == discoverabilityV1, "discoverability v1");
        require(first.externalIdsHash == idsV1, "ids v1");
        require(first.revision == 1, "release revision 1");

        bytes32 presentationV2 = keccak256("release-presentation-v2");
        vm.prank(ARTIST);
        metadata.updateReleasePresentation(RELEASE_ID, presentationV2, discoverabilityV1, idsV1);
        CatalogMetadataRegistry420.ReleasePresentation420 memory second = metadata.releasePresentation(RELEASE_ID);
        require(second.presentationHash == presentationV2, "presentation v2");
        require(second.revision == 2, "release revision 2");
    }

    function testUnauthorizedAccountCannotMutateCreatorPresentation() public {
        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(STRANGER);
        metadata.updateCreatorPresentation(ARTIST_ID, keccak256("profile"), bytes32(0));
    }

    function testUnauthorizedAccountCannotMutateReleasePresentation() public {
        vm.expectRevert(CreativeErrors420.Unauthorized.selector);
        vm.prank(STRANGER);
        metadata.updateReleasePresentation(RELEASE_ID, keccak256("presentation"), bytes32(0), bytes32(0));
    }

    function testCreatorPresentationRequiresCanonicalManifest() public {
        vm.expectRevert(CreativeErrors420.InvalidId.selector);
        vm.prank(ARTIST);
        metadata.updateCreatorPresentation(ARTIST_ID, bytes32(0), bytes32(0));
    }

    function testReleasePresentationRequiresCanonicalManifest() public {
        vm.expectRevert(CreativeErrors420.InvalidId.selector);
        vm.prank(ARTIST);
        metadata.updateReleasePresentation(RELEASE_ID, bytes32(0), keccak256("tags"), keccak256("ids"));
    }

    function testUnknownReleaseCannotReceiveOrReturnMetadata() public {
        vm.expectRevert(CreativeErrors420.NotFound.selector);
        vm.prank(ARTIST);
        metadata.updateReleasePresentation(999, keccak256("presentation"), bytes32(0), bytes32(0));

        vm.expectRevert(CreativeErrors420.NotFound.selector);
        metadata.releasePresentation(999);
    }
}
