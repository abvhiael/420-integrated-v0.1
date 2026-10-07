// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeErrors420.sol";
import "../core/CreativeProtocolRegistry420.sol";
import "../core/CreatorProfileRegistry420.sol";
import "../music/WorkRegistry420.sol";
import "../music/RecordingRegistry420.sol";
import "../rights/ContributorRegistry420.sol";
import "../rights/RightsRegistry420.sol";
import "../rights/AuthorizationRegistry420.sol";
import "../rights/LicenseRegistry420.sol";
import "../economics/RoyaltyScheduleRegistry420.sol";
import "../economics/RoyaltyVault420.sol";
import "../economics/RoyaltyRouter420.sol";
import "../catalog/CatalogRegistry420.sol";
import "../catalog/CatalogMetadataRegistry420.sol";
import "../media/MediaManifestRegistry420.sol";
import "../media/StorageSourceRegistry420.sol";
import "../media/PlaybackResolver420.sol";
import "../media/PlaybackAccounting420.sol";
import "../economics/StreamingSettlementEpoch420.sol";
import "../economics/StreamingRevenueAllocator420.sol";
import "../economics/StreamingRoyaltySettlement420.sol";

/// @notice Canonical HZ-1..HZ-4 constructor graph used by deployment tooling and qualification.
/// @dev This library only materializes immutable constructor dependencies. Governance-only wiring,
///      submitter authorization, STREAM economics and external ProtocolRegistry publication are
///      deliberately separate post-deployment phases.
library HzDeploymentGraph420 {
    struct Deployment {
        CreativeProtocolRegistry420 creativeProtocolRegistry;
        CreatorProfileRegistry420 creatorProfileRegistry;
        WorkRegistry420 workRegistry;
        RecordingRegistry420 recordingRegistry;
        ContributorRegistry420 contributorRegistry;
        RightsRegistry420 rightsRegistry;
        AuthorizationRegistry420 authorizationRegistry;
        LicenseRegistry420 licenseRegistry;
        RoyaltyScheduleRegistry420 royaltyScheduleRegistry;
        RoyaltyVault420 royaltyVault;
        RoyaltyRouter420 royaltyRouter;
        CatalogRegistry420 catalogRegistry;
        CatalogMetadataRegistry420 catalogMetadataRegistry;
        MediaManifestRegistry420 mediaManifestRegistry;
        StorageSourceRegistry420 storageSourceRegistry;
        PlaybackResolver420 playbackResolver;
        PlaybackAccounting420 playbackAccounting;
        StreamingSettlementEpoch420 streamingSettlementEpoch;
        StreamingRevenueAllocator420 streamingRevenueAllocator;
        StreamingRoyaltySettlement420 streamingRoyaltySettlement;
    }

    function deploy(address governanceTimelock, address protocolTreasury)
        internal
        returns (Deployment memory d)
    {
        if (governanceTimelock == address(0) || protocolTreasury == address(0)) {
            revert CreativeErrors420.ZeroAddress();
        }

        d.creativeProtocolRegistry = new CreativeProtocolRegistry420(governanceTimelock);
        d.creatorProfileRegistry = new CreatorProfileRegistry420(governanceTimelock);
        d.workRegistry = new WorkRegistry420(governanceTimelock, address(d.creatorProfileRegistry));
        d.recordingRegistry = new RecordingRegistry420(
            governanceTimelock,
            address(d.creatorProfileRegistry),
            address(d.workRegistry)
        );
        d.contributorRegistry = new ContributorRegistry420(
            address(d.creatorProfileRegistry),
            address(d.workRegistry),
            address(d.recordingRegistry)
        );
        d.rightsRegistry = new RightsRegistry420(
            governanceTimelock,
            address(d.creatorProfileRegistry),
            address(d.workRegistry),
            address(d.recordingRegistry)
        );
        d.authorizationRegistry = new AuthorizationRegistry420(
            governanceTimelock,
            address(d.creatorProfileRegistry),
            address(d.workRegistry),
            address(d.recordingRegistry)
        );
        d.licenseRegistry = new LicenseRegistry420(
            governanceTimelock,
            address(d.creatorProfileRegistry),
            address(d.recordingRegistry)
        );
        d.royaltyScheduleRegistry = new RoyaltyScheduleRegistry420(governanceTimelock);
        d.royaltyVault = new RoyaltyVault420(
            governanceTimelock,
            address(d.rightsRegistry),
            address(d.creatorProfileRegistry),
            protocolTreasury
        );
        d.royaltyRouter = new RoyaltyRouter420(
            governanceTimelock,
            address(d.recordingRegistry),
            address(d.royaltyScheduleRegistry),
            address(d.royaltyVault)
        );

        d.catalogRegistry = new CatalogRegistry420(
            address(d.creatorProfileRegistry),
            address(d.recordingRegistry)
        );
        d.catalogMetadataRegistry = new CatalogMetadataRegistry420(
            address(d.creatorProfileRegistry),
            address(d.catalogRegistry)
        );

        d.mediaManifestRegistry = new MediaManifestRegistry420(
            address(d.recordingRegistry),
            address(d.creatorProfileRegistry)
        );
        d.storageSourceRegistry = new StorageSourceRegistry420(
            address(d.recordingRegistry),
            address(d.creatorProfileRegistry)
        );
        d.playbackResolver = new PlaybackResolver420(
            address(d.mediaManifestRegistry),
            address(d.storageSourceRegistry)
        );
        d.playbackAccounting = new PlaybackAccounting420(
            governanceTimelock,
            address(d.recordingRegistry)
        );

        d.streamingSettlementEpoch = new StreamingSettlementEpoch420(
            governanceTimelock,
            address(d.playbackAccounting)
        );
        d.streamingRevenueAllocator = new StreamingRevenueAllocator420(
            address(d.streamingSettlementEpoch),
            address(d.playbackAccounting)
        );
        d.streamingRoyaltySettlement = new StreamingRoyaltySettlement420(
            address(d.streamingRevenueAllocator),
            address(d.royaltyRouter)
        );
    }
}
